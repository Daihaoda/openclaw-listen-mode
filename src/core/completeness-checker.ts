/**
 * LLM-based completeness checker.
 *
 * When the silence timer fires, this module asks a lightweight LLM
 * whether the user has finished expressing their current thought.
 * If not, the timer is extended (up to maxExtensions times).
 *
 * Zero-cost when disabled; ~140 tokens per check when enabled.
 */

import type { InboundMessage } from '../types/message.js';
import type { GatewayContext } from '../types/plugin-api.js';
import type { DetectedLanguage } from '../types/state.js';

export interface CompletenessCheckConfig {
  /** Whether to enable LLM completeness checking */
  enabled: boolean;
  /** LLM model to use ('auto' = gateway default) */
  model: string;
  /** LLM call timeout in ms */
  timeoutMs: number;
  /** Max times to extend the silence timeout */
  maxExtensions: number;
  /** Fixed extension duration per retry (ms) */
  extensionMs: number;
}

export const DEFAULT_COMPLETENESS_CONFIG: CompletenessCheckConfig = {
  enabled: true,
  model: 'auto',
  timeoutMs: 1500,
  maxExtensions: 2,
  extensionMs: 7000,
};

export interface CompletenessResult {
  complete: boolean;
}

// ─── Prompts ───

const PROMPT_ZH = `用户正在倾诉，以下是最近的消息：
---
{MESSAGES}
---
判断：用户是否已经表达完当前想法？
- 完：已说完或在等回应
- 未完：可能还要继续说
只输出JSON：{"done":true} 或 {"done":false}`;

const PROMPT_EN = `A user is venting. Recent messages:
---
{MESSAGES}
---
Has the user finished their current thought?
Output only JSON: {"done":true} or {"done":false}`;

// ─── Helpers ───

/**
 * Format messages for the prompt.
 * Takes at most `maxMessages` recent messages, numbered.
 */
function formatMessages(messages: InboundMessage[], maxMessages: number = 10): string {
  const recent = messages.slice(-maxMessages);
  return recent.map((m, i) => `[${i + 1}] ${m.content}`).join('\n');
}

/**
 * Parse LLM response. Returns null on failure.
 */
function parseResponse(raw: string): CompletenessResult | null {
  try {
    const jsonMatch = raw.match(/\{[^}]+\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.done === 'boolean') {
      return { complete: parsed.done };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Main ───

/**
 * Ask LLM whether the user has finished expressing their thought.
 *
 * On any failure (timeout, parse error, etc.), returns `{ complete: true }`
 * to fall through to the default behavior (trigger response).
 */
export async function checkCompleteness(
  ctx: GatewayContext,
  messages: InboundMessage[],
  language: DetectedLanguage,
  config: CompletenessCheckConfig,
): Promise<CompletenessResult> {
  if (!config.enabled || messages.length === 0) {
    return { complete: true };
  }

  const formatted = formatMessages(messages);
  const prompt = (language === 'zh' ? PROMPT_ZH : PROMPT_EN).replace('{MESSAGES}', formatted);

  try {
    const raw = await ctx.callLLM(prompt, {
      model: config.model === 'auto' ? undefined : config.model,
      maxTokens: 10,
      timeoutMs: config.timeoutMs,
    });

    const result = parseResponse(raw);
    if (result) {
      return result;
    }

    ctx.logger.warn('Completeness check: failed to parse LLM response', raw);
    return { complete: true }; // fallback: assume done
  } catch (err) {
    ctx.logger.warn('Completeness check: LLM call failed, assuming complete', err);
    return { complete: true }; // fallback: assume done
  }
}
