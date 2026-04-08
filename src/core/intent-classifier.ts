/**
 * LLM-based intent classification.
 * Replaces/supplements keyword matching with semantic understanding.
 * Combined with emotion level scoring in a single LLM call.
 */

import type { GatewayContext } from '../types/plugin-api.js';
import { detectLanguage } from './language-detector.js';

export type Intent = 'task' | 'vent' | 'chat';
export type EmotionIntensity = 1 | 2 | 3 | 4 | 5;

export interface ClassificationResult {
  intent: Intent;
  emotionLevel?: EmotionIntensity;
}

export interface IntentClassifierConfig {
  enabled: boolean;
  classificationModel: string;
  classificationTimeoutMs: number;
  fallbackToKeywords: boolean;
}

export const DEFAULT_INTENT_CONFIG: IntentClassifierConfig = {
  enabled: true,
  classificationModel: 'auto',
  classificationTimeoutMs: 1000,
  fallbackToKeywords: true,
};

const PROMPT_ZH = `判断这条消息：
1. 意图（task / vent / chat）
2. 如果是 vent，情绪强度（1-5，1=轻微吐槽，5=极度痛苦/危机）
只输出 JSON：{"intent":"vent","level":3}
如果不是 vent，只输出：{"intent":"task"} 或 {"intent":"chat"}

消息："{MESSAGE}"`;

const PROMPT_EN = `Classify this message:
1. Intent (task / vent / chat)
2. If vent, emotion intensity (1-5, 1=mild venting, 5=extreme distress/crisis)
Output only JSON: {"intent":"vent","level":3}
If not vent, output only: {"intent":"task"} or {"intent":"chat"}

Message: "{MESSAGE}"`;

// Simple LRU cache for recent classifications
const classificationCache = new Map<string, { result: ClassificationResult; timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10 seconds

function getCacheKey(senderId: string, content: string): string {
  return `${senderId}:${content.slice(0, 100)}`;
}

function getCached(senderId: string, content: string): ClassificationResult | null {
  const key = getCacheKey(senderId, content);
  const entry = classificationCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.result;
  }
  if (entry) {
    classificationCache.delete(key);
  }
  return null;
}

function setCache(senderId: string, content: string, result: ClassificationResult): void {
  const key = getCacheKey(senderId, content);
  classificationCache.set(key, { result, timestamp: Date.now() });

  // Evict old entries if cache grows too large
  if (classificationCache.size > 100) {
    const oldest = classificationCache.keys().next().value;
    if (oldest) classificationCache.delete(oldest);
  }
}

function parseResponse(raw: string): ClassificationResult | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = raw.match(/\{[^}]+\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const intent = parsed.intent as string;

    if (!['task', 'vent', 'chat'].includes(intent)) return null;

    const result: ClassificationResult = { intent: intent as Intent };
    if (intent === 'vent' && typeof parsed.level === 'number') {
      result.emotionLevel = Math.max(1, Math.min(5, Math.round(parsed.level))) as EmotionIntensity;
    }

    return result;
  } catch {
    return null;
  }
}

export async function classifyIntent(
  ctx: GatewayContext,
  senderId: string,
  content: string,
  config: IntentClassifierConfig,
): Promise<ClassificationResult | null> {
  if (!config.enabled) return null;

  // Check cache
  const cached = getCached(senderId, content);
  if (cached) return cached;

  const lang = detectLanguage(content);
  const prompt = (lang === 'zh' ? PROMPT_ZH : PROMPT_EN).replace('{MESSAGE}', content);

  try {
    const raw = await ctx.callLLM(prompt, {
      model: config.classificationModel === 'auto' ? undefined : config.classificationModel,
      maxTokens: 30,
      timeoutMs: config.classificationTimeoutMs,
    });

    const result = parseResponse(raw);
    if (result) {
      setCache(senderId, content, result);
      return result;
    }

    ctx.logger.warn('Failed to parse classification response', raw);
    return null;
  } catch {
    ctx.logger.warn('Intent classification LLM call failed, will fallback to keywords');
    return null;
  }
}

/** Clear the classification cache (for testing) */
export function clearClassificationCache(): void {
  classificationCache.clear();
}
