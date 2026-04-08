import { describe, it, expect, vi } from 'vitest';
import { AnalyticsEmitter } from '../../src/core/analytics.js';
import type { ListenSessionEvent } from '../../src/core/analytics.js';

const sampleEvent: ListenSessionEvent = {
  type: 'listen_session_complete',
  senderId: 'user1',
  timestamp: Date.now(),
  triggerType: 'manual',
  exitReason: 'silence_timeout',
  language: 'zh',
  messageCount: 5,
  durationMs: 30000,
  ackCount: 2,
  emotionLevel: 'high',
  responseTriggered: true,
};

describe('AnalyticsEmitter', () => {
  it('should emit events to registered handlers', () => {
    const emitter = new AnalyticsEmitter();
    const handler = vi.fn();

    emitter.on('session_complete', handler);
    emitter.emit('session_complete', sampleEvent);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(sampleEvent);
  });

  it('should support multiple handlers', () => {
    const emitter = new AnalyticsEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('session_complete', handler1);
    emitter.on('session_complete', handler2);
    emitter.emit('session_complete', sampleEvent);

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('should remove handlers with off()', () => {
    const emitter = new AnalyticsEmitter();
    const handler = vi.fn();

    emitter.on('session_complete', handler);
    emitter.off('session_complete', handler);
    emitter.emit('session_complete', sampleEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not crash if handler throws', () => {
    const emitter = new AnalyticsEmitter();
    const badHandler = vi.fn(() => {
      throw new Error('oops');
    });
    const goodHandler = vi.fn();

    emitter.on('session_complete', badHandler);
    emitter.on('session_complete', goodHandler);
    emitter.emit('session_complete', sampleEvent);

    // Both should have been called
    expect(badHandler).toHaveBeenCalledOnce();
    expect(goodHandler).toHaveBeenCalledOnce();
  });

  it('should clear all listeners', () => {
    const emitter = new AnalyticsEmitter();
    const handler = vi.fn();

    emitter.on('session_complete', handler);
    emitter.removeAllListeners();
    emitter.emit('session_complete', sampleEvent);

    expect(handler).not.toHaveBeenCalled();
  });
});
