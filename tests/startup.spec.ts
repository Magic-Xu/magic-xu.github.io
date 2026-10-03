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
  for (const viewport of [{ width: 1440, height: 960 }, { width: 1800, height: 850 }, { width: 960, height: 640 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
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
      // GPU and software backends vary slightly in shader arithmetic and filtering.
      // Less than 1% RGB error preserves alignment without requiring identical noise.
      expect(difference / 255, 'Mean RGB difference after matching the same viewport crop').toBeLessThan(.01);
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

test('bottom entrances are gradual and revealing 3D controls never shifts the text or explore link', async ({ page }) => {
  await instrumentScene(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => release = resolve);
  await page.route('**/alpine-height.png', async route => { await gate; await route.continue(); });
  // Hold only these CSS entrances from their first frame. A software WebGL frame
  // may outlast an entrance, so wall-clock sampling cannot observe its midpoint.
  await page.route(url => url.pathname === '/', async route => {
    const response = await route.fetch();
    const style = '<style>.hero-horizon :is(.scene-credit,.hero-scroll,.scene-journey,.scene-toggle):not([data-test-playing]){animation-play-state:paused!important}</style>';
    await route.fulfill({ response, body: (await response.text()).replace('<head>', `<head>${style}`) });
  });
  const sampleEntrances = (selector: string) => page.locator(selector).evaluateAll(elements => elements.map(element => {
    const animation = element.getAnimations().find(animation => animation instanceof CSSAnimation && animation.animationName === 'horizon-item-enter');
    if (!animation) throw new Error(`${element.className} is missing its entrance`);
    const timing = animation.effect!.getTiming();
    animation.currentTime = Number(timing.delay) + Number(timing.duration) * .15;
    const sample = { className: element.className, opacity: Number(getComputedStyle(element).opacity), transform: getComputedStyle(element).transform };
    animation.currentTime = 0;
    element.setAttribute('data-test-playing', '');
    return sample;
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  try {
    const samples = await sampleEntrances('.scene-credit, .hero-scroll');
    await expect(page.locator('.hero-scroll')).toHaveCSS('opacity', '1');
    await expect(page.locator('[data-scene-journey]')).toBeHidden();
    const positions = () => page.evaluate(() => ['#home-title', '.hero-horizon', '.hero-scroll'].map(selector => {
      const box = document.querySelector(selector)!.getBoundingClientRect(); return { y: box.y, height: box.height };
    }));
    const before = await positions();
    release(); await sceneReady(page);
    samples.push(...await sampleEntrances('.scene-journey, .scene-toggle'));
    await expect(page.locator('[data-scene-toggle]')).toHaveCSS('opacity', '1');
    expect(await positions()).toEqual(before);
    await page.setViewportSize({ width: 768, height: 1024 });
    const creditGap = await page.evaluate(() => {
      const range = document.createRange(); range.selectNodeContents(document.querySelector('.scene-credit')!);
      return range.getBoundingClientRect().left - document.querySelector('[data-radio]')!.getBoundingClientRect().right;
    });
    expect(creditGap, 'Source text has breathing room beside the radio on tablet').toBeGreaterThanOrEqual(12);
    for (const className of ['scene-credit', 'hero-scroll', 'scene-journey', 'scene-toggle']) {
      const sample = samples.find(item => item.className === className);
      expect(sample, `${className} has its own entrance`).toBeDefined();
      expect(sample!.opacity).toBeLessThan(.9);
      expect(sample!.transform).not.toBe('none');
    }
    expect(await page.evaluate(() => window.__probe.introStarts)).toBe(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    expect(await page.evaluate(() => window.__probe.introStarts)).toBe(1);
  } finally { release(); }
});

test('explore remains usable without 3D, and the radio entrance is interruptible and never repeats on client navigation', async ({ page }) => {
  await page.route('**/landscape/**', route => route.abort());
  await page.addInitScript(() => {
    (window as any).__radioFrames = [];
    const sample = () => {
      const radio = document.querySelector<HTMLElement>('[data-radio]:not([hidden])');
      if (radio) (window as any).__radioFrames.push({ opacity: Number(getComputedStyle(radio).opacity), transform: getComputedStyle(radio).transform });
      if (performance.now() < 2500) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/');
  await expect(page.locator('[data-radio]')).toHaveAttribute('data-entered', 'true');
  const frames: { opacity: number; transform: string }[] = await page.evaluate(() => (window as any).__radioFrames);
  expect(frames.some(frame => frame.opacity > .05 && frame.opacity < .9 && frame.transform !== 'none')).toBe(true);
  await page.locator('.hero-scroll').click();
  await expect(page).toHaveURL(/#recent-title$/);
  await expect(page.locator('#recent-title')).toBeInViewport();
  await page.locator('[data-open]').click();
  await page.keyboard.press('Escape');
  await page.locator('.site-nav a[href="/about/"]').click();
  await expect(page.locator('[data-radio]')).toHaveAttribute('data-entered', 'true');
  await expect(page.locator('[data-radio]')).toHaveCSS('opacity', '1');
  await page.reload({ waitUntil: 'domcontentloaded' });
  // An immediate click finishes the decoration while keeping the requested action.
  await page.locator('[data-open]').dispatchEvent('click');
  await expect(page.locator('[data-panel]')).toBeVisible();
  await expect(page.locator('[data-radio]')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('[data-radio]')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-radio]')).toHaveCSS('transform', 'none');
});
