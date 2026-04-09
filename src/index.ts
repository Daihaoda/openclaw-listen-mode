export { ListenModePlugin } from './plugin.js';

// ─── OpenClaw Plugin Entry: Listen Mode v3 ───
// Intercept + Buffer + Debounce + Semantic Judge + runEmbeddedPiAgent
//
// Flow:
//   message → before_dispatch → { handled: true }
//   → buffer + 2s debounce + parallel semantic judge
//   → DONE: trigger immediately / WAIT: extend 3s
//   → runEmbeddedPiAgent (OpenClaw pipeline: session + memory)
//   → extract reply → send via channel API

// ─── Types ───

interface PluginApi {
  registrationMode: string;
  pluginConfig?: Record<string, unknown>;
  config: Record<string, unknown> & {
    models?: { providers?: Record<string, { baseUrl?: string; apiKey?: string; models?: { id: string }[] }> };
    channels?: { telegram?: { botToken?: string } };
  };
  runtime: {
    agent: {
      runEmbeddedPiAgent: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
      resolveAgentDir: (params: Record<string, unknown>) => string;
      resolveAgentWorkspaceDir: (params: Record<string, unknown>) => string;
      session: {
        loadSessionStore: (params: Record<string, unknown>) => Record<string, unknown>;
        resolveSessionFilePath: (...args: unknown[]) => string;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  logger: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
  on: (event: string, handler: (...args: unknown[]) => unknown) => void;
  [key: string]: unknown;
}

interface SenderState {
  messages: { content: string; timestamp: number }[];
  timer: ReturnType<typeof setTimeout> | null;
  abortController: AbortController | null;
  judgeAbort: AbortController | null;
  state: 'idle' | 'buffering' | 'waiting' | 'triggering';
}

// ─── Config ───

const DEBOUNCE_MS = 2000;
const WAIT_EXTEND_MS = 3000;
const JUDGE_TIMEOUT_MS = 3000;
const SKIP_JUDGE_CHARS = 5;

// ─── Plugin Entry ───

export default function (api: PluginApi): void {
  api.logger.info(`listen-mode: register called, registrationMode=${api.registrationMode}`);

  const on = api.on?.bind(api);
  if (!on) { api.logger.error('listen-mode: api.on() not available'); return; }

  const senderState = new Map<string, SenderState>();

  // Cache LLM provider config
  const providers = (api.config?.models as any)?.providers ?? {};
  const pName = Object.keys(providers)[0] ?? 'minimax';
  const pCfg = providers[pName] ?? {};
  const baseUrl: string = pCfg.baseUrl ?? 'https://api.minimax.io/anthropic';
  const apiKey: string = pCfg.apiKey ?? '';
  const model: string = pCfg.models?.[0]?.id ?? 'MiniMax-M2.7';
  const botToken: string = (api.config?.channels as any)?.telegram?.botToken ?? '';

  // ─── Semantic Judge ───

  async function runJudge(buffer: string[], signal: AbortSignal): Promise<'DONE' | 'WAIT'> {
    const bufferText = buffer.map((msg, i) => `[${i + 1}] ${msg}`).join('\n');
    const prompt = `你是一个消息完整性判断器。
用户向 AI 助手发送了以下消息序列（按时间顺序）。

判断用户是否已经说完，可以让 AI 回复了。

输出规则：
- 只输出 DONE 或 WAIT，不要任何其他内容
- DONE：当前内容已足够理解用户意图，AI 可以有价值地回复
- WAIT：内容明显是铺垫 / 开头 / 句子逻辑不完整，等用户说完更好

判断时优先考虑：
1. 最后一条消息是否像一个"收尾"还是"开头"
2. 消息整体是否构成一个完整的意图或问题
3. 有疑虑时，输出 WAIT（保守原则）

用户消息序列：
${bufferText}`;

    try {
      const res = await fetch(baseUrl + '/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 100, messages: [{ role: 'user', content: prompt }] }),
        signal,
      });
      const data = await res.json() as any;
      const textContent: string = data?.content?.find((c: any) => c.type === 'text')?.text ?? '';
      const thinkContent: string = data?.content?.find((c: any) => c.type === 'thinking')?.thinking ?? '';

      let text = textContent.trim().toUpperCase();
      if (!text.startsWith('DONE') && !text.startsWith('WAIT')) {
        const thinkUpper = thinkContent.toUpperCase();
        if (thinkUpper.includes('输出 DONE') || thinkUpper.includes('OUTPUT DONE') || thinkUpper.includes('SHOULD BE DONE') || thinkUpper.includes('应该输出 DONE')) {
          text = 'DONE';
        } else if (thinkUpper.includes('输出 WAIT') || thinkUpper.includes('OUTPUT WAIT') || thinkUpper.includes('SHOULD BE WAIT') || thinkUpper.includes('应该输出 WAIT')) {
          text = 'WAIT';
        }
      }
      if (text.startsWith('DONE')) return 'DONE';
      return 'WAIT';
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'WAIT';
      api.logger.warn('listen-mode: judge error', e?.message);
      return 'WAIT';
    }
  }

  async function runJudgeWithTimeout(buffer: string[], signal: AbortSignal): Promise<'DONE' | 'WAIT'> {
    return Promise.race([
      runJudge(buffer, signal),
      new Promise<'WAIT'>(resolve => setTimeout(() => resolve('WAIT'), JUDGE_TIMEOUT_MS)),
    ]);
  }

  // ─── AI Trigger ───

  async function triggerAI(senderId: string): Promise<void> {
    const state = senderState.get(senderId);
    if (!state || state.messages.length === 0) return;

    state.state = 'triggering';
    const merged = state.messages.map(m => m.content).join('\n');
    api.logger.info(`listen-mode: triggering AI for ${senderId}, msgs=${state.messages.length}`);

    const ac = new AbortController();
    state.abortController = ac;

    try {
      const agent = api.runtime?.agent;
      const agentDir = agent?.resolveAgentDir?.({ cfg: api.config }) ?? '';
      const workspaceDir = agent?.resolveAgentWorkspaceDir?.({ cfg: api.config }) ?? agentDir;
      const path = await import('node:path');
      const fs = await import('node:fs');
      const sessionsDir = path.join(agentDir, '..', 'sessions');
      const storeFile = path.join(sessionsDir, 'sessions.json');
      const store = JSON.parse(fs.readFileSync(storeFile, 'utf8'));

      // Resolve session
      let sessionKey = '';
      let realSessionId = '';
      let sessionFilePath = '';
      for (const [key, entry] of Object.entries(store) as [string, any][]) {
        if (entry.lastTo === 'telegram:' + senderId || entry.origin?.from === 'telegram:' + senderId) {
          sessionKey = key;
          realSessionId = entry.sessionId;
          sessionFilePath = path.join(sessionsDir, realSessionId + '.jsonl');
          break;
        }
      }
      if (!sessionKey) {
        sessionKey = 'agent:main:main';
        const entry = store[sessionKey] as any;
        if (entry?.sessionId) {
          realSessionId = entry.sessionId;
          sessionFilePath = path.join(sessionsDir, realSessionId + '.jsonl');
        }
      }

      const result = await agent.runEmbeddedPiAgent({
        sessionId: realSessionId,
        sessionKey,
        prompt: merged,
        sessionFile: sessionFilePath,
        workspaceDir,
        agentDir: agentDir || undefined,
        config: api.config,
        provider: pName,
        model,
        timeoutMs: 60000,
        runId: 'listen-' + Date.now(),
        trigger: 'user',
        abortSignal: ac.signal,
        senderId: String(senderId),
        messageTo: 'telegram:' + senderId,
        messageChannel: 'telegram',
        agentAccountId: 'default',
      }) as any;

      if (ac.signal.aborted) return;

      // Extract reply
      const sentTexts: string[] = result?.messagingToolSentTexts ?? [];
      const payloads: any[] = result?.payloads ?? [];
      let replyText = sentTexts[0] ?? '';
      if (!replyText && payloads.length > 0) {
        replyText = payloads.map((p: any) => p.text).filter(Boolean).join('\n');
      }

      state.messages = [];
      state.abortController = null;
      state.state = 'idle';

      // Agent sends via message tool (multi-bubble). Only Bot API fallback if agent didn't send.
      const agentSent = result?.didSendViaMessagingTool || (sentTexts.length > 0);
      if (!agentSent && replyText && botToken) {
        await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: senderId, text: replyText }),
        });
      }

    } catch (e: any) {
      if (e?.name === 'AbortError' || ac.signal.aborted) return;
      api.logger.warn('listen-mode: agent error, falling back to direct HTTP', e?.message);

      // Fallback: direct HTTP
      try {
        const res = await fetch(baseUrl + '/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: merged }] }),
        });
        const data = await res.json() as any;
        const reply: string = data?.content?.find((c: any) => c.type === 'text')?.text ?? '';
        if (reply && botToken) {
          await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: senderId, text: reply }),
          });
        }
      } catch (fe: any) { api.logger.error('listen-mode: fallback error', fe?.message); }

      state.messages = [];
      state.abortController = null;
      state.state = 'idle';
    }
  }

  // ─── Judge with Side Effects ───

  async function runJudgeWithEffect(senderId: string, signal: AbortSignal): Promise<void> {
    const state = senderState.get(senderId);
    if (!state || state.state !== 'buffering') return;

    const bufferSnapshot = state.messages.map(m => m.content);
    const result = await runJudgeWithTimeout(bufferSnapshot, signal);

    if (signal.aborted) return;
    if (state.state !== 'buffering' && state.state !== 'waiting') return;

    if (result === 'DONE') {
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      triggerAI(senderId);
    } else {
      if (state.timer) clearTimeout(state.timer);
      state.state = 'waiting';
      state.timer = setTimeout(() => { state.timer = null; triggerAI(senderId); }, WAIT_EXTEND_MS);
    }
  }

  // ─── Main Dispatch Handler ───

  on('before_dispatch', async (event: any, ctx: any) => {
    const content = event.content ?? '';
    const senderId = event.senderId ?? ctx?.senderId ?? 'unknown';

    let state = senderState.get(senderId);
    if (!state) {
      state = { messages: [], timer: null, abortController: null, judgeAbort: null, state: 'idle' };
      senderState.set(senderId, state);
    }

    // Abort existing AI call if in progress
    if (state.state === 'triggering' && state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }

    // Cancel old judge
    if (state.judgeAbort) state.judgeAbort.abort();
    state.judgeAbort = new AbortController();

    // Skip duplicate content
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg && lastMsg.content === content) {
      return { handled: true };
    }

    // Buffer
    state.messages.push({ content, timestamp: Date.now() });
    state.state = 'buffering';

    // Debounce timer
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => { state.timer = null; triggerAI(senderId); }, DEBOUNCE_MS);

    // Parallel semantic judge (fire-and-forget)
    const shouldSkipJudge = state.messages.length === 1 && content.length <= SKIP_JUDGE_CHARS;
    if (!shouldSkipJudge) {
      void runJudgeWithEffect(senderId, state.judgeAbort.signal);
    }

    return { handled: true };
  });

  api.logger.info('listen-mode: v3 registered (debounce + semantic judge + runEmbeddedPiAgent)');
}

// ─── Re-exports ───

export type {
  ListenModeConfig,
  DeepPartial,
  TriggerMode,
  Sensitivity,
  AckConfig,
  ReplyConfig,
  EmojiConfig,
  IntelligenceConfig,
  DynamicTimeoutConfigOptions,
  EmotionLevelConfig,
  PersonaConfigOptions,
  SessionConfigOptions,
  StatsConfigOptions,
} from './types/config.js';
export type {
  InboundMessage,
  OutboundMessage,
  SplitMessage,
} from './types/message.js';
export type {
  OpenClawPlugin,
  GatewayContext,
  SendOptions,
  SendToAgentOptions,
  LLMCallOptions,
  Logger,
} from './types/plugin-api.js';
export { ListenState } from './types/state.js';
export type { SessionState, TriggerResult, ExitResult, ExitReason, DetectedLanguage } from './types/state.js';
export { DEFAULT_CONFIG } from './config/defaults.js';
export { AnalyticsEmitter } from './core/analytics.js';
export type { ListenSessionEvent, ListenModeAnalytics } from './core/analytics.js';
export { scoreEmotion, aggregateEmotionScore } from './core/emotion-scorer.js';
export type { EmotionScore, EmotionLevel } from './core/emotion-scorer.js';
export { calculateDynamicTimeout, DEFAULT_DYNAMIC_TIMEOUT } from './core/dynamic-timeout.js';
export type { DynamicTimeoutConfig } from './core/dynamic-timeout.js';
export { classifyIntent } from './core/intent-classifier.js';
export type { ClassificationResult, Intent, EmotionIntensity, IntentClassifierConfig } from './core/intent-classifier.js';
export { PersonaManager, PRESET_PERSONAS } from './core/persona.js';
export type { PersonaDefinition, PersonaConfig } from './core/persona.js';
export { ListenSessionManager } from './core/listen-session.js';
export type { SessionConfig } from './core/listen-session.js';
export { StatsCollector } from './core/stats.js';
export type { ListenModeStats, StatsConfig } from './core/stats.js';
