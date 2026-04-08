import { describe, it, expect, vi } from 'vitest';
import { classifyIntent, clearClassificationCache } from '../../src/core/intent-classifier.js';
import { DEFAULT_INTENT_CONFIG } from '../../src/core/intent-classifier.js';
import { createMockGateway } from '../helpers/mock-gateway.js';

describe('IntentClassifier', () => {
  beforeEach(() => {
    clearClassificationCache();
  });

  it('should classify vent intent', async () => {
    const gateway = createMockGateway({ llmReply: '{"intent":"vent","level":3}' });
    const result = await classifyIntent(gateway, 'user1', '我好难过', DEFAULT_INTENT_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.intent).toBe('vent');
    expect(result!.emotionLevel).toBe(3);
  });

  it('should classify task intent', async () => {
    const gateway = createMockGateway({ llmReply: '{"intent":"task"}' });
    const result = await classifyIntent(gateway, 'user1', '帮我写个函数', DEFAULT_INTENT_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.intent).toBe('task');
    expect(result!.emotionLevel).toBeUndefined();
  });

  it('should classify chat intent', async () => {
    const gateway = createMockGateway({ llmReply: '{"intent":"chat"}' });
    const result = await classifyIntent(gateway, 'user1', '今天天气不错', DEFAULT_INTENT_CONFIG);
    expect(result!.intent).toBe('chat');
  });

  it('should return null when disabled', async () => {
    const gateway = createMockGateway();
    const result = await classifyIntent(gateway, 'user1', '测试', { ...DEFAULT_INTENT_CONFIG, enabled: false });
    expect(result).toBeNull();
  });

  it('should return null on LLM failure', async () => {
    const gateway = createMockGateway();
    gateway.callLLM = vi.fn().mockRejectedValue(new Error('timeout'));
    const result = await classifyIntent(gateway, 'user1', '测试', DEFAULT_INTENT_CONFIG);
    expect(result).toBeNull();
  });

  it('should cache results for same sender/content', async () => {
    const gateway = createMockGateway({ llmReply: '{"intent":"vent","level":2}' });
    await classifyIntent(gateway, 'user1', '我好烦', DEFAULT_INTENT_CONFIG);
    await classifyIntent(gateway, 'user1', '我好烦', DEFAULT_INTENT_CONFIG);
    expect(gateway.llmCalls.length).toBe(1); // Only one LLM call
  });

  it('should clamp emotion level to 1-5', async () => {
    const gateway = createMockGateway({ llmReply: '{"intent":"vent","level":8}' });
    const result = await classifyIntent(gateway, 'user1', '测试', DEFAULT_INTENT_CONFIG);
    expect(result!.emotionLevel).toBe(5);
  });

  it('should handle malformed JSON gracefully', async () => {
    const gateway = createMockGateway({ llmReply: 'not json at all' });
    const result = await classifyIntent(gateway, 'user1', '测试', DEFAULT_INTENT_CONFIG);
    expect(result).toBeNull();
  });
});
