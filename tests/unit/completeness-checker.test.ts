import { describe, it, expect, vi } from 'vitest';
import { checkCompleteness, DEFAULT_COMPLETENESS_CONFIG } from '../../src/core/completeness-checker.js';
import type { InboundMessage } from '../../src/types/message.js';
import type { GatewayContext } from '../../src/types/plugin-api.js';

function makeCtx(llmResponse: string | Error): GatewayContext {
  return {
    sendToUser: vi.fn(),
    sendToAgent: vi.fn(),
    callLLM: vi.fn().mockImplementation(async () => {
      if (llmResponse instanceof Error) throw llmResponse;
      return llmResponse;
    }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  } as unknown as GatewayContext;
}

function makeMessages(texts: string[]): InboundMessage[] {
  return texts.map((t) => ({
    senderId: 'user1',
    content: t,
    timestamp: Date.now(),
  }));
}

const enabledConfig = { ...DEFAULT_COMPLETENESS_CONFIG, enabled: true };

describe('CompletenessChecker', () => {
  it('should return complete=true when LLM says done', async () => {
    const ctx = makeCtx('{"done":true}');
    const result = await checkCompleteness(
      ctx,
      makeMessages(['我朋友分手了', '她很难过']),
      'zh',
      enabledConfig,
    );
    expect(result.complete).toBe(true);
    expect(ctx.callLLM).toHaveBeenCalledOnce();
  });

  it('should return complete=false when LLM says not done', async () => {
    const ctx = makeCtx('{"done":false}');
    const result = await checkCompleteness(
      ctx,
      makeMessages(['我朋友跟我说了件事', '然后...']),
      'zh',
      enabledConfig,
    );
    expect(result.complete).toBe(false);
  });

  it('should fallback to complete=true on LLM error', async () => {
    const ctx = makeCtx(new Error('timeout'));
    const result = await checkCompleteness(
      ctx,
      makeMessages(['测试消息']),
      'zh',
      enabledConfig,
    );
    expect(result.complete).toBe(true);
  });

  it('should fallback to complete=true on malformed JSON', async () => {
    const ctx = makeCtx('I think the user is not done');
    const result = await checkCompleteness(
      ctx,
      makeMessages(['测试消息']),
      'zh',
      enabledConfig,
    );
    expect(result.complete).toBe(true);
  });

  it('should return complete=true when disabled', async () => {
    const ctx = makeCtx('{"done":false}');
    const result = await checkCompleteness(
      ctx,
      makeMessages(['测试消息']),
      'zh',
      { ...DEFAULT_COMPLETENESS_CONFIG, enabled: false }, // explicitly disabled
    );
    expect(result.complete).toBe(true);
    expect(ctx.callLLM).not.toHaveBeenCalled();
  });

  it('should return complete=true for empty messages', async () => {
    const ctx = makeCtx('{"done":false}');
    const result = await checkCompleteness(ctx, [], 'zh', enabledConfig);
    expect(result.complete).toBe(true);
    expect(ctx.callLLM).not.toHaveBeenCalled();
  });

  it('should truncate to last 10 messages', async () => {
    const ctx = makeCtx('{"done":true}');
    const messages = makeMessages(Array.from({ length: 15 }, (_, i) => `消息${i + 1}`));
    await checkCompleteness(ctx, messages, 'zh', enabledConfig);

    const prompt = (ctx.callLLM as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // Should contain [1] through [10], not [1] through [15]
    expect(prompt).toContain('[1]');
    expect(prompt).toContain('[10]');
    expect(prompt).not.toContain('[11]');
  });

  it('should use Chinese prompt for zh language', async () => {
    const ctx = makeCtx('{"done":true}');
    await checkCompleteness(ctx, makeMessages(['你好']), 'zh', enabledConfig);

    const prompt = (ctx.callLLM as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain('用户正在倾诉');
  });

  it('should use English prompt for en language', async () => {
    const ctx = makeCtx('{"done":true}');
    await checkCompleteness(ctx, makeMessages(['hello']), 'en', enabledConfig);

    const prompt = (ctx.callLLM as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain('A user is venting');
  });

  it('should pass correct LLM options', async () => {
    const ctx = makeCtx('{"done":true}');
    const config = { ...enabledConfig, model: 'haiku', timeoutMs: 2000 };
    await checkCompleteness(ctx, makeMessages(['test']), 'zh', config);

    expect(ctx.callLLM).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        model: 'haiku',
        maxTokens: 10,
        timeoutMs: 2000,
      }),
    );
  });

  it('should use undefined model when set to auto', async () => {
    const ctx = makeCtx('{"done":true}');
    await checkCompleteness(ctx, makeMessages(['test']), 'zh', enabledConfig);

    expect(ctx.callLLM).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        model: undefined,
      }),
    );
  });

  it('should handle JSON with extra text around it', async () => {
    const ctx = makeCtx('Based on analysis: {"done":false} end');
    const result = await checkCompleteness(
      ctx,
      makeMessages(['还没说完']),
      'zh',
      enabledConfig,
    );
    expect(result.complete).toBe(false);
  });
});
