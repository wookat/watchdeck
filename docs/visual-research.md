# 视觉/品牌/特效升级专项 — 竞品视觉调研（R122）

日期：2026-08-05。方法：真实浏览器截图 + 页面源码/网络请求分析（公开可观察行为）。
边界：不绕反爬（Letterboxd/Serializd/Reelgood 有 Cloudflare 盾，直连被拒即跳过，仅参考其公开的设计讨论与既往 R101 观察）；不盗用受版权素材/代码，闭源站学习结构与思路后自研重制。

## 逐站观察

### Trakt（app.trakt.tv，SvelteKit）
- 技术：SvelteKit（`/_app/immutable/` 资源、svelte-* class 前缀），组件级 CSS 拆分，CDN 海报。
- 详情页：大海报+播放按钮悬浮、紫色主 CTA（品牌红渐变到紫）、评分行（Trakt%/IMDB/烂番茄式多源）、Where to Watch 卡、Sentiment AI 摘要卡。
- 卡片：海报 hover 出现「⋮」快捷菜单角标；已看角标「✓ WATCHED」贴片。
- 可复刻：多源评分行的排版密度、✓ WATCHED 海报贴片、快捷操作悬浮。

### Mubi（mubi.com，Next.js）
- 技术：Next.js（`/_next/static/`），自建组件库，styled 类名混淆。
- Browse 网格：剧照式大卡（非 2:3 海报），左下大写衬线感标题+导演/国家/年份小字，hover 卡片放大扩展为预告片自动播放+简介+WATCH CTA（影院感最强的交互）。
- 排版：极简黑白、全大写导航、字距拉开；「策展」气质靠大图+少文案。
- 可复刻：hover 时海报卡的「上浮+信息渐显」层（我们不做视频，改为渐变信息层）、大写小字排版点缀。

### TMDB（themoviedb.org，开源风格参考）
- 详情页 hero：**backdrop 剧照做整头部背景**，取海报主色调做半透明 tint 叠加渐变，白字前景；海报左侧悬浮、圆角。这是「影院感」详情页的行业标准结构（Trakt/Plex/JustWatch 同构）。
- 可复刻（首选）：我们 TMDB API 已返回 backdrop_path，详情页加 backdrop hero 是零额外配额的最大视觉跃升。

### Letterboxd / Serializd / Reelgood
- Cloudflare 盾拦截，未直连（红线）。沿用 R101 观察：Letterboxd 深墨绿底+三色圆点品牌、海报 hover 绿描边+阴影上浮、密度高但留白讲究；Serializd 深蓝紫+圆角大卡。

## 整合结论 → WatchDeck 影迷向「影院感」设计语言
定位：TV Time 难民（追剧影迷）→ 深色影院底 + 海报墙质感 + 克制的胶片感点缀。

1. **详情页 backdrop hero**（TMDB/Trakt 同构）：backdrop 剧照 + 深色渐变压底，海报悬浮左侧。
2. **海报 hover 动效**（Letterboxd/Mubi 之长）：上浮 scale + violet 描边 + 底部渐变信息层渐显；`prefers-reduced-motion` 全部降级为纯描边。
3. **落地页影院 hero**：聚光灯径向渐变 + 细微胶片颗粒纹理（CSS 生成，无图片资产）。
4. **组件体系现代化**（shadcn/ui 风格约定，不引运行时）：统一按钮/输入框 focus ring、圆角、过渡时长 token；导航 sticky+blur 已有，加滚动细化。
5. **品牌素材**：logo/favicon 重绘（场记板+播放三角，violet 渐变）、PWA 图标同步、OG 默认卡换新 logo、空状态插画（自研 SVG）。

## 技术栈决定（维持 R101 stack-assessment 结论）
- 不迁移框架：SSR + Tailwind v4 是 pSEO 主轴的正确形态（Mubi/Trakt 的重 JS 方案对我们无收益）。
- 不引入 GSAP/Motion 运行时：本批动效全部 CSS transition/animation 可达，零 JS 成本、天然 reduced-motion 降级；如未来需要滚动编排再评估。
- 组件现代化以「shadcn/ui 的设计 token 约定」落地为 Tailwind 工具类规范，而非引入 React 组件库（我们是 hono/jsx SSR）。

## 证据
- 截图：Trakt 首页/Severance 详情页、Mubi Browse 网格与 hover 扩展卡、TMDB backdrop hero（见 PR 评论）。
- 源码信号：Trakt `/_app/immutable/`（SvelteKit）、Mubi `/_next/static/`（Next.js）。
