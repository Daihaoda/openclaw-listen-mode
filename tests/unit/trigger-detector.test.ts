import { describe, it, expect } from 'vitest';
import { detectTrigger } from '../../src/core/trigger-detector.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import type { ListenModeConfig } from '../../src/types/config.js';

const manualConfig: ListenModeConfig = { ...DEFAULT_CONFIG, triggerMode: 'manual' };
const autoConfig: ListenModeConfig = { ...DEFAULT_CONFIG, triggerMode: 'auto' };
const bothConfig: ListenModeConfig = { ...DEFAULT_CONFIG, triggerMode: 'both' };

describe('TriggerDetector', () => {
  describe('task veto (highest priority)', () => {
    it('should block listen mode when task keyword is present', () => {
      const result = detectTrigger('我烦死了帮我看下这个 SQL', manualConfig);
      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('task_veto');
    });

    it('should block even with emotion + task keyword', () => {
      const result = detectTrigger('我累了帮我改个 bug', manualConfig);
      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('task_veto');
    });

    it('should block English task keywords', () => {
      const result = detectTrigger("I'm so stressed, help me fix this", bothConfig);
      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('task_veto');
    });
  });

  describe('manual trigger', () => {
    it('should trigger on Chinese manual phrases', () => {
      const result = detectTrigger('你听我说', manualConfig);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe('manual');
      expect(result.language).toBe('zh');
    });

    it('should trigger on English manual phrases', () => {
      const result = detectTrigger('hear me out', manualConfig);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe('manual');
      expect(result.language).toBe('en');
    });

    it('should not trigger on random text in manual mode', () => {
      const result = detectTrigger('今天天气真好', manualConfig);
      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('no_match');
    });

    it('should not auto-detect emotions in manual mode', () => {
      const result = detectTrigger('我好难过', manualConfig);
      expect(result.triggered).toBe(false);
    });
  });

  describe('auto trigger', () => {
    it('should trigger on strong emotion signal', () => {
      const result = detectTrigger('我分手了', autoConfig);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe('auto');
    });

    it('should trigger on medium signal + short message', () => {
      const result = detectTrigger('好烦', autoConfig);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe('auto');
    });

    it('should not trigger medium signal on long message', () => {
      const longMsg = '好烦，' + '这个项目的需求文档写得太复杂了我完全看不懂到底要做什么功能';
      const result = detectTrigger(longMsg, autoConfig);
      expect(result.triggered).toBe(false);
    });

    it('should not trigger on message with question mark', () => {
      const result = detectTrigger('好烦，怎么办？', autoConfig);
      expect(result.triggered).toBe(false);
    });

    it('should trigger English strong signal', () => {
      const result = detectTrigger('I just got fired', autoConfig);
      expect(result.triggered).toBe(true);
      expect(result.language).toBe('en');
    });

    it('should respect sensitivity=low (only strong signals)', () => {
      const lowConfig: ListenModeConfig = { ...autoConfig, sensitivity: 'low' };
      expect(detectTrigger('我分手了', lowConfig).triggered).toBe(true); // strong
      expect(detectTrigger('好烦', lowConfig).triggered).toBe(false); // medium
    });

    it('should respect sensitivity=high (includes weak signals)', () => {
      const highConfig: ListenModeConfig = { ...autoConfig, sensitivity: 'high' };
      expect(detectTrigger('唉', highConfig).triggered).toBe(true);
    });
  });

  describe('both mode', () => {
    it('should trigger on manual phrases', () => {
      const result = detectTrigger('你听我说', bothConfig);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe('manual');
    });

    it('should trigger on emotion signals', () => {
      const result = detectTrigger('我分手了', bothConfig);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe('auto');
    });
  });
});
