export { ListenModePlugin } from './plugin.js';

// OpenClaw plugin entry point
import { ListenModePlugin } from './plugin.js';
import type { InboundMessage } from './types/message.js';

interface PluginApi {
  registrationMode: string;
  pluginConfig: Record<string, unknown>;
  config: Record<string, unknown>;
  logger: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
  registerHook: (events: string, handler: (...args: any[]) => any, opts?: { name?: string; description?: string }) => void;
  registerTool: (...args: any[]) => void;
  on: (event: string, handler: (...args: any[]) => any, opts?: { name?: string }) => void;
  [key: string]: unknown;
}

// Default export for OpenClaw full-mode loading
export default function (api: PluginApi): void {
  api.logger.info(`listen-mode: register called, registrationMode=${api.registrationMode}`);

  const pluginConfig = api.pluginConfig ?? {};
  const plugin = new ListenModePlugin(pluginConfig as any);
  let initialized = false;

  const ensureInit = async (ctx: any): Promise<void> => {
    if (!initialized) {
      const gatewayCtx = {
        sendToUser: ctx.sendText?.bind(ctx) ?? ctx.reply?.bind(ctx) ?? (async (_id: string, content: string) => {
          api.logger.warn('listen-mode: no sendText/reply available, message lost:', content);
        }),
        sendToAgent: async (_senderId: string, content: string) => content,
        callLLM: ctx.callLLM?.bind(ctx) ?? (async () => ''),
        logger: api.logger,
      };
      await plugin.init(gatewayCtx as any);
      initialized = true;
      api.logger.info('listen-mode: initialized on first message');
    }
  };

  const buildMessage = (ctx: any): InboundMessage => ({
    id: ctx.message?.id ?? `msg-${Date.now()}`,
    senderId: ctx.session?.contactId ?? ctx.message?.from ?? 'unknown',
    content: ctx.message?.text ?? ctx.message?.content ?? '',
    timestamp: ctx.message?.timestamp ?? Date.now(),
    type: 'text',
    groupId: ctx.session?.groupId ?? ctx.message?.groupId,
    mentionsBot: ctx.message?.mentionsBot ?? true,
  });

  // Hook: before_dispatch — claiming hook, fires before model dispatch for ALL messages
  // "First handler returning { handled: true } wins"
  api.registerHook('before_dispatch', async (ctx: any) => {
    api.logger.info('listen-mode: before_dispatch fired');
    await ensureInit(ctx);
    const message = buildMessage(ctx);
    const result = await plugin.onInboundMessage(message);
    if (result === 'handled') {
      api.logger.info('listen-mode: claimed turn via before_dispatch');
      return { handled: true };
    }
    return undefined;
  }, {
    name: 'listen-mode.before-dispatch',
    description: 'Intercepts messages for empathic listen mode before dispatch',
  });

  // Hook: before_agent_reply — claiming hook, fires before agent reply
  api.registerHook('before_agent_reply', async (ctx: any) => {
    api.logger.info('listen-mode: before_agent_reply fired');
    await ensureInit(ctx);
    const message = buildMessage(ctx);
    const result = await plugin.onInboundMessage(message);
    if (result === 'handled') {
      api.logger.info('listen-mode: claimed turn via before_agent_reply');
      return { handled: true };
    }
    return undefined;
  }, {
    name: 'listen-mode.before-agent-reply',
    description: 'Intercepts messages before agent replies for listen mode',
  });

  // Hook: inbound_claim — for plugin-owned bindings
  api.registerHook('inbound_claim', async (ctx: any) => {
    api.logger.info('listen-mode: inbound_claim fired');
    await ensureInit(ctx);
    const message = buildMessage(ctx);
    const result = await plugin.onInboundMessage(message);
    if (result === 'handled') {
      return { handled: true };
    }
    return undefined;
  }, {
    name: 'listen-mode.inbound-claim',
    description: 'Claims inbound messages for listen mode',
  });

  // Hook: message_received — fire-and-forget, for logging/state tracking
  api.registerHook('message_received', async (_ctx: any) => {
    api.logger.info('listen-mode: message_received fired');
  }, {
    name: 'listen-mode.message-received',
    description: 'Tracks received messages for listen mode state',
  });

  // Hook: intercept outbound messages for splitting
  api.registerHook('message_sending', async (ctx: any) => {
    const outbound = {
      senderId: ctx.session?.contactId ?? 'unknown',
      content: ctx.message?.text ?? ctx.message?.content ?? '',
      type: 'text' as const,
    };
    const result = await plugin.onOutboundMessage(outbound);
    if (Array.isArray(result)) {
      for (const msg of result) {
        if (msg.type === 'sticker') {
          await ctx.sendSticker?.(msg.stickerCategory);
        } else {
          await ctx.sendText?.(msg.content);
        }
      }
      return { cancel: true };
    }
    return undefined;
  }, {
    name: 'listen-mode.message-sending',
    description: 'Splits outbound messages for natural chat delivery',
  });

  api.logger.info('listen-mode: all hooks registered');
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
