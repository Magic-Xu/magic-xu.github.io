# 小麦在野

MagicXu 的个人网站，记录 AI、独立开发与生活探索。使用 Astro 生成静态页面，部署到 GitHub Pages。

## 本地运行

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run dev
```

`npm run build` 生成 `dist/`，`npm run preview` 预览构建结果。

## 内容维护

- `src/content/blog/`：Markdown 文章；`draft: true` 的文章不会出现在列表、详情或 RSS 中。
- `src/pages/index.astro`：首页介绍与最近两篇文章。
- `src/pages/about.astro`：个人介绍与联系方式。
- `src/content/locales/zh-CN.ts`：导航、作品及文章列表文案。
- `projects.featuredName` 指定重点项目；`writing.featuredPostId` 指定置顶文章的文件名（不含 `.md`）。置顶项单独展示，其余文章按时间倒序，首页与 RSS 仍按发布时间排序。
- `src/data/site.ts`：网站地址、作者和公开联系方式。
- `/rss.xml`：按发布时间生成的文章摘要订阅源。

## 视觉资源

首页山景为 AI 生成图片，以 WebP 保存在 `public/images/home/`。

公司墙复用 `public/company-icons/` 的原有 Logo。公众号二维码原图位于 `public/images/contact/wechat-xiaomai.jpg`，页脚入口指向关于页的联系方式区域。

中文标题使用本地 Noto Serif SC（SIL OFL），箭头来自 Phosphor Icons（MIT）；授权文本随资源保存在 `public/fonts/` 和 `public/icons/`。字体按现有页面文字制作子集，新增字形缺失时会回退系统宋体；大幅修改标题时可重新制作子集。正文使用系统字体。
