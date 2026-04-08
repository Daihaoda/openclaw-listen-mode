/**
 * Analytics event emitter for listen mode sessions.
 * Provides hooks for external systems to track usage patterns.
 */

import type { ExitReason, TriggerType, DetectedLanguage } from '../types/state.js';
import type { EmotionLevel } from './emotion-scorer.js';

export interface ListenSessionEvent {
  type: 'listen_session_complete';
  senderId: string;
  timestamp: number;
  /** How the session was triggered */
  triggerType: TriggerType;
  /** How the session ended */
  exitReason: ExitReason;
  /** Detected language during the session */
  language: DetectedLanguage;
  /** Number of messages buffered */
  messageCount: number;
  /** Total duration in ms */
  durationMs: number;
  /** Number of interim acks sent */
  ackCount: number;
  /** Peak emotion level detected */
  emotionLevel: EmotionLevel;
  /** Whether a response was triggered (vs abort) */
  responseTriggered: boolean;
}

export interface ListenModeAnalytics {
  /** Register an event handler */
  on(event: 'session_complete', handler: (data: ListenSessionEvent) => void): void;
  /** Remove an event handler */
  off(event: 'session_complete', handler: (data: ListenSessionEvent) => void): void;
}

type EventHandler = (data: ListenSessionEvent) => void;

export class AnalyticsEmitter implements ListenModeAnalytics {
  private handlers = new Map<string, Set<EventHandler>>();

  on(event: 'session_complete', handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: 'session_complete', handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: 'session_complete', data: ListenSessionEvent): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          handler(data);
        } catch {
          // Don't let analytics errors break the main flow
        }
      }
    }
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }
}
