export type TimerFactory = {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
};

const defaultTimerFactory: TimerFactory = {
  setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof globalThis.setTimeout>),
};

export class ResettableTimer {
  private timerId: unknown = null;
  private readonly callback: () => void;
  private readonly delayMs: number;
  private readonly factory: TimerFactory;

  constructor(callback: () => void, delayMs: number, factory?: TimerFactory) {
    this.callback = callback;
    this.delayMs = delayMs;
    this.factory = factory ?? defaultTimerFactory;
  }

  start(): void {
    this.clear();
    this.timerId = this.factory.setTimeout(this.callback, this.delayMs);
  }

  reset(): void {
    this.start();
  }

  clear(): void {
    if (this.timerId !== null) {
      this.factory.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  get isRunning(): boolean {
    return this.timerId !== null;
  }
}
