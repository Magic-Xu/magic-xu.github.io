# 小麦在野

MagicXu 的个人网站，记录 AI、独立开发与生活探索。使用 Astro 生成静态页面，部署到 GitHub Pages。

## 设计与交互规范

后续新增页面、功能、组件或动效，先阅读 [设计与交互规范](docs/design-system.md)，再沿用现有组件和样式。

网站的识别特征是：真实山野的开场、纸色与森林绿、宋体标题、舒展的阅读留白，以及连续、可打断的交互动画。首页承担沉浸感，内容页保持清晰安静；在野电台作为全站陪伴入口。新增功能应延续这些特征。

规范包含实际色值与字号、组件对应关系、微动画时长、漫游与电台的交互约定、响应式和按改动范围选择的验收清单。需要保持的原则与可调整的实现参数分开说明；[当前页面截图](docs/design-system.md#视觉基准)可用于视觉对照。[AGENTS.md](AGENTS.md) 为开发代理提供相同的规范入口。

## 本地运行

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run dev
```

`npm run check` 先生成 Astro 类型再检查 TypeScript，首次检出即可执行；`npm run build` 生成 `dist/`，`npm run preview` 预览构建结果。

## 回归验证

```sh
npx playwright install chromium
npm run check
npm test
```

`npm test` 自动构建并启动独立预览服务，运行真实浏览器测试。只检查首屏可运行 `npm run test:startup`；已有 Chrome 时可用 `PLAYWRIGHT_CHANNEL=chrome npm test`。测试覆盖首屏加载、刷新恢复、山野控制、失败回退、电台、客户端导航和内容交互，另有完整飞行路线检查。范围、报告及视觉验收方法见 [测试说明](docs/testing.md)。PR 和手动触发的 GitHub Actions 会运行同一测试集。

## 内容维护

- `src/content/blog/`：Markdown 文章；`draft: true` 的文章不会出现在列表、详情或 RSS 中。
- `src/content/notes/`：短篇随笔，在 `/notes/` 按年份、日期倒序直接展示全文。
- `src/content/footprints/`：旅行记录，在 `/footprints/` 按时间分组；地点图可定位并展开对应记录。
- `src/pages/index.astro`：首页介绍与最近三篇文章。
- `src/pages/about.astro`：个人介绍与联系方式。
- `src/content/locales/zh-CN.ts`：导航、作品及文章列表文案。
- `projects.featuredName` 指定重点项目；`writing.featuredPostId` 指定置顶文章的文件名（不含 `.md`）。置顶项单独展示，其余文章按时间倒序，首页与 RSS 仍按发布时间排序。
- `src/data/site.ts`：网站地址、作者和公开联系方式。
- `/subscribe/`：RSS 订阅说明与地址复制入口；`/rss.xml` 为按发布时间生成的文章摘要订阅源。

### 随笔与足迹

两个栏目目前没有公开记录，展示正式空状态：随笔引导阅读文章，足迹引导查看作品。空状态不展示年份、计数、地图或示例记录。向对应目录加入真实记录后，构建会自动显示列表与地图；`draft: true` 的记录不展示。随笔与足迹不进入文章 RSS。

空栏目或含演示记录的页面设置 `noindex, nofollow`；有真实记录且不含演示内容时自动移除。真实记录不需要填写 `demo`，默认值为 `false`。测试样例放在 `tests/fixtures/journal/`，不进入常规构建；含样例的交互验证见 [测试说明](docs/testing.md)。

每条记录使用独立 Markdown 文件，文件名是稳定的锚点 ID。随笔元数据示例：

```yaml
---
date: 2026-09-20
topic: 在路上
footprint: hangzhou # 可选，对应足迹文件名，不含 .md
draft: true
---
```

正文直接放几句感悟，不必填写标题、摘要或阅读时长。关联的足迹必须存在且不为草稿，否则构建报错，避免留下无效入口。

足迹元数据示例（演示）：

```yaml
---
place: 杭州
region: 浙江
visitedAt: 2026-09-20
longitude: 120.16
latitude: 30.27
summary: 西湖边，走一条没有计划的路。
draft: true
---
```

正文保存旅途的片段，当前每个地点维护一份记录。以上示例保持草稿状态；填写真实内容后，将 `draft` 设为 `false` 即可展示。日期以 `YYYY-MM-DD` 维护，按 UTC 日历日期显示，不随访客时区偏移。

[`FootprintMap.astro`](src/components/FootprintMap.astro) 使用本地 SVG 海岸轮廓和经纬度定位，不请求在线地图服务。底图来自 [Natural Earth 1:110m Land](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/)，按其[公共领域许可](https://www.naturalearthdata.com/about/terms-of-use/)投影为 `public/maps/east-asia-land.svg`。当前覆盖东经 96–126°、北纬 20–42°，不包含行政区边界；超出范围的记录仍出现在列表，但不在图上标点。拓展地域时一起更新底图与 [`journal.ts`](src/lib/journal.ts) 的 `mapExtent`，勿将越界地点挤到图边。

[`footprints.ts`](src/scripts/footprints.ts) 处理地图选中、锚点定位和连续展开收起；无 JavaScript 时仍可用原生链接与 `details/summary` 阅读。主导航为「文章 / 作品 / 足迹 / 随笔 / 关于」，≤600px 时品牌与导航分成两行。

## 在野电台

全站左下角的播放器默认不播放，首次出现时轻微上移、淡入；站内切页保留同一播放器与播放进度。底部「曲库」展开当前歌单，歌单标题旁的「换频道」在同一区域显示频道选择；选中后返回对应歌单，封面与播放控制保持在上方。频道与歌曲共用受视口高度约束的内容区，内部滚动。面板、曲库展开和视图切换使用可中断的 GSAP 过渡，开启减少动态效果时直接切换。展开和收起不改变播放状态。

目前有 6 个频道、25 首 AI 音乐。新访客默认「旅行与自由」，首曲为《没有时刻表》；播放列表只显示当前频道，上一首、下一首和自动续播在频道内循环。前台播放中切频道会淡出并接入新曲，暂停时切频道保持暂停；选择当前频道保留曲目与进度。进入后台立即完成音量过渡，后台续播不等待界面动画；返回前台沿用实际播放进度，保留暂停与静音选择。刷新后恢复所选频道、曲目和音量，仍需主动播放；原有曲目偏好会迁移到「人声精选」。

| 频道 | 曲目 ID | 数量 |
| --- | --- | --- |
| 山野与晨光 | `wild-001` 至 `wild-004` | 4 |
| 阅读与留白 | `wild-005` 至 `wild-008` | 4 |
| 专注与创造 | `wild-009` 至 `wild-012` | 4 |
| 旅行与自由 | `wild-013` 至 `wild-016` | 4 |
| 夜色与休息 | `wild-017` 至 `wild-020` | 4 |
| 人声精选 | `fireside`、`before-love`、`the-light-i-left-on`、`one-stop-late`、`red-light-halo` | 5 |

[`src/data/radio.ts`](src/data/radio.ts) 的 `radioChannels` 维护频道、歌名、展示艺人、音色、时长和资源路径。每首歌的 MP3 与 480 × 480 WebP 封面保存在 `public/music/<id>/`，音频仅在播放或主动调整进度时加载。添加曲目时同步更新所属频道和文件，保持已发布 ID 稳定。

唱片中心、播放面板、歌单与系统媒体信息使用同一首歌的封面。缺少 `cover` 或图片请求失败时，使用 `public/music/default-cover.svg`；补图后设置相应路径即可。曲库维护时检查封面实际能解码，并列出缺失曲目供补齐。

20 首纯音乐来自个人飞书音乐素材库的**电台版 v2**，每首 3 分钟，使用移除片尾语音、统一响度并淡入淡出的 MP3；保留原有音乐包中的 5 首人声曲目。界面持续标注「AI 生成」。公开资源仅包含播放所需音频与封面，原始 WAV、生成记录、附件令牌和私有来源文件不进入站点。

## 视觉资源

首页使用 TypeScript + Three.js 渲染完整地形：瑞士劳特布龙嫩及周边约 40 × 40 公里的山地，米制高程与航拍影像对应到同一坐标范围。浏览器在实体网格中沿约 23 公里的平滑环线移动，经过谷地与山脊后返回；镜头在环线接点保持连续。高程来自 Mapzen Terrain Tiles，航拍影像来自 swisstopo；访客可通过首页署名进入 `/landscape/credits/` 查看来源与致谢；资源的处理方式与完整许可说明见 [`public/landscape/SOURCES.md`](public/landscape/SOURCES.md)。

`src/lib/landscape.ts` 管理地形、相机与生命周期。点击「走入山野」淡出文案并逐渐加速，按住鼠标左键拖动可改变观察方向，松手保留当前观察偏移，普通移动不影响视角；「回到首页」或 Esc 恢复介绍。「暂停漫游」停止自动飞行、天空和薄雾，仍可按住鼠标拖动观察，「继续漫游」从当前位置接续。`src/lib/landscape-atmosphere.ts` 使用地形深度绘制谷地薄雾，山体会遮挡其后的雾；`src/scripts/landscape.ts` 负责按页面加载和释放场景。

`public/landscape/` 保存本地地形、影像、岩壁细节及同场景的静态首帧，无需访客访问第三方地图服务。HTML 内嵌轻量山景预览，静态大图解码后渐显；地形计算和纹理解码在 Worker 中完成，大纹理分批上传以留出界面响应时间。全域底图和压缩后的开场纹理形成静止的三维首帧，完成与静态图的交接后再缓慢启动飞行，随后渐进混入完整高清纹理。局部纹理失败仍可使用完整底图。场景以高空飞行为主，树林和建筑保留在航拍表面中，不提供地面步行或建筑内部视角。

同一标签页刷新时，使用 `sessionStorage` 保存的画面和同一时刻的相机状态接续，包括观察角度、暂停和进入山野状态；不会自动恢复音乐播放。记录有效期为 15 分钟，屏幕比例或桌面/手机模式不匹配、数据失效或存储不可用时使用正常开场。站内导航和新访问使用正常开场。调整路线或投影时更新 `landscape-state.ts` 的缓存版本，并按 [测试说明](docs/testing.md#更新开场素材) 重建首帧素材。

移动端使用较轻的网格和纹理，限制到 30 FPS 并省略体积雾后处理；性能不足时降低像素密度。离开首屏或切换标签页停止渲染，站内导航释放 WebGL 资源。减少动态效果、节省流量、必要资源加载失败或 WebGL 不可用时显示同场景静态图。静态图生成自实际场景；修改开场构图时同步更新桌面和手机两张图。

`src/styles/experience.css` 维护首页构图、首次绘制即开始的文字入场和全站交互样式；`src/scripts/motion.ts` 管理入场完成状态、作品详情展开和文章阅读进度。

公司墙复用 `public/company-icons/` 的原有 Logo。公众号二维码原图位于 `public/images/contact/wechat-xiaomai.jpg`，页脚入口指向关于页的联系方式区域。

中文标题使用本地 Noto Serif SC（SIL OFL），箭头来自 Phosphor Icons（MIT）；授权文本随资源保存在 `public/fonts/` 和 `public/icons/`。字体按现有页面文字制作子集，新增字形缺失时会回退系统宋体；大幅修改标题时可重新制作子集。正文使用系统字体。
