# 山野场景资源

场景覆盖瑞士劳特布龙嫩及周边山地，地形宽约 40.3 公里。地理数据转换为米制地形网格，并按浏览器显示需要降采样、拼接与压缩；薄雾和天空为程序生成的视觉效果。

## 航拍影像

© swisstopo — Federal Office of Topography swisstopo.

- 数据：SWISSIMAGE，瑞士彩色正射影像。
- 来源：https://www.swisstopo.admin.ch/en/orthoimage-swissimage-10
- 使用条款：https://www.swisstopo.admin.ch/en/faq-free-geodata
- 获取：2026-10-02，geo.admin.ch WMTS 的 current 版本，EPSG:3857。世界底图中心区域为 zoom 14、X 8544–8559、Y 5784–5799，外围补充 zoom 13、X 4270–4281、Y 2890–2901；局部高清影像为 zoom 15、X 17100–17111、Y 11575–11590。
- 处理：瓦片拼接、不同分辨率缩放与 WebP 编码。`alpine-color*.webp` 为远景底图，`alpine-detail*.webp` 为飞行区域的局部高清图，`alpine-opening*.webp` 为同一高清图保留分辨率、进一步压缩后的开场纹理。`alpine-poster*.webp` 是本场景确定起点渲染的静态画面，`alpine-preview*.webp` 是嵌入首页 HTML 的微型版本。

## 高程

Mapzen Terrain Tiles / Tilezen Joerd.

Produced using Copernicus data and information funded by the European Union — EU-DEM layers. Includes USGS SRTM and GMTED elevation data where applicable.

- 数据与格式：https://registry.opendata.aws/terrain-tiles/
- 来源与授权：https://github.com/tilezen/joerd/blob/master/docs/attribution.md
- 获取：2026-10-02，Terrarium zoom 12，X 2135–2140，Y 1445–1450。
- 处理：解码米制高程、取整到 1 米，拼接为 1536 × 1536 网格。`alpine-height.png` 的 R、G 通道以 `R × 256 + G` 保存高程；B 通道为零。浏览器据此生成地形，`alpine.json` 保存坐标范围及影像映射。

## 岩壁细节

Rock Face 03 — Dario Barresi、Rico Cilliers / Poly Haven，CC0。

- 来源：https://polyhaven.com/a/rock_face_03
- 授权：https://polyhaven.com/license
- 处理：1K Diffuse 纹理转为 WebP；`rock-detail.webp` 通过三平面映射补充陡坡表面的细节。
