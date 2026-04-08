/**
 * Keyword-based emotion category classifier for fallback ack selection.
 * Used when LLM ack generation fails/times out.
 */

import type { AckEmotionCategory } from '../i18n/responses.js';
import type { InboundMessage } from '../types/message.js';

// ---------------------------------------------------------------------------
// Keyword dictionaries
// ---------------------------------------------------------------------------

const ANGER_ZH = ['过分', '欺负', '凭什么', '太过了', '气死', '不讲理', '恶心', '恨', '狗东西', '混蛋', '渣', '贱', '去死'];
const ANGER_EN = ['unfair', 'pissed', 'furious', 'disgusting', 'hate', 'asshole', 'wtf', 'bullshit', 'screw', 'rage'];

const SADNESS_ZH = ['难过', '分手', '走了', '去世', '伤心', '哭', '离开', '死了', '没了', '眼泪', '想他', '想她', '舍不得', '再也'];
const SADNESS_EN = ['sad', 'broke up', 'passed away', 'died', 'crying', 'miss', 'heartbroken', 'gone', 'lost', 'tears'];

const ANXIETY_ZH = ['紧张', '来不及', '怎么办', '焦虑', '担心', '害怕', '慌', '急', '赶不上', '考试', '面试', 'ddl', '截止'];
const ANXIETY_EN = ['anxious', 'nervous', 'worried', 'scared', 'deadline', 'panic', 'can\'t sleep', 'stressed', 'what if', 'running out'];

const HELPLESS_ZH = ['确诊', '被裁', '没办法', '无能为力', '绝望', '抑郁', '癌症', '倒闭', '破产', '没钱', '无助', '完了'];
const HELPLESS_EN = ['diagnosed', 'laid off', 'fired', 'bankrupt', 'hopeless', 'depressed', 'no choice', 'helpless', 'nothing I can do', 'over'];

const RANT_ZH = ['吐槽', '无语', '服了', '离谱', '奇葩', '搞笑', '智商', '脑子', '迷惑', '窒息', '社死', '尴尬', '抓狂'];
const RANT_EN = ['rant', 'ridiculous', 'unbelievable', 'annoying', 'stupid', 'cringe', 'facepalm', 'embarrassing', 'clown', 'joke'];

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

function containsAny(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Classify the emotion category from recent messages using keyword matching.
 * Scans messages in reverse order (most recent first) and returns the first match.
 * Defaults to 'gossip' if no keywords match.
 */
export function classifyAckEmotion(messages: InboundMessage[]): AckEmotionCategory {
  // Combine recent messages for scanning (last 5)
  const recent = messages.slice(-5);
  const combined = recent.map((m) => m.content).join(' ');

  // Check if text contains Chinese
  const isChinese = /[\u4e00-\u9fff]/.test(combined);

  if (isChinese) {
    if (containsAny(combined, ANGER_ZH)) return 'anger';
    if (containsAny(combined, SADNESS_ZH)) return 'sadness';
    if (containsAny(combined, ANXIETY_ZH)) return 'anxiety';
    if (containsAny(combined, HELPLESS_ZH)) return 'helpless';
    if (containsAny(combined, RANT_ZH)) return 'rant';
  } else {
    if (containsAny(combined, ANGER_EN)) return 'anger';
    if (containsAny(combined, SADNESS_EN)) return 'sadness';
    if (containsAny(combined, ANXIETY_EN)) return 'anxiety';
    if (containsAny(combined, HELPLESS_EN)) return 'helpless';
    if (containsAny(combined, RANT_EN)) return 'rant';
  }

  return 'gossip';
}
