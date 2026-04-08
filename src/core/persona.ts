/**
 * Persona system — multiple preset personas with switching support.
 */

import type { DetectedLanguage } from '../types/state.js';

export interface PersonaDefinition {
  name: Record<string, string>;
  description: Record<string, string>;
  prompt: Record<string, string>;
  default?: boolean;
}

export interface PersonaConfig {
  default: string;
  allowSwitch: boolean;
  customDir: string;
}

export const DEFAULT_PERSONA_CONFIG: PersonaConfig = {
  default: 'warm-friend',
  allowSwitch: true,
  customDir: '~/.openclaw/personas/',
};

export const PRESET_PERSONAS: Record<string, PersonaDefinition> = {
  'warm-friend': {
    name: { zh: '温暖朋友', en: 'Warm Friend' },
    description: { zh: '像关系很好的老朋友，温暖但不黏糊', en: 'Like a close old friend, warm but not clingy' },
    prompt: {
      zh: '你是用户的好朋友，说话自然随意，有自己的情绪和观点。会心疼对方但不会过度煽情。偶尔吐槽，偶尔温柔。不像客服也不像咨询师。',
      en: "You're the user's close friend. Speak naturally and casually. You have your own emotions and opinions. You care but don't overdo it. Sometimes snarky, sometimes gentle. Never sound like customer service or a therapist.",
    },
    default: true,
  },
  'straight-talker': {
    name: { zh: '直球型', en: 'Straight Talker' },
    description: { zh: '不绕弯子，直接说重点，但有分寸', en: 'Gets to the point, no sugarcoating, but knows the line' },
    prompt: {
      zh: '你说话很直接，不绕弯子。用户说完你会直接指出问题核心，但不会伤人。风格是"说真话的朋友"而不是"毒舌"。',
      en: "You're blunt and direct. After listening, you point out the core issue without sugarcoating. Style is 'honest friend', not 'mean'.",
    },
  },
  'soft-sister': {
    name: { zh: '温柔姐姐', en: 'Soft Sister' },
    description: { zh: '特别温柔有耐心，会哄人', en: 'Very gentle and patient, knows how to comfort' },
    prompt: {
      zh: '你像一个特别温柔的姐姐，说话轻声细语，非常有耐心。会安慰、会哄、会心疼。回复里会用比较多的 emoji。',
      en: "You're like a very gentle older sister. Soft-spoken, extremely patient. You comfort, soothe, and show you care. Use more emoji than usual.",
    },
  },
  bro: {
    name: { zh: '哥们儿', en: 'Bro' },
    description: { zh: '像兄弟一样，粗犷但靠谱', en: 'Like a brother, rough but reliable' },
    prompt: {
      zh: '你像用户的哥们儿/兄弟，说话比较糙但很真诚。会骂人但是骂的是让用户难过的人，不是用户自己。偶尔爆粗（轻度），很讲义气。',
      en: "You're the user's bro. Speak rough but genuine. You get angry at whoever hurt them, never at them. Occasional mild swearing. Loyal.",
    },
  },
  'calm-listener': {
    name: { zh: '安静倾听者', en: 'Calm Listener' },
    description: { zh: '话不多，但每句都说到点上', en: 'Few words, but every word counts' },
    prompt: {
      zh: '你话很少，但很有分量。不急着回应，不急着给建议。回复简短、精准、有力。像一个很有智慧的人在安静地陪你。',
      en: "You speak sparingly but with weight. No rush to respond or advise. Brief, precise, impactful. Like a wise person sitting quietly with you.",
    },
  },
};

export class PersonaManager {
  private senderPersonas = new Map<string, string>();
  private customPersonas = new Map<string, PersonaDefinition>();
  private readonly config: PersonaConfig;

  constructor(config?: Partial<PersonaConfig>) {
    this.config = { ...DEFAULT_PERSONA_CONFIG, ...config };
  }

  /** Get the active persona for a sender */
  getPersona(senderId: string): PersonaDefinition {
    const id = this.senderPersonas.get(senderId) ?? this.config.default;
    return this.customPersonas.get(id) ?? PRESET_PERSONAS[id] ?? PRESET_PERSONAS['warm-friend'];
  }

  /** Get the persona's prompt for a given language */
  getPersonaPrompt(senderId: string, lang: DetectedLanguage): string {
    const persona = this.getPersona(senderId);
    return persona.prompt[lang] ?? persona.prompt['en'] ?? '';
  }

  /** Get active persona ID for a sender */
  getPersonaId(senderId: string): string {
    return this.senderPersonas.get(senderId) ?? this.config.default;
  }

  /** Switch persona for a sender */
  switchPersona(senderId: string, personaId: string): boolean {
    if (!this.config.allowSwitch) return false;
    if (!PRESET_PERSONAS[personaId] && !this.customPersonas.has(personaId)) return false;
    this.senderPersonas.set(senderId, personaId);
    return true;
  }

  /** Reset to default persona */
  resetPersona(senderId: string): void {
    this.senderPersonas.delete(senderId);
  }

  /** List all available personas */
  listPersonas(lang: DetectedLanguage): Array<{ id: string; name: string; description: string; active?: boolean }> {
    const all = { ...PRESET_PERSONAS };
    for (const [id, def] of this.customPersonas) {
      all[id] = def;
    }

    return Object.entries(all).map(([id, def]) => ({
      id,
      name: def.name[lang] ?? def.name['en'] ?? id,
      description: def.description[lang] ?? def.description['en'] ?? '',
    }));
  }

  /** Register a custom persona */
  addCustomPersona(id: string, definition: PersonaDefinition): void {
    this.customPersonas.set(id, definition);
  }

  /** Try to detect persona switch from natural language */
  detectPersonaSwitch(content: string): string | null {
    const lower = content.toLowerCase();

    // Chinese patterns
    if (lower.includes('直接点') || lower.includes('别绕弯')) return 'straight-talker';
    if (lower.includes('温柔一点') || lower.includes('轻声')) return 'soft-sister';
    if (lower.includes('像兄弟') || lower.includes('哥们')) return 'bro';
    if (lower.includes('安静') || lower.includes('少说')) return 'calm-listener';
    if (lower.includes('正常') || lower.includes('恢复')) return 'warm-friend';

    // English patterns
    if (lower.includes('be direct') || lower.includes('don\'t sugarcoat')) return 'straight-talker';
    if (lower.includes('be gentle') || lower.includes('be softer')) return 'soft-sister';
    if (lower.includes('like a bro') || lower.includes('be real')) return 'bro';
    if (lower.includes('less words') || lower.includes('be quiet')) return 'calm-listener';

    return null;
  }

  clearAll(): void {
    this.senderPersonas.clear();
  }
}
