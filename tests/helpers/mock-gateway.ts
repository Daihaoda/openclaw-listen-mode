import type { GatewayContext, SendOptions, SendToAgentOptions, LLMCallOptions } from '../../src/types/plugin-api.js';

interface SendRecord {
  senderId: string;
  content: string;
  options?: SendOptions;
}

interface AgentCallRecord {
  senderId: string;
  content: string;
  options?: SendToAgentOptions;
}

export function createMockGateway(options?: {
  agentReply?: string;
  llmReply?: string;
}): GatewayContext & {
  sentMessages: SendRecord[];
  agentCalls: AgentCallRecord[];
  llmCalls: string[];
} {
  const sentMessages: SendRecord[] = [];
  const agentCalls: AgentCallRecord[] = [];
  const llmCalls: string[] = [];

  return {
    sentMessages,
    agentCalls,
    llmCalls,
    async sendToUser(senderId: string, content: string, opts?: SendOptions) {
      sentMessages.push({ senderId, content, options: opts });
    },
    async sendToAgent(senderId: string, content: string, opts?: SendToAgentOptions) {
      agentCalls.push({ senderId, content, options: opts });
      return options?.agentReply ?? 'Agent response';
    },
    async callLLM(prompt: string, _opts?: LLMCallOptions) {
      llmCalls.push(prompt);
      return options?.llmReply ?? '嗯嗯';
    },
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };
}

export function createMessage(
  senderId: string,
  content: string,
  overrides?: { id?: string; timestamp?: number; channel?: string; type?: 'text' },
) {
  return {
    id: overrides?.id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    senderId,
    content,
    timestamp: overrides?.timestamp ?? Date.now(),
    type: overrides?.type ?? ('text' as const),
    ...overrides,
  };
}
