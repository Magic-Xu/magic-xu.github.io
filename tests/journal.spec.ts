import { test, expect, fitsViewport } from './helpers';

const journals = [
  { route: '/notes/', label: '随笔', destination: '/writing/', action: '去读文章' },
  { route: '/footprints/', label: '足迹', destination: '/projects/', action: '看看作品' }
];

test('empty journals have useful destinations and publish no sample records', async ({ page }) => {
  for (const journal of journals) {
    await page.goto(journal.route);
    await expect(page.locator('.site-nav [aria-current="page"]')).toHaveText(journal.label);
    await expect(page.locator('.journal-empty')).toBeVisible();
    await expect(page.locator('.journal-empty')).toContainText('这里还没有');
    await expect(page.locator('.note, .trip-entry, .map-place, .journal-preview')).toHaveCount(0);
    await expect(page.locator('.notes-count, .footprints-count, .notes-index, .footprint-map')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await page.getByRole('link', { name: journal.action }).click();
    await expect(page).toHaveURL(new RegExp(`${journal.destination}$`));
  }
});

test('empty pages fit desktop, tablet, phone and short screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    for (const journal of journals) {
      await page.goto(journal.route);
      await fitsViewport(page);
      await expect(page.locator('.site-nav a')).toHaveText(['文章', '作品', '足迹', '随笔', '关于']);
      const action = page.getByRole('link', { name: journal.action });
      await action.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`${journal.destination}$`));
    }
  }
});

test('empty journals stay readable and navigable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    for (const journal of journals) {
      await page.goto(`${baseURL}${journal.route}`);
      await expect(page.locator('.journal-empty')).toContainText('这里还没有');
      await page.getByRole('link', { name: journal.action }).click();
      await expect(page).toHaveURL(new RegExp(`${journal.destination}$`));
    }
  } finally { await context.close(); }
});

test('the radio keeps playing when visiting and leaving empty journals', async ({ page }) => {
  await page.goto('/notes/');
  const audio = page.locator('audio');
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await page.locator('.radio-mini-play').click();
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0)).toBe(true);
  await audio.evaluate((a: HTMLAudioElement) => window.__testAudio = a);
  await page.locator('.site-nav a[href="/footprints/"]').click();
  await expect(page.locator('.journal-empty-footprints')).toBeVisible();
  await page.getByRole('link', { name: '看看作品' }).click();
  await expect(page).toHaveURL(/\/projects\/$/);
  expect(await page.evaluate(() => window.__testAudio === document.querySelector('audio') && !window.__testAudio.paused)).toBe(true);
  await expect(page.locator('audio')).toHaveCount(1);
});
