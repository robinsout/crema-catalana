// Playwright with silent pages: tests check that a recording is requested, not heard,
// so every <audio> plays muted (WebKit has no browser flag for it, Chromium also gets --mute-audio).
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
        this.muted = true;
        return play.call(this);
      };
    });
    await use(context);
  },
});

export { expect };
export type { Browser, Page } from '@playwright/test';
