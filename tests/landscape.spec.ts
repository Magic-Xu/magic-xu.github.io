import { test, expect, instrumentScene, sceneReady, pauseScene, camera, matrixDifference, fitsViewport } from './helpers';

test('only held primary drag steers; release, hover, plain clicks and blur preserve the angle', async ({ page }) => {
  await instrumentScene(page); await page.goto('/'); await pauseScene(page);
  for (const exploring of [false, true]) {
    if (exploring) { await page.locator('[data-scene-journey]').click(); await pauseScene(page); }
    const initial = await camera(page);
    for (const [x, y] of [[300, 250], [1200, 650], [200, 700]]) await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.click(680, 340);
    await page.waitForTimeout(100);
    expect(await camera(page)).toEqual(initial);
    await page.mouse.down(); await page.mouse.move(682, 341); await page.mouse.up();
    expect(await camera(page)).toEqual(initial);
    await page.mouse.move(680, 340); await page.mouse.down(); await page.mouse.move(980, 460, { steps: 8 }); await page.mouse.up();
    const turned = await camera(page);
    expect(matrixDifference(initial, turned)).toBeGreaterThan(.01);
    expect(turned.slice(12, 15)).toEqual(initial.slice(12, 15));
    await page.mouse.move(1450, 970); await page.mouse.move(250, 200);
    await page.waitForTimeout(100); expect(await camera(page)).toEqual(turned);
    await page.mouse.move(1300, 650); await page.mouse.down(); await page.mouse.move(1450, 980, { steps: 5 }); await page.mouse.up();
    await expect(page.locator('.home-hero')).not.toHaveAttribute('data-dragging');
    const released = await camera(page);
    await page.mouse.move(900, 350); expect(await camera(page)).toEqual(released);
    await page.mouse.down(); await page.mouse.move(700, 360);
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
    await expect(page.locator('.home-hero')).not.toHaveAttribute('data-dragging');
  }
});

test('pause freezes rendering; journey and Escape keep copy, focus and flight consistent', async ({ page }) => {
  await instrumentScene(page); await page.goto('/'); await sceneReady(page);
  const journey = page.locator('[data-scene-journey]');
  await journey.click();
  await expect(journey).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.hero-copy').evaluate(e => (e as HTMLElement).inert)).toBe(true);
  await pauseScene(page);
  const paused = await page.evaluate(() => window.__probe.frames);
  await page.waitForTimeout(400); expect(await page.evaluate(() => window.__probe.frames)).toBe(paused);
  await page.keyboard.press('Escape');
  await expect(journey).toHaveAttribute('aria-pressed', 'false');
  await expect(journey).toBeFocused();
  expect(await page.locator('.hero-copy').evaluate(e => (e as HTMLElement).inert)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__probe.frames)).toBeGreaterThan(paused);
  for (let i = 0; i < 4; i++) await journey.click();
  await expect(journey).toHaveAttribute('aria-pressed', 'false');
});

test('context loss and a live motion preference switch leave a usable static page and recover', async ({ page }) => {
  await instrumentScene(page); await page.goto('/'); await sceneReady(page);
  await page.locator('[data-scene-journey]').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.home-hero')).toHaveAttribute('data-scene', 'fallback');
  await expect(page.locator('[data-scene-journey]')).toBeHidden();
  expect(await page.locator('.hero-copy').evaluate(e => (e as HTMLElement).inert)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await sceneReady(page);
  expect(await page.evaluate(() => window.__probe.introStarts)).toBe(1);
  await page.locator('canvas').evaluate(canvas => {
    window.__lose = (canvas as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context');
    window.__lose!.loseContext();
  });
  await expect(page.locator('.home-hero')).toHaveAttribute('data-scene', 'fallback');
  await expect(page.locator('[data-scene-journey]')).toBeHidden();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__lose!.restoreContext()); await sceneReady(page);
  await expect(page.locator('[data-scene-journey]')).toBeVisible();
});

test('pending loads tolerate preference changes and navigation without duplicate renderers', async ({ page }) => {
  await instrumentScene(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => release = resolve);
  await page.route('**/alpine-height.png', async route => { await gate; await route.continue().catch(() => {}); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('[data-scene-toggle]')).toBeHidden();
  await page.locator('.site-nav a[href="/projects/"]').click();
  await expect(page).toHaveURL(/\/projects\/$/);
  release(); await page.unroute('**/alpine-height.png');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect.poll(() => page.workers().length).toBe(0);
  const stopped = await page.evaluate(() => window.__probe.frames);
  await page.waitForTimeout(200); expect(await page.evaluate(() => window.__probe.frames)).toBe(stopped);
  await page.locator('.site-brand').click(); await sceneReady(page);
  await expect(page.locator('.hero-landscape img')).toHaveAttribute('data-decoded', '');
  await expect(page.locator('[data-landscape] canvas')).toHaveCount(1);
});

for (const mode of ['reduced', 'save-data', 'core-failure', 'worker-failure', 'texture-worker-failure', 'webgl-unavailable'] as const) {
  test(`${mode} retains the landscape fallback and useful navigation`, async ({ page }) => {
    const heavy: string[] = [];
    page.on('request', request => { if (/landscape-[\w-]+\.js|alpine-height\.png/.test(request.url())) heavy.push(request.url()); });
    if (mode === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (mode === 'save-data') await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }));
    if (mode === 'core-failure') await page.route('**/alpine-height.png', route => route.abort());
    if (mode === 'worker-failure') await page.route(/landscape-terrain\.worker-[\w-]+\.js$/, route => route.abort());
    if (mode === 'texture-worker-failure') await page.route(/landscape-textures\.worker-[\w-]+\.js$/, route => route.abort());
    if (mode === 'webgl-unavailable') await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, options?: unknown) {
        if (type.includes('webgl')) return null;
        return original.call(this, type as '2d', options);
      } as typeof original;
    });
    await page.goto('/'); await expect(page.locator('#home-title')).toHaveCSS('opacity', '1');
    await expect(page.locator('[data-scene-journey]')).toBeHidden();
    await expect(page.locator('.home-hero')).toHaveAttribute('data-scene', 'fallback');
    expect(await page.locator('.hero-landscape img').evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
    if (mode === 'reduced' || mode === 'save-data') expect(heavy).toEqual([]);
    await page.locator('.hero-link').click(); await expect(page).toHaveURL(/\/about\/$/);
  });
}

test('missing optional detail keeps the full base terrain flying', async ({ page }) => {
  await instrumentScene(page);
  await page.route('**/alpine-detail*.webp', route => route.abort());
  await page.route('**/rock-detail.webp', route => route.abort());
  await page.goto('/'); await sceneReady(page);
  const before = await camera(page);
  await expect.poll(async () => matrixDifference(before, await camera(page))).toBeGreaterThan(1);
  await expect(page.locator('[data-scene-toggle]')).toBeVisible();
});

test('leaving the hero stops rendering and returning continues the flight', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await instrumentScene(page); await page.goto('/'); await sceneReady(page);
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => page.locator('.home-hero').evaluate(e => e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
  await page.waitForTimeout(100);
  const stopped = await page.evaluate(() => window.__probe.frames);
  await page.waitForTimeout(350); expect(await page.evaluate(() => window.__probe.frames)).toBe(stopped);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.__probe.frames)).toBeGreaterThan(stopped);
});

for (const width of [390, 320]) {
  test(`mobile ${width}px keeps controls separated, radio inside the viewport and touch scrolling available`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 568 }, isMobile: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    try {
      await page.goto(baseURL!); await sceneReady(page);
      const journey = await page.locator('[data-scene-journey]').boundingBox();
      const pause = await page.locator('[data-scene-toggle]').boundingBox();
      const radio = await page.locator('[data-radio]').boundingBox();
      expect(journey!.x + journey!.width).toBeLessThanOrEqual(pause!.x);
      expect(pause!.y + pause!.height).toBeLessThan(radio!.y);
      await page.locator('[data-scene-journey]').click();
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await page.locator('.home-hero').dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, button: 0, pointerId: 1 });
      await page.locator('.home-hero').dispatchEvent('pointermove', { pointerType: 'touch', buttons: 1, pointerId: 1, clientX: 150, clientY: 400 });
      await expect(page.locator('.home-hero')).not.toHaveAttribute('data-dragging');
      await page.locator('[data-open]').click(); await page.locator('[data-list-toggle]').click();
      await page.waitForTimeout(650); await fitsViewport(page);
    } finally { await context.close(); }
  });
}
