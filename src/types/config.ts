export type TriggerMode = 'manual' | 'auto' | 'both';
export type Sensitivity = 'low' | 'medium' | 'high';
export type EmojiFrequency = 'low' | 'moderate' | 'high';

export interface AckConfig {
  entryReply: boolean;
  intervalMessages: [number, number];
  intervalMs: [number, number];
  useLLM: boolean;
  llmModel: string;
  llmTimeoutMs: number;
}

export interface ReplyConfig {
  splitEnabled: boolean;
  maxCharsPerMessage: number;
  delayBaseMs: number;
  delayPerCharMs: number;
  delayRandomMs: number;
}

export interface EmojiConfig {
  enabled: boolean;
  frequency: EmojiFrequency;
  stickerEnabled: boolean;
  stickerDir: string;
}

/** Phase 3: Intent classification config */
export interface IntelligenceConfig {
  intentClassification: boolean;
  classificationModel: string;
  classificationTimeoutMs: number;
  fallbackToKeywords: boolean;
}

/** Phase 3: Dynamic timeout config */
export interface DynamicTimeoutConfigOptions {
  enabled: boolean;
  minMs: number;
  maxMs: number;
  multiplier: number;
  /** Extra time added when the last message was a voice message (ms) */
  voiceExtraMs: number;
}

/** Phase 3: Emotion level config */
export interface EmotionLevelConfig {
  enabled: boolean;
  affectBehavior: boolean;
}

/** Phase 3: Persona config */
export interface PersonaConfigOptions {
  default: string;
  allowSwitch: boolean;
  customDir: string;
}

/** Phase 3: Multi-round session config */
export interface SessionConfigOptions {
  enabled: boolean;
  maxDurationMs: number;
  maxRounds: number;
}

/** Phase 3: Stats config */
export interface StatsConfigOptions {
  enabled: boolean;
  storagePath: string;
}

/** Phase 4: LLM completeness check config */
export interface CompletenessCheckConfig {
  enabled: boolean;
  model: string;
  timeoutMs: number;
  maxExtensions: number;
  extensionMs: number;
}

export interface ListenModeConfig {
  triggerMode: TriggerMode;
  silenceTimeoutMs: number;
  maxListenTimeMs: number;
  maxBufferMessages: number;
  sensitivity: Sensitivity;
  languages: string[];
  systemHint: boolean;
  ack: AckConfig;
  reply: ReplyConfig;
  emoji: EmojiConfig;
  byChannel: Record<string, Partial<ListenModeConfig>>;
  // Phase 3
  intelligence: IntelligenceConfig;
  dynamicTimeout: DynamicTimeoutConfigOptions;
  emotionLevel: EmotionLevelConfig;
  persona: PersonaConfigOptions;
  session: SessionConfigOptions;
  stats: StatsConfigOptions;
  completenessCheck: CompletenessCheckConfig;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
