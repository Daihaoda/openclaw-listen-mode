import { describe, it, expect } from 'vitest';
import { splitReply } from '../../src/delivery/reply-splitter.js';

describe('ReplySplitter', () => {
  it('should split by <<<SPLIT>>> delimiter', () => {
    const input = '第一句话<<<SPLIT>>>第二句话<<<SPLIT>>>第三句话';
    const result = splitReply(input);
    expect(result).toEqual([
      { type: 'text', content: '第一句话' },
      { type: 'text', content: '第二句话' },
      { type: 'text', content: '第三句话' },
    ]);
  });

  it('should parse sticker markers', () => {
    const input = '文字消息<<<SPLIT>>><<<STICKER:comfort>>><<<SPLIT>>>另一句';
    const result = splitReply(input);
    expect(result).toEqual([
      { type: 'text', content: '文字消息' },
      { type: 'sticker', category: 'comfort' },
      { type: 'text', content: '另一句' },
    ]);
  });

  it('should handle content without split markers', () => {
    const input = '普通回复内容';
    const result = splitReply(input);
    expect(result).toEqual([{ type: 'text', content: '普通回复内容' }]);
  });

  it('should filter empty segments', () => {
    const input = '<<<SPLIT>>>第一句<<<SPLIT>>><<<SPLIT>>>第二句<<<SPLIT>>>';
    const result = splitReply(input);
    expect(result).toEqual([
      { type: 'text', content: '第一句' },
      { type: 'text', content: '第二句' },
    ]);
  });

  it('should trim whitespace', () => {
    const input = '  第一句  <<<SPLIT>>>  第二句  ';
    const result = splitReply(input);
    expect(result).toEqual([
      { type: 'text', content: '第一句' },
      { type: 'text', content: '第二句' },
    ]);
  });
});
