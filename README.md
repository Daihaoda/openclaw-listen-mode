# @im_dd/openclaw-listen-mode

> An OpenClaw plugin that teaches AI to shut up and listen first.
> 让 AI 学会闭嘴，先听完再说。

[![npm version](https://img.shields.io/npm/v/@im_dd/openclaw-listen-mode)](https://www.npmjs.com/package/@im_dd/openclaw-listen-mode)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is this?

When users send multiple messages to an AI chatbot, the AI typically responds after every single message. This creates an interrupted experience — the AI starts answering before hearing the full story.

**Listen Mode** fixes this. The plugin:

1. **Intercepts** all incoming messages via OpenClaw's `before_dispatch` hook
2. **Buffers** messages with a 2-second debounce window
3. **Judges** completeness using a parallel LLM call (DONE/WAIT semantic analysis)
4. **Responds** once with full context via `runEmbeddedPiAgent` (OpenClaw pipeline)

```
User: My friend broke up
User: Her boyfriend cheated
User: Her bestie found out
AI:   (waits for all messages...)
AI:   That's terrible... cheated AND got caught by her bestie.
      How is she doing? Is someone with her?
```

## Architecture (v3)

```
User sends message
  |
  v
before_dispatch hook intercepts
  -> { handled: true } blocks default AI response
  -> message enters buffer
  -> 2s debounce timer starts
  -> parallel semantic judge (DONE/WAIT) via LLM
  |
  |-- DONE: trigger AI immediately
  |-- WAIT: extend timer by 3s
  |-- timeout/error: fallback to debounce
  |
  v (timer expires)
runEmbeddedPiAgent (full OpenClaw pipeline)
  -> session history preserved
  -> memory-tdai (long-term memory)
  -> prompt build (system prompt + context)
  -> LLM call
  -> memory capture
  |
  v
AI reply delivered to user
  -> via agent's message tool (primary)
  -> via channel Bot API (fallback)
```

### Abort on New Message

If the user sends another message while AI is generating:

```
User: message1 -> AI starts generating...
User: message2 -> AbortController cancels AI call
                -> buffer keeps message1 + message2
                -> re-trigger AI with all messages
```

### Semantic Judge

A parallel LLM call determines if the user has finished their thought:

| Buffer | Judgment | Reason |
|--------|----------|--------|
| "I want to tell you something" | WAIT | Opening statement, more coming |
| "Write me an email to my boss saying I'm sick tomorrow" | DONE | Complete request |
| "My friend broke up" | WAIT | Story just starting |
| "How's the weather?" | DONE | Complete question |

The judge runs in parallel with the debounce timer. If it returns before the timer, it can either trigger AI early (DONE) or extend the wait (WAIT). On timeout or error, the original debounce behavior is preserved.

### Duplicate Detection

Skips identical consecutive messages from the same sender (OpenClaw's Telegram polling sometimes dispatches the same batch twice).

## Platform Support

| Platform | Intercept | AI Pipeline | Reply Delivery | Status |
|----------|-----------|-------------|----------------|--------|
| **Telegram** | api.on('before_dispatch') | runEmbeddedPiAgent | message tool + Bot API fallback | **Supported** |
| WeChat | api.on('before_dispatch') | runEmbeddedPiAgent | Blocked by channel routing | Not yet |
| Discord | api.on('before_dispatch') | runEmbeddedPiAgent | Pending adapter | Not yet |
| Slack | api.on('before_dispatch') | runEmbeddedPiAgent | Pending adapter | Not yet |

**Currently only Telegram is fully supported.** Other channels pass through to OpenClaw's default handling. The core intercept + buffer + judge logic is platform-agnostic; the blocker for other channels is reply delivery routing (`runEmbeddedPiAgent`'s message tool routes by session origin, not by the current message's channel).

## Performance

| Metric | Value |
|--------|-------|
| Cold start | ~80-120s (first message, session + memory init) |
| Warm response | 8-19s (subsequent messages) |
| Debounce window | 2s |
| Judge timeout | 3s |
| WAIT extension | +3s |

## Install

```bash
npm install @im_dd/openclaw-listen-mode
```

The plugin is automatically discovered by OpenClaw when placed in `~/.openclaw/extensions/listen-mode/`.

## Configuration

Zero configuration required. The plugin reads LLM provider settings from OpenClaw's `openclaw.json`:

- **Model/Provider**: Uses the first configured provider (e.g., MiniMax, OpenAI, Anthropic)
- **Bot Token**: Reads from `channels.telegram.botToken` for Telegram delivery
- **Session**: Automatically resolves from OpenClaw's session store

### Tunable Constants

```javascript
DEBOUNCE_MS = 2000        // Debounce window (ms)
WAIT_EXTEND_MS = 3000     // Extra wait when judge returns WAIT (ms)
JUDGE_TIMEOUT_MS = 3000   // Judge LLM call timeout (ms)
SKIP_JUDGE_CHARS = 5      // Skip judge for single messages <= this length
```

## How It Works (Under the Hood)

1. **`api.on('before_dispatch')`** — OpenClaw hook that fires for every incoming message. Returns `{ handled: true }` to prevent default processing.

2. **`runEmbeddedPiAgent`** — OpenClaw's internal API that runs the full agent pipeline: session history loading, memory recall, prompt building, LLM call, memory capture, and response generation. This ensures the AI has full conversation context and long-term memory.

3. **Session Resolution** — The plugin reads `~/.openclaw/agents/main/sessions/sessions.json` to map session keys to UUIDs, then passes the correct session file path to `runEmbeddedPiAgent`.

4. **Reply Delivery** — Primary: `runEmbeddedPiAgent`'s internal message tool sends replies directly. Fallback: If the agent didn't send, the plugin uses the channel's Bot API.

5. **Semantic Judge** — A lightweight LLM call with a specialized prompt that outputs only `DONE` or `WAIT`. Runs in parallel with the debounce timer. The result is extracted from the model's thinking content (for models like MiniMax that output thinking first).

## Version History

| Version | Changes |
|---------|---------|
| 2.0.1 | Fix duplicate replies (agent message tool + Bot API double-send) |
| 2.0.0 | v3: Semantic judge + runEmbeddedPiAgent + channel-agnostic + dedup |
| 1.0.0 | Instant response + abort-on-new-message |
| 0.5.0 | Debounce + abort mode |
| 0.4.x | api.on() hook discovery, bridgedChannels |
| 0.3.x | LLM completeness check, silence-based exit |
| 0.2.x | Dynamic timeout v2, emotion-aware acks |

## Testing

```bash
npm test              # Run all 135 tests
npm run test:watch    # Watch mode
```

## License

MIT
