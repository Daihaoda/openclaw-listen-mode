import type { SplitMessage } from '../types/message.js';

const SPLIT_DELIMITER = '<<<SPLIT>>>';
const STICKER_REGEX = /^<<<STICKER:(\w+)>>>$/;

export function splitReply(content: string): SplitMessage[] {
  const parts = content.split(SPLIT_DELIMITER);
  const messages: SplitMessage[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const stickerMatch = trimmed.match(STICKER_REGEX);
    if (stickerMatch) {
      messages.push({ type: 'sticker', category: stickerMatch[1] });
    } else {
      messages.push({ type: 'text', content: trimmed });
    }
  }

  return messages;
}
