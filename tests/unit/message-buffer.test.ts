import { describe, it, expect } from 'vitest';
import { MessageBuffer } from '../../src/core/message-buffer.js';
import { createMessage } from '../helpers/mock-gateway.js';

describe('MessageBuffer', () => {
  it('should buffer messages per sender', () => {
    const buffer = new MessageBuffer();
    buffer.push('user1', createMessage('user1', 'msg1'));
    buffer.push('user2', createMessage('user2', 'msg2'));
    buffer.push('user1', createMessage('user1', 'msg3'));

    expect(buffer.count('user1')).toBe(2);
    expect(buffer.count('user2')).toBe(1);
  });

  it('should flush messages in order', () => {
    const buffer = new MessageBuffer();
    buffer.push('user1', createMessage('user1', 'first'));
    buffer.push('user1', createMessage('user1', 'second'));

    const flushed = buffer.flush('user1');
    expect(flushed).toHaveLength(2);
    expect(flushed[0].content).toBe('first');
    expect(flushed[1].content).toBe('second');
    expect(buffer.count('user1')).toBe(0);
  });

  it('should clear without returning', () => {
    const buffer = new MessageBuffer();
    buffer.push('user1', createMessage('user1', 'msg'));
    buffer.clear('user1');
    expect(buffer.count('user1')).toBe(0);
    expect(buffer.has('user1')).toBe(false);
  });

  it('should get recent messages', () => {
    const buffer = new MessageBuffer();
    buffer.push('user1', createMessage('user1', 'a'));
    buffer.push('user1', createMessage('user1', 'b'));
    buffer.push('user1', createMessage('user1', 'c'));

    const recent = buffer.getRecent('user1', 2);
    expect(recent).toHaveLength(2);
    expect(recent[0].content).toBe('b');
    expect(recent[1].content).toBe('c');
  });

  it('should return empty for unknown sender', () => {
    const buffer = new MessageBuffer();
    expect(buffer.flush('unknown')).toEqual([]);
    expect(buffer.count('unknown')).toBe(0);
  });
});
