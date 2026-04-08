import type { Logger } from '../types/plugin-api.js';

export function createDefaultLogger(): Logger {
  return {
    debug: (msg, ...args) => console.debug(`[listen-mode] ${msg}`, ...args),
    info: (msg, ...args) => console.info(`[listen-mode] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[listen-mode] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[listen-mode] ${msg}`, ...args),
  };
}
