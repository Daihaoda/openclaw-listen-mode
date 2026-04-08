import type { GatewayContext } from '../types/plugin-api.js';
import type { ListenModeConfig } from '../types/config.js';
import type { SessionState } from '../types/state.js';
import type { MessageBuffer } from '../core/message-buffer.js';
import { generateLLMAck } from './llm-ack-generator.js';
import { getFallbackAck } from './fallback-pool.js';
import { randomInRange } from '../utils/random.js';

export function shouldSendInterimAck(
  state: SessionState,
  config: ListenModeConfig,
  now: number,
): boolean {
  // Check message count threshold
  if (state.messagesSinceLastAck >= state.currentAckThreshold) {
    return true;
  }

  // Check time interval
  if (state.lastAckTime !== null) {
    const elapsed = now - state.lastAckTime;
    const [minMs, maxMs] = config.ack.intervalMs;
    const threshold = randomInRange(minMs, maxMs);
    if (elapsed >= threshold) {
      return true;
    }
  }

  return false;
}

export function nextAckThreshold(config: ListenModeConfig): number {
  const [min, max] = config.ack.intervalMessages;
  return randomInRange(min, max);
}

export async function getInterimAck(
  ctx: GatewayContext,
  state: SessionState,
  buffer: MessageBuffer,
  senderId: string,
  config: ListenModeConfig,
): Promise<string> {
  const recent = buffer.getRecent(senderId, 5);

  // Primary: LLM generates context-aware ack (95% of cases)
  if (config.ack.useLLM) {
    try {
      const ack = await generateLLMAck(ctx, recent, state.detectedLanguage, state.lastAckContent, {
        model: config.ack.llmModel,
        maxTokens: 20,
        timeoutMs: config.ack.llmTimeoutMs,
      });
      return ack.trim();
    } catch {
      ctx.logger.warn('LLM ack generation failed, falling back to emotion-categorized pool');
    }
  }

  // Fallback: emotion-categorized pool (keyword-based classification)
  return getFallbackAck(state.detectedLanguage, recent, state.lastAckContent);
}
