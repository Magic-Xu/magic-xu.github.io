import { test, expect, fitsViewport } from './helpers';
import { radioChannels, radioTracks, defaultRadioCover } from '../src/data/radio';
import type { Page } from '@playwright/test';

async function chooseChannel(page: Page, id: string) {
  await page.locator('[data-channel-toggle]').click();
  await page.locator(`button[data-channel="${id}"]`).click();
  await expect(page.locator('[data-radio]')).toHaveAttribute('data-channel', id);
}
async function playingTrack(page: Page, id: string) {
  await expect.poll(() => page.locator('audio').evaluate((a: HTMLAudioElement) => ({ playing: !a.paused, src: a.currentSrc.split('/').at(-2), time: a.currentTime })))
    .toMatchObject({ playing: true, src: id });
  await page.waitForFunction(() => document.querySelector('audio')!.currentTime > .15);
}

test('all 25 tracks play with their own artwork, channel lists and bounded previous/next/ended loops', async ({ page }) => {
  test.setTimeout(120_000);
  const audioRequests: string[] = [];
  page.on('request', request => { if (request.url().endsWith('.mp3')) audioRequests.push(request.url()); });
  await page.goto('/about/');
  await page.locator('[data-open]').click();
  expect(audioRequests).toEqual([]);
  await expect(page.locator('[data-channel-title]')).toHaveText('山野与晨光');
  await page.locator('[data-list-toggle]').click();
  for (const channel of radioChannels) {
    await chooseChannel(page, channel.id);
    await expect(page.locator('[data-playlist] button:visible')).toHaveCount(channel.tracks.length);
    await expect(page.locator('[data-track-count]')).toHaveText(`${channel.tracks.length} 首`);
    for (const track of channel.tracks) {
      await page.locator(`button[data-track="${track.id}"]`).click();
      await playingTrack(page, track.id);
      await expect(page.locator(`button[data-track="${track.id}"]`)).toHaveAttribute('aria-current', 'true');
      await expect(page.locator('[data-title]')).toHaveText(track.title);
      for (const selector of ['[data-disc-cover]', '[data-cover]', `[data-track-cover="${track.id}"]`]) {
        await expect(page.locator(selector)).toHaveAttribute('src', track.cover!);
        await expect.poll(() => page.locator(selector).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 480)).toBe(true);
      }
    }
    await page.locator('[data-previous]').click();
    await playingTrack(page, channel.tracks.at(-2)!.id);
    await page.locator('[data-next]').click();
    await playingTrack(page, channel.tracks.at(-1)!.id);
    await page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime = a.duration - .15);
    await expect(page.locator('[data-title]')).toHaveText(channel.tracks[0].title);
    await playingTrack(page, channel.tracks[0].id);
    await page.locator('[data-previous]').click();
    await playingTrack(page, channel.tracks.at(-1)!.id);
  }
  expect(new Set(audioRequests.map(url => new URL(url).pathname)).size).toBe(radioTracks.length);
});

test('channel choice respects play intent, fades sound, survives navigation and restores silently on reload', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().endsWith('.mp3')) requests.push(request.url()); });
  await page.goto('/about/');
  const audio = page.locator('audio');
  await page.locator('[data-open]').click();
  await chooseChannel(page, 'reading');
  await chooseChannel(page, 'night');
  expect(requests).toEqual([]);
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await page.locator('[data-panel] [data-play]').click();
  await playingTrack(page, 'wild-017');
  await audio.evaluate((a: HTMLAudioElement) => window.__testAudio = a);
  await page.locator('[data-volume]').fill('0.28');
  await page.evaluate(() => {
    (window as any).__volumes = [];
    document.querySelector('audio')!.addEventListener('volumechange', event => (window as any).__volumes.push((event.target as HTMLAudioElement).volume));
  });
  await chooseChannel(page, 'focus');
  await playingTrack(page, 'wild-009');
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.volume)).toBeCloseTo(.28, 2);
  const volumes: number[] = await page.evaluate(() => (window as any).__volumes);
  expect(volumes.some(value => value > .01 && value < .25)).toBe(true);
  await page.locator('[data-panel] [data-play]').click();
  await page.locator('[data-seek]').fill('42');
  await chooseChannel(page, 'focus');
  expect(await audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeCloseTo(42, 0);
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await page.locator('[data-mute]').click(); expect(await audio.evaluate((a: HTMLAudioElement) => a.muted)).toBe(true);
  await page.locator('[data-mute]').click(); expect(await audio.evaluate((a: HTMLAudioElement) => a.muted)).toBe(false);
  await page.locator('[data-next]').click();
  await playingTrack(page, 'wild-010');
  await page.keyboard.press('Escape');
  await page.locator('.site-nav a[href="/projects/"]').click(); await expect(page).toHaveURL(/\/projects\/$/);
  expect(await page.evaluate(() => window.__testAudio === document.querySelector('audio') && !window.__testAudio.paused)).toBe(true);
  await expect(page.locator('[data-radio]')).toHaveAttribute('data-entered', 'true');
  await expect(page.locator('[data-radio]')).toHaveCSS('opacity', '1');
  requests.length = 0;
  await page.reload();
  await page.locator('[data-radio]:not([hidden])').waitFor();
  await expect(page.locator('[data-radio]')).toHaveAttribute('data-channel', 'focus');
  await expect(page.locator('[data-title]')).toHaveText('代码之外');
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  expect(await audio.evaluate((a: HTMLAudioElement) => a.volume)).toBe(.28);
  expect(requests).toEqual([]);
});

test('panel, playlist and channel picker animate continuously and fit small screens', async ({ page }) => {
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
  for (const region of ['list', 'channel']) {
    const baseHeight = (await radio.boundingBox())!.height;
    await page.locator(`[data-${region}-toggle]`).click(); await page.waitForTimeout(180);
    expect((await radio.boundingBox())!.height).toBeGreaterThan(baseHeight + 10);
    for (let i = 0; i < 4; i++) { await page.locator(`[data-${region}-toggle]`).click(); await page.waitForTimeout(100); }
    await page.waitForTimeout(600);
    expect(Math.abs((await radio.boundingBox())!.height - (await page.locator('[data-panel]').boundingBox())!.height - 2)).toBeLessThan(2);
  }
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 768, height: 480 }]) {
    await page.setViewportSize(size); await page.waitForTimeout(300); await fitsViewport(page);
    await page.locator('button[data-channel="vocals"]').click();
    await expect(page.locator('[data-channel-toggle]')).toBeFocused();
    await page.locator('button[data-track="before-love"]').click();
    await expect(page.locator('[data-title]')).toHaveText('愛してるより先に');
    await page.locator('[data-channel-toggle]').click();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Escape'); // Channel picker closes before the panel.
  await expect(page.locator('[data-channel-region]')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-panel]')).toBeHidden();
  await expect(page.locator('.radio-record')).toHaveCSS('animation-name', 'none');
  await page.locator('[data-open]').click(); await page.mouse.click(2, 2);
  await expect(page.locator('[data-panel]')).toBeHidden();
});

test('rapid channel changes and a pause during the fade retain the latest choice', async ({ page }) => {
  await page.goto('/about/'); await page.locator('[data-open]').click();
  await page.locator('[data-panel] [data-play]').click(); await playingTrack(page, 'wild-001');
  // Overlap the fading audio and opening/closing regions with actual button events.
  await page.evaluate(() => {
    const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!.click();
    for (const id of ['reading', 'travel', 'vocals', 'focus']) { click('[data-channel-toggle]'); click(`button[data-channel="${id}"]`); }
    click('[data-panel] [data-play]');
  });
  await page.waitForTimeout(700);
  await expect(page.locator('[data-title]')).toHaveText('把想法种下');
  expect(await page.locator('audio').evaluate((a: HTMLAudioElement) => a.paused && !a.getAttribute('src'))).toBe(true);
  await expect(page.locator('[data-radio]')).not.toHaveAttribute('data-active');
  await page.locator('[data-panel] [data-play]').click();
  await playingTrack(page, 'wild-009');
  await expect.poll(() => page.locator('audio').evaluate((a: HTMLAudioElement) => a.volume)).toBe(.45);
});

test('older track-only preferences migrate, and invalid or refused storage keeps a silent default', async ({ browser, baseURL }) => {
  for (const preference of [JSON.stringify({ id: 'before-love', volume: .2 }), '{invalid', 'refused']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.addInitScript(value => {
        if (value === 'refused') {
          Storage.prototype.getItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
          Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
        } else localStorage.setItem('magic-field-radio', value);
      }, preference);
      await page.goto(`${baseURL}/about/`);
      await page.locator('[data-open]').click();
      const legacy = preference.includes('before-love');
      await expect(page.locator('[data-title]')).toHaveText(legacy ? '愛してるより先に' : '山谷醒来');
      await expect(page.locator('[data-channel-title]')).toHaveText(legacy ? '人声精选' : '山野与晨光');
      expect(await page.locator('audio').evaluate((a: HTMLAudioElement) => a.paused && !a.getAttribute('src'))).toBe(true);
      await chooseChannel(page, 'night');
      await page.locator('[data-panel] [data-play]').click(); await playingTrack(page, 'wild-017');
    } finally { await context.close(); }
  }
});

test('failed artwork uses the shared cover everywhere, then a healthy track restores its own artwork', async ({ page }) => {
  await page.route('**/music/wild-001/cover.webp', route => route.abort());
  await page.goto('/about/'); await page.locator('[data-open]').click();
  await page.locator('[data-list-toggle]').click();
  for (const selector of ['[data-cover]', '[data-disc-cover]', '[data-track-cover="wild-001"]']) {
    await expect(page.locator(selector)).toHaveAttribute('src', defaultRadioCover);
    await expect.poll(() => page.locator(selector).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await page.locator('button[data-track="wild-002"]').click();
  for (const selector of ['[data-cover]', '[data-disc-cover]']) await expect(page.locator(selector)).toHaveAttribute('src', '/music/wild-002/cover.webp');
  await page.locator('button[data-track="wild-001"]').click();
  await expect(page.locator('[data-cover]')).toHaveAttribute('src', defaultRadioCover);
});

test('a failed audio request offers a working retry', async ({ page }) => {
  await page.route('**/music/wild-001/audio.mp3', route => route.abort());
  await page.goto('/about/'); await page.locator('[data-open]').click();
  await page.locator('[data-panel] [data-play]').click();
  await expect(page.locator('[data-radio]')).toHaveAttribute('data-error');
  await expect(page.locator('[data-message]')).toContainText('重试');
  await page.unroute('**/music/wild-001/audio.mp3');
  await page.locator('[data-panel] [data-play]').click();
  await playingTrack(page, 'wild-001');
  await expect(page.locator('[data-radio]')).not.toHaveAttribute('data-error');
});
