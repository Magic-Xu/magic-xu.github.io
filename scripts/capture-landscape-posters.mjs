import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { resolve } from 'node:path';

// Run against the current build, then rebuild to embed the new previews.
const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:4322';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium' });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
      deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile
    });
    // Use the same restoration contract to hold the exact opening pose.
    await page.addInitScript(() => {
      window.__landscapeResume = { state: { distance: 0, elapsed: 0, journey: 0, lookX: 0, lookY: 0, paused: true, exploring: false, detail: 0, rock: 0 } };
    });
    await page.goto(baseURL);
    await page.locator('[data-scene-presented="true"]').waitFor({ timeout: 60000 });
    await page.addStyleTag({ content: '.site-header,.hero-inner,.hero-shade,[data-radio]{visibility:hidden!important}' });
    const image = await page.locator('.landscape-world').screenshot();
    const suffix = mobile ? '-mobile' : '';
    await sharp(image).webp({ quality: 87 }).toFile(resolve(`public/landscape/alpine-poster${suffix}.webp`));
    await sharp(image).resize({ width: mobile ? 180 : 320 }).webp({ quality: 45 }).toFile(resolve(`public/landscape/alpine-preview${suffix}.webp`));
    await page.close();
  }
} finally { await browser.close(); }
console.log('Updated opening posters and inline previews. Run npm run build again.');
