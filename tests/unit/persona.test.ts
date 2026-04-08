import { describe, it, expect } from 'vitest';
import { PersonaManager, PRESET_PERSONAS } from '../../src/core/persona.js';

describe('PersonaManager', () => {
  it('should return default persona', () => {
    const pm = new PersonaManager();
    const persona = pm.getPersona('user1');
    expect(persona).toBe(PRESET_PERSONAS['warm-friend']);
  });

  it('should switch persona', () => {
    const pm = new PersonaManager();
    const switched = pm.switchPersona('user1', 'bro');
    expect(switched).toBe(true);
    expect(pm.getPersonaId('user1')).toBe('bro');
    expect(pm.getPersona('user1')).toBe(PRESET_PERSONAS['bro']);
  });

  it('should reject switching to unknown persona', () => {
    const pm = new PersonaManager();
    const switched = pm.switchPersona('user1', 'nonexistent');
    expect(switched).toBe(false);
  });

  it('should reject switching when disabled', () => {
    const pm = new PersonaManager({ allowSwitch: false });
    const switched = pm.switchPersona('user1', 'bro');
    expect(switched).toBe(false);
  });

  it('should reset to default', () => {
    const pm = new PersonaManager();
    pm.switchPersona('user1', 'bro');
    pm.resetPersona('user1');
    expect(pm.getPersonaId('user1')).toBe('warm-friend');
  });

  it('should get persona prompt in Chinese', () => {
    const pm = new PersonaManager();
    const prompt = pm.getPersonaPrompt('user1', 'zh');
    expect(prompt).toContain('好朋友');
  });

  it('should get persona prompt in English', () => {
    const pm = new PersonaManager();
    const prompt = pm.getPersonaPrompt('user1', 'en');
    expect(prompt).toContain('close friend');
  });

  it('should list all personas', () => {
    const pm = new PersonaManager();
    const list = pm.listPersonas('zh');
    expect(list.length).toBe(5);
    expect(list.map((p) => p.id)).toContain('warm-friend');
    expect(list.map((p) => p.id)).toContain('bro');
  });

  it('should detect natural language persona switch', () => {
    const pm = new PersonaManager();
    expect(pm.detectPersonaSwitch('能不能直接点别绕弯子')).toBe('straight-talker');
    expect(pm.detectPersonaSwitch('温柔一点')).toBe('soft-sister');
    expect(pm.detectPersonaSwitch('be direct')).toBe('straight-talker');
    expect(pm.detectPersonaSwitch('普通消息')).toBeNull();
  });

  it('should support custom personas', () => {
    const pm = new PersonaManager();
    pm.addCustomPersona('custom', {
      name: { zh: '自定义', en: 'Custom' },
      description: { zh: '自定义人设', en: 'Custom persona' },
      prompt: { zh: '你是自定义角色', en: 'You are custom' },
    });
    const switched = pm.switchPersona('user1', 'custom');
    expect(switched).toBe(true);
    expect(pm.getPersonaPrompt('user1', 'zh')).toContain('自定义角色');
  });
});
