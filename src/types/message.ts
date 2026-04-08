export interface InboundMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  channel?: string;
  /** Group ID if this is a group chat message */
  groupId?: string;
  /** Whether this message mentions/@ the bot (for group chat) */
  mentionsBot?: boolean;
  /** Message type */
  type?: 'text' | 'image' | 'voice' | 'video' | 'file';
}

export interface OutboundMessage {
  senderId: string;
  content: string;
  type?: 'text' | 'sticker' | 'image';
  stickerCategory?: string;
}

export type SplitMessage =
  | { type: 'text'; content: string }
  | { type: 'sticker'; category: string };
