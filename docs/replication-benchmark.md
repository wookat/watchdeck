# 一比一复刻基准对照表 — 标杆：Trakt（app.trakt.tv）

- 调研日期：2026-08-08（走查复核 2026-08-05 生产环境）
- 标杆选择：Trakt Web（https://app.trakt.tv，Svelte 全 JS 渲染，用真实浏览器走查）。Serializd 作为次级参考未纳入本轮（Trakt 覆盖面更全）。
- 走查方式：真实浏览器逐页走查 + DOM 结构分析（home / 详情页 severance / calendar / discover / profile / search），全部为公开可访问部分，未绕任何 bot wall，未注册新账号。
- 合规边界：只复刻信息架构 / 布局 / 交互 / 状态反馈规律，全部自研实现；不拷贝其代码（其 trakt-web 仓库为 GPLv3 开源，为避免 license 传染同样不复制）、版权图片、字体、商标、文案原文。
- 评分口径：还原度 = 该页面/流程中标杆核心体验规律在 WatchDeck 的落地程度（不是像素级一致，是结构与体验规律一致）。低于 100% 的项列缺陷等级；「有意不复刻」项单独标注并说明理由，不计入缺陷。

## 逐页对照

### 1. 首页 / Dashboard（Trakt: Home ↔ WatchDeck: /home）

| 维度 | Trakt 观察 | WatchDeck 现状 | 还原度 | 差距/处置 |
|---|---|---|---|---|
| 信息架构 | 多区块 dashboard：Continue Watching / Start Watching / Streak callout / Calendar / Recommended / History / Social Activity，每区块可折叠+下钻链接 | Next Up（=Continue Watching）+ Airing this week（=Calendar 区块）+ watchlist 提示 + onboarding 清单 | 90% | 缺 Streak callout（P1，本轮已补）；Recommended/History 区块有意不搬上首页（详情页已有 More like this、/history 独立页，首页保持聚焦——超越项见文末）；Social 层未做（待老板拍板的大方向） |
| Streak callout | 「连续观看 N 天」激励条，醒目放在 dashboard | 原仅在 /stats 深处显示 | 0%→100% | **P1 已修**：/home 顶部新增 🔥 N-day streak 条（≥2 天显示，点击进 /stats），与 Trakt 同构自研 |
| Continue Watching 卡片 | 海报+剧名+SxxEyy+标记按钮 | Next Up 卡片同构：海报+剧名+SxxEyy+集名+播出日+剩余集数+✓ Watched | 100% | 我们额外多剩余集数与 undo |
| 空态 | 每区块有解释性空态文案+Discover CTA | 空态区分「无任何数据」（导入/搜索 CTA）与「全部追平」（watchlist 预览网格） | 100% | 同构且有差异化 |
| 状态反馈 | 操作后区块即时更新 | 标记后绿色确认条+Undo | 100% | — |

### 2. 剧集详情页（Trakt: /shows/:slug ↔ WatchDeck: /shows/:id-slug）

| 维度 | Trakt 观察 | WatchDeck 现状 | 还原度 | 差距/处置 |
|---|---|---|---|---|
| Hero 布局 | 大海报+标题+元数据行（年份/集数/分级/题材）+ 生命周期状态（Returning Series） | backdrop hero+海报+标题+年份/季集数/状态/评分/题材行 | 95% | 生命周期状态原为纯文本混在元数据里，不如 Trakt 的显式状态标识可扫读（P2，本轮已修） |
| 状态标识 | 「Returning Series / Ended / Canceled」显式状态 chip | 原纯文本 | 70%→100% | **P2 已修**：StatusBadge 彩色 chip（在播/制作中=绿、Canceled=红、Ended=灰），自研样式 |
| Created by | 「Created by X」链接到人物页 | 原无 | 0%→100% | **P1 已修**：详情页新增 Created by 行，链接到我们已有的 /person pSEO 页（TMDB created_by 数据） |
| 主操作区 | Watched / Watchlist / Trailer / More 操作条 + 评分星 | Watching/Watchlist/Completed/Dropped 四态 + ▶ Trailer + 集级 ★ 评分 | 100% | 结构等价，我们状态机更细（四态 vs 二态） |
| 季/集列表 | Seasons 选择器 + 集行 | 季 tab + 集行（watched/评分/rewatch/bulk 标记） | 100% | 我们集行功能更多（up-to-here、↺ again、集评分） |
| Where to stream | Providers + Stream 按钮 | WhereToWatch 组件 + 我的服务高亮 | 100% | 我们多「按我的服务过滤」 |
| 评论/Reviews | 评论区+sentiment 卡 | 无 | 0% | 有意不复刻：社交层（评论/评价流）为待老板拍板的独立大方向，不在本轮边界内 |
| 推荐 | 相关推荐行 | More like this 海报行 | 100% | — |

### 3. 日历（Trakt: /calendar ↔ WatchDeck: /calendar）

| 维度 | Trakt 观察 | WatchDeck 现状 | 还原度 | 差距/处置 |
|---|---|---|---|---|
| 布局 | 7 天日期条 + 前后翻页 + Today | 按日分组列表（Today/Tomorrow/日期节标题，Today 紫色高亮） | 90% | 布局范式不同但同为「按日分组」；我们数据源为你追的剧的 next episode（无翻页需求），有意保留列表式（移动端更优） |
| Premieres/Finales 过滤 | All / Premieres / Finales 三档过滤 | 原无首播标识 | 0%→85% | **P2 已修**：日历与首页 Airing 行新增「Series premiere / Season premiere」徽章（E01 自动识别）。Finale 标识需 TMDB episode_type 额外请求，性价比低暂缓（P3 backlog） |
| 空态 | 有氛围感空态文案 | EmptyState 插画+解释+Browse CTA | 100% | 文案自研，不抄原文 |
| iCal | VIP 功能 | 免费 iCal 订阅+人话提示 | 100% | 超越项：他们收费我们免费 |

### 4. 发现页（Trakt: /discover ↔ WatchDeck: /search + /browse）

| 维度 | Trakt 观察 | WatchDeck 现状 | 还原度 | 差距/处置 |
|---|---|---|---|---|
| 结构 | Trending / Anticipated / Popular 海报行 | /search 未输入时 Trending shows/movies 网格；/browse 题材/网络/年份/人物入口 | 95% | Anticipated（未播先热）无对应（P3 backlog，TMDB 无直接等价端点）；我们 browse pSEO 维度远多于 Trakt discover |
| 海报卡 | 海报+年份+集数/时长+context menu | 海报+标题+年份+in-library 徽章+快捷添加 | 95% | context menu（每卡三点菜单）有意不复刻——我们卡上直接给「+ Watchlist」快捷动作，路径更短 |

### 5. 个人资料/统计（Trakt: /profile/me ↔ WatchDeck: /stats + /u/:share + /library + /history）

| 维度 | Trakt 观察 | WatchDeck 现状 | 还原度 | 差距/处置 |
|---|---|---|---|---|
| 本月/全时期指标 | This month（集/剧/影/plays/小时/评分）+ All time 指标墙 | /stats：小时/集数/剧数/影数/plays/评分分布/Top episodes/Month in Review/streak | 95% | 指标覆盖等价；organization 不同（我们单页多卡） |
| Screen Time / peak hours | 日均/峰值时段分析 | 无小时级分析（导入数据多无时刻精度） | — | 有意不复刻：TV Time 导出与手动标记多为日期精度，做时段分析会是假精度，违背「不伪造数据」红线 |
| 年度回顾 | VIP 收费年报 | Wrapped 免费+可分享海报卡 | 100% | 超越项 |
| 公开主页 | Profile 公开 | /u/:token 公开分享页+OG 卡 | 100% | — |

### 6. 搜索（Trakt: /search ↔ WatchDeck: /search）

| 维度 | Trakt 观察 | WatchDeck 现状 | 还原度 | 差距/处置 |
|---|---|---|---|---|
| 过滤 | show/movie/person/list 过滤 | All/TV/Movies 标签 + People 行 | 95% | list 搜索无（我们 lists 为私有+分享链接模型，无公共 list 库可搜，有意不做） |
| Top searches | 热搜榜 | 未输入时 Trending 网格 | 100% | 等价结构 |
| 空态/回显 | 输入回显+空态 | 「Results for “q”」+EmptyState 插画 | 100% | — |

### 7. 全局导航/页脚

| 维度 | Trakt 观察 | WatchDeck 现状 | 还原度 | 差距/处置 |
|---|---|---|---|---|
| 导航 | 侧栏 rail：Search/Home/Discover/Lists/Profile | 顶部 sticky nav：Home/Search/Browse/Library/Lists/Calendar/Stats/History/Settings | 100% | 范式不同（顶栏 vs 侧栏）但入口覆盖超集；顶栏为我们既定设计系统，有意保留 |
| 页脚 | About/VIP/API/Forums/Terms/Privacy/状态页/社区链接 | About & Press/Guides/Pricing/Privacy/Terms/TMDB attribution | 95% | API/Forums/状态页无对应产品面（超出当前产品范围，有意不做） |

## 本轮缺陷修复清单（未达 100% 项）

| 等级 | 项 | 修复 |
|---|---|---|
| P1 | 首页无 streak 激励条（Trakt dashboard 核心留存机制） | /home 顶部 🔥 N-day streak 条（≥2 天显示，D1 连续日期计算，链接 /stats） |
| P1 | 详情页无 Created by（关键元数据+人物页互链缺口） | TvDetails 增 created_by，详情页 Created by 行链接 /person 页 |
| P2 | 详情页生命周期状态不可扫读 | StatusBadge 彩色 chip（Returning/In Production/Planned=绿、Canceled=红、其余灰） |
| P2 | 日历/首页 Airing 无首播标识（Trakt Premieres 过滤的核心价值） | E01 自动打「Series premiere / Season premiere」徽章 |
| P3 backlog | Finale 标识（需逐集 episode_type 请求）、Anticipated 区块（TMDB 无直接等价） | 记录暂缓，价值/成本比低 |

有意不复刻项（不计缺陷）：评论/社交层（待拍板独立方向）、Screen Time 时段分析（数据精度不支持，避免假精度）、context menu（用直达快捷键替代）、公共 list 搜索（产品模型不同）、API/Forums/状态页（超出产品面）。

## 超越项（我们比标杆多做/做得更好）

1. **免费提供 Trakt 的 VIP 功能**：iCal 日历订阅、年度回顾（Wrapped）在 Trakt 均为付费 VIP，我们 beta 免费且 Wrapped 还带可分享海报 OG 卡。
2. **更细的观看状态机**：Watching/Watchlist/Completed/Dropped 四态 + 自动完结归档；Trakt 详情页主操作只有 Watched/Watchlist 二元。
3. **集级深度**：per-episode ★ 评分、↺ rewatch 计次、「watched up to here」批量补记——TV Time 难民核心诉求，Trakt web 详情页无此密度。
4. **导入即家**：TV Time GDPR ZIP / Trakt CSV / Serializd CSV / Netflix CSV 四源导入+未匹配手动绑定，Trakt 无 TV Time 直接导入。
5. **pSEO 面**：题材/网络/年份/人物公开页+结构化数据+sitemap/IndexNow，Trakt discover 无此公开可索引面。
6. **人话解释层**：全站 Hint tooltip 把统计术语翻译成大白话，标杆无对应层。

## 复刻洞察深度优化（本轮 +2）

1. **Streak 激励条**（上表 P1）：把留存机制从 /stats 深处提到 dashboard 首屏——直接借鉴 Trakt streak callout 的位置心理学。
2. **Premiere 徽章**（上表 P2）：把 Trakt「Premieres 过滤」的价值内联化——不用切过滤器，扫日历即见首播，比标杆交互成本更低。
