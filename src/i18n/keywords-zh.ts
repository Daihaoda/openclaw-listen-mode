/** Chinese manual trigger phrases */
export const TRIGGER_PHRASES_ZH = [
  '开始聊天',
  '听我说',
  '我想聊聊',
  '你听我说',
  '我跟你说件事',
  '我和你说件事',
  '让我说完',
  '陪我聊聊',
  '我跟你说',
  '我和你说',
  '我想跟你说',
  '我想和你说',
  '跟你讲',
  '和你讲',
  '告诉你件事',
  '告诉你个事',
  '和我说了件事',
  '跟我说了件事',
  '告诉我一件事',
  '告诉我一个事',
  '我跟你讲',
  '我和你讲',
  '我要吐槽',
];

/** Chinese task veto keywords (highest priority, blocks listen mode) */
export const TASK_KEYWORDS_ZH = [
  '帮我',
  '帮我写',
  '查一下',
  '翻译',
  '给我',
  '搜一下',
  '写个',
  '做个',
  '算一下',
  '发一下',
];

/** Chinese explicit exit words — user wants to END the listen session */
export const EXIT_WORDS_ZH = [
  '结束聊天',
  '不聊了',
  '就到这吧',
  '我先去忙了',
  '好了不说了',
  '拜拜',
  '下次再聊',
  '不说了',
  '先这样吧',
  '我走了',
  '回头再聊',
];

/**
 * Chinese end phrases — user finished a thought segment, wants a response.
 * IMPORTANT: These trigger a response but DO NOT exit listen mode.
 */
export const END_PHRASES_ZH = [
  '说完了',
  '就这样',
  '你说吧',
  '想听听你的想法',
  '你怎么看',
  '大概就是这样',
  '就这些',
  '你觉得呢',
  '怎么办',
  '该怎么做',
];

/** Chinese emotion keywords by signal strength */
export const EMOTION_STRONG_ZH = [
  '分手', '离婚', '去世', '崩溃', '想死', '确诊', '被裁',
  '死了', '走了', '没了', '癌症', '抑郁',
];

export const EMOTION_MEDIUM_ZH = [
  '难过', '好烦', '心累', '焦虑', '失眠', '吵架', '委屈',
  '生气', '伤心', '痛苦', '害怕', '绝望', '孤独', '无助',
];

export const EMOTION_WEAK_ZH = [
  '烦', '累', '唉', '丧', 'emo', '哎', '呜',
];
