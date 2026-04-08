import type { ListenModeConfig } from '../types/config.js';
import type { ExitResult } from '../types/state.js';
import { detectLanguage } from './language-detector.js';
import { EXIT_WORDS_ZH, END_PHRASES_ZH, TASK_KEYWORDS_ZH } from '../i18n/keywords-zh.js';
import { EXIT_WORDS_EN, END_PHRASES_EN, TASK_KEYWORDS_EN } from '../i18n/keywords-en.js';

function containsAny(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/** Semantic question patterns */
const QUESTION_PATTERNS_ZH = [
  '你觉得呢',
  '你怎么想',
  '你说呢',
  '怎么办',
  '该怎么',
  '是不是我的错',
  '我是不是',
  '有什么建议',
  '你会怎么做',
  '怎么安慰',
];

const QUESTION_PATTERNS_EN = [
  'what do you think',
  'what should i do',
  'any advice',
  'any thoughts',
  'how would you',
  'is it my fault',
  'am i wrong',
  'do you think',
  'what would you do',
  'should i',
];

function isQuestion(text: string, lang: 'zh' | 'en'): boolean {
  const trimmed = text.trim();
  if (trimmed.endsWith('?') || trimmed.endsWith('？')) {
    return true;
  }
  const patterns = lang === 'zh' ? QUESTION_PATTERNS_ZH : QUESTION_PATTERNS_EN;
  return containsAny(trimmed, patterns);
}

export interface ExitContext {
  content: string;
  bufferCount: number;
  listenStartTime: number;
  now: number;
}

export function detectExit(
  ctx: ExitContext,
  config: ListenModeConfig,
): ExitResult {
  const lang = detectLanguage(ctx.content);
  const exitWords = lang === 'zh' ? EXIT_WORDS_ZH : EXIT_WORDS_EN;
  const endPhrases = lang === 'zh' ? END_PHRASES_ZH : END_PHRASES_EN;
  const taskKeywords = lang === 'zh' ? TASK_KEYWORDS_ZH : TASK_KEYWORDS_EN;

  // 1. Explicit exit words — EXIT listen mode, send warm goodbye (no AI response)
  if (containsAny(ctx.content, exitWords)) {
    return { shouldExit: true, reason: 'user_abort', triggerResponse: false };
  }

  // 2. Task instruction — trigger response but STAY in listen mode (user's conversation is continuous)
  if (containsAny(ctx.content, taskKeywords)) {
    return { shouldExit: true, reason: 'task_instruction', triggerResponse: true, stayInMode: true };
  }

  // 3. End phrases — trigger response but STAY in listen mode
  if (containsAny(ctx.content, endPhrases)) {
    return { shouldExit: true, reason: 'explicit_end', triggerResponse: true, stayInMode: true };
  }

  // 4. Question detected — trigger response but STAY in listen mode
  if (isQuestion(ctx.content, lang)) {
    return { shouldExit: true, reason: 'question_detected', triggerResponse: true, stayInMode: true };
  }

  // 5. Message count limit — trigger response but STAY in listen mode
  if (ctx.bufferCount >= config.maxBufferMessages) {
    return { shouldExit: true, reason: 'message_limit', triggerResponse: true, stayInMode: true };
  }

  // 6. Max listen time is now handled by the silence-exit timer in state-machine
  //    (resets on every message, fires after maxListenTimeMs of silence)

  return { shouldExit: false };
}

/** Check silence timeout — triggers response but STAYS in listen mode */
export function createSilenceExitResult(): ExitResult {
  return { shouldExit: true, reason: 'silence_timeout', triggerResponse: true, stayInMode: true };
}
