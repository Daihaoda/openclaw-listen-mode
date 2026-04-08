/** English manual trigger phrases */
export const TRIGGER_PHRASES_EN = [
  'start chat',
  'listen',
  'i need to talk',
  'let me vent',
  'hear me out',
  'i need to get this off my chest',
  'can i talk to you',
  'i need someone to listen',
];

/** English task veto keywords */
export const TASK_KEYWORDS_EN = [
  'help me',
  'write',
  'generate',
  'fix',
  'search',
  'translate',
  'find',
  'create',
  'send',
  'make',
  'build',
  'code',
  'debug',
];

/** English explicit exit words — user wants to END the listen session */
export const EXIT_WORDS_EN = [
  'end chat',
  'gotta go',
  'bye',
  'talk later',
  "i'm done for now",
  "that's all for now",
  'see ya',
  'later',
  'gotta run',
];

/**
 * English end phrases — user finished a thought, wants a response.
 * IMPORTANT: These trigger a response but DO NOT exit listen mode.
 */
export const END_PHRASES_EN = [
  'what do you think',
  'your turn',
  'what should i do',
  'any thoughts',
  "that's it",
  "i'm done talking",
  'so yeah',
];

/** English emotion keywords by signal strength */
export const EMOTION_STRONG_EN = [
  'broke up', 'divorced', 'passed away', 'fired', 'diagnosed',
  'laid off', 'died', 'cancer', 'suicide', 'miscarriage',
];

export const EMOTION_MEDIUM_EN = [
  'so sad', 'stressed', "can't sleep", 'anxious', 'heartbroken',
  'depressed', 'devastated', 'crying', 'lonely', 'hopeless',
];

export const EMOTION_WEAK_EN = [
  'ugh', 'tired', 'meh', 'done', 'over it', 'exhausted', 'bleh',
];
