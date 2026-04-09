import type { ListenModeConfig } from '../types/config.js';

export const DEFAULT_CONFIG: ListenModeConfig = {
  triggerMode: 'both',
  silenceTimeoutMs: 20000,
  maxListenTimeMs: 300000,
  maxBufferMessages: 20,
  sensitivity: 'high',
  languages: ['zh', 'en'],
  systemHint: true,
  ack: {
    entryReply: true,
    intervalMessages: [5, 7],
    intervalMs: [30000, 60000],
    useLLM: true,
    llmModel: 'haiku',
    llmTimeoutMs: 2000,
  },
  reply: {
    splitEnabled: true,
    maxCharsPerMessage: 50,
    delayBaseMs: 1500,
    delayPerCharMs: 150,
    delayRandomMs: 1000,
  },
  emoji: {
    enabled: true,
    frequency: 'moderate',
    stickerEnabled: false,
    stickerDir: '~/.openclaw/stickers/',
  },
  byChannel: {},
  // Phase 3
  intelligence: {
    intentClassification: true,
    classificationModel: 'auto',
    classificationTimeoutMs: 1000,
    fallbackToKeywords: true,
  },
  dynamicTimeout: {
    enabled: true,
    minMs: 10000,
    maxMs: 30000,
    multiplier: 3,
    voiceExtraMs: 15000,
  },
  emotionLevel: {
    enabled: true,
    affectBehavior: true,
  },
  persona: {
    default: 'warm-friend',
    allowSwitch: true,
    customDir: '~/.openclaw/personas/',
  },
  session: {
    enabled: true,
    maxDurationMs: 600000,
    maxRounds: 5,
  },
  stats: {
    enabled: true,
    storagePath: '~/.openclaw/listen-mode/stats.json',
  },
  completenessCheck: {
    enabled: true,
    model: 'auto',
    timeoutMs: 1500,
    maxExtensions: 2,
    extensionMs: 7000,
  },
};
