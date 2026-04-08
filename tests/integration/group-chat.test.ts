import { describe, it, expect, beforeEach } from 'vitest';
import { ListenModePlugin } from '../../src/plugin.js';
import { createMockGateway } from '../helpers/mock-gateway.js';
import type { InboundMessage } from '../../src/types/message.js';

describe('Group Chat Support', () => {
  let plugin: ListenModePlugin;
  let gateway: ReturnType<typeof createMockGateway>;

  beforeEach(async () => {
    gateway = createMockGateway({
      agentReply: '心疼你<<<SPLIT>>>加油',
    });
    plugin = new ListenModePlugin({ ack: { useLLM: false } });
    await plugin.init(gateway);
  });

  it('should ignore group messages that do not mention the bot', async () => {
    const msg: InboundMessage = {
      id: 'msg1',
      senderId: 'user1',
      content: '你听我说',
      timestamp: Date.now(),
      groupId: 'group1',
      mentionsBot: false,
      type: 'text',
    };

    const result = await plugin.onInboundMessage(msg);
    expect(result).toBe('passthrough');
    expect(gateway.sentMessages.length).toBe(0);
  });

  it('should process group messages that mention the bot', async () => {
    const msg: InboundMessage = {
      id: 'msg2',
      senderId: 'user1',
      content: '你听我说',
      timestamp: Date.now(),
      groupId: 'group1',
      mentionsBot: true,
      type: 'text',
    };

    const result = await plugin.onInboundMessage(msg);
    expect(result).toBe('handled');
    // Entry response should be sent
    expect(gateway.sentMessages.length).toBe(1);
  });

  it('should process non-group messages normally (no groupId)', async () => {
    const msg: InboundMessage = {
      id: 'msg3',
      senderId: 'user1',
      content: '你听我说',
      timestamp: Date.now(),
      type: 'text',
    };

    const result = await plugin.onInboundMessage(msg);
    expect(result).toBe('handled');
    expect(gateway.sentMessages.length).toBe(1);
  });
});
