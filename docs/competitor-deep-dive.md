# Competitor deep-dive — 扩面调研与技术反推（专项 R1 批，2026-08）

方法：直接抓取/浏览各竞品公开页面（HTML/HTTP 头/结构化数据/静态资源），无登录、不绕反爬（Cloudflare 挑战一律跳过，改用 Wayback 公共存档）。目标是「取各家之长整合复刻」，不是照抄单一家。

## 覆盖竞品（11 家）

| # | 竞品 | 形态 | 抓取途径 | 技术信号（公开可观察） |
|---|------|------|----------|------------------------|
| 1 | Trakt (app.trakt.tv) | Web+App，免费+VIP | 直接抓取 | 新 Web 端为 **Svelte** SPA，Cloudflare 前置；JSON-LD WebSite |
| 2 | Letterboxd | Web+App，免费+Pro/Patron | Wayback 存档 | 服务端渲染 + JS islands（System.import 按需加载）；CF 挑战保护 |
| 3 | Serializd | Web+App，完全免费 | Wayback 存档 | SPA（客户端 Loading 占位），TMDB 数据源 |
| 4 | Simkl | Web，免费+VIP | Wayback 存档 | 传统服务端渲染+大量内联 JS；表单校验文案内嵌 |
| 5 | TVmaze | Web，免费+Premium | 直接抓取 | nginx/Ubuntu 自托管，服务端渲染；自有 TV 数据库+公开 API |
| 6 | BetaSeries | Web+App（法国） | 直接抓取 | 服务端渲染+critical CSS 内联优化；Cloudflare；公开 API 文档 |
| 7 | Reelgood | Web，免费+企业数据 | Wayback 存档 | SSR+客户端水合；按流媒体服务过滤是核心 |
| 8 | JustWatch | Web，免费（导流变现） | 直接抓取 | **Vue 3 + Vite** SSR，重 SEO（1.3MB 首页 HTML，海量内链） |
| 9 | Hobi | App（TV Time 官方迁移伙伴） | 直接抓取 | 营销站 Cloudflare；卖点=「记住一切」+TV Time 导入含评分 |
| 10 | Showly | App（开源 Android/iOS） | 直接抓取 | 静态营销站；Trakt 双向同步为核心卖点 |
| 11 | Must/Watcharr | App/自托管开源 | 直接抓取 | Must=社交推荐（ML）；Watcharr=Svelte 自托管 watched list（1.5k star） |

## 逐家要点（功能 × 交互 × 实现反推）

### 1. Trakt — 定价与 VIP 功能结构（最重要参照）
- **定价**：VIP $6/mo、$5/mo（$60/年）、$4/mo（$96/两年）。付款方式 Apple Pay/Google Pay/信用卡。
- VIP 功能清单（我们的对照）：Year in Review（我们已有 By-year/So-far 雏形）、**Month in Review（缺）**、All-Time Stats（已有）、Streaming Sync（Netflix 等自动同步——重活，Beta）、Plex Sync（定位外）、**Advanced Filtering（按平台/类型/年份/分级过滤日历与列表——部分缺）**、Unlimited Lists（自定义清单——**缺**）、Unlimited Notes（已有 notes）、Improved Rewatching（**重看计数缺**）。
- 交互模式：pricing 页用「Most Popular」徽章突出年付档；功能卡带 NEW/POPULAR/BETA 状态角标；每项带 "See what it looks like" 示例链接。
- 反推：VIP 页大量 webp 截图演示 + data-fanart 背景轮换（用热门剧照当背景，情绪化促销）。

### 2. Letterboxd — 日记交互与 Pro 分层（交互设计标杆）
- **定价**：Pro $19/年、Patron $49/年。免费档功能完整（unlimited films/diary/reviews/lists），付费=无广告+统计+个性化。
- **日志弹窗（log modal）是核心交互**：一个弹窗完成 看过日期+以前看过(rewatch)+含剧透+标签+评分+喜欢+隐私级别（公开/密友/私密）+草稿。我们的「标记看过」只有单击打勾，可借鉴：**看过时间可编辑、rewatch 标记**。
- Pro 卖点值得抄：**按自己订阅的流媒体过滤 + watchlist 上架通知**（"get notified when films in your watchlist arrive on those services"）。
- 反推：页面服务端渲染，交互组件按需 System.import；隐私分级文案严谨（Close Friends 评分不计入统计）。

### 3. Serializd — 免费定位与 FAQ 营销
- 完全免费；自我定位「Letterboxd for TV / Goodreads for TV」。落地页三段式：Track → Community → Discover，每段 3 个 checkmark 要点。
- FAQ 直接回答「能否从 TV Time/Trakt 导入」——把导入当获客钩子（我们已做，落地页 FAQ 已有）。
- 差异点：**季/剧评论 + TV 日记 + 用户清单**；社区是其护城河（我们定位外）。

### 4. Simkl — 自动追踪与多媒介
- 卖点「Automatically track what you're watching」；覆盖 Anime（我们暂不做）。
- 注册表单内联即时校验文案（密码长度/键盘布局提示）——我们注册表单可加**内联即时校验**。

### 5. TVmaze — 数据广度与倒计时
- 首页信息密度极高：今晚播出、**季首播倒计时（Countdown）**、频道时间表、最近新增。
- **Countdown 到小时**是黏性利器（Hobi 也主打）。我们日历只有日期，可加「距下集 N 天」相对时间。

### 6. BetaSeries — 本地化与 API 生态
- 多语言（13 种）、公开 API 文档吸引开发者生态。critical CSS 内联首屏优化（我们可评估）。

### 7. Reelgood — 流媒体聚合过滤
- 核心交互：「ADD YOUR SERVICES」个性化——只看自己订阅平台的内容；Top 10 This Week 跨平台榜单；**Roulette 随机选片**。
- 我们已有 where-to-stream 展示，缺「**我的流媒体服务**」偏好过滤（Letterboxd Pro 同款，付费点）。

### 8. JustWatch — pSEO 天花板
- 首页 HTML 1.3MB，海量「What's on Netflix/新上架/即将下架」内链矩阵；Vue+Vite SSR。
- 借鉴：**「New on <平台>」类聚合页**是搜索流量大户（我们已有 by-network，可加 trending-on 维度文案）。

### 9. Hobi — TV Time 难民定位（直接竞争对手！）
- 首页 banner：「TV Time has shut down. Hobi is the official migration partner」——**与我们同一目标人群**，且为「官方迁移伙伴」。10M+ 下载、Wired/CNET/Verge 引用背书。
- 功能对照：episode countdown（到小时）、通知、Trakt 双向同步（服务端跑）、**Diary 时间线**（我们 /history 已具雏形）、统计含 **streaks（连续观看天数，缺）**。
- 文案反推：卖「记忆」而非「工具」——"Your show is back, two years later. You remember loving it. Not much else. Hobi remembers everything."（情感化文案值得学）。
- 弱点=无 Web 端（我们的差异化立足点，继续强化）。

### 10. Showly — 开源移动端
- Discover/Track/Collect 三段式；证言墙（用户评价+国旗）增信任。落地页可加**用户证言区**（有真实用户后）。

### 11. Must / Watcharr
- Must：ML 个性化推荐 Vision + 情境化清单（"first date movies"）。
- Watcharr：开源自托管、Svelte、极简 UI；证明该品类自托管需求存在（定位外）。

## 整合复刻清单（P0/P1/P2）

**P0（定价口径，老板直接指令）**
- [ ] 全站去「free forever」表述 → 「Beta 免费试用」；新增 /pricing 页展示正式档位（参照 Trakt $5/mo·$60/yr 与 Letterboxd $19/yr 区间定价），标注 Beta 期间全功能免费开放、不收款。

**P1（各家之长，低成本高价值）**
- [ ] 观看记录可编辑日期 + rewatch 重看标记（Letterboxd log modal 精髓的服务端渲染版）
- [ ] 日历/Next Up 相对倒计时「in N days / tomorrow」（TVmaze/Hobi countdown）
- [ ] 统计加 streak 连续观看（Hobi）与 Month in Review 月度小结（Trakt VIP 卖点，我们免费）
- [ ] 落地页文案情感化改写 + 竞品式三段 checkmark 布局（Hobi/Serializd）
- [ ] 「我的流媒体服务」偏好 + 详情页优先显示（Reelgood/Letterboxd Pro）

**P2**
- [ ] 自定义清单 lists（Trakt VIP 大卖点）
- [ ] watchlist 上架通知（Letterboxd Pro）
- [ ] 注册表单内联校验（Simkl）
- [ ] Roulette 随机选片（Reelgood）

## 设计语言观察（截图+源码）
- Trakt/Hobi：深色底+品牌红/紫强调、大标题+短句、功能卡三列栅格、状态角标（NEW/BETA/POPULAR）。
- Letterboxd：三色圆点品牌、密度高但留白讲究、卡片阴影弱化靠边框分隔。
- 共性：pricing 页三卡并列+推荐档高亮、hero 区真实产品截图/剧照背景、社会证明（媒体引用/用户数）。
- 我们现状（slate-950 深底+violet 强调 Tailwind v4）方向正确；差距主要在 pricing 页缺失、落地页缺社会证明与情感文案、功能卡缺状态角标。
