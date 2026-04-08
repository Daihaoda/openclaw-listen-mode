/**
 * Emotion intensity scorer.
 * Assigns a 0-1 intensity score to a message based on emotion signals.
 * Higher scores indicate stronger emotional content.
 *
 * Used to influence Agent response style via system hint adjustments.
 */

import { detectLanguage } from './language-detector.js';
import {
  EMOTION_STRONG_ZH,
  EMOTION_MEDIUM_ZH,
  EMOTION_WEAK_ZH,
} from '../i18n/keywords-zh.js';
import {
  EMOTION_STRONG_EN,
  EMOTION_MEDIUM_EN,
  EMOTION_WEAK_EN,
} from '../i18n/keywords-en.js';
import type { InboundMessage } from '../types/message.js';

export type EmotionLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface EmotionScore {
  level: EmotionLevel;
  score: number; // 0.0 - 1.0
  matchedKeywords: string[];
}

function findMatches(text: string, keywords: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

export function scoreEmotion(content: string): EmotionScore {
  const lang = detectLanguage(content);
  const strong = lang === 'zh' ? EMOTION_STRONG_ZH : EMOTION_STRONG_EN;
  const medium = lang === 'zh' ? EMOTION_MEDIUM_ZH : EMOTION_MEDIUM_EN;
  const weak = lang === 'zh' ? EMOTION_WEAK_ZH : EMOTION_WEAK_EN;

  const strongMatches = findMatches(content, strong);
  const mediumMatches = findMatches(content, medium);
  const weakMatches = findMatches(content, weak);

  const allMatches = [...strongMatches, ...mediumMatches, ...weakMatches];

  if (strongMatches.length > 0) {
    // Strong signal: 0.8-1.0 depending on count
    const score = Math.min(1.0, 0.8 + strongMatches.length * 0.1);
    return { level: 'critical', score, matchedKeywords: allMatches };
  }

  if (mediumMatches.length > 0) {
    // Medium signal: 0.5-0.7
    const score = Math.min(0.7, 0.5 + mediumMatches.length * 0.1);
    return { level: 'high', score, matchedKeywords: allMatches };
  }

  if (weakMatches.length > 0) {
    // Weak signal: 0.2-0.4
    const score = Math.min(0.4, 0.2 + weakMatches.length * 0.1);
    return { level: 'medium', score, matchedKeywords: allMatches };
  }

  return { level: 'none', score: 0, matchedKeywords: [] };
}

/**
 * Aggregate emotion score across multiple buffered messages.
 * Takes the max score and combines all matched keywords.
 */
export function aggregateEmotionScore(messages: InboundMessage[]): EmotionScore {
  if (messages.length === 0) {
    return { level: 'none', score: 0, matchedKeywords: [] };
  }

  const scores = messages.map((m) => scoreEmotion(m.content));
  const maxScore = scores.reduce((max, s) => (s.score > max.score ? s : max), scores[0]);
  const allKeywords = [...new Set(scores.flatMap((s) => s.matchedKeywords))];

  return {
    level: maxScore.level,
    score: maxScore.score,
    matchedKeywords: allKeywords,
  };
}

/**
 * Generate emotion-aware system hint suffix based on intensity level.
 */
export function getEmotionHintSuffix(score: EmotionScore, lang: 'zh' | 'en'): string {
  if (lang === 'zh') {
    switch (score.level) {
      case 'critical':
        return '\n\n注意：用户当前情绪非常强烈，请格外温柔，完全不要给建议，只做共情和陪伴。不要使用 emoji。';
      case 'high':
        return '\n\n注意：用户情绪比较低落，优先共情，谨慎给建议。emoji 少用。';
      case 'medium':
        return '\n\n用户有些情绪波动，保持温暖的语气。';
      default:
        return '';
    }
  } else {
    switch (score.level) {
      case 'critical':
        return '\n\nNote: The user is in significant emotional distress. Be extremely gentle, only empathize and be present. Do not give advice. Avoid emoji.';
      case 'high':
        return '\n\nNote: The user is feeling quite down. Prioritize empathy, be cautious with advice. Use emoji sparingly.';
      case 'medium':
        return '\n\nThe user seems somewhat upset. Keep a warm tone.';
      default:
        return '';
    }
  }
}
