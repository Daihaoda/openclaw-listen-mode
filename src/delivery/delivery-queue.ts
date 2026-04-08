import type { SplitMessage } from '../types/message.js';
import type { ReplyConfig } from '../types/config.js';
import type { GatewayContext } from '../types/plugin-api.js';
import { calculateDelay } from './delay-calculator.js';

interface QueueEntry {
  abortController: AbortController;
  promise: Promise<void>;
}

class AbortError extends Error {
  constructor() {
    super('Aborted');
    this.name = 'AbortError';
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new AbortError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export class DeliveryQueue {
  private queues = new Map<string, QueueEntry>();

  async enqueue(
    senderId: string,
    messages: SplitMessage[],
    ctx: GatewayContext,
    config: ReplyConfig,
  ): Promise<void> {
    this.cancel(senderId);

    const abortController = new AbortController();
    const { signal } = abortController;

    const promise = (async () => {
      for (let i = 0; i < messages.length; i++) {
        if (signal.aborted) break;

        const msg = messages[i];

        if (msg.type === 'text') {
          await ctx.sendToUser(senderId, msg.content);
        } else if (msg.type === 'sticker') {
          await ctx.sendToUser(senderId, '', {
            type: 'sticker',
            stickerCategory: msg.category,
          });
        }

        if (i < messages.length - 1) {
          try {
            const delay = calculateDelay(msg, config);
            await sleep(delay, signal);
          } catch (e: unknown) {
            if (e instanceof AbortError) {
              ctx.logger.info(
                `Delivery cancelled for sender ${senderId}, ${messages.length - i - 1} messages remaining`,
              );
              break;
            }
            throw e;
          }
        }
      }
    })();

    this.queues.set(senderId, { abortController, promise });

    try {
      await promise;
    } finally {
      const current = this.queues.get(senderId);
      if (current?.promise === promise) {
        this.queues.delete(senderId);
      }
    }
  }

  cancel(senderId: string): void {
    const entry = this.queues.get(senderId);
    if (entry) {
      entry.abortController.abort();
      this.queues.delete(senderId);
    }
  }

  hasPending(senderId: string): boolean {
    return this.queues.has(senderId);
  }

  cancelAll(): void {
    for (const [, entry] of this.queues) {
      entry.abortController.abort();
    }
    this.queues.clear();
  }
}
