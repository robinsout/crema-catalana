// Fixed-window rate limit per client address, in memory.
export class RateLimiter {
  readonly #perMinute: number;
  readonly #now: () => number;
  #windowStart = 0;
  #counts = new Map<string, number>();

  constructor({ perMinute, now = () => Date.now() }: { perMinute: number; now?: () => number }) {
    this.#perMinute = perMinute;
    this.#now = now;
  }

  // seconds to wait, or 0 when the request may go through
  check(client: string): number {
    const t = this.#now();
    if (t - this.#windowStart >= 60_000) {
      this.#windowStart = t;
      this.#counts.clear();
    }
    const n = (this.#counts.get(client) ?? 0) + 1;
    this.#counts.set(client, n);
    return n > this.#perMinute ? Math.ceil((this.#windowStart + 60_000 - t) / 1000) || 1 : 0;
  }
}
