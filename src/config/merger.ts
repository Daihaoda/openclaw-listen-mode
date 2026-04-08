import type { DeepPartial, ListenModeConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from './defaults.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(base: any, override: any): any {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const overrideVal = override[key];
    if (overrideVal === undefined) continue;
    if (isPlainObject(result[key]) && isPlainObject(overrideVal)) {
      result[key] = deepMerge(result[key], overrideVal);
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

export function buildConfig(userConfig?: DeepPartial<ListenModeConfig>): ListenModeConfig {
  if (!userConfig) return { ...DEFAULT_CONFIG };
  return deepMerge(DEFAULT_CONFIG, userConfig) as ListenModeConfig;
}

export function resolveChannelConfig(
  config: ListenModeConfig,
  channel?: string,
): ListenModeConfig {
  if (!channel || !config.byChannel[channel]) return config;
  return deepMerge(config, config.byChannel[channel]) as ListenModeConfig;
}
