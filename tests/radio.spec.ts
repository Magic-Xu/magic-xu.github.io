import { test, expect, fitsViewport } from './helpers';
import { radioTracks } from '../src/data/radio';

test('radio loads only on intent, plays every track, persists across pages and preserves preferences without autoplay', async ({ page }) => {
  const audioRequests: string[] = [];
  page.on('request', request => { if (request.url().endsWith('.mp3')) audioRequests.push(request.url()); });
  await page.goto('/about/');
  const audio = page.locator('audio');
  await page.locator('[data-open]').click();
  await expect(page.locator('[data-panel]')).toBeVisible();
  expect(audioRequests).toEqual([]);
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await page.locator('[data-panel] [data-play]').click();
  await page.waitForFunction(() => document.querySelector('audio')!.currentTime > .3);
  await audio.evaluate((a: HTMLAudioElement) => window.__testAudio = a);
  await page.keyboard.press('Escape');
  await page.locator('.site-nav a[href="/projects/"]').click(); await expect(page).toHaveURL(/\/projects\/$/);
  expect(await page.evaluate(() => window.__testAudio === document.querySelector('audio') && !window.__testAudio.paused)).toBe(true);
  await page.locator('[data-open]').click(); await page.locator('[data-panel] [data-play]').click();
  await page.locator('[data-seek]').fill('42');
  expect(await audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeCloseTo(42, 0);
  await page.locator('[data-volume]').fill('0.28');
  await page.locator('[data-mute]').click(); expect(await audio.evaluate((a: HTMLAudioElement) => a.muted)).toBe(true);
  await page.locator('[data-mute]').click(); expect(await audio.evaluate((a: HTMLAudioElement) => a.muted)).toBe(false);
  await page.locator('[data-list-toggle]').click();
  await expect(page.locator('[data-playlist] button')).toHaveCount(radioTracks.length);
  for (let i = 0; i < radioTracks.length; i++) {
    await page.locator(`[data-track="${i}"]`).click();
    await page.waitForFunction(() => document.querySelector('audio')!.currentTime > .15);
    await expect(page.locator(`[data-track="${i}"]`)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-title]')).toHaveText(radioTracks[i].title);
  }
  await page.locator('[data-previous]').click();
  await expect(page.locator('[data-title]')).toHaveText(radioTracks.at(-2)!.title);
  await page.locator('[data-next]').click();
  await expect(page.locator('[data-title]')).toHaveText(radioTracks.at(-1)!.title);
  await page.waitForFunction(() => document.querySelector('audio')!.readyState >= 1);
  await audio.evaluate((a: HTMLAudioElement) => a.currentTime = a.duration - .15);
  await expect(page.locator('[data-title]')).toHaveText(radioTracks[0].title);
  await page.waitForFunction(() => document.querySelector('audio')!.currentTime > .1);
  await page.reload();
  await page.locator('[data-radio]:not([hidden])').waitFor();
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  expect(await audio.evaluate((a: HTMLAudioElement) => a.volume)).toBe(.28);
});

test('panel and playlist animate through intermediate sizes and support reversal, focus and small screens', async ({ page }) => {
  await page.goto('/about/');
  const radio = page.locator('[data-radio]');
  const closedHeight = (await radio.boundingBox())!.height;
  await page.locator('[data-open]').click(); await page.waitForTimeout(180);
  const intermediate = (await radio.boundingBox())!.height;
  expect(intermediate).toBeGreaterThan(closedHeight + 3);
  await page.waitForTimeout(600); expect((await radio.boundingBox())!.height).toBeGreaterThan(intermediate);
  await page.keyboard.press('Escape'); await page.waitForTimeout(550);
  await expect(page.locator('[data-open]')).toBeFocused();
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-open]').click(); await page.waitForTimeout(220); await page.keyboard.press('Escape'); await page.waitForTimeout(160);
  }
  await expect(page.locator('[data-panel]')).toBeHidden();
  await expect.poll(async () => Math.abs((await radio.boundingBox())!.height - closedHeight)).toBeLessThan(2);
  await page.locator('[data-open]').click(); await page.waitForTimeout(650);
  const baseHeight = (await radio.boundingBox())!.height;
  await page.locator('[data-list-toggle]').click(); await page.waitForTimeout(180);
  expect((await radio.boundingBox())!.height).toBeGreaterThan(baseHeight + 10);
  for (let i = 0; i < 4; i++) { await page.locator('[data-list-toggle]').click(); await page.waitForTimeout(100); }
  await page.waitForTimeout(600);
  expect(Math.abs((await radio.boundingBox())!.height - (await page.locator('[data-panel]').boundingBox())!.height - 2)).toBeLessThan(2);
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(size); await page.waitForTimeout(300); await fitsViewport(page);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.keyboard.press('Escape');
  await expect(page.locator('[data-panel]')).toBeHidden();
  await expect(page.locator('.radio-record')).toHaveCSS('animation-name', 'none');
  await page.locator('[data-open]').click(); await page.mouse.click(2, 2);
  await expect(page.locator('[data-panel]')).toBeHidden();
});

test('a failed audio request offers a working retry', async ({ page }) => {
  await page.route('**/music/fireside/audio.mp3', route => route.abort());
  await page.goto('/about/'); await page.locator('[data-open]').click();
  await page.locator('[data-panel] [data-play]').click();
  await expect(page.locator('[data-radio]')).toHaveAttribute('data-error');
  await expect(page.locator('[data-message]')).toContainText('重试');
  await page.unroute('**/music/fireside/audio.mp3');
  await page.locator('[data-panel] [data-play]').click();
  await page.waitForFunction(() => document.querySelector('audio')!.currentTime > .1);
  await expect(page.locator('[data-radio]')).not.toHaveAttribute('data-error');
});
