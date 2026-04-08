/** Exit farewell responses */
export const EXIT_FAREWELL_ZH = [
  '好的好的，想聊随时找我 🫶',
  '嗯嗯，我都在的',
  '去忙吧，回头再聊 ☺️',
  '好嘞，随时来找我',
  '嗯嗯拜拜，我一直在的',
];

export const EXIT_FAREWELL_EN = [
  "okay okay, I'm always here",
  'take care, talk anytime ☺️',
  "see ya, I'm always around",
  'bye bye, come back anytime 🫶',
];

/** Silence exit responses (long silence, user likely left) */
export const SILENCE_EXIT_ZH = [
  '我先在这等你哈，回来了随时继续说 ☺️',
  '你先忙，想聊了随时找我 🫶',
  '我先不打扰啦，回来了继续说',
  '等你回来，随时继续 ☺️',
];

export const SILENCE_EXIT_EN = [
  "I'll be here when you're back, take your time ☺️",
  "no rush, come back anytime 🫶",
  "I'll wait here, just continue when you're ready",
];

/** Entry responses when manually triggered */
export const ENTRY_MANUAL_ZH = [
  '我在，你说 🫶',
  '我听着呢',
  '好，我在',
  '嗯嗯说吧，我听着',
  '我在呢，慢慢说',
  '好的好的，你说',
  '来，我听着 ☺️',
];

export const ENTRY_MANUAL_EN = [
  "I'm here",
  'go ahead, I\'m listening',
  "I'm all ears ☺️",
  'yeah, I\'m here',
  'go ahead, take your time',
];

/** Entry responses when auto-triggered (emotion detected) */
export const ENTRY_AUTO_ZH = [
  '我在呢',
  '嗯嗯，我在',
  '我听着呢',
  '怎么了，我在',
];

export const ENTRY_AUTO_EN = [
  "I'm here",
  'hey, I\'m listening',
  'what happened?',
  "I'm here, take your time",
];

// ---------------------------------------------------------------------------
// Emotion-categorized fallback ack pools
// ---------------------------------------------------------------------------

export type AckEmotionCategory = 'anger' | 'sadness' | 'anxiety' | 'helpless' | 'gossip' | 'rant';

/** Anger — 愤怒（过分、欺负、凭什么） */
export const ACK_ANGER_ZH = [
  '什么？？过分了吧',
  '不是 这也太过了',
  '气死了吧这个',
  '靠 真的假的',
  '凭什么啊！！',
  '这谁能忍啊',
  '太离谱了…',
  '我听着都气',
];

export const ACK_ANGER_EN = [
  'are you kidding me??',
  'that\'s so messed up',
  'wtf no way',
  'how is that ok??',
  'I\'d be pissed too',
  'that\'s insane...',
  'bruh who does that',
  'absolutely not ok',
];

/** Sadness — 悲伤（难过、分手、走了） */
export const ACK_SADNESS_ZH = [
  '天呐…',
  '嗯嗯我在',
  '唉…',
  '抱抱',
  '我在呢…',
  '嗯嗯你说',
];

export const ACK_SADNESS_EN = [
  'oh no...',
  'I\'m here',
  'hey...',
  'I\'m so sorry',
  'yeah... I\'m listening',
  'take your time',
];

/** Anxiety — 焦虑（紧张、来不及、怎么办） */
export const ACK_ANXIETY_ZH = [
  '别急别急',
  '嗯嗯 先别慌',
  '深呼吸 慢慢说',
  '然后呢？',
  '嗯嗯我在 你说',
  '先别急 继续说',
];

export const ACK_ANXIETY_EN = [
  'ok ok breathe',
  'hey don\'t panic',
  'one thing at a time',
  'ok and then?',
  'I\'m here, keep going',
  'it\'s ok take your time',
];

/** Helpless — 无力（确诊、被裁、没办法） */
export const ACK_HELPLESS_ZH = [
  '靠…',
  '这也太…',
  '嗯嗯…',
  '我在',
  '…',
  '天呐',
];

export const ACK_HELPLESS_EN = [
  'shit...',
  'that\'s...',
  'damn...',
  'I\'m here',
  '...',
  'jeez',
];

/** Gossip — 八卦/日常（默认兜底） */
export const ACK_GOSSIP_ZH = [
  '啊？然后呢',
  '不是吧！！',
  '等等细说细说',
  '卧槽然后呢',
  '所以呢所以呢',
  '真的假的',
  '笑死然后呢',
  '等等？？',
];

export const ACK_GOSSIP_EN = [
  'wait what??',
  'no way!!',
  'omg and then?',
  'hold on tell me more',
  'are you serious lol',
  'lmaooo wait',
  'bro what',
  'wait for real??',
];

/** Rant — 吐槽/抱怨 */
export const ACK_RANT_ZH = [
  '啊这😅',
  '就离谱',
  '无语了吧',
  '不是吧…',
  '哈？？',
  '服了服了',
  '绝了…',
  '牛 真的牛',
];

export const ACK_RANT_EN = [
  'bro seriously?',
  'that\'s ridiculous',
  'I can\'t even',
  'you\'re joking right',
  'no shot lol',
  'that\'s so dumb omg',
  'I\'m dead 💀',
  'classic...',
];

// ---------------------------------------------------------------------------
// Pool lookup maps
// ---------------------------------------------------------------------------

export const ACK_POOLS_ZH: Record<AckEmotionCategory, readonly string[]> = {
  anger: ACK_ANGER_ZH,
  sadness: ACK_SADNESS_ZH,
  anxiety: ACK_ANXIETY_ZH,
  helpless: ACK_HELPLESS_ZH,
  gossip: ACK_GOSSIP_ZH,
  rant: ACK_RANT_ZH,
};

export const ACK_POOLS_EN: Record<AckEmotionCategory, readonly string[]> = {
  anger: ACK_ANGER_EN,
  sadness: ACK_SADNESS_EN,
  anxiety: ACK_ANXIETY_EN,
  helpless: ACK_HELPLESS_EN,
  gossip: ACK_GOSSIP_EN,
  rant: ACK_RANT_EN,
};

// ---------------------------------------------------------------------------
// Legacy exports (backward compat)
// ---------------------------------------------------------------------------

/** @deprecated Use ACK_POOLS_ZH / ACK_POOLS_EN instead */
export const FALLBACK_ACK_ZH = ACK_GOSSIP_ZH;
export const FALLBACK_ACK_EN = ACK_GOSSIP_EN;
export const FALLBACK_ACK_LIGHT_ZH = ACK_GOSSIP_ZH;
export const FALLBACK_ACK_LIGHT_EN = ACK_GOSSIP_EN;
export const FALLBACK_ACK_HEAVY_ZH = ACK_SADNESS_ZH;
export const FALLBACK_ACK_HEAVY_EN = ACK_SADNESS_EN;
