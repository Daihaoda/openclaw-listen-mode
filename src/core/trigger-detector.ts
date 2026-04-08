import type { ListenModeConfig } from '../types/config.js';
import type { TriggerResult, DetectedLanguage } from '../types/state.js';
import { detectLanguage } from './language-detector.js';
import { TRIGGER_PHRASES_ZH, TASK_KEYWORDS_ZH, EMOTION_STRONG_ZH, EMOTION_MEDIUM_ZH, EMOTION_WEAK_ZH } from '../i18n/keywords-zh.js';
import { TRIGGER_PHRASES_EN, TASK_KEYWORDS_EN, EMOTION_STRONG_EN, EMOTION_MEDIUM_EN, EMOTION_WEAK_EN } from '../i18n/keywords-en.js';

function containsAny(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function isShortMessage(text: string, lang: DetectedLanguage): boolean {
  if (lang === 'zh') return text.length < 20;
  return text.length < 60;
}

function hasQuestionMark(text: string): boolean {
  return text.includes('?') || text.includes('？');
}

export function detectTrigger(content: string, config: ListenModeConfig): TriggerResult {
  const lang = detectLanguage(content);
  const taskKeywords = lang === 'zh' ? TASK_KEYWORDS_ZH : TASK_KEYWORDS_EN;

  // Step 1: Task veto (highest priority)
  if (containsAny(content, taskKeywords)) {
    return { triggered: false, reason: 'task_veto' };
  }

  // Step 2: Manual trigger (always checked if mode is 'manual' or 'both')
  if (config.triggerMode === 'manual' || config.triggerMode === 'both') {
    const triggerPhrases = lang === 'zh' ? TRIGGER_PHRASES_ZH : TRIGGER_PHRASES_EN;
    if (containsAny(content, triggerPhrases)) {
      return { triggered: true, triggerType: 'manual', language: lang };
    }
  }

  // Step 3: Auto emotion detection (only if mode is 'auto' or 'both')
  if (config.triggerMode === 'auto' || config.triggerMode === 'both') {
    const strong = lang === 'zh' ? EMOTION_STRONG_ZH : EMOTION_STRONG_EN;
    const medium = lang === 'zh' ? EMOTION_MEDIUM_ZH : EMOTION_MEDIUM_EN;
    const weak = lang === 'zh' ? EMOTION_WEAK_ZH : EMOTION_WEAK_EN;

    const isShort = isShortMessage(content, lang);
    const noQuestion = !hasQuestionMark(content);

    // Strong signal: instant trigger (all sensitivity levels)
    if (containsAny(content, strong)) {
      return { triggered: true, triggerType: 'auto', language: lang };
    }

    // Medium signal + short sentence conditions
    if (config.sensitivity !== 'low' && containsAny(content, medium)) {
      if (isShort && noQuestion) {
        return { triggered: true, triggerType: 'auto', language: lang };
      }
    }

    // Weak signal + short sentence + no task context
    if (config.sensitivity === 'high' && containsAny(content, weak)) {
      if (isShort && noQuestion) {
        return { triggered: true, triggerType: 'auto', language: lang };
      }
    }
  }

  return { triggered: false, reason: 'no_match' };
}
