import { test, expect } from './helpers';

declare global {
  interface Window {
    __setRadioBackground: (hidden: boolean) => void;
    __radioFrameCount: number;
  }
}

test.beforeEach(async ({ page }) => {
  // Automation keeps pages active. Reproduce hidden-tab RAF suspension while
  // leaving native audio playback, media events and elapsed time untouched.
  await page.addInitScript(() => {
    localStorage.setItem('magic-field-radio', JSON.stringify({ channel: 'morning', id: 'wild-001' }));
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    const frames = new Map<number, { callback: FrameRequestCallback; nativeId?: number }>();
    let hidden = false, nextId = 0;
    window.__radioFrameCount = 0;
    Object.defineProperties(document, {
      hidden: { get: () => hidden },
      visibilityState: { get: () => hidden ? 'hidden' : 'visible' },
    });
    const schedule = (id: number) => {
      const frame = frames.get(id)!;
      frame.nativeId = request(time => {
        frame.nativeId = undefined;
        if (hidden) return;
        frames.delete(id);
        window.__radioFrameCount++;
        frame.callback(time);
      });
    };
    window.requestAnimationFrame = callback => {
      const id = ++nextId;
      frames.set(id, { callback });
      if (!hidden) schedule(id);
      return id;
    };
    window.cancelAnimationFrame = id => {
      const frame = frames.get(id);
      if (frame?.nativeId !== undefined) cancel(frame.nativeId);
      frames.delete(id);
    };
    window.__setRadioBackground = value => {
      if (value === hidden) return;
      hidden = value;
      for (const [id, frame] of frames) {
        if (hidden) {
          if (frame.nativeId !== undefined) cancel(frame.nativeId);
          frame.nativeId = undefined;
        } else schedule(id);
      }
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
  await page.goto('/about/');
  await page.locator('[data-open]').click();
  await page.locator('[data-panel] [data-play]').click();
  await expect.poll(() => page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(.2);
  await page.locator('[data-volume]').fill('0.28');
});

test('background auto-next remains audible and returning preserves the real progress', async ({ page }) => {
  const audio = page.locator('audio');
  const stoppedFrames = await page.evaluate(() => {
    window.__setRadioBackground(true);
    return window.__radioFrameCount;
  });
  for (const id of ['wild-002', 'wild-003']) {
    await audio.evaluate((a: HTMLAudioElement) => a.currentTime = a.duration - .15);
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => ({
      id: a.currentSrc.split('/').at(-2), advancing: a.currentTime > .3, paused: a.paused,
    }))).toEqual({ id, advancing: true, paused: false });
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.volume)).toBeCloseTo(.28, 2);
    expect(await page.evaluate(() => window.__radioFrameCount)).toBe(stoppedFrames);
  }
  const before = await audio.evaluate((a: HTMLAudioElement) => a.currentTime);
  await page.evaluate(() => window.__setRadioBackground(false));
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(before);
  expect(await audio.evaluate((a: HTMLAudioElement) => a.volume)).toBeCloseTo(.28, 2);
  expect(await page.locator('[data-seek]').evaluate((input: HTMLInputElement) => Math.abs(Number(input.value) - document.querySelector('audio')!.currentTime))).toBeLessThan(.5);
});

test('hiding during a manual switch completes it, and visibility does not undo pause or mute', async ({ page }) => {
  const audio = page.locator('audio');
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-next]')!.click();
    window.__setRadioBackground(true);
  });
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => ({
    id: a.currentSrc.split('/').at(-2), advancing: a.currentTime > .3, volume: a.volume,
  }))).toEqual({ id: 'wild-002', advancing: true, volume: .28 });
  await page.evaluate(() => window.__setRadioBackground(false));
  await page.locator('[data-next]').click();
  await page.waitForFunction(() => {
    const audio = document.querySelector('audio')!;
    return audio.currentSrc.includes('/wild-003/') && audio.volume > 0 && audio.volume < .28;
  });
  await page.evaluate(() => window.__setRadioBackground(true));
  expect(await audio.evaluate((a: HTMLAudioElement) => a.volume)).toBeCloseTo(.28, 2);
  await page.evaluate(() => window.__setRadioBackground(false));
  await page.locator('[data-mute]').click();
  await page.locator('[data-panel] [data-play]').click();
  const pausedTime = await audio.evaluate((a: HTMLAudioElement) => a.currentTime);
  await page.evaluate(() => { window.__setRadioBackground(true); window.__setRadioBackground(false); });
  await page.waitForTimeout(600);
  expect(await audio.evaluate((a: HTMLAudioElement) => ({ paused: a.paused, muted: a.muted, time: a.currentTime })))
    .toEqual({ paused: true, muted: true, time: pausedTime });
  await expect(page.locator('[data-radio]')).not.toHaveAttribute('data-active');
});

test('a track finishing its load in the background starts at the chosen volume', async ({ page }) => {
  let release!: () => void;
  let requested!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const intercepted = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/music/wild-002/audio.mp3', async route => {
    requested();
    await held;
    await route.continue();
  });
  await page.locator('[data-next]').click();
  await intercepted;
  await page.evaluate(() => window.__setRadioBackground(true));
  release();
  await expect.poll(() => page.locator('audio').evaluate((a: HTMLAudioElement) => ({
    id: a.currentSrc.split('/').at(-2), advancing: a.currentTime > .3, volume: a.volume,
  }))).toEqual({ id: 'wild-002', advancing: true, volume: .28 });
});
