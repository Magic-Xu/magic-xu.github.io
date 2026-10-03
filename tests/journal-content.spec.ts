import { test, expect, fitsViewport } from './helpers';

test('notes are readable in full, grouped by year, and link to a real trip entry', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.locator('.site-nav [aria-current="page"]')).toHaveText('随笔');
  await expect(page.locator('.journal-preview')).toContainText('演示内容');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('.note')).toHaveCount(7);
  await expect(page.locator('.notes-year h2')).toHaveText(['2026年', '2025年']);
  await expect(page.locator('.note-copy').first()).toContainText('把这一小步做好，明天就有了继续走的地方。');
  await page.locator('.note-place').click();
  await expect(page).toHaveURL(/\/footprints\/#footprint-hangzhou$/);
  await expect(page.locator('#footprint-hangzhou')).toHaveAttribute('open', '');
  await expect(page.locator('[data-place="hangzhou"]')).toHaveAttribute('aria-current', 'location');
  await page.goBack();
  await expect(page.locator('.site-nav [aria-current="page"]')).toHaveText('随笔');
  await page.locator('.site-nav a[href="/footprints/"]').click();
  await page.locator('#footprint-dali summary').click();
  await expect(page.locator('#footprint-dali summary')).toHaveAttribute('aria-expanded', 'true');
});

test('map selection opens and locates the matching memory, including direct links', async ({ page }) => {
  await page.goto('/footprints/#footprint-xian');
  await expect(page.locator('#footprint-xian summary')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-place="xian"]')).toHaveAttribute('aria-current', 'location');
  for (const id of ['beijing', 'dali', 'chengdu', 'xiamen', 'hangzhou']) {
    await page.locator(`[data-place="${id}"]`).click();
    const entry = page.locator(`#footprint-${id}`);
    await expect(entry.locator('summary')).toBeFocused();
    await expect(entry).toHaveAttribute('open', '');
    await expect(entry.locator('.trip-expanded')).toBeVisible();
    await expect(page.locator('.map-place[aria-current]')).toHaveAttribute('data-place', id);
    await expect(page).toHaveURL(new RegExp(`#footprint-${id}$`));
    await expect.poll(async () => (await entry.boundingBox())!.y).toBeGreaterThanOrEqual(90);
  }
});

test('trip expansion has intermediate frames, reverses, and settles when motion preference changes', async ({ page }) => {
  await page.goto('/footprints/');
  const entry = page.locator('#footprint-dali');
  const summary = entry.locator('summary');
  const closed = (await entry.boundingBox())!.height;
  await summary.click();
  await page.waitForTimeout(180);
  const partial = (await entry.boundingBox())!.height;
  expect(partial).toBeGreaterThan(closed + 2);
  await page.waitForTimeout(420);
  const full = (await entry.boundingBox())!.height;
  expect(full).toBeGreaterThan(partial + 2);
  await summary.click(); await page.waitForTimeout(140); await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => Math.abs((await entry.boundingBox())!.height - full)).toBeLessThan(1);
  await summary.click(); await page.waitForTimeout(90);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(entry).not.toHaveAttribute('open');
  await expect(entry.locator('.trip-expanded')).toHaveAttribute('inert', '');
  await summary.focus(); await page.keyboard.press('Enter');
  await expect(entry).toHaveAttribute('open', '');
  await expect(entry).not.toHaveAttribute('style', /height/);
  await page.keyboard.press('Space');
  await expect(entry).not.toHaveAttribute('open');
  await expect(page.locator('.map-place[aria-current]')).toHaveCount(0);
});

test('rapid map choices keep the final selection and focus', async ({ page }) => {
  await page.goto('/footprints/');
  await page.locator('[data-place="dali"]').click();
  await page.waitForTimeout(100);
  await page.locator('[data-place="chengdu"]').click();
  await expect(page.locator('#footprint-chengdu summary')).toBeFocused();
  await expect(page.locator('.map-place[aria-current]')).toHaveAttribute('data-place', 'chengdu');
  await expect(page.locator('#footprint-chengdu')).not.toHaveAttribute('style', /height/);
});

test('five navigation links and both journals fit phone, tablet and desktop widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/notes/', '/footprints/']) {
      await page.goto(route);
      await expect(page.locator('.site-nav a')).toHaveCount(5);
      await fitsViewport(page);
      const links = await page.locator('.site-nav a').all();
      let edge = 0;
      for (const link of links) {
        const box = (await link.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(edge);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        edge = box.x + box.width;
      }
      if (route === '/footprints/') {
        const pins = await page.locator('.map-place').all();
        for (const pin of pins) expect((await pin.boundingBox())!.width).toBeGreaterThanOrEqual(44);
        await page.locator('[data-place="beijing"]').click();
        await expect(page.locator('#footprint-beijing summary')).toBeFocused();
        const target = (await page.locator('#footprint-beijing summary').boundingBox())!;
        const header = (await page.locator('.site-header').boundingBox())!;
        expect(target.y).toBeGreaterThanOrEqual(header.y + header.height);
      }
    }
  }
});

test('notes and travel memories remain usable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/notes/`);
    await expect(page.locator('.note-copy').last()).toContainText('留白也是一次选择。');
    await page.locator('.site-nav a[href="/footprints/"]').click();
    await page.locator('[data-place="dali"]').click();
    const entry = page.locator('#footprint-dali');
    if (!(await entry.evaluate((element: HTMLDetailsElement) => element.open))) await entry.locator('summary').click();
    await expect(entry.locator('.trip-expanded')).toContainText('云走得很快');
    await expect(entry.locator('.trip-expanded')).toBeVisible();
  } finally { await context.close(); }
});

test('the radio continues through both new tabs and reload stays silent', async ({ page }) => {
  await page.goto('/notes/');
  await page.locator('.radio-mini-play').click();
  const audio = page.locator('audio');
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0)).toBe(true);
  await audio.evaluate((a: HTMLAudioElement) => window.__testAudio = a);
  for (const route of ['/footprints/', '/notes/', '/writing/']) {
    await page.locator(`.site-nav a[href="${route}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    expect(await page.evaluate(() => window.__testAudio === document.querySelector('audio') && !window.__testAudio.paused)).toBe(true);
    await expect(page.locator('audio')).toHaveCount(1);
  }
  await page.reload();
  await expect(page.locator('[data-radio]:not([hidden])')).toBeVisible();
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
});
