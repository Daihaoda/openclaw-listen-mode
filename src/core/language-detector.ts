import type { DetectedLanguage } from '../types/state.js';

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/;

export function detectLanguage(text: string): DetectedLanguage {
  return CJK_REGEX.test(text) ? 'zh' : 'en';
}
