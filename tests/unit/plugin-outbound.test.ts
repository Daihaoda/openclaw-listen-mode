import { describe, it, expect, beforeEach } from 'vitest';
import { ListenModePlugin } from '../../src/plugin.js';
import { createMockGateway } from '../helpers/mock-gateway.js';
import type { OutboundMessage } from '../../src/types/message.js';

describe('Plugin onOutboundMessage', () => {
  let plugin: ListenModePlugin;
  let gateway: ReturnType<typeof createMockGateway>;

  beforeEach(async () => {
    gateway = createMockGateway();
    plugin = new ListenModePlugin();
    await plugin.init(gateway);
  });

  it('should split messages with <<<SPLIT>>> markers', async () => {
    const msg: OutboundMessage = {
      senderId: 'user1',
      content: '第一句<<<SPLIT>>>第二句<<<SPLIT>>>第三句',
    };

    const result = await plugin.onOutboundMessage(msg);
    expect(Array.isArray(result)).toBe(true);
    const arr = result as OutboundMessage[];
    expect(arr).toHaveLength(3);
    expect(arr[0].content).toBe('第一句');
    expect(arr[1].content).toBe('第二句');
    expect(arr[2].content).toBe('第三句');
  });

  it('should handle sticker markers in outbound messages', async () => {
    const msg: OutboundMessage = {
      senderId: 'user1',
      content: '文字<<<SPLIT>>><<<STICKER:comfort>>><<<SPLIT>>>另一句',
    };

    const result = await plugin.onOutboundMessage(msg);
    expect(Array.isArray(result)).toBe(true);
    const arr = result as OutboundMessage[];
    expect(arr).toHaveLength(3);
    expect(arr[0].content).toBe('文字');
    expect(arr[0].type).toBe('text');
    expect(arr[1].type).toBe('sticker');
    expect(arr[1].stickerCategory).toBe('comfort');
    expect(arr[2].content).toBe('另一句');
  });

  it('should pass through messages without split markers', async () => {
    const msg: OutboundMessage = {
      senderId: 'user1',
      content: '普通回复',
    };

    const result = await plugin.onOutboundMessage(msg);
    expect(Array.isArray(result)).toBe(false);
    expect((result as OutboundMessage).content).toBe('普通回复');
  });

  it('should pass through when split is disabled', async () => {
    const disabledPlugin = new ListenModePlugin({ reply: { splitEnabled: false } });
    await disabledPlugin.init(gateway);

    const msg: OutboundMessage = {
      senderId: 'user1',
      content: '第一句<<<SPLIT>>>第二句',
    };

    const result = await disabledPlugin.onOutboundMessage(msg);
    expect(Array.isArray(result)).toBe(false);
    expect((result as OutboundMessage).content).toBe('第一句<<<SPLIT>>>第二句');
  });
});
