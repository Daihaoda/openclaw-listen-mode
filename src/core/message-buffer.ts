import type { InboundMessage } from '../types/message.js';

export class MessageBuffer {
  private buffers = new Map<string, InboundMessage[]>();

  push(senderId: string, message: InboundMessage): void {
    if (!this.buffers.has(senderId)) {
      this.buffers.set(senderId, []);
    }
    this.buffers.get(senderId)!.push(message);
  }

  flush(senderId: string): InboundMessage[] {
    const messages = this.buffers.get(senderId) ?? [];
    this.buffers.delete(senderId);
    return messages;
  }

  clear(senderId: string): void {
    this.buffers.delete(senderId);
  }

  count(senderId: string): number {
    return this.buffers.get(senderId)?.length ?? 0;
  }

  getRecent(senderId: string, n: number): InboundMessage[] {
    const messages = this.buffers.get(senderId) ?? [];
    return messages.slice(-n);
  }

  has(senderId: string): boolean {
    return this.buffers.has(senderId) && this.buffers.get(senderId)!.length > 0;
  }

  clearAll(): void {
    this.buffers.clear();
  }
}
