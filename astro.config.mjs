// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  outDir: process.env.JOURNAL_TEST_DATA === '1' ? './.journal-test-dist' : process.env.JOURNAL_PREVIEW === '1' ? './.journal-preview-dist' : './dist',
  cacheDir: process.env.JOURNAL_TEST_DATA === '1' ? './node_modules/.astro-journal-tests' : process.env.JOURNAL_PREVIEW === '1' ? './node_modules/.astro-journal-preview' : undefined,
  compressHTML: true,
  markdown: { shikiConfig: { theme: 'github-light' } },
  site: 'https://magicxu.com'
  // 如果仓库名不是 `magic-xu.github.io`（例如 `my-site`），请取消下一行注释：
  // base: '/my-site/'
});
