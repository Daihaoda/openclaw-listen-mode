import { describe, it, expect } from 'vitest';
import { calculateDynamicTimeout, DEFAULT_DYNAMIC_TIMEOUT } from '../../src/core/dynamic-timeout.js';

const D = DEFAULT_DYNAMIC_TIMEOUT;

describe('DynamicTimeout v2', () => {
  it('should return base timeout for simple message', () => {
    // base=7000, no modifiers
    expect(calculateDynamicTimeout([], D, false, '嗯')).toBe(7000);
  });

  it('should reduce timeout for question marks', () => {
    // base=7000 × question=0.3 = 2100, clamped to min=2000
    expect(calculateDynamicTimeout([], D, false, '你觉得呢？')).toBe(2100);
  });

  it('should reduce timeout for complete sentences (period)', () => {
    // base=7000 × complete=0.5 = 3500
    expect(calculateDynamicTimeout([], D, false, '说完了。')).toBe(3500);
  });

  it('should increase timeout for ellipsis', () => {
    // base=7000 × incomplete=1.5 = 10500
    expect(calculateDynamicTimeout([], D, false, '就很无语...')).toBe(10500);
  });

  it('should increase timeout for Chinese ellipsis', () => {
    // base=7000 × incomplete=1.5 = 10500
    expect(calculateDynamicTimeout([], D, false, '就很无语…')).toBe(10500);
  });

  it('should add length bonus for long messages', () => {
    const longMsg = '三年了他说不合适我真的很难接受这个事实我到现在都还没有办法释怀。'; // >30 chars
    // (base=7000 + lengthBonus=5000) × complete=0.5 = 6000
    expect(calculateDynamicTimeout([], D, false, longMsg)).toBe(6000);
  });

  it('should add voice bonus', () => {
    // (base=7000 + voice=15000) = 22000
    expect(calculateDynamicTimeout([], D, true, '嗯')).toBe(22000);
  });

  it('should detect accelerating trend (intervals shrinking)', () => {
    // Intervals: 8000→5000→3000, diff = 3000-8000 = -5000 < -2000 → accel=1.3
    // base=7000 × 1.0(no punct) × 1.3 = 9100
    const timestamps = [0, 8000, 13000, 16000];
    expect(calculateDynamicTimeout(timestamps, D, false, '而且')).toBe(9100);
  });

  it('should detect decelerating trend (intervals growing)', () => {
    // Intervals: 3000→8000→15000, diff = 15000-3000 = 12000 > 2000 → decel=0.7
    // base=7000 × complete=0.5 × decel=0.7 = 2450
    const timestamps = [0, 3000, 11000, 26000];
    expect(calculateDynamicTimeout(timestamps, D, false, '就这样吧。')).toBe(2450);
  });

  it('should clamp to minimum', () => {
    // Decel: 7000 × question=0.3 × decel=0.7 = 1470, clamped to min=2000
    const timestamps = [0, 3000, 11000, 26000];
    expect(calculateDynamicTimeout(timestamps, D, false, '怎么办？')).toBe(2000);
  });

  it('should clamp to maximum', () => {
    // (base=7000 + voice=15000) × incomplete=1.5 × accel=1.3 = 42900, clamped to max=30000
    const timestamps = [0, 8000, 13000, 16000];
    expect(calculateDynamicTimeout(timestamps, D, true, '然后...')).toBe(30000);
  });

  it('should handle empty text', () => {
    expect(calculateDynamicTimeout([], D, false, '')).toBe(7000);
  });

  it('should handle comma as incomplete', () => {
    // base=7000 × incomplete=1.5 = 10500
    expect(calculateDynamicTimeout([], D, false, '但是，')).toBe(10500);
  });
});
