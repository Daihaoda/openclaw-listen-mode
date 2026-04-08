import { describe, it, expect } from 'vitest';
import { StatsCollector } from '../../src/core/stats.js';

describe('StatsCollector', () => {
  it('should record sessions and calculate accuracy', () => {
    const stats = new StatsCollector();
    stats.recordSession({
      triggerType: 'manual',
      exitReason: 'silence_timeout',
      emotionLevel: 'high',
      rounds: 1,
      personaId: 'warm-friend',
      responseTriggered: true,
    });

    const result = stats.getStats();
    expect(result.totalSessions).toBe(1);
    expect(result.triggerAccuracy).toBe(1);
  });

  it('should track aborted sessions', () => {
    const stats = new StatsCollector();
    stats.recordSession({
      triggerType: 'auto',
      exitReason: 'user_abort',
      emotionLevel: 'medium',
      rounds: 1,
      personaId: 'warm-friend',
      responseTriggered: false,
    });

    const result = stats.getStats();
    expect(result.totalSessions).toBe(1);
    expect(result.abortedSessions).toBe(1);
    expect(result.triggerAccuracy).toBe(0);
  });

  it('should track distribution counters', () => {
    const stats = new StatsCollector();
    stats.recordSession({
      triggerType: 'manual',
      exitReason: 'silence_timeout',
      emotionLevel: 'critical',
      rounds: 2,
      personaId: 'bro',
      responseTriggered: true,
    });

    const result = stats.getStats();
    expect(result.triggerTypes['manual']).toBe(1);
    expect(result.exitReasons['silence_timeout']).toBe(1);
    expect(result.emotionLevels['critical']).toBe(1);
    expect(result.personaUsage['bro']).toBe(1);
    expect(result.avgRoundsPerSession).toBe(2);
  });

  it('should record delivery stats', () => {
    const stats = new StatsCollector();
    stats.recordDelivery(false);
    stats.recordDelivery(true);
    stats.recordDelivery(false);

    const result = stats.getStats();
    expect(result.totalDeliveries).toBe(3);
    expect(result.deliveryCancelCount).toBe(1);
  });

  it('should reset stats', () => {
    const stats = new StatsCollector();
    stats.recordSession({
      triggerType: 'manual',
      exitReason: 'silence_timeout',
      emotionLevel: 'high',
      rounds: 1,
      personaId: 'warm-friend',
      responseTriggered: true,
    });
    stats.reset();

    const result = stats.getStats();
    expect(result.totalSessions).toBe(0);
  });

  it('should serialize and deserialize', () => {
    const stats = new StatsCollector();
    stats.recordSession({
      triggerType: 'manual',
      exitReason: 'question_detected',
      emotionLevel: 'high',
      rounds: 3,
      personaId: 'soft-sister',
      responseTriggered: true,
    });

    const json = stats.toJSON();
    const stats2 = new StatsCollector();
    stats2.fromJSON(json);

    expect(stats2.getStats().totalSessions).toBe(1);
    expect(stats2.getStats().personaUsage['soft-sister']).toBe(1);
  });

  it('should not record when disabled', () => {
    const stats = new StatsCollector({ enabled: false });
    stats.recordSession({
      triggerType: 'manual',
      exitReason: 'silence_timeout',
      emotionLevel: 'none',
      rounds: 1,
      personaId: 'warm-friend',
      responseTriggered: true,
    });

    expect(stats.getStats().totalSessions).toBe(0);
  });
});
