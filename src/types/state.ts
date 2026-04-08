import type { InboundMessage } from './message.js';

export enum ListenState {
  NORMAL = 'NORMAL',
  LISTENING = 'LISTENING',
  RESPONDING = 'RESPONDING',
}

export type DetectedLanguage = 'zh' | 'en';

export interface SessionState {
  mode: ListenState;
  buffer: InboundMessage[];
  listenStartTime: number | null;
  lastMessageTime: number | null;
  lastAckContent: string | null;
  lastAckTime: number | null;
  messagesSinceLastAck: number;
  currentAckThreshold: number;
  detectedLanguage: DetectedLanguage;
  lastMessageIsVoice: boolean;
  lastMessageText: string;
  completenessExtensions: number;
}

export type TriggerType = 'manual' | 'auto';

export interface TriggerResult {
  triggered: boolean;
  reason?: 'task_veto' | 'no_match';
  triggerType?: TriggerType;
  language?: DetectedLanguage;
}

export type ExitReason =
  | 'silence_timeout'
  | 'max_listen_time'
  | 'explicit_end'
  | 'user_abort'
  | 'question_detected'
  | 'message_limit'
  | 'task_instruction';

export interface ExitResult {
  shouldExit: boolean;
  reason?: ExitReason;
  /** Whether to trigger Agent response (false for abort/task switch) */
  triggerResponse?: boolean;
  /** If true, trigger response but stay in LISTENING mode (don't exit) */
  stayInMode?: boolean;
}
