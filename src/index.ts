export { ListenModePlugin } from './plugin.js';

// OpenClaw plugin entry point — uses correct (event, ctx) hook signatures
import { ListenModePlugin } from './plugin.js';
import type { InboundMessage } from './types/message.js';
import type { GatewayContext } from './types/plugin-api.js';

// ─── Types matching OpenClaw Plugin SDK ───

interface PluginApi {
  registrationMode: string;
  pluginConfig?: Record<string, unknown>;
  config: Record<string, unknown>;
  logger: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
  runtime: {
    sendMessage?: (to: string, text: string, opts?: Record<string, unknown>) => Promise<void>;
    callLLM?: (prompt: string, opts?: Record<string, unknown>) => Promise<string>;
    dispatchToAgent?: (sessionKey: string, content: string) => Promise<string>;
    [key: string]: unknown;
  };
  // api.on() is the correct hook registration method (not registerHook)
  on: (event: string, handler: (...args: any[]) => any) => void;
  registerHook?: (events: string | string[], handler: (...args: any[]) => any, opts?: Record<string, unknown>) => void;
  [key: string]: unknown;
}

// OpenClaw Hook event types (from plugin-sdk/src/plugins/types.d.ts)
interface BeforeDispatchEvent {
  content: string;
  body?: string;
  channel?: string;
  sessionKey?: string;
  senderId?: string;
  isGroup?: boolean;
  timestamp?: number;
}

interface BeforeAgentReplyEvent {
  cleanedBody: string;
}

interface MessageSendingEvent {
  to: string;
  content: string;
}

interface HookContext {
  channelId?: string;
  accountId?: string;
  conversationId?: string;
  sessionKey?: string;
  senderId?: string;
}

// ─── Plugin Entry ───

// Default export for OpenClaw full-mode loading
export default function (api: PluginApi): void {
  api.logger.info(`listen-mode: register called, registrationMode=${api.registrationMode}`);

  const pluginConfig = api.pluginConfig ?? {};
  const plugin = new ListenModePlugin(pluginConfig as any);
  let initialized = false;

  // Track senderId → sessionKey for routing sendToUser/sendToAgent
  const senderSessions = new Map<string, string>();

  const ensureInit = (): void => {
    if (initialized) return;

    const gatewayCtx: GatewayContext = {
      sendToUser: async (senderId: string, content: string) => {
        if (api.runtime?.sendMessage) {
          await api.runtime.sendMessage(senderId, content);
          return;
        }
        api.logger.warn('listen-mode: sendToUser — no runtime.sendMessage, message lost:', content);
      },
      sendToAgent: async (senderId: string, content: string) => {
        const sessionKey = senderSessions.get(senderId) ?? senderId;
        if (api.runtime?.dispatchToAgent) {
          return await api.runtime.dispatchToAgent(sessionKey, content);
        }
        api.logger.warn('listen-mode: sendToAgent — no runtime.dispatchToAgent, returning as-is');
        return content;
      },
      callLLM: async (prompt: string, opts?: Record<string, unknown>) => {
        if (api.runtime?.callLLM) {
          return await api.runtime.callLLM(prompt, opts);
        }
        api.logger.warn('listen-mode: callLLM — not available');
        return '';
      },
      logger: api.logger,
    };

    plugin.init(gatewayCtx);
    initialized = true;
    api.logger.info('listen-mode: initialized');
  };

  const buildMessage = (event: { content?: string; senderId?: string; isGroup?: boolean; timestamp?: number }, ctx?: HookContext): InboundMessage => ({
    id: `msg-${Date.now()}`,
    senderId: event.senderId ?? ctx?.senderId ?? 'unknown',
    content: event.content ?? '',
    timestamp: event.timestamp ?? Date.now(),
    type: 'text',
    groupId: undefined,
    mentionsBot: true,
  });

  // Use api.on() — the correct OpenClaw hook registration method
  const on = api.on?.bind(api);
  if (!on) {
    api.logger.error('listen-mode: api.on() not available, cannot register hooks');
    return;
  }

  // ─── Layer 1: before_dispatch — intercept message before agent dispatch ───
  on('before_dispatch', async (event: BeforeDispatchEvent, ctx: HookContext) => {
    api.logger.info(`listen-mode: before_dispatch, content="${(event.content ?? '').slice(0, 30)}"`);
    ensureInit();

    const senderId = event.senderId ?? ctx?.senderId ?? 'unknown';
    if (event.sessionKey) senderSessions.set(senderId, event.sessionKey);
    if (ctx?.sessionKey) senderSessions.set(senderId, ctx.sessionKey);

    const message = buildMessage(event, ctx);
    const result = await plugin.onInboundMessage(message);
    if (result === 'handled') {
      api.logger.info(`listen-mode: CLAIMED via before_dispatch for ${senderId}`);
      return { handled: true };
    }
    return undefined;
  });

  // ─── Layer 2: before_agent_reply — backup if dispatch wasn't blocked ───
  on('before_agent_reply', async (event: BeforeAgentReplyEvent, ctx: HookContext) => {
    ensureInit();

    // Only block if plugin is in LISTENING state for this sender
    const senderId = ctx?.senderId ?? 'unknown';
    const message = buildMessage({ content: event.cleanedBody, senderId }, ctx);
    const result = await plugin.onInboundMessage(message);
    if (result === 'handled') {
      api.logger.info(`listen-mode: BLOCKED agent reply for ${senderId}`);
      return { handled: true, reason: 'listen-mode active' };
    }
    return undefined;
  });

  // ─── message_sending — intercept outbound for reply splitting ───
  on('message_sending', async (event: MessageSendingEvent, _ctx: HookContext) => {
    const outbound = {
      senderId: event.to ?? 'unknown',
      content: event.content ?? '',
      type: 'text' as const,
    };
    const result = await plugin.onOutboundMessage(outbound);
    if (Array.isArray(result)) {
      return { content: result.map((m: any) => m.content).join('\n') };
    }
    return undefined;
  });

  api.logger.info('listen-mode: hooks registered via api.on() (before_dispatch + before_agent_reply)');
}

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
export {
  ListenState,
} from './types/state.js';
export type {
  SessionState,
  TriggerResult,
  ExitResult,
  ExitReason,
  DetectedLanguage,
} from './types/state.js';
export { DEFAULT_CONFIG } from './config/defaults.js';

// Analytics
export { AnalyticsEmitter } from './core/analytics.js';
export type { ListenSessionEvent, ListenModeAnalytics } from './core/analytics.js';

// Emotion scoring
export { scoreEmotion, aggregateEmotionScore } from './core/emotion-scorer.js';
export type { EmotionScore, EmotionLevel } from './core/emotion-scorer.js';

// Dynamic timeout
export { calculateDynamicTimeout, DEFAULT_DYNAMIC_TIMEOUT } from './core/dynamic-timeout.js';
export type { DynamicTimeoutConfig } from './core/dynamic-timeout.js';

// Intent classifier
export { classifyIntent } from './core/intent-classifier.js';
export type { ClassificationResult, Intent, EmotionIntensity, IntentClassifierConfig } from './core/intent-classifier.js';

// Persona system
export { PersonaManager, PRESET_PERSONAS } from './core/persona.js';
export type { PersonaDefinition, PersonaConfig } from './core/persona.js';

// Listen session
export { ListenSessionManager } from './core/listen-session.js';
export type { SessionConfig } from './core/listen-session.js';

// Stats
export { StatsCollector } from './core/stats.js';
export type { ListenModeStats, StatsConfig } from './core/stats.js';
