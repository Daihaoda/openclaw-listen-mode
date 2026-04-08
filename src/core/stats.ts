/**
 * Local usage statistics collection and storage.
 * No message content is stored — only counts and ratios.
 */

import type { ExitReason, TriggerType } from '../types/state.js';
import type { EmotionLevel } from './emotion-scorer.js';

export interface StatsConfig {
  enabled: boolean;
  storagePath: string;
}

export const DEFAULT_STATS_CONFIG: StatsConfig = {
  enabled: true,
  storagePath: '~/.openclaw/listen-mode/stats.json',
};

export interface ListenModeStats {
  /** Total sessions started */
  totalSessions: number;
  /** Sessions where user aborted ("没事", "算了") */
  abortedSessions: number;
  /** Trigger accuracy: 1 - (aborted / total) */
  triggerAccuracy: number;
  /** Average rounds per session */
  avgRoundsPerSession: number;
  /** Total rounds across all sessions */
  totalRounds: number;
  /** Cancel rate during split delivery */
  deliveryCancelCount: number;
  /** Total deliveries */
  totalDeliveries: number;
  /** Trigger type distribution */
  triggerTypes: Record<string, number>;
  /** Exit reason distribution */
  exitReasons: Record<string, number>;
  /** Emotion level distribution */
  emotionLevels: Record<string, number>;
  /** Persona usage distribution */
  personaUsage: Record<string, number>;
  /** Last reset timestamp */
  lastReset: number;
}

function createEmptyStats(): ListenModeStats {
  return {
    totalSessions: 0,
    abortedSessions: 0,
    triggerAccuracy: 1,
    avgRoundsPerSession: 0,
    totalRounds: 0,
    deliveryCancelCount: 0,
    totalDeliveries: 0,
    triggerTypes: {},
    exitReasons: {},
    emotionLevels: {},
    personaUsage: {},
    lastReset: Date.now(),
  };
}

export class StatsCollector {
  private stats: ListenModeStats;
  private readonly config: StatsConfig;

  constructor(config?: Partial<StatsConfig>) {
    this.config = { ...DEFAULT_STATS_CONFIG, ...config };
    this.stats = createEmptyStats();
  }

  recordSession(params: {
    triggerType: TriggerType;
    exitReason: ExitReason;
    emotionLevel: EmotionLevel;
    rounds: number;
    personaId: string;
    responseTriggered: boolean;
  }): void {
    if (!this.config.enabled) return;

    this.stats.totalSessions++;
    this.stats.totalRounds += params.rounds;

    if (!params.responseTriggered && params.exitReason === 'user_abort') {
      this.stats.abortedSessions++;
    }

    // Update accuracy
    this.stats.triggerAccuracy =
      this.stats.totalSessions > 0
        ? 1 - this.stats.abortedSessions / this.stats.totalSessions
        : 1;

    // Update average rounds
    this.stats.avgRoundsPerSession =
      this.stats.totalSessions > 0
        ? this.stats.totalRounds / this.stats.totalSessions
        : 0;

    // Distribution counters
    this.stats.triggerTypes[params.triggerType] =
      (this.stats.triggerTypes[params.triggerType] ?? 0) + 1;
    this.stats.exitReasons[params.exitReason] =
      (this.stats.exitReasons[params.exitReason] ?? 0) + 1;
    this.stats.emotionLevels[params.emotionLevel] =
      (this.stats.emotionLevels[params.emotionLevel] ?? 0) + 1;
    this.stats.personaUsage[params.personaId] =
      (this.stats.personaUsage[params.personaId] ?? 0) + 1;
  }

  recordDelivery(cancelled: boolean): void {
    if (!this.config.enabled) return;
    this.stats.totalDeliveries++;
    if (cancelled) {
      this.stats.deliveryCancelCount++;
    }
  }

  getStats(): ListenModeStats {
    return { ...this.stats };
  }

  reset(): void {
    this.stats = createEmptyStats();
  }

  /** Serialize stats to JSON string (for file storage) */
  toJSON(): string {
    return JSON.stringify(this.stats, null, 2);
  }

  /** Load stats from JSON string */
  fromJSON(json: string): void {
    try {
      const parsed = JSON.parse(json) as ListenModeStats;
      this.stats = { ...createEmptyStats(), ...parsed };
    } catch {
      this.stats = createEmptyStats();
    }
  }
}
