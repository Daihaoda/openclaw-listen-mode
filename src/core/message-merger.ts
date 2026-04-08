import type { InboundMessage } from '../types/message.js';
import type { DetectedLanguage } from '../types/state.js';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const SYSTEM_HINT_ZH = `用户连续发了多条消息，现在停了。请整体理解后回复。
注意：不要编造用户没说的内容。"我朋友"≠用户本人，区分清楚。`;

const SYSTEM_HINT_EN = `The user sent multiple messages in a row and has now stopped. Understand them as a whole before replying.
Important: Don't make up things the user didn't say. "My friend" ≠ the user themselves — keep pronouns straight.`;

export function mergeMessages(
  messages: InboundMessage[],
  language: DetectedLanguage,
  includeHint: boolean,
): string {
  const header =
    language === 'zh'
      ? '[用户连续发了以下消息，请整体理解后再回复]'
      : '[The user sent the following messages in a row. Please understand them as a whole before replying]';

  const body = messages
    .map((m) => `(${formatTimestamp(m.timestamp)}) ${m.content}`)
    .join('\n');

  const parts: string[] = [];
  if (includeHint) {
    parts.push(language === 'zh' ? SYSTEM_HINT_ZH : SYSTEM_HINT_EN);
  }
  parts.push(header);
  parts.push(body);

  return parts.join('\n\n');
}
