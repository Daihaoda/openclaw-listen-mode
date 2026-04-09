import { z } from 'zod';

export const ackConfigSchema = z.object({
  entryReply: z.boolean(),
  intervalMessages: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  intervalMs: z.tuple([z.number().positive(), z.number().positive()]),
  useLLM: z.boolean(),
  llmModel: z.string(),
  llmTimeoutMs: z.number().positive(),
});

export const replyConfigSchema = z.object({
  splitEnabled: z.boolean(),
  maxCharsPerMessage: z.number().int().positive(),
  delayBaseMs: z.number().nonnegative(),
  delayPerCharMs: z.number().nonnegative(),
  delayRandomMs: z.number().nonnegative(),
});

export const emojiConfigSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['low', 'moderate', 'high']),
  stickerEnabled: z.boolean(),
  stickerDir: z.string(),
});

export const completenessCheckSchema = z.object({
  enabled: z.boolean(),
  model: z.string(),
  timeoutMs: z.number().positive(),
  maxExtensions: z.number().int().min(0).max(5),
  extensionMs: z.number().positive(),
});

export const listenModeConfigSchema = z.object({
  triggerMode: z.enum(['manual', 'auto', 'both']),
  silenceTimeoutMs: z.number().positive(),
  maxListenTimeMs: z.number().positive(),
  maxBufferMessages: z.number().int().positive(),
  sensitivity: z.enum(['low', 'medium', 'high']),
  languages: z.array(z.string()),
  systemHint: z.boolean(),
  ack: ackConfigSchema,
  reply: replyConfigSchema,
  emoji: emojiConfigSchema,
  byChannel: z.record(z.any()),
});
