import { describe, it, expect } from 'vitest';
import { ListenSessionManager } from '../../src/core/listen-session.js';
import { createMessage } from '../helpers/mock-gateway.js';

describe('ListenSessionManager', () => {
  it('should start a new session', () => {
    const sm = new ListenSessionManager();
    const round = sm.startRound('user1');
    expect(round).toBe(1);
    expect(sm.getCurrentRound('user1')).toBe(1);
  });

  it('should track multiple rounds', () => {
    const sm = new ListenSessionManager();
    sm.startRound('user1');
    sm.addMessages('user1', [createMessage('user1', 'msg1')]);
    sm.recordAiResponse('user1', 'response1');

    const round2 = sm.startRound('user1');
    expect(round2).toBe(2);
    expect(sm.hasHistory('user1')).toBe(true);
  });

  it('should build context string with history', () => {
    const sm = new ListenSessionManager();

    sm.startRound('user1');
    sm.addMessages('user1', [createMessage('user1', '我好难过')]);
    sm.recordAiResponse('user1', '怎么啦<<<SPLIT>>>想说的话我在');

    sm.startRound('user1');
    sm.addMessages('user1', [createMessage('user1', '我分手了')]);

    const context = sm.buildContextString('user1', 'zh');
    expect(context).toContain('倾听会话上下文');
    expect(context).toContain('第 1 轮');
    expect(context).toContain('我好难过');
    expect(context).toContain('怎么啦');
    expect(context).toContain('当前消息');
  });

  it('should not include history for first round', () => {
    const sm = new ListenSessionManager();
    sm.startRound('user1');
    const context = sm.buildContextString('user1', 'zh');
    expect(context).toBe('');
  });

  it('should end session on demand', () => {
    const sm = new ListenSessionManager();
    sm.startRound('user1');
    sm.endSession('user1');
    expect(sm.hasHistory('user1')).toBe(false);
    expect(sm.getCurrentRound('user1')).toBe(0);
  });

  it('should respect max rounds', () => {
    const sm = new ListenSessionManager({ maxRounds: 2 });
    sm.startRound('user1');
    sm.startRound('user1');

    // Third round should start a new session
    const round3 = sm.startRound('user1');
    expect(round3).toBe(1); // Reset
    expect(sm.hasHistory('user1')).toBe(false);
  });

  it('should build English context string', () => {
    const sm = new ListenSessionManager();
    sm.startRound('user1');
    sm.addMessages('user1', [createMessage('user1', 'I feel sad')]);
    sm.recordAiResponse('user1', "what's wrong<<<SPLIT>>>I'm here");

    sm.startRound('user1');
    const context = sm.buildContextString('user1', 'en');
    expect(context).toContain('Listen Session Context');
    expect(context).toContain('Round 1');
    expect(context).toContain('I feel sad');
  });
});
