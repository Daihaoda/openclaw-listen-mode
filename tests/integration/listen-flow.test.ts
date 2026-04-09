import { describe, it, expect, beforeEach } from 'vitest';
import { StateMachine } from '../../src/core/state-machine.js';
import { ListenState } from '../../src/types/state.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import { createMockGateway, createMessage } from '../helpers/mock-gateway.js';
import type { TimerFactory } from '../../src/utils/timer.js';

function createFakeTimers(): TimerFactory & { fire: (id: number) => void; pendingCount: () => number } {
  let nextId = 1;
  const timers = new Map<number, () => void>();

  return {
    setTimeout: (cb: () => void, _ms: number) => {
      const id = nextId++;
      timers.set(id, cb);
      return id;
    },
    clearTimeout: (id: unknown) => {
      timers.delete(id as number);
    },
    fire: (id: number) => {
      const cb = timers.get(id);
      if (cb) {
        timers.delete(id);
        cb();
      }
    },
    pendingCount: () => timers.size,
  };
}

describe('Listen Flow Integration', () => {
  let gateway: ReturnType<typeof createMockGateway>;
  let timers: ReturnType<typeof createFakeTimers>;
  let sm: StateMachine;

  beforeEach(() => {
    gateway = createMockGateway({
      agentReply: '心疼你<<<SPLIT>>>不是你的错<<<SPLIT>>>今晚好好休息',
    });
    timers = createFakeTimers();
    sm = new StateMachine(
      { ...DEFAULT_CONFIG, ack: { ...DEFAULT_CONFIG.ack, useLLM: false } },
      gateway,
      timers,
    );
  });

  it('should enter listen mode on manual trigger', async () => {
    const result = await sm.handleInbound(createMessage('user1', '你听我说'));
    expect(result).toBe('handled');
    // Entry ack sent
    expect(gateway.sentMessages.length).toBe(1);
  });

  it('should passthrough normal messages', async () => {
    const result = await sm.handleInbound(createMessage('user1', '今天天气怎么样'));
    expect(result).toBe('passthrough');
    expect(sm.getMode('user1')).toBe(ListenState.NORMAL);
  });

  it('should trigger AI immediately on each message in listen mode', async () => {
    await sm.handleInbound(createMessage('user1', '你听我说'));

    // First message triggers AI immediately
    const callsBefore = gateway.agentCalls.length;
    await sm.handleInbound(createMessage('user1', '我分手了'));

    // AI should have been called (at least once more)
    expect(gateway.agentCalls.length).toBeGreaterThan(callsBefore);
    // Last call should contain the message
    const lastCall = gateway.agentCalls[gateway.agentCalls.length - 1];
    expect(lastCall.content).toContain('我分手了');
  });

  it('should include all messages when question triggers response', async () => {
    await sm.handleInbound(createMessage('user1', '你听我说'));
    await sm.handleInbound(createMessage('user1', '我分手了'));
    await sm.handleInbound(createMessage('user1', '你觉得我该怎么办？'));

    // Last agent call should contain all messages
    const lastCall = gateway.agentCalls[gateway.agentCalls.length - 1];
    expect(lastCall.content).toContain('我分手了');
    expect(lastCall.content).toContain('怎么办');
  });

  it('should abort on exit words without triggering response', async () => {
    await sm.handleInbound(createMessage('user1', '你听我说'));

    // Wait for initial response to complete
    await new Promise(r => setTimeout(r, 10));

    const result = await sm.handleInbound(createMessage('user1', '结束聊天'));

    expect(result).toBe('handled');
    // Should have sent farewell
    expect(gateway.sentMessages.some(m => m.content.includes('随时') || m.content.includes('拜拜') || m.content.includes('在的'))).toBe(true);
  });

  it('should handle task instruction mid-listen and stay in mode', async () => {
    await sm.handleInbound(createMessage('user1', '你听我说'));
    await sm.handleInbound(createMessage('user1', '我分手了'));
    await sm.handleInbound(createMessage('user1', '帮我查个东西'));

    // Should have triggered agent response
    expect(gateway.agentCalls.length).toBeGreaterThanOrEqual(1);
    // Last call should contain the task message
    const lastCall = gateway.agentCalls[gateway.agentCalls.length - 1];
    expect(lastCall.content).toContain('帮我查个东西');
  });

  it('should isolate state between senders', async () => {
    await sm.handleInbound(createMessage('user1', '你听我说'));

    const result = await sm.handleInbound(createMessage('user2', '今天天气怎么样'));
    expect(result).toBe('passthrough');
    expect(sm.getMode('user2')).toBe(ListenState.NORMAL);
  });

  it('should include all messages on explicit end phrase', async () => {
    await sm.handleInbound(createMessage('user1', '你听我说'));
    await sm.handleInbound(createMessage('user1', '我被公司裁了'));
    await sm.handleInbound(createMessage('user1', '说完了'));

    // Last agent call should contain the content
    const lastCall = gateway.agentCalls[gateway.agentCalls.length - 1];
    expect(lastCall.content).toContain('我被公司裁了');
  });

  it('should clean up on destroy', async () => {
    await sm.handleInbound(createMessage('user1', '你听我说'));
    sm.destroy();
    expect(sm.getMode('user1')).toBe(ListenState.NORMAL);
  });
});
