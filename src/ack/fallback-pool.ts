import type { DetectedLanguage } from '../types/state.js';
import type { InboundMessage } from '../types/message.js';
import type { AckEmotionCategory } from '../i18n/responses.js';
import { ACK_POOLS_ZH, ACK_POOLS_EN } from '../i18n/responses.js';
import { classifyAckEmotion } from './emotion-category.js';
import { randomPick } from '../utils/random.js';

/**
 * Get a fallback ack from the emotion-categorized pool.
 *
 * @param language  - detected language
 * @param recentMessages - recent buffered messages (used for keyword emotion classification)
 * @param lastAck  - last ack sent (avoid repeating)
 * @param categoryOverride - force a specific category (e.g. from LLM classification)
 */
export function getFallbackAck(
  language: DetectedLanguage,
  recentMessages: InboundMessage[],
  lastAck?: string | null,
  categoryOverride?: AckEmotionCategory,
): string {
  const category = categoryOverride ?? classifyAckEmotion(recentMessages);
  const pools = language === 'zh' ? ACK_POOLS_ZH : ACK_POOLS_EN;
  const pool = pools[category];

  // Avoid repeating the last ack
  if (lastAck && pool.length > 1) {
    const filtered = pool.filter((r) => r !== lastAck);
    return randomPick(filtered);
  }
  return randomPick(pool);
}
