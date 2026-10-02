import { test, expect, instrumentScene, sceneReady, pauseScene, camera, matrixDifference } from './helpers';
import sharp from 'sharp';

test('a first visit still paints a real landscape when every external landscape image fails', async ({ page }) => {
  await page.route('**/landscape/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#home-title')).toHaveCSS('opacity', '1');
  const pixels = await page.screenshot({ clip: { x: 850, y: 250, width: 500, height: 400 } });
  const stats = await sharp(pixels).stats();
  expect(Math.max(...stats.channels.map(channel => channel.stdev)), 'Landscape detail remains visible instead of a flat green fill').toBeGreaterThan(10);
});

test.describe('opening frame alignment', () => {
  // Compare at the reference drawing density, independently of CI's lower
  // resolution for behavior tests. Downsampling the canvas first alters edges.
  test.use({ deviceScaleFactor: 1 });
  for (const viewport of [{ width: 1440, height: 960 }, { width: 1800, height: 850 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    test(`poster and stationary 3D frame align at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.locator('[data-scene="ready"]').waitFor();
      await page.locator('.landscape-world').evaluate(e => {
        const transition = e.getAnimations()[0];
        if (!transition) throw new Error('Expected the initial scene handover');
        transition.pause(); transition.currentTime = 0;
      });
      await expect(page.locator('.hero-landscape img')).toHaveAttribute('data-decoded', '');
      await page.addStyleTag({ content: '.site-header,.hero-inner,.hero-shade,[data-radio]{visibility:hidden!important}' });
      const poster = await page.locator('.home-hero').screenshot();
      await page.locator('.landscape-world').evaluate(e => {
        const transition = e.getAnimations()[0];
        transition.currentTime = Number(transition.effect!.getTiming().duration) - .1;
      });
      const scene = await page.locator('.home-hero').screenshot();
      const [a, b] = await Promise.all([poster, scene].map(image => sharp(image).resize({ width: 160 }).removeAlpha().raw().toBuffer()));
      const difference = a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / a.length;
      expect(difference, 'Mean RGB difference after matching the same viewport crop').toBeLessThan(2);
    });
  }
});

test('cold entry has an inline landscape; a late window load does not replay the entrance', async ({ page }) => {
  await instrumentScene(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => release = resolve);
  await page.route('**/alpine-poster.webp', async route => { await gate; await route.continue(); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  try {
    expect(await page.locator('.hero-landscape').evaluate(e => getComputedStyle(e).backgroundImage)).toContain('data:image/webp;base64,');
    expect(await page.locator('.hero-landscape img').evaluate((e: HTMLImageElement) => e.complete)).toBe(false);
    await expect(page.locator('#home-title')).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => window.__probe.introStarts)).toBe(1);
    release();
    await page.waitForLoadState('load');
    await sceneReady(page);
    expect(await page.evaluate(() => window.__probe.introStarts)).toBe(1);
    const samples = await page.evaluate(() => window.__probe.opacities);
    const visible = samples.findIndex(value => value > .95);
    expect(visible).toBeGreaterThanOrEqual(0);
    expect(Math.min(...samples.slice(visible))).toBeGreaterThan(.9);
  } finally { release(); }
});

test('the camera holds still throughout handover, then moves; detail blends progressively', async ({ page }, testInfo) => {
  await instrumentScene(page);
  await page.goto('/');
  await page.locator('[data-scene="ready"]').waitFor();
  const first = await camera(page);
  expect(first).toHaveLength(16);
  await page.waitForTimeout(700);
  expect(await camera(page)).toEqual(first);
  await expect(page.locator('[data-scene-toggle]')).toBeHidden();
  await sceneReady(page);
  await page.waitForFunction(() => window.__probe.detail === 1);
  expect(matrixDifference(first, await camera(page))).toBeGreaterThan(1);
  const probe = await page.evaluate(() => window.__probe);
  expect(probe.detailSamples.some(value => value > .05 && value < .95)).toBe(true);
  await testInfo.attach('startup-performance.json', { body: JSON.stringify(probe.longTasks, null, 2), contentType: 'application/json' });
});

test('reload restores the same paused camera, drag angle, journey and detail', async ({ page }) => {
  await instrumentScene(page);
  await page.goto('/'); await sceneReady(page);
  await page.locator('[data-scene-journey]').click();
  await page.waitForFunction(() => window.__probe.detail === 1);
  await pauseScene(page);
  await page.mouse.move(600, 340); await page.mouse.down(); await page.mouse.move(960, 410, { steps: 8 }); await page.mouse.up();
  const before = await camera(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.home-hero')).toHaveAttribute('data-restored', '');
  await expect(page.locator('.landscape-resume')).toBeVisible();
  await expect(page.locator('.home-hero')).toHaveAttribute('data-exploring', 'true');
  await sceneReady(page);
  expect(matrixDifference(before, await camera(page))).toBeLessThan(.0001);
  await expect(page.locator('[data-scene-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-scene-journey]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__probe.detail)).toBe(1);
  await page.waitForTimeout(300); expect(await camera(page)).toEqual(before);
  await page.locator('[data-scene-toggle]').click();
  await expect.poll(async () => matrixDifference(before, await camera(page))).toBeGreaterThan(1);
});

test('running reload resumes the saved route instead of restarting', async ({ page }) => {
  await instrumentScene(page);
  await page.goto('/'); await sceneReady(page);
  await page.waitForTimeout(900);
  const before = await camera(page);
  await page.reload(); await sceneReady(page);
  const restored = await camera(page);
  expect(matrixDifference(before.slice(12, 15), restored.slice(12, 15))).toBeLessThan(50);
  await expect(page.locator('[data-scene-toggle]')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(400);
  expect(matrixDifference(restored, await camera(page))).toBeGreaterThan(1);
});

test('reloading again during handover retains the same saved frame', async ({ page }) => {
  await instrumentScene(page); await page.goto('/'); await pauseScene(page);
  await page.mouse.move(600, 340); await page.mouse.down(); await page.mouse.move(920, 380); await page.mouse.up();
  const before = await camera(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.home-hero')).toHaveAttribute('data-restored', '');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.home-hero')).toHaveAttribute('data-restored', '');
  await sceneReady(page);
  expect(matrixDifference(before, await camera(page))).toBeLessThan(.0001);
});

test('private storage refusal and invalid saved data retain a usable opening', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
    Storage.prototype.getItem = () => '{invalid';
  });
  await page.goto('/'); await sceneReady(page);
  await page.reload(); await sceneReady(page);
  await expect(page.locator('.home-hero')).not.toHaveAttribute('data-restored');
  await expect(page.locator('#home-title')).toBeVisible();
});

test('slow no-cache entry remains usable before the terrain arrives', async ({ page, context }) => {
  test.setTimeout(90_000);
  await instrumentScene(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 180, downloadThroughput: 750000, uploadThroughput: 375000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#home-title')).toHaveCSS('opacity', '1');
  await page.locator('[data-open]').click();
  await expect(page.locator('[data-panel]')).toBeVisible();
  await page.keyboard.press('Escape');
  await sceneReady(page);
  expect(await page.evaluate(() => window.__probe.introStarts)).toBe(1);
});

test('no JavaScript keeps the landscape, text and navigation readable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(baseURL!);
    await expect(page.locator('.hero-landscape img')).toHaveCSS('opacity', '1');
    await expect(page.locator('#home-title')).toBeVisible();
    await expect(page.locator('[data-scene-toggle]')).toBeHidden();
    await page.locator('.hero-link').click();
    await expect(page).toHaveURL(/\/about\/$/);
  } finally { await context.close(); }
});
