// Fixed-window limit per client address, in memory: `limit` events per `windowMs`.
export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  #windowStart = 0;
  #counts = new Map<string, number>();

  constructor({ limit, windowMs, now = () => Date.now() }: { limit: number; windowMs: number; now?: () => number }) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#now = now;
  }

  // counts an event; returns seconds to wait, or 0 when it may go through
  check(client: string): number {
    const t = this.#now();
    if (t - this.#windowStart >= this.#windowMs) {
      this.#windowStart = t;
      this.#counts.clear();
    }
    const n = (this.#counts.get(client) ?? 0) + 1;
    this.#counts.set(client, n);
    return n > this.#limit ? Math.ceil((this.#windowStart + this.#windowMs - t) / 1000) || 1 : 0;
  }
}
