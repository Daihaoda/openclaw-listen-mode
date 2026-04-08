/**
 * Dynamic timeout calculator v2.
 *
 * Four-layer rule-based calculation (zero LLM cost):
 * 1. Base timeout (7s)
 * 2. Message length bonus (long messages → more wait)
 * 3. Punctuation/completeness multiplier
 * 4. Sending pace trend multiplier
 * + Voice message bonus
 *
 * Formula: timeout = (base + lengthBonus + voiceBonus) × punctuation × trend
 * Clamped to [minMs, maxMs]
 */

export interface DynamicTimeoutConfig {
  /** Minimum timeout in ms (floor) */
  minTimeoutMs: number;
  /** Maximum timeout in ms (ceiling) */
  maxTimeoutMs: number;
  /** Base timeout in ms */
  baseMs: number;
  /** Multiplier applied to average message interval (legacy, used as fallback) */
  multiplier: number;
  /** Fallback timeout when not enough data */
  fallbackMs: number;
  /** Extra ms to add when last message was voice */
  voiceExtraMs: number;
  /** Character count threshold for length bonus */
  lengthThreshold: number;
  /** Bonus ms added when last message exceeds lengthThreshold */
  lengthBonusMs: number;
  /** Punctuation multipliers */
  punctuation: {
    /** Sentence-ending punctuation (。！!.) → likely done */
    complete: number;
    /** Question mark (？?) → waiting for answer, respond fast */
    question: number;
    /** Incomplete (，,...…) → still thinking */
    incomplete: number;
  };
  /** Pace trend detection */
  trend: {
    /** Multiplier when intervals are shrinking (user speeding up) */
    accelerating: number;
    /** Multiplier when intervals are growing (user slowing down) */
    decelerating: number;
    /** Minimum diff in ms to detect a trend */
    thresholdMs: number;
  };
}

export const DEFAULT_DYNAMIC_TIMEOUT: DynamicTimeoutConfig = {
  minTimeoutMs: 2000,
  maxTimeoutMs: 30000,
  baseMs: 7000,
  multiplier: 3,
  fallbackMs: 7000,
  voiceExtraMs: 15000,
  lengthThreshold: 30,
  lengthBonusMs: 5000,
  punctuation: {
    complete: 0.5,
    question: 0.3,
    incomplete: 1.5,
  },
  trend: {
    accelerating: 1.3,
    decelerating: 0.7,
    thresholdMs: 2000,
  },
};

/**
 * Detect punctuation type of the last character.
 * Returns a multiplier: <1 = likely done, >1 = likely not done.
 */
function getPunctuationMultiplier(text: string, config: DynamicTimeoutConfig): number {
  const trimmed = text.trim();
  if (!trimmed) return 1.0;

  // Check multi-char patterns first (before single-char check)
  // Ellipsis → still thinking
  if (trimmed.endsWith('...') || trimmed.endsWith('…') || trimmed.endsWith('。。。')) {
    return config.punctuation.incomplete;
  }

  const lastChar = trimmed.slice(-1);

  // Question mark → respond fast
  if ('？?'.includes(lastChar)) {
    return config.punctuation.question;
  }

  // Complete sentence punctuation
  if ('。！!.'.includes(lastChar)) {
    return config.punctuation.complete;
  }

  // Incomplete indicators (comma etc.)
  if ('，,、'.includes(lastChar)) {
    return config.punctuation.incomplete;
  }

  return 1.0;
}

/**
 * Detect sending pace trend from message timestamps.
 * Returns a multiplier: >1 = accelerating (wait longer), <1 = decelerating (wait less).
 */
function getTrendMultiplier(timestamps: number[], config: DynamicTimeoutConfig): number {
  if (timestamps.length < 3) return 1.0;

  const intervals: number[] = [];
  const start = Math.max(0, timestamps.length - 4);
  for (let i = start + 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }

  if (intervals.length < 2) return 1.0;

  const latest = intervals[intervals.length - 1];
  const earliest = intervals[0];
  const diff = latest - earliest;

  if (diff < -config.trend.thresholdMs) {
    return config.trend.accelerating; // Intervals shrinking → user speeding up
  } else if (diff > config.trend.thresholdMs) {
    return config.trend.decelerating; // Intervals growing → user slowing down
  }

  return 1.0;
}

/**
 * Calculate dynamic silence timeout based on message content and timing.
 *
 * @param messageTimestamps - timestamps of buffered messages
 * @param config - timeout configuration
 * @param lastMessageIsVoice - whether the last message was a voice message
 * @param lastMessageText - text content of the last message (for length + punctuation analysis)
 */
export function calculateDynamicTimeout(
  messageTimestamps: number[],
  config: DynamicTimeoutConfig = DEFAULT_DYNAMIC_TIMEOUT,
  lastMessageIsVoice: boolean = false,
  lastMessageText: string = '',
): number {
  // ─── Base timeout ───
  let timeout = config.baseMs;

  // ─── 1. Message length bonus ───
  if (lastMessageText.length > config.lengthThreshold) {
    timeout += config.lengthBonusMs;
  }

  // ─── 2. Voice message bonus ───
  if (lastMessageIsVoice) {
    timeout += config.voiceExtraMs;
  }

  // ─── 3. Punctuation multiplier ───
  const punctMultiplier = getPunctuationMultiplier(lastMessageText, config);
  timeout *= punctMultiplier;

  // ─── 4. Pace trend multiplier ───
  const trendMultiplier = getTrendMultiplier(messageTimestamps, config);
  timeout *= trendMultiplier;

  // ─── Clamp to bounds ───
  return Math.max(config.minTimeoutMs, Math.min(config.maxTimeoutMs, timeout));
}
