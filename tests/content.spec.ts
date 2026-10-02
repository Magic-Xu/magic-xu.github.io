import { test, expect } from './helpers';

test('project details animate, reverse and remain readable with reduced motion', async ({ page }) => {
  await page.goto('/projects/');
  const details = page.locator('.project-entry').first(), summary = details.locator('summary');
  const closed = (await details.boundingBox())!.height;
  await summary.click(); await page.waitForTimeout(180);
  expect((await details.boundingBox())!.height).toBeGreaterThan(closed + 5);
  await summary.click(); await page.waitForTimeout(90); await summary.click();
  await page.waitForTimeout(650); await expect(details).toHaveAttribute('open', '');
  await summary.click(); await expect(details).not.toHaveAttribute('open');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await summary.click();
  await expect(details.locator('.project-expanded')).toHaveCSS('opacity', '1');
});

test('Chinese reading headings update the active table of contents and progress', async ({ page }) => {
  await page.goto('/writing/google-play-closed-testing/');
  const heading = page.locator('.article-prose h2').nth(1), id = await heading.getAttribute('id');
  await heading.evaluate(e => scrollTo({ top: scrollY + e.getBoundingClientRect().top - 125, behavior: 'instant' }));
  await page.waitForFunction(id => Array.from(document.querySelectorAll<HTMLAnchorElement>('.toc-link[aria-current="location"]')).some(a => decodeURIComponent(a.hash.slice(1)) === id), id);
  expect(await page.locator('.reading-progress').evaluate(e => new DOMMatrix(getComputedStyle(e).transform).a)).toBeGreaterThan(0);
});

test('source credit opens UTF-8 HTML, fits narrow screens and returns home', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await page.locator('.scene-credit').click();
  await expect(page).toHaveURL(/\/landscape\/credits\/$/);
  await expect(page.locator('h1')).toHaveText('山野的来处');
  expect(await page.evaluate(() => document.characterSet)).toBe('UTF-8');
  expect(await page.locator('main').innerText()).not.toContain('�');
  await expect(page.locator('canvas')).toHaveCount(0);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.locator('.back-link').click(); await expect(page.locator('#home-title')).toBeVisible();
});
