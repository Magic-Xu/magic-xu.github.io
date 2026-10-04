import { test, expect, fitsViewport } from './helpers';

const journals = [
  { route: '/notes/', label: '随笔' },
  { route: '/footprints/', label: '足迹' }
];

test('published journals show the approved notes, places and album without preview copy', async ({ page }) => {
  for (const journal of journals) {
    await page.goto(journal.route);
    await expect(page.locator('.site-nav [aria-current="page"]')).toHaveText(journal.label);
    await expect(page.locator('.journal-empty, .journal-preview, meta[name="robots"]')).toHaveCount(0);
  }
  await expect(page.locator('[data-map-link]')).toHaveCount(45);
  await expect(page.locator('#photos-title')).toHaveText('相机里的回忆');
  await expect(page.locator('.photo-gallery figure')).toHaveCount(14);
  await expect(page.locator('.photo-gallery time')).toHaveCount(0);
  await page.goto('/notes/');
  await expect(page.locator('.note')).toHaveCount(3);
  const dates = await page.locator('.note-meta time[datetime]').evaluateAll(elements => elements.map(el => el.getAttribute('datetime')!));
  expect(dates).toEqual([...dates].sort().reverse());
  await expect(page.getByAltText('公司楼下公园的小猫', { exact: true })).toBeVisible();
  await expect(page.locator('.note-reference a')).toHaveCount(2);
});

test('right-side scrolling docks the map and hands off to the page at both list boundaries', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/footprints/');
  await page.evaluate(() => document.fonts.ready);
  const list = page.locator('[data-place-list]');
  const state = () => page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-place-list]')!;
    const explorer = document.querySelector('.travel-explorer')!;
    const header = document.querySelector('.site-header')!.getBoundingClientRect();
    return { page: scrollY, list: panel.scrollTop, end: panel.scrollHeight - panel.clientHeight,
      dock: scrollY + explorer.getBoundingClientRect().top - header.height - 24,
      top: panel.getBoundingClientRect().top, header: header.bottom };
  });
  const wheel = async (delta: number) => {
    const box = (await list.boundingBox())!;
    await page.mouse.move(box.x + box.width * .6, Math.max(150, box.y + 14));
    await page.mouse.wheel(0, delta);
  };
  const initial = await state();
  await wheel(80);
  await expect.poll(async () => (await state()).page).toBeCloseTo(80, 0);
  expect((await state()).list).toBe(0);
  await wheel(initial.dock - 80 + 200);
  await expect.poll(async () => (await state()).list).toBeCloseTo(200, 0);
  expect((await state()).page).toBeCloseTo(initial.dock, 0);
  const docked = await state();
  expect(docked.top).toBeCloseTo(docked.header + 24, 0);
  const mapTop = (await page.locator('[data-travel-atlas]').boundingBox())!.y;
  await wheel(100);
  await expect.poll(async () => (await state()).list).toBeCloseTo(300, 0);
  expect((await page.locator('[data-travel-atlas]').boundingBox())!.y).toBe(mapTop);
  await wheel(docked.end - 300 + 100);
  await expect.poll(async () => (await state()).page).toBeCloseTo(initial.dock + 100, 0);
  expect((await state()).list).toBe(docked.end);
  await wheel(-150);
  await expect.poll(async () => (await state()).list).toBeCloseTo(docked.end - 50, 0);
  expect((await state()).page).toBeCloseTo(initial.dock, 0);
  await wheel(-(docked.end - 50) - 80);
  await expect.poll(async () => (await state()).page).toBeCloseTo(initial.dock - 80, 0);
  expect((await state()).list).toBe(0);
  // Left-side scrolling can leave before the list is exhausted; the album stays unobstructed.
  await wheel(180);
  await expect.poll(async () => (await state()).list).toBeCloseTo(100, 0);
  const map = (await page.locator('.atlas-surface').boundingBox())!;
  const extent = await page.locator('.atlas-land').getAttribute('viewBox');
  await page.mouse.move(map.x + map.width / 2, map.y + 80);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => (await state()).page).toBeCloseTo(initial.dock + 120, 0);
  expect((await state()).list).toBeCloseTo(100, 0);
  await expect(page.locator('.atlas-land')).toHaveAttribute('viewBox', extent!);
  await page.locator('.travel-index a[href="#travel-photos"]').click();
  const album = (await page.locator('#travel-photos').boundingBox())!;
  const panel = (await list.boundingBox())!;
  expect(panel.y + panel.height).toBeLessThan(album.y);
});

test('published journals fit desktop, tablet, phone and short screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    for (const journal of journals) {
      await page.goto(journal.route);
      await fitsViewport(page);
      await expect(page.locator('.site-nav a')).toHaveText(['文章', '作品', '足迹', '随笔', '关于']);
      if (journal.route === '/footprints/') {
        await page.locator('.travel-index a[href="#travel-photos"]').focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/#travel-photos$/);
        await expect(page.locator('#photos-title')).toBeVisible();
      }
    }
  }
});

test('published notes and photos remain readable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/notes/`);
    await expect(page.locator('.note-copy')).toHaveCount(3);
    await expect(page.locator('.note-copy').last()).toContainText('现象级爆火');
    await page.locator('.site-nav a[href="/footprints/"]').click();
    await expect(page.locator('[data-map-link]')).toHaveCount(45);
    await expect(page.locator('.photo-gallery img')).toHaveCount(14);
    await expect(page.locator('#photos-title')).toHaveText('相机里的回忆');
  } finally { await context.close(); }
});

test('the radio keeps playing when visiting and leaving journals', async ({ page }) => {
  await page.goto('/notes/');
  const audio = page.locator('audio');
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await page.locator('.radio-mini-play').click();
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0)).toBe(true);
  await audio.evaluate((a: HTMLAudioElement) => window.__testAudio = a);
  await page.locator('.site-nav a[href="/footprints/"]').click();
  await expect(page.locator('[data-travel-atlas]')).toBeVisible();
  await page.locator('.site-nav a[href="/projects/"]').click();
  await expect(page).toHaveURL(/\/projects\/$/);
  expect(await page.evaluate(() => window.__testAudio === document.querySelector('audio') && !window.__testAudio.paused)).toBe(true);
  await expect(page.locator('audio')).toHaveCount(1);
});
