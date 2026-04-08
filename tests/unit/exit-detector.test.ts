import { describe, it, expect } from 'vitest';
import { detectExit } from '../../src/core/exit-detector.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

const config = DEFAULT_CONFIG;
const baseCtx = {
  bufferCount: 5,
  listenStartTime: Date.now() - 10000,
  now: Date.now(),
};

describe('ExitDetector', () => {
  it('should detect user abort (Chinese)', () => {
    const result = detectExit({ ...baseCtx, content: '结束聊天' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('user_abort');
    expect(result.triggerResponse).toBe(false);
  });

  it('should detect user abort (English)', () => {
    const result = detectExit({ ...baseCtx, content: 'end chat' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('user_abort');
    expect(result.triggerResponse).toBe(false);
  });

  it('should detect task instruction mid-listen', () => {
    const result = detectExit({ ...baseCtx, content: '帮我查个东西' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('task_instruction');
    expect(result.triggerResponse).toBe(true);
    expect(result.stayInMode).toBe(true);
  });

  it('should detect explicit end phrase', () => {
    const result = detectExit({ ...baseCtx, content: '说完了' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('explicit_end');
    expect(result.triggerResponse).toBe(true);
  });

  it('should detect question (end phrase "怎么办" matches explicit_end)', () => {
    const result = detectExit({ ...baseCtx, content: '你觉得我该怎么办？' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('explicit_end');
    expect(result.triggerResponse).toBe(true);
    expect(result.stayInMode).toBe(true);
  });

  it('should detect English question', () => {
    const result = detectExit({ ...baseCtx, content: 'do you think I made a mistake?' }, config);
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('question_detected');
    expect(result.triggerResponse).toBe(true);
  });

  it('should detect message limit', () => {
    const result = detectExit(
      { ...baseCtx, content: '继续说', bufferCount: 20 },
      config,
    );
    expect(result.shouldExit).toBe(true);
    expect(result.reason).toBe('message_limit');
    expect(result.triggerResponse).toBe(true);
  });

  it('should NOT detect max listen time in exit-detector (now handled by silence-exit timer)', () => {
    // max_listen_time is now a silence-based timer in state-machine, not checked per-message
    const result = detectExit(
      { ...baseCtx, content: '还有', listenStartTime: Date.now() - 600000, now: Date.now() },
      config,
    );
    expect(result.shouldExit).toBe(false);
  });

  it('should not exit for normal message within limits', () => {
    const result = detectExit({ ...baseCtx, content: '我分手了' }, config);
    expect(result.shouldExit).toBe(false);
  });
});
