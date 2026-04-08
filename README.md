# @im_dd/openclaw-listen-mode

> An OpenClaw plugin that teaches AI to shut up and listen first.
> 让 AI 学会闭嘴，先听完再说。

[![npm version](https://img.shields.io/npm/v/@im_dd/openclaw-listen-mode)](https://www.npmjs.com/package/@im_dd/openclaw-listen-mode)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is this?

When users vent to an AI chatbot, the AI typically responds after every single message. This creates an awkward, interrupted experience — like talking to someone who keeps cutting you off.

**Listen Mode** fixes this. When activated, the AI:

1. **Shuts up** and lets the user talk
2. **Buffers** all messages during the silence
3. **Waits** intelligently (dynamic timeout based on punctuation, typing speed, message length)
4. **Responds** with a single, comprehensive empathic reply that addresses everything the user said

```
User: 我朋友跟我说了件事
User: 她男朋友劈腿了
User: 被她闺蜜发现的
User: 然后她男朋友还死不承认
AI:   (listening... 🎧)
User: 她现在特别难过
AI:   天呐这也太过分了吧... 被闺蜜发现的还死不承认，你朋友现在肯定又气又伤心
      <<<SPLIT>>>
      她现在怎么样了？有没有人陪着她
```

## Features

- **State Machine**: `NORMAL → LISTENING → RESPONDING` with stay-in-mode support
- **Dynamic Silence Timeout**: Rule-based 4-layer calculation — punctuation, message length, typing speed, voice detection
- **LLM Completeness Check**: Asks a lightweight LLM "has the user finished talking?" before responding
- **Emotion-Aware Acks**: 6 emotion categories (anger, sadness, anxiety, helpless, gossip, rant) with keyword classification
- **Silence-Based Exit**: 5 minutes of no messages → warm farewell → exit (resets on every message)
- **Intent Classification**: LLM-based task/vent/chat classification with keyword fallback
- **Multi-Round Sessions**: Responds but stays in listen mode — user's conversation is continuous
- **Persona System**: Switchable personas with preset and custom definitions
- **i18n**: Chinese and English support
- **135 Tests**: Comprehensive unit and integration test coverage

## Install

```bash
npm install @im_dd/openclaw-listen-mode
```

## Quick Start

```typescript
import { ListenModePlugin } from '@im_dd/openclaw-listen-mode';

const plugin = new ListenModePlugin();
// or with custom config:
const plugin = new ListenModePlugin({
  silenceTimeoutMs: 20000,
  maxListenTimeMs: 300000,  // 5min silence exit
  completenessCheck: {
    enabled: true,           // LLM completeness check (default: on)
  },
});
```

## How It Works

### Trigger → Listen → Respond → Stay

```
User says "听我说" (trigger phrase)
  → AI: "我在，你说 🫶" (entry ack)
  → Enter LISTENING mode

User sends messages...
  → Buffer all messages
  → Send emotion-aware acks every 5-7 messages
  → Dynamic silence timer resets on each message

User stops typing...
  → Silence timer fires (7-30s dynamic)
  → LLM completeness check: "User finished?" 
    → No → extend 7s, check again (max 2x)
    → Yes → merge buffer → send to AI agent
  → AI responds comprehensively
  → Stay in LISTENING mode (wait for more)

User says "不聊了" (exit phrase)
  → AI: "好嘞，随时来找我" (farewell)
  → Exit to NORMAL mode

-- OR --

5 minutes of silence after last message
  → AI: "我先在这等你哈，回来了随时继续说 ☺️"
  → Exit to NORMAL mode
```

### Dynamic Silence Timeout

The silence timeout adapts to the user's behavior in real-time:

```
timeout = (base + lengthBonus + voiceBonus) × punctuation × trend
```

| Layer | Rule | Effect |
|-------|------|--------|
| Base | 7 seconds | Default wait time |
| Length | Message > 30 chars | +5s bonus |
| Voice | Last message is voice | +15s bonus |
| Punctuation | `？` question mark | ×0.3 (respond fast) |
| | `。` period | ×0.5 (sentence done) |
| | `...` `，` ellipsis/comma | ×1.5 (still thinking) |
| Trend | Typing faster | ×1.3 (wait longer) |
| | Typing slower | ×0.7 (almost done) |

Clamped to **[2s, 30s]**.

### LLM Completeness Check

When the silence timer fires, instead of responding immediately:

```
Timer fires → LLM: "Has user finished their thought?"
  → {"done": false} → extend 7s, try again (max 2 extensions)
  → {"done": true}  → trigger response
  → LLM error       → fallback to immediate response
```

Cost: ~140 tokens per check, max 2 checks per round. Negligible.

## Configuration

All options with defaults:

```typescript
{
  // Trigger
  triggerMode: 'both',           // 'manual' | 'auto' | 'both'
  sensitivity: 'high',           // 'low' | 'medium' | 'high'
  languages: ['zh', 'en'],

  // Timing
  silenceTimeoutMs: 20000,       // Base silence timeout (dynamic overrides this)
  maxListenTimeMs: 300000,       // 5min silence → exit
  maxBufferMessages: 20,         // Max messages before forced response

  // Acknowledgments
  ack: {
    entryReply: true,            // Send "我在，你说" on enter
    intervalMessages: [5, 7],    // Ack every 5-7 messages
    useLLM: true,                // Use LLM for contextual acks
    llmModel: 'haiku',           // Cheap model for acks
  },

  // Reply splitting (for WeChat multi-bubble)
  reply: {
    splitEnabled: true,
    maxCharsPerMessage: 50,
    delayBaseMs: 1500,           // Human-like typing delay
  },

  // Intelligence
  intelligence: {
    intentClassification: true,   // LLM intent detection
    fallbackToKeywords: true,     // Keyword fallback if LLM fails
  },

  // Dynamic timeout
  dynamicTimeout: {
    enabled: true,
    minMs: 10000,
    maxMs: 30000,
    voiceExtraMs: 15000,
  },

  // LLM completeness check
  completenessCheck: {
    enabled: true,
    model: 'auto',               // Use gateway default model
    timeoutMs: 1500,
    maxExtensions: 2,            // Max 2 extensions (2×7s = 14s extra)
    extensionMs: 7000,           // 7s per extension
  },

  // Persona
  persona: {
    default: 'warm-friend',
    allowSwitch: true,
  },

  // Session
  session: {
    enabled: true,
    maxDurationMs: 600000,       // 10min session cap
    maxRounds: 5,
  },
}
```

## Project Structure

```
src/
├── ack/                    # Acknowledgment system
│   ├── emotion-category.ts   # 6-category emotion classifier
│   ├── entry-responder.ts    # Entry/exit/farewell messages
│   ├── fallback-pool.ts      # Emotion-specific ack pools
│   ├── interim-responder.ts  # Mid-listen ack logic
│   └── llm-ack-generator.ts  # LLM-powered contextual acks
├── config/                 # Configuration
│   ├── defaults.ts           # Default values
│   ├── merger.ts             # Deep merge user config
│   └── schema.ts             # Zod validation
├── core/                   # Core logic
│   ├── state-machine.ts      # Main state machine (NORMAL/LISTENING/RESPONDING)
│   ├── dynamic-timeout.ts    # 4-layer dynamic silence timeout
│   ├── completeness-checker.ts # LLM "user finished?" check
│   ├── exit-detector.ts      # Exit condition detection
│   ├── intent-classifier.ts  # LLM intent classification
│   ├── emotion-scorer.ts     # Emotion intensity scoring
│   ├── message-buffer.ts     # Per-user message buffering
│   ├── message-merger.ts     # Buffer → single prompt
│   ├── persona.ts            # Persona management
│   ├── listen-session.ts     # Multi-round session tracking
│   └── analytics.ts          # Session analytics events
├── delivery/               # Message delivery
│   ├── reply-splitter.ts     # <<<SPLIT>>> handling
│   ├── delivery-queue.ts     # Ordered delivery with delays
│   └── delay-calculator.ts   # Human-like typing delays
├── i18n/                   # Internationalization
│   ├── keywords-zh.ts        # Chinese triggers/exits/tasks
│   ├── keywords-en.ts        # English triggers/exits/tasks
│   └── responses.ts          # Ack/farewell response pools
├── types/                  # TypeScript types
└── plugin.ts               # Plugin entry point
```

## Testing

```bash
npm test              # Run all 135 tests
npm run test:watch    # Watch mode
```

## License

MIT
