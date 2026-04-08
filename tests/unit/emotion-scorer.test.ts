import { describe, it, expect } from 'vitest';
import { scoreEmotion, aggregateEmotionScore } from '../../src/core/emotion-scorer.js';
import { createMessage } from '../helpers/mock-gateway.js';

describe('EmotionScorer', () => {
  describe('scoreEmotion', () => {
    it('should score strong Chinese emotion as critical', () => {
      const score = scoreEmotion('我分手了');
      expect(score.level).toBe('critical');
      expect(score.score).toBeGreaterThanOrEqual(0.8);
      expect(score.matchedKeywords).toContain('分手');
    });

    it('should score medium Chinese emotion as high', () => {
      const score = scoreEmotion('我好难过');
      expect(score.level).toBe('high');
      expect(score.score).toBeGreaterThanOrEqual(0.5);
    });

    it('should score weak Chinese emotion as medium', () => {
      const score = scoreEmotion('唉');
      expect(score.level).toBe('medium');
      expect(score.score).toBeGreaterThanOrEqual(0.2);
    });

    it('should score neutral content as none', () => {
      const score = scoreEmotion('今天天气不错');
      expect(score.level).toBe('none');
      expect(score.score).toBe(0);
    });

    it('should score strong English emotion', () => {
      const score = scoreEmotion('I just got fired');
      expect(score.level).toBe('critical');
      expect(score.matchedKeywords).toContain('fired');
    });

    it('should score medium English emotion', () => {
      const score = scoreEmotion('I feel so sad');
      expect(score.level).toBe('high');
    });
  });

  describe('aggregateEmotionScore', () => {
    it('should take max score across messages', () => {
      const messages = [
        createMessage('user1', '今天好烦'),
        createMessage('user1', '我分手了'),
        createMessage('user1', '在一起三年'),
      ];
      const score = aggregateEmotionScore(messages);
      expect(score.level).toBe('critical'); // "分手" is strong
      expect(score.matchedKeywords).toContain('分手');
      expect(score.matchedKeywords).toContain('烦');
    });

    it('should return none for empty messages', () => {
      const score = aggregateEmotionScore([]);
      expect(score.level).toBe('none');
      expect(score.score).toBe(0);
    });

    it('should deduplicate keywords', () => {
      const messages = [
        createMessage('user1', '好难过'),
        createMessage('user1', '真的好难过'),
      ];
      const score = aggregateEmotionScore(messages);
      // "难过" appears in both but should only be listed once
      const count = score.matchedKeywords.filter((k) => k === '难过').length;
      expect(count).toBe(1);
    });
  });
});
