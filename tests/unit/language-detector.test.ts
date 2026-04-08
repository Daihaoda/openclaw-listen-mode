import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../src/core/language-detector.js';

describe('LanguageDetector', () => {
  it('should detect Chinese text', () => {
    expect(detectLanguage('我好难过')).toBe('zh');
    expect(detectLanguage('你听我说')).toBe('zh');
  });

  it('should detect English text', () => {
    expect(detectLanguage('I feel so sad')).toBe('en');
    expect(detectLanguage('hear me out')).toBe('en');
  });

  it('should detect mixed text as Chinese if CJK present', () => {
    expect(detectLanguage('我很 sad')).toBe('zh');
  });

  it('should default to English for empty or symbols-only', () => {
    expect(detectLanguage('...')).toBe('en');
    expect(detectLanguage('123')).toBe('en');
  });
});
