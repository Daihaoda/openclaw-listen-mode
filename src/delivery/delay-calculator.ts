import type { ReplyConfig } from '../types/config.js';
import type { SplitMessage } from '../types/message.js';

function countChars(msg: SplitMessage): number {
  if (msg.type === 'sticker') return 0;
  return msg.content.length;
}

export function calculateDelay(msg: SplitMessage, config: ReplyConfig): number {
  const charCount = countChars(msg);
  const base = Math.max(config.delayBaseMs, charCount * config.delayPerCharMs);
  const random = Math.floor(Math.random() * config.delayRandomMs);
  return base + random;
}
