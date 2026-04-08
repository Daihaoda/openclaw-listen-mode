import type { DetectedLanguage, TriggerType } from '../types/state.js';
import {
  ENTRY_MANUAL_ZH,
  ENTRY_MANUAL_EN,
  ENTRY_AUTO_ZH,
  ENTRY_AUTO_EN,
  EXIT_FAREWELL_ZH,
  EXIT_FAREWELL_EN,
  SILENCE_EXIT_ZH,
  SILENCE_EXIT_EN,
} from '../i18n/responses.js';
import { randomPick } from '../utils/random.js';

export function getEntryResponse(
  language: DetectedLanguage,
  triggerType: TriggerType,
): string {
  if (triggerType === 'manual') {
    return randomPick(language === 'zh' ? ENTRY_MANUAL_ZH : ENTRY_MANUAL_EN);
  }
  return randomPick(language === 'zh' ? ENTRY_AUTO_ZH : ENTRY_AUTO_EN);
}

export function getExitFarewell(language: DetectedLanguage): string {
  return randomPick(language === 'zh' ? EXIT_FAREWELL_ZH : EXIT_FAREWELL_EN);
}

export function getSilenceExitMessage(language: DetectedLanguage): string {
  return randomPick(language === 'zh' ? SILENCE_EXIT_ZH : SILENCE_EXIT_EN);
}
