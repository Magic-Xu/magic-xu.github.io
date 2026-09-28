// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  compressHTML: true,
  markdown: { shikiConfig: { theme: 'github-light' } },
  site: 'https://magic-xu.github.io'
  // 如果仓库名不是 `magic-xu.github.io`（例如 `my-site`），请取消下一行注释：
  // base: '/my-site/'
});
