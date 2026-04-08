import type { InboundMessage } from '../types/message.js';
import type { DetectedLanguage } from '../types/state.js';
import type { GatewayContext, LLMCallOptions } from '../types/plugin-api.js';

function buildPromptZh(recentMessages: InboundMessage[], lastAck: string | null): string {
  const msgText = recentMessages.map((m) => m.content).join('\n');
  const lastAckLine = lastAck ? `上一次回的是：${lastAck}` : '';
  return `用户正在连续倾诉，这是他最近发的几条消息：
${msgText}

请给一句非常短的回应（不超过 10 个字），表示你在听。
规则：
- 不要总结、不要建议、不要分析
- 禁止推断用户未说出的情绪或原因（比如用户说"我被裁了"，不要回"你一定很焦虑"）
- 只对用户已经说出的内容做最轻的反馈
- 用叠词或口语（嗯嗯、然后呢、天呐…）
- 不要和上一次中间回应重复${lastAckLine ? `（${lastAckLine}）` : ''}
只输出回应内容，不要输出任何其他文字。`;
}

function buildPromptEn(recentMessages: InboundMessage[], lastAck: string | null): string {
  const msgText = recentMessages.map((m) => m.content).join('\n');
  const lastAckLine = lastAck ? `last ack was "${lastAck}"` : '';
  return `The user is venting. Recent messages:
${msgText}

Give a very short response (under 5 words) showing you're listening.
Rules:
- Don't summarize, advise, or analyze
- NEVER infer emotions or reasons the user hasn't stated (e.g. user says "I got fired", don't reply "you must be so anxious")
- Only react to what was explicitly said
- Use casual speech (mm hmm, oh no, then what...)
- Don't repeat: ${lastAckLine || 'N/A'}
Output only the response, nothing else.`;
}

export async function generateLLMAck(
  ctx: GatewayContext,
  recentMessages: InboundMessage[],
  language: DetectedLanguage,
  lastAck: string | null,
  options: LLMCallOptions,
): Promise<string> {
  const prompt =
    language === 'zh'
      ? buildPromptZh(recentMessages, lastAck)
      : buildPromptEn(recentMessages, lastAck);

  return await ctx.callLLM(prompt, {
    model: options.model,
    maxTokens: options.maxTokens ?? 20,
    timeoutMs: options.timeoutMs,
  });
}
