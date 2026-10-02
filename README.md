# 小麦在野

MagicXu 的个人网站，记录 AI、独立开发与生活探索。使用 Astro 生成静态页面，部署到 GitHub Pages。

## 本地运行

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run dev
```

`npm run check` 检查 TypeScript，`npm run build` 生成 `dist/`，`npm run preview` 预览构建结果。

## 内容维护

- `src/content/blog/`：Markdown 文章；`draft: true` 的文章不会出现在列表、详情或 RSS 中。
- `src/pages/index.astro`：首页介绍与最近三篇文章。
- `src/pages/about.astro`：个人介绍与联系方式。
- `src/content/locales/zh-CN.ts`：导航、作品及文章列表文案。
- `projects.featuredName` 指定重点项目；`writing.featuredPostId` 指定置顶文章的文件名（不含 `.md`）。置顶项单独展示，其余文章按时间倒序，首页与 RSS 仍按发布时间排序。
- `src/data/site.ts`：网站地址、作者和公开联系方式。
- `/subscribe/`：RSS 订阅说明与地址复制入口；`/rss.xml` 为按发布时间生成的文章摘要订阅源。

## 在野电台

全站左下角的播放器默认不播放，展开或收起不改变播放状态，站内切页保留播放。面板与歌单使用可中断的 GSAP 过渡，开启减少动态效果时直接切换。支持选曲、进度、音量与整张歌单循环；刷新后恢复所选曲目和音量，需再次点击播放。

`src/data/radio.ts` 维护歌名、展示艺人、曲风、时长和资源路径。每首歌的 MP3 与 WebP 封面保存在 `public/music/<id>/`，音频在用户播放或拖动进度时才加载。添加曲目时同步更新这两处，播放器会自动生成歌单。

当前 5 首曲目来自提供的 AI 音乐包，界面标注「AI 生成」。公开资源仅包含播放用音频与封面，原始 WAV、生成记录和私有来源文件不进入站点。

## 视觉资源

首页使用 TypeScript + Three.js 渲染完整地形：瑞士劳特布龙嫩及周边约 40 × 40 公里的山地，米制高程与航拍影像对应到同一坐标范围。浏览器在实体网格中沿约 23 公里的平滑环线移动，经过谷地与山脊后返回；镜头在环线接点保持连续。高程来自 Mapzen Terrain Tiles，航拍影像来自 swisstopo；访客可通过首页署名进入 `/landscape/credits/` 查看来源与致谢；资源的处理方式与完整许可说明见 [`public/landscape/SOURCES.md`](public/landscape/SOURCES.md)。

`src/lib/landscape.ts` 管理地形、相机与生命周期。点击「走入山野」淡出文案并逐渐加速，按住鼠标左键拖动可改变观察方向，松手保留当前观察偏移，普通移动不影响视角；「回到首页」或 Esc 恢复介绍。「暂停漫游」停止自动飞行、天空和薄雾，仍可按住鼠标拖动观察，「继续漫游」从当前位置接续。`src/lib/landscape-atmosphere.ts` 使用地形深度绘制谷地薄雾，山体会遮挡其后的雾；`src/scripts/landscape.ts` 负责按页面加载和释放场景。

`public/landscape/` 保存本地地形、影像、岩壁细节及同场景的静态首帧，无需访客访问第三方地图服务。先加载全域底图，再加载飞行区域的清晰纹理；局部纹理失败仍可使用完整底图。场景以高空飞行为主，树林和建筑保留在航拍表面中，不提供地面步行或建筑内部视角。

移动端使用较轻的网格和纹理，限制到 30 FPS 并省略体积雾后处理；性能不足时降低像素密度。离开首屏或切换标签页停止渲染，站内导航释放 WebGL 资源。减少动态效果、节省流量、必要资源加载失败或 WebGL 不可用时显示同场景静态图。静态图生成自实际场景；修改开场构图时同步更新桌面和手机两张图。

`src/styles/experience.css` 维护首页构图和全站交互样式；`src/scripts/motion.ts` 管理页面入场、作品详情展开和文章阅读进度。

公司墙复用 `public/company-icons/` 的原有 Logo。公众号二维码原图位于 `public/images/contact/wechat-xiaomai.jpg`，页脚入口指向关于页的联系方式区域。

中文标题使用本地 Noto Serif SC（SIL OFL），箭头来自 Phosphor Icons（MIT）；授权文本随资源保存在 `public/fonts/` 和 `public/icons/`。字体按现有页面文字制作子集，新增字形缺失时会回退系统宋体；大幅修改标题时可重新制作子集。正文使用系统字体。
