/**
 * Multi-round listen session context accumulation.
 * Preserves conversation history across multiple listen rounds
 * within the same emotional conversation.
 */

import type { InboundMessage } from '../types/message.js';
import type { DetectedLanguage } from '../types/state.js';

export interface SessionConfig {
  enabled: boolean;
  maxDurationMs: number;
  maxRounds: number;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  enabled: true,
  maxDurationMs: 600000, // 10 minutes
  maxRounds: 5,
};

interface SessionRound {
  roundNumber: number;
  userMessages: InboundMessage[];
  aiResponse?: string;
}

interface ListenSession {
  startTime: number;
  rounds: SessionRound[];
  currentRound: number;
}

export class ListenSessionManager {
  private sessions = new Map<string, ListenSession>();
  private readonly config: SessionConfig;

  constructor(config?: Partial<SessionConfig>) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
  }

  /** Start or continue a session for a sender */
  startRound(senderId: string): number {
    if (!this.config.enabled) return 1;

    let session = this.sessions.get(senderId);

    // Check if existing session has expired or hit max rounds
    if (session) {
      const elapsed = Date.now() - session.startTime;
      if (elapsed > this.config.maxDurationMs || session.currentRound >= this.config.maxRounds) {
        this.sessions.delete(senderId);
        session = undefined;
      }
    }

    if (!session) {
      session = {
        startTime: Date.now(),
        rounds: [],
        currentRound: 0,
      };
      this.sessions.set(senderId, session);
    }

    session.currentRound++;
    session.rounds.push({
      roundNumber: session.currentRound,
      userMessages: [],
    });

    return session.currentRound;
  }

  /** Add messages to the current round */
  addMessages(senderId: string, messages: InboundMessage[]): void {
    const session = this.sessions.get(senderId);
    if (!session || session.rounds.length === 0) return;

    const currentRound = session.rounds[session.rounds.length - 1];
    currentRound.userMessages.push(...messages);
  }

  /** Record the AI's response for the current round */
  recordAiResponse(senderId: string, response: string): void {
    const session = this.sessions.get(senderId);
    if (!session || session.rounds.length === 0) return;

    const currentRound = session.rounds[session.rounds.length - 1];
    currentRound.aiResponse = response;
  }

  /** Check if there's an active session with history */
  hasHistory(senderId: string): boolean {
    const session = this.sessions.get(senderId);
    return !!session && session.rounds.length > 1;
  }

  /** Get the current round number */
  getCurrentRound(senderId: string): number {
    return this.sessions.get(senderId)?.currentRound ?? 0;
  }

  /**
   * Build context string including all previous rounds.
   * Used to prepend to the merged message so Agent sees full history.
   */
  buildContextString(senderId: string, lang: DetectedLanguage): string {
    const session = this.sessions.get(senderId);
    if (!session || session.rounds.length <= 1) return '';

    const header = lang === 'zh' ? '[倾听会话上下文]' : '[Listen Session Context]';
    const parts: string[] = [header];

    // Include all previous rounds (not the current one)
    for (let i = 0; i < session.rounds.length - 1; i++) {
      const round = session.rounds[i];
      const roundLabel = lang === 'zh' ? `--- 第 ${round.roundNumber} 轮 ---` : `--- Round ${round.roundNumber} ---`;
      parts.push(roundLabel);

      for (const msg of round.userMessages) {
        const prefix = lang === 'zh' ? '用户：' : 'User: ';
        parts.push(`${prefix}${msg.content}`);
      }

      if (round.aiResponse) {
        const prefix = lang === 'zh' ? '（AI 回复：' : '(AI replied: ';
        // Only include a summary, not the full response
        const summary = round.aiResponse
          .replace(/<<<SPLIT>>>/g, ' ')
          .replace(/<<<STICKER:\w+>>>/g, '')
          .trim()
          .slice(0, 100);
        parts.push(`${prefix}${summary}${summary.length >= 100 ? '...' : ''}）`);
      }
    }

    const currentLabel = lang === 'zh' ? '--- 当前消息 ---' : '--- Current Messages ---';
    parts.push(currentLabel);

    return parts.join('\n');
  }

  /** End a session (user abort, task switch, or natural end) */
  endSession(senderId: string): void {
    this.sessions.delete(senderId);
  }

  /** Check if session has expired */
  isExpired(senderId: string): boolean {
    const session = this.sessions.get(senderId);
    if (!session) return true;
    return Date.now() - session.startTime > this.config.maxDurationMs;
  }

  clearAll(): void {
    this.sessions.clear();
  }
}
