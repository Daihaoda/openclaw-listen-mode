import type { InboundMessage, OutboundMessage } from './message.js';

export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

export interface SendOptions {
  type?: 'text' | 'sticker' | 'image';
  stickerCategory?: string;
}

export interface SendToAgentOptions {
  systemHint?: string;
  /** AbortSignal for cancelling the agent call */
  signal?: AbortSignal;
}

export interface LLMCallOptions {
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GatewayContext {
  /** Send a message directly to the user (bypasses Agent) */
  sendToUser(senderId: string, content: string, options?: SendOptions): Promise<void>;
  /** Forward a message to the Agent for processing */
  sendToAgent(senderId: string, content: string, options?: SendToAgentOptions): Promise<string>;
  /** Call a lightweight LLM for plugin-internal use */
  callLLM(prompt: string, options?: LLMCallOptions): Promise<string>;
  /** Plugin-scoped logger */
  logger: Logger;
}

export interface OpenClawPlugin {
  readonly name: string;
  init(ctx: GatewayContext): Promise<void>;
  onInboundMessage(message: InboundMessage): Promise<'passthrough' | 'handled'>;
  onOutboundMessage(message: OutboundMessage): Promise<OutboundMessage | OutboundMessage[]>;
  destroy(): Promise<void>;
}
