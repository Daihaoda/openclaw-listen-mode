import { describe, it, expect } from 'vitest';
import { detectExit } from '../../src/core/exit-detector.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

const config = DEFAULT_CONFIG;
const baseCtx = {
  bufferCount: 5,
  listenStartTime: Date.now() - 10000,
  now: Date.now(),
};

describe('ExitDetector - Enhanced Question Detection', () => {
  it('should detect Chinese "你觉得呢" as end phrase (now in END_PHRASES_ZH)', () => {
    const result = detectExit({ ...baseCtx, content: '你觉得呢' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('explicit_end');
    expect(result.triggerResponse).toBe(true);
    expect(result.stayInMode).toBe(true);
  });

  it('should detect Chinese "怎么办" as end phrase (now in END_PHRASES_ZH)', () => {
    const result = detectExit({ ...baseCtx, content: '我该怎么办啊' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('explicit_end');
    expect(result.stayInMode).toBe(true);
  });

  it('should detect Chinese "是不是我的错"', () => {
    const result = detectExit({ ...baseCtx, content: '是不是我的错' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('question_detected');
  });

  it('should detect English "what do you think" (matches end phrase)', () => {
    const result = detectExit({ ...baseCtx, content: 'what do you think' }, config);
    expect(result.shouldExit).toBe(true);
    // "what do you think" is in END_PHRASES_EN, so explicit_end takes priority
    expect(result.reason).toBe('explicit_end');
    expect(result.triggerResponse).toBe(true);
  });

  it('should detect English "how would you handle this"', () => {
    const result = detectExit({ ...baseCtx, content: 'how would you handle this' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('question_detected');
  });

  it('should detect English "any advice"', () => {
    const result = detectExit({ ...baseCtx, content: 'any advice on this' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('question_detected');
  });

  it('should detect English "should i" pattern', () => {
    const result = detectExit({ ...baseCtx, content: 'should i just quit' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('question_detected');
  });

  it('should not exit for normal emotional statement', () => {
    const result = detectExit({ ...baseCtx, content: '我真的好难过' }, config);
    expect(result.shouldExit).toBe(false);
  });

  it('should not exit for normal English statement', () => {
    const result = detectExit({ ...baseCtx, content: 'I feel so lost' }, config);
    expect(result.shouldExit).toBe(false);
  });
});
