# WatchDeck 持续迭代日志

每轮由五个驱动找改进点：①测试 ②UX 走查 ③前端视觉 ④竞品调研 ⑤用户/数据分析。
格式：轮次 / 发现（驱动+优先级）/ 修复 / 证据。

---

## Round 2 — 2026-08-05

**发现**
- [测试(性能) / P1] `/home` Next Up 对每个在追剧集串行调用 TMDB（详情+逐季），追 10+ 部剧时首屏可达数秒——这是产品最重要的页面。
- [数据分析 / P2] `/api/stats` 只返回日 PV，缺周报所需的国家分布、热门路径、热门搜索词、注册/waitlist 数。
- [QA 走查 / P3] round-1 QA 发现：`/reset/<token>` 页导航固定渲染未登录态，与 `/forgot` 不一致。

**修复（已部署，Version eb82b5a3）**
- `/home` 各剧集 Next Up 计算改为 `Promise.all` 并行，单剧内部季循环保持短路。
- `/api/stats` 扩展为 `{daily, countries, topPaths, topSearches, users, waitlist}`（30 天窗口），一次调用出周报。
- `/reset/<token>` 有效页传入当前用户，导航状态一致。

**证据（线上验证）**
- QA 账号加 8 部在追剧后 `/home` 200 且 0.31–0.71s（此前串行按剧数线性增长）。
- 非管理员访问 `/api/stats` 仍 403（访问控制回归通过）。

---

## Round 1 — 2026-08-05

**发现**
- [UX 走查 / P1] 无「忘记密码」流程：用户忘记密码即永久失去账号（竞品 Trakt/Serializd 均有）。
- [数据分析 / P2] 第一方统计只记录 path，不记录搜索词——无法分析用户找什么内容（搜索词是内容缺口和 pSEO 的关键信号）。
- [测试 / P3] round-6 遗留：清除评分后悬停星短暂显示琥珀色。

**修复（已部署，Version 19c5bf74）**
- 完整密码重置流程：`/forgot` 表单 → Resend 发送 1 小时有效的一次性重置链接 `/reset/<token>` → 设新密码后使旧会话全部失效并自动登录；对不存在的邮箱返回相同提示（防枚举），`/forgot` 提交限速 5 次/10 分钟。登录页新增 "Forgot password?" 入口。
- 新表 `search_queries`：记录搜索词与结果数（不记录用户 ID/IP，保持无 Cookie 隐私架构）。
- 评分星增加 `transition-colors` 缓解悬停残留观感。

**证据（线上验证）**
- `/forgot` GET 200；无效 token `/reset/...` 404。
- 真实 E2E：新账号 → 插入 token → 重置成功 → 旧密码 401 / 新密码 302 → token 复用 404（单次有效）。
- `/search?q=the bear` 后 `search_queries` 出现 `('the bear', 20)`。

---

## Round 3 — 2026-08-05

**发现**（来自测试代理对全站的真实线上 UX/视觉走查，无 P0/P1）
- [UX / P2] 整季按钮在全部看完后仍显示「Mark season watched」，点了无变化（静默 no-op），且无法整季取消。
- [UX / P2] 日历空态文案把「你追的剧都已完结/无排期」归咎为用户加的剧不够，误导。
- [UX / P3] Next Up 点「✓ Watched」无撤销入口，误点需进详情页找回。
- [视觉 / P3] 搜索结果缺年份时显示悬空分隔符「· Movie」。
- [视觉 / P3] Stats「Most-watched shows」只有 1 项时像坏了（其他在追剧 0 集）。

**修复（已部署，Version 7397a75a）**
- 整季按钮双态：已播集全看完 → 绿色「Season N watched — unmark all」（`/api/watch-season` 新增 undo=1 整季取消）。
- 日历空态改为解释「暂无已公布的排期，公布后自动出现（含 iCal）」并引导去 /browse。
- Next Up 标记后重定向 `/home?w=<id>.<s>.<e>`，顶部绿色横幅「Marked SxxExx watched. Undo」，一键撤销。
- 缺年份时不再渲染悬空「·」。
- Most-watched 列表下加说明「其他在追剧记录集数后会出现在这里」。

**证据（线上验证）**
- 82856 S1 bulk → 按钮变「unmark all」→ undo → 恢复「Mark season 1 watched」。
- `/home?w=95396.1.2` 显示撤销横幅；日历空态新文案 + Browse 链接在线可见；`2022 · TV` 正常、无悬空分隔符。
- 走查录屏与报告：test-report-round3-discovery.md（无 P0/P1）。

---

## Round 4 — 2026-08-05

**发现**
- [竞品调研 / P1] TV Time 的招牌统计是「你花了多少小时看剧」，这是迁移用户情感黏性最强的数字；Trakt 也在 VIP 档提供 watch-time 统计。WatchDeck 统计页只有集数/部数，缺这一情感核心指标。

**修复（已部署，Version 7e12bcc1）**
- 新增 hours watched 统计：按剧集实际时长（TMDB `last_episode_to_air.runtime`/`episode_run_time`，缺省 40min）与电影 `runtime`（缺省 110min）计算总观看小时数，KV 缓存 1 小时/用户。
- `/stats` 与公开分享页新增第一张「hours watched」卡片；分享页 OG 卡片与 meta description 同步加入 hours。

**证据（线上验证）**
- QA 账号看 3 集 Severance → stats 显示「4 hours watched」（3×~55min＋TMDB 实际时长，四舍五入）。
- OG PNG 重新渲染 200 / 1200×630，首格为 hours watched。

**已知限制（P3，下轮候选）**
- hours 缓存 1 小时，导入大量数据后统计页最长 1 小时才刷新该卡片。

---

## Round 5 — 2026-08-05

**发现**
- [测试 / P1] 部署链问题：Round 3/4 分支基于 main（不含未合并的 PR #10），线上部署一度回退了 Round 2 的 Next Up 并行与富管理统计。本轮已将 iteration-2 分支合并进来重新部署，线上恢复全量代码。
- [QA / P2] Round 4 已知限制：hours watched 缓存 1 小时，标记/导入后统计不即时。
- [数据分析] 第一方数据周览：人类 PV 326（11 国）、注册 5、waitlist 2、搜索词 3 条——仍以内部 QA 为主，无自然流量，获客是最大瓶颈（社区投放待老板口径）。

**修复（已部署，Version 7a484274）**
- 合并 iteration-2 分支：恢复 /home 并行 Next Up、富 /api/stats、reset 页导航修复。
- `invalidateHours()`：/api/watch、/api/watch-season、/api/watch-movie、/api/import/batch 四处变更后台删除 `hours:<userId>` KV 键，统计即时刷新。

**证据（线上验证）**
- 标记 Severance S01E04 后 stats 立即 4→5 hours（无需等缓存过期）。
- /home 200 / 0.41s（并行恢复）。

**回归发现（测试代理，P0）**
- iteration-5 分支漏合 iteration-3（Round 3 四项修复未在线上）。已合并 iteration-3 重新部署并复验。

---

## Round 6 — 2026-08-05

**发现**
- [前端视觉/无障碍 / P2] 无 skip-to-content 链接、导航搜索框无可访问名称、评分星按钮无 aria-label/aria-pressed、键盘 focus 无统一可见轮廓——键盘与读屏用户体验差（WCAG 2.4.1/4.1.2/2.4.7）。
- [视觉 / P3] round-3 遗留：placeholder 海报是播放三角，易被误解为可播放视频。

**修复（已部署，Version d4591d19）**
- Layout 加「Skip to content」链接（聚焦时可见）＋ `<main id="main">`。
- 导航搜索框 `aria-label`；评分星按钮加 `aria-label`（Rate n stars / Clear rating）与 `aria-pressed`。
- 全局 `:focus-visible` 紫色 2px 轮廓。
- placeholder 海报改为场记板图标，消除「可播放」歧义。

**证据（线上验证）**
- 首页 HTML 含「Skip to content」；styles.css 含 `:focus-visible` 规则；`/placeholder-poster.svg` 已更新为场记板。

---

## Round 7 — 2026-08-05

**发现**
- [UX 走查 / P2] Library 无标题筛选：TV Time 导入用户常有上百条目，只靠状态页签+排序找单部剧很费劲（Trakt/Serializd 均有列表内搜索）。
- [数据分析 / P2] 导入是产品核心转化路径，但第一方统计只有页面 PV，无法看「上传→解析成功/失败→入库完成」漏斗，无法定位导入流失。

**修复（已部署，Version eb5c830b）**
- Library 新增标题筛选框（服务端 `LIKE COLLATE NOCASE`，保留状态/排序参数），无结果时给「Clear filter」空态。
- 导入漏斗事件：`/funnel/import-parse-ok|import-parse-empty|import-parse-fail|import-batch-done` 记入 analytics_events（ua_class='funnel'，不记用户/IP）；`/api/stats` 新增 funnel 汇总，PV 类查询排除 funnel 事件。

**证据（线上验证）**
- `/library?q=sever` 只列 Severance；`?q=zzzz` 显示「Nothing in your library matches … Clear filter」。
- 上传 CSV 后 D1 出现 `('/funnel/import-parse-ok', 1)`。

---

## Round 8 — 2026-08-05

**发现**
- [竞品/SEO / P2] Trakt、Serializd 的剧集/电影详情页都有 schema.org 结构化数据（TVSeries/Movie JSON-LD），Google 富结果依赖它；我们的 pSEO 页面（数千 TMDB 详情页 + 题材页）没有任何结构化数据。
- [竞品/分享 / P3] 剧集/电影页分享到社交平台时无 og:image（只有分享统计页有 OG 卡），链接预览是纯文字。

**修复（已部署，Version e6a03126）**
- Layout 支持 `jsonLd` 注入 `<script type="application/ld+json">`。
- 剧集页输出 TVSeries JSON-LD（name/url/description/image/datePublished/numberOfSeasons/genre），电影页输出 Movie JSON-LD。
- 剧集/电影页 og:image 使用 TMDB w500 海报 + twitter:card summary_large_image。

**证据（线上验证）**
- `/shows/95396-severance` 含 `"@type":"TVSeries"`；`/movies/27205-inception` 含 `"@type":"Movie"` 与 og:image。

---

## Round 9 — 2026-08-05

**发现**
- [UX 走查 / P2] Next Up 全部追平时只显示一句「You're all caught up」+ 日历链接，是个死胡同：watchlist 里明明有想看的剧/电影，却只有页脚一行小字提示数量（TV Time/Trakt 在此场景直接推荐 watchlist 内容）。

**修复（已部署，Version a07c1eb1）**
- `/home` 在 Next Up 为空且 watchlist 非空时查询最近 6 条 watchlist 条目，caught-up 空态下方渲染「Start something from your watchlist」海报网格（移动端 3 列 / 桌面 6 列），点击直达详情页。

**证据**
- 部署后 `/home` 线上 200；该分支逻辑（nextUp 空 && watchlist>0）待下次 5 轮回归中用全新账号覆盖验证。

---

## Round 10 — 2026-08-05

**发现**
- [竞品/产品逻辑 / P2] TV Time 会在看完最后一集时自动把剧标为 completed；我们看完已完结剧的全部集数后状态仍停留在 watching，Library「Completed」页签与 Stats「shows completed」长期偏低，需要用户手动改状态（我们 UI 甚至没有改状态入口）。

**修复（已部署，Version e1d5fed6）**
- `maybeAutoComplete`：单集标记或整季标记后，若剧集 TMDB status 为 Ended/Canceled 且已看集数 ≥ number_of_episodes，自动将 tracked.status 从 watching 置为 completed（不覆盖 watchlist/dropped 等手动状态）。
- 单集 undo 与整季 unmark 时，若状态为 completed 自动回退为 watching；整季 unmark 顺带补上此前遗漏的 invalidateHours。

**证据（线上验证）**
- QA 账号整季标记 Chernobyl（Ended，5 集）→ tracked.status='completed'（eps=5）；整季 unmark → status='watching'、集数归零。测试数据已清理。

**回归发现（测试代理，Rounds 6-10 全项通过后追加修复）**
- P2：`hasAnything` 只统计 watching 状态的 TV，movie-only watchlist 用户看到的是 onboarding 空态而非 watchlist 网格。已改为 `tracked(watching TV) > 0 || watchlist > 0`，重新部署。
- P3（记录待议）：场记板占位图在海报尺寸下略像日历图标。

---

## Round 11 — 2026-08-05

**发现**
- [UX 走查 / P2] 条目一旦加入 library 无法移除：详情页只有 4 个状态按钮（watching/watchlist/completed/dropped），误加的剧/电影只能永远留在 Library（Trakt/TV Time 都有 remove）。上轮回归也确认「no UI to delete rows」。

**修复（已部署，Version 775e0bcc）**
- 新增 `POST /api/untrack`：删除该用户的 tracked 行（保留 episode/movie 观看历史，重加即恢复进度）。
- 剧集/电影详情页在已追踪时显示「Remove」按钮（灰色，hover 变红，title 说明保留历史）。

**证据（线上验证）**
- throwaway 账号 track Chernobyl → 详情页出现 untrack 表单；POST /api/untrack → 按钮消失、tracked 行删除（302 + 页面复查）。

---

## Round 12 — 2026-08-05

**发现**
- [前端视觉/移动端 / P2] 375px 登录态导航拆成两行且「Next Up」文字内部折行，视觉破碎。
- [前端视觉 / P3] 上轮回归指出场记板占位图小尺寸下像日历图标。

**修复（已部署，Version 3b043726）**
- 移动端导航改为单行横向滚动（whitespace-nowrap + overflow-x-auto + 隐藏滚动条 scrollbar-width:none / ::-webkit-scrollbar hidden），桌面端不变。
- 占位海报重绘：加斜置带条纹的场记板顶板，与主板形成明显夹角，不再像日历。

**证据（线上验证）**
- 375px 截图：导航单行、无横向滚动条、Next Up 不折行；新 SVG 渲染核对为场记板。

---

## Round 13 — 2026-08-05

**发现**
- [竞品 / P2] Trakt 的核心页面之一是 watch history（按时间倒序的观看流水）；我们记录了 watched_at 但没有任何界面可看，用户无法回答「我上周看了什么」。

**修复（已部署，Version 0f36ac59）**
- 新增 `/history`：合并 episode_watches 与 movie_watches（各取最近 100，合并后按 watched_at 倒序截 100），列表显示海报、标题、SxxExx/Movie、观看日期，点击跳详情页；空态引导去标记。
- 导航新增 History 链接（移动端导航已可横向滚动，可容纳）。

**证据（线上验证）**
- throwaway 账号 `/history` 200，按倒序列出 Breaking Bad S02E10…S02E02 等观看记录。

---

## Round 14 — 2026-08-05

**发现**
- [QA/性能 / P2] `upcomingItems`（/calendar 与 iCal feed 共用）串行 `await tvDetails`，追 30 部剧且 KV 缓存未命中时最坏 ~6s（与 round-2 修复前的 /home 同型问题）。
- [QA 回归] 边界路由抽查：不存在的 show/movie/genre/share token、og.png 坏 token 均正确 404；未登录访问 /history 302 → /login。无新问题。

**修复（已部署，Version 2443cbb7）**
- `upcomingItems` 改为 `Promise.all` 并行拉取（单剧失败返回 null 不影响整页），/calendar 与 /feed/<token>.ics 同时受益。

**证据（线上验证）**
- /calendar 登录态 200（0.45s，热缓存）；tsc/css 构建通过。

---

## Round 15 — 2026-08-05

**发现**
- [UX 走查/竞品 / P2] 从中途开始补记进度很痛苦：只能逐集点或整季标。TV Time 有「我看到这里了」——一键把某集之前的所有集标为已看，是补记场景的核心交互。

**修复（已部署，Version 6e6dc1a8）**
- 新增 `POST /api/watch-up-to`：并行拉取目标季及之前所有季，把已播出且 ≤ 目标集的全部集数批量 INSERT OR IGNORE，写 tracked、触发 maybeAutoComplete 与 invalidateHours。
- 季页每个未看集旁新增「⇤ up to here」按钮（带 title/aria-label 说明）。

**证据（线上验证）**
- throwaway 账号对 Breaking Bad S02E05 执行 up-to → D1：S1=7 集全标、S2=5 集，精确到目标集为止。

---

## Round 16 — 2026-08-05

**发现**
- [前端视觉/无障碍 / P2] 对比度审计（WCAG 1.4.3 AA 需 ≥4.5:1）：正文尺寸的次要文字大量使用 text-slate-500（#64748b），在 slate-950 背景上 4.24:1、在 slate-900 卡片上仅 3.75:1，均不达标（集数日期、SxxExx 编码、题材行、History 日期等都受影响）。竞品调研侧：复查 Bingers 官网仍为 iOS/Android only，无 Web 端动向。

**修复（已部署，Version f560db81）**
- views.tsx 全量 text-slate-500 → text-slate-400（#94a3b8，slate-950 上 7.87:1 / slate-900 上 6.96:1，AA 达标且不破坏层级：主文字仍为更亮的 slate-100/白）。

**证据（线上验证）**
- 线上 HTML 已无 text-slate-500；对比度计算脚本输出见本轮记录。

---

## Round 17 — 2026-08-05

**发现**
- [合规/竞品 / P1] 产品面向 GDPR 导出用户，却没有账号自助管理：不能改昵称/密码（登录态）、更没有删除账号（GDPR 被遗忘权）。TV Time/Trakt 均有完整账号设置页。

**修复（已部署，Version 21c79ae3）**
- 新增 /settings（导航 ⚙）：① Display name（展示于公开分享页）；② 修改密码（校验当前密码，新密码 ≥8）；③ 删除账号（输密码确认 + confirm 弹窗，D1 batch 删除 episode/movie watches、tracked、share/feed tokens、password_resets、imports、sessions、users 后销毁会话）。

**证据（线上验证）**
- r15 throwaway 账号线上走通：改昵称 302→saved；错误当前密码 → error 提示；删除账号 → 302 / + 会话清除，D1 复查 users=0 且无孤儿行。

---

## Round 18 — 2026-08-05

**发现**
- [合规 / P1] 产品收集邮箱/密码/观看数据、主打 GDPR 迁移，却没有 Privacy Policy 与 Terms 页面（竞品均有，也是 GDPR 透明度义务）。

**修复（已部署，Version 3b068b43）**
- 新增 /privacy（收集内容、无 Cookie 统计说明、不存 IP、邮件仅 opt-in、Settings 自助删除、第三方 TMDB/Resend/Cloudflare）与 /terms；页脚加 Privacy · Terms 链接；两页入 sitemap。联系邮箱用已验证发信域 watchdeck@zalize.com。

**证据（线上验证）**
- /privacy、/terms 均 200，首页页脚含链接。

---

## Round 19 — 2026-08-05

**发现**
- [UX/竞品 / P2] 搜索结果不显示「已在库中」状态（Trakt/TV Time 均有已追标识），老用户搜索时容易重复添加或困惑。

**修复（已部署，Version 545cbc1c）**
- MediaCard 增加 inLibrary 角标（✓ In library，emerald 圆角标签叠加在海报右上）；/search 登录态下查询 tracked 生成 `media_type:tmdb_id` Set 传入 SearchPage；未登录不查询、不显示。

**证据（线上验证）**
- r10 账号搜索 breaking bad：badge 出现（grep=1）；未登录同一搜索 grep=0。

---

## Round 20 — 2026-08-06

**发现（QA 回归驱动，测试代理完整回归 16-19 轮）**
- 16-19 轮全部通过，无 P0/P1/P2。唯一 P3：搜索结果「✓ In library」角标渲染在海报左上而非右上——根因是部署时 public/styles.css 缺少 right-1.5 工具类（CSS 未随最后一次视图改动重新生成），absolute 退化为文档流位置。
- 数据：human PV 467（desktop 412 / mobile 55），搜索词 severance 7、breaking bad 2；仍以内部 QA 流量为主。
- r15 throwaway 账号已在 Round 17 线上验证中经 /api/settings/delete 自删（预期行为，非异常）。

**修复（已部署，Version 7b0dfd31）**
- 重新生成 Tailwind CSS 并部署；线上 styles.css 现包含 .right-1\.5，角标回到海报右上。

**证据（线上验证）**
- curl 线上 styles.css grep right-1\.5 = 1；测试代理报告 /home/ubuntu/test-report-rounds16-19-regression.md + 录屏。

---

## Round 21 — 2026-08-06

**发现**
- [pSEO/竞品 / P2] 浏览发现仅有题材维度；用户找剧的高频入口是「平台/电视网」（Netflix shows、HBO shows 等高搜索量词），Trakt/Simkl 均有 network 维度浏览。

**修复（已部署，Version be4a4723）**
- 新增 12 个电视网聚合页 /browse/network/:id-slug（Netflix/HBO/Disney+/Apple TV+/Prime Video/Hulu/Paramount+/Peacock/AMC/FX/Showtime/BBC One），TMDB discover with_networks、20 页分页、canonical；/browse 增「By network」区块；12 个 URL 入 sitemap。

**证据（线上验证）**
- /browse/network/213-netflix 200（h1 "Netflix TV shows"）、无效 id 404、HBO page=2 200；sitemap 含 12 个 network URL；/browse 显示 By network。


---

## Round 22 — 2026-08-06

**发现**
- [UX / P2] Library 卡片上无法直接改状态（watching/watchlist/completed/dropped），必须进详情页；TV Time/Trakt 均支持列表内快速改状态。

**修复（已部署，Version 691d4cb9）**
- Library 每张卡片下方新增紧凑状态下拉（onchange 自动提交，noscript 有 Save 按钮兜底），POST 复用 /api/track upsert；redirect 保留当前 status/sort/q 筛选参数；下拉带 aria-label。

**证据（线上验证）**
- r10 账号 /library 渲染下拉；POST 改 Breaking Bad→completed 后出现在 completed 筛选（grep=1），已还原 watching。

---

## Round 23 — 2026-08-06

**发现**
- [竞品 / P1] TV Time/Simkl 详情页都有「在哪看」流媒体平台标识，我们没有——这是迁移用户高频使用的功能，TMDB 免费提供 JustWatch 数据（要求署名）。

**修复（已部署，Version 8285a086）**
- tmdb.ts 新增 watchProviders()（/​{type}/{id}/watch/providers，US 区，24h 缓存）；剧集/电影详情页 overview 下方新增 WhereToWatch 组件：最多 6 个流媒体 logo（w45，链接到 JustWatch 聚合页）+ "data by JustWatch" 署名；无 flatrate 数据时整块隐藏。

**证据（线上验证）**
- Severance/Breaking Bad/Inception 详情页均渲染 "Where to stream (US)" 与 JustWatch 署名。

---

## Round 24 — 2026-08-06

**发现**
- [SEO/数据 / P2] 近几轮新增了 14 个可索引 URL（12 个 network 聚合页 + /privacy + /terms），但 IndexNow 只在最初上线时提交过一次，且提交脚本依赖只有 Worker 能读的 INDEXNOW_KEY，无法复用。

**修复（已部署，Version ec780f63）**
- 新增管理端点 POST /api/indexnow（仅 ADMIN_EMAIL，可提交 1-100 个以 / 开头的路径），Worker 内部用 INDEXNOW_KEY 调 api.indexnow.org 批量提交；管理员登录后一次表单提交即可通知搜索引擎新页面。

**证据（线上验证）**
- 未登录 POST → 403 {"error":"forbidden"}；非管理员账号 POST → 403（部署传播完成后连续 4 次一致）。实际提交待管理员（老板邮箱）登录后触发。

---

## Round 25 — 2026-08-06

**发现（QA 回归驱动，测试代理完整回归 21-24 轮）**
- [P0，已当场修复] 21-24 轮各自独立基于 main 分支开发并逐轮部署，导致最后一次部署（iteration-24 分支）覆盖掉了 21-23 轮的代码——线上一度缺失 network 页/状态下拉/流媒体标识。根因：并行 sibling 分支 + 单 Worker 部署互相覆盖。
- [P3] 流媒体 logo 链接指向 JustWatch 首页而非该剧目页面。

**修复（已部署，Version 83e6024c）**
- 合并 21+22+23+24 为累计分支 devin/1786007015-iterations-21-24 并重新部署；四轮功能全部在线复验通过。流程改进：此后每轮基于累计分支开发，避免覆盖。

**证据（线上验证）**
- 测试代理报告 /home/ubuntu/test-report-rounds21-24-regression.md + 录屏：21-24 轮全过、QA 基线（8 shows/Severance 4/Friends 0）前后一致、r10 状态往返还原。

---

## Round 26 — 2026-08-06

**发现（pSEO/竞品驱动）**
- [P1] Trakt/Simkl 都有按年份浏览入口；WatchDeck 只有题材/网络聚合，缺「年份」维度的 pSEO 长尾页。

**修复（已部署，Version 21906b4c）**
- 新增 /browse/year/:type/:year（tv|movie × 1950–明年，超范围 404），TMDB discover 按 first_air_date_year / primary_release_year 热度排序，24h 缓存、页码钳制 20、canonical 就位。
- /browse 增加「By year」区块（近 15 年 × TV/电影）；sitemap 新增 30 个年份 URL。

**证据（线上验证）**
- /browse 出现 By year；/browse/year/tv/2025 与 /browse/year/movie/2010 均 200；?page=2 显示 Page 2 of 20；/browse/year/tv/1900 404；sitemap 含 30 个 browse/year URL。

---

## Round 27 — 2026-08-06

**发现（UX/数据驱动）**
- [P1] 匿名访客落地页只有营销文案，没有任何真实内容/内链；第一方数据显示 `/` 是最高 PV 路径（70），但落地页对 SEO 与转化贡献低。

**修复（已部署，Version 34ef9dd7）**
- 落地页在英雄区与订阅卡下方追加「Trending this week」剧集+电影海报网格（复用 TrendingSection，TMDB 12h 缓存，失败降级不渲染）——匿名访客可直接点进详情页，形成 pSEO 内链。
- 顺带修复 hono/jsx 陷阱：Layout 传入多个直接子节点时第二个不渲染，需包一层容器（已加 <div> 包裹）。

**证据（线上验证）**
- `/` 包含 "Trending shows this week" 与 "Trending movies this week" 两个海报网格，卡片链接到 /shows/:id、/movies/:id。

---

## Round 28 — 2026-08-06

**发现（视觉/SEO 驱动）**
- [P2] /browse 标题仍写「Browse by genre」，但页面已含年份与网络维度，标题失真。
- [P2] 三类分页聚合页（题材/年份/网络）缺 rel=prev/next 链接标记，分页序列对爬虫不友好。

**修复（已部署，Version c7cfebfb）**
- /browse H1/副标改为「Browse TV shows & movies · by genre, year or network」。
- Layout 新增 prev/next 可选属性，三个分页路由全部输出 <link rel="prev|next">（第 2 页的 prev 指向无参数首页 URL，与 canonical 一致）。

**证据（线上验证）**
- /browse/year/tv/2025?page=2 head 内输出 rel=prev（…/2025）与 rel=next（…?page=3）；/browse 显示新标题。

---

## Round 29 — 2026-08-06

**发现（竞品/合规驱动）**
- [P1] TV Time 关停的最大教训是「数据被锁死」，但 WatchDeck 自己也只进不出：只有导入没有导出，GDPR 数据可携带权仅靠删除不够，Trakt 免费档亦提供数据导出。

**修复（已部署，Version 4e30794a）**
- 新增 GET /api/export（需登录，匿名 302 → /login）：一次性导出 tracked（含状态/评分/时间戳）、episode_watches、movie_watches 为格式化 JSON，Content-Disposition 附件下载、no-store。
- /settings 新增「Export your data」区块，一键下载。

**证据（线上验证）**
- 匿名 GET /api/export → 302 /login；r10 账号导出 JSON 含 Breaking Bad tracked + 22 集观看记录，文件名 watchdeck-export-YYYY-MM-DD.json；/settings 显示导出区块。

---

## Round 30 — 2026-08-06

**发现（QA 回归驱动，测试代理完整回归 26-29 轮）**
- [P2，已修复] 三类分页聚合页（年份/题材/网络）只有下界钳制，?page=99 会渲染「Page 99 of 20」；TMDB 请求虽被钳制但 UI 页码失真且产生无限分页 URL 面。
- 其余 26-29 轮全部通过：落地页双 Trending 网格、年份页/站点地图 30 URL、rel prev/next、数据导出（导出前后 D1 计数一致，只读验证）、QA 基线（8/4/0）与核心冒烟全过。

**修复（已部署，Version 6bad3c18）**
- 三个 browse 路由页码统一 Math.min(20, Math.max(1, …)) 上下界钳制，线上复验 ?page=99 全部显示 Page 20 of 20。

**证据（线上验证）**
- 测试代理报告 /home/ubuntu/test-report-rounds26-29-regression.md + 录屏；修复后 curl 复验三条 ?page=99 URL 均 Page 20 of 20。

---

## Round 31 — 2026-08-06

**发现（竞品驱动）**
- [P1] Trakt/Simkl 搜索均可按类型过滤；WatchDeck 搜索把 TV/电影混排且无过滤，重名标题（如 Inception 相关剧集与电影）难区分。

**修复（已部署，Version 6b6e8abd）**
- 搜索结果页新增 All / TV shows / Movies 过滤 tab（?type=tv|movie，role=group + aria-current 可访问性标记），空结果时提示「try All」。

**证据（线上验证）**
- /search?q=inception&type=tv 仅剩 /shows/ 链接（无 /movies/27205）；&type=movie 含 /movies/27205；tab 组 aria-label="Filter results by type" 输出。

---

## Round 32 — 2026-08-06

**发现（UX/竞品驱动）**
- [P1] Trakt 剧集页醒目显示下一集播出信息；WatchDeck 剧集页无「下一集何时播」，用户须去日历翻找。

**修复（已部署，Version 59b0b265）**
- 剧集详情页在类型行下方新增「Next episode: SxxExx — 集名 · 日期」高亮徽章（TMDB next_episode_to_air，UTC 格式化，无未播集则不渲染）。

**证据（线上验证）**
- 在播剧集页显示「Next episode: S03E06 — The Drive · Aug 6, 2026」；已完结剧（Severance 等）无徽章。

---

## Round 33 — 2026-08-06

**发现（竞品驱动）**
- [P1] Serializd 的核心卖点是剧集日记/笔记，TV Time 也有 notes；WatchDeck 无任何私人笔记能力，导入用户的「感想」无处安放。

**修复（已部署，Version 45aa4989）**
- tracked 表新增 notes 列（D1 已迁移，schema.sql 同步）；新增 POST /api/notes（登录+CSRF Origin 校验，2000 字上限，空值清除）。
- 剧集/电影详情页对已追踪条目显示「📝 Private notes」折叠区（有笔记默认展开），textarea+保存；/api/export 导出同步包含 notes 字段。

**证据（线上验证）**
- r10 账号 Breaking Bad 页保存笔记 → 刷新可见 → /api/export tracked.notes 含同一内容 → 清空后不再显示（数据已还原，r10 无残留笔记）。

---

## Round 34 — 2026-08-06

**发现（UX/视觉驱动）**
- [P2] Library 状态 tab（All/Watching/Watchlist/Completed/Dropped）无数量提示，须点进每个 tab 才知道有没有内容（TV Time/Trakt 均带计数）。

**修复（已部署，Version 99ed3cc6）**
- /library 增加一次 GROUP BY status 计数查询，每个 tab 显示条目数（All 为总和），当前 tab 用浅紫、其余用 slate-500 弱化。

**证据（线上验证）**
- r10 账号 /library tab 呈现 All 3 / Watching 2 / Watchlist 0 / Completed 1 / Dropped 0，与 D1 数据一致。

---

## Round 35 — 2026-08-06（QA 回归轮）

**发现（测试驱动，测试代理完整回归 31-34 轮 + 冒烟）**
- 无 P0/P1/P2。1 个 P3 为测试夹具问题（原示例剧 219246 的下一集播出日已过，改用 The Simpsons /shows/456 验证徽章，功能正常）。

**结果（生产 Version 99ed3cc6）**
- R31 搜索类型过滤（All/TV/Movies、aria-current、空结果提示）通过；R32 下一集徽章（在播显示/完结不显示）通过；R33 私人笔记（保存/持久/导出含 notes/清除还原 NULL、未追踪与未登录不显示）通过；R34 Library tab 计数与 D1 一致通过。
- 冒烟：落地页 Trending、R30 分页钳制（?page=99 → Page 20 of 20）、标记+撤销均通过；QA 基线 8/4/0 前后一致；r10 净零还原（0 笔记）。

**证据**
- 测试代理报告 test-report-rounds31-34-regression.md + 录屏；PR #34 评论附截图。

---

## Round 36 — 2026-08-06

**发现（竞品驱动）**
- [P1] TV Time/Trakt 均有「口味画像」类统计（Top genres）；WatchDeck /stats 只有数量与月度条形图，缺题材维度。

**修复（已部署，Version b0efd363）**
- userStats 新增 topGenres：取最近 40 个 tracked 条目并行读 TMDB 详情（已有 12/24h KV 缓存，零新增配额压力），聚合 genre 计数取前 6；/stats 与公开分享页复用 StatsBody 渲染「Top genres」条形图（无数据不渲染）。

**证据（线上验证）**
- r10 账号 /stats 显示 Top genres：Drama/Mystery/Sci-Fi & Fantasy/Action/Science Fiction/Adventure，与其 3 个 tracked 条目的 TMDB 题材一致。

---

## Round 37 — 2026-08-06

**发现（pSEO/数据驱动）**
- [P1] sitemap 的详情页 URL 只来自本周 trending（约 40 条且随周轮换），最大的 pSEO 面（剧集/电影详情页）覆盖不足。

**修复（已部署，Version 5f03421d）**
- 新增 discoverPopular（TMDB discover 按 popularity 排序，24h 缓存）；sitemap 并行拉取 TV/电影各前 2 页热门并与 trending 去重合并。

**证据（线上验证）**
- sitemap.xml <loc> 总数 182，其中详情页 URL 98 条（此前约 40）。

---

## Round 38 — 2026-08-06

**发现（UX/视觉驱动）**
- [P2] 日历页播出日期显示原始 ISO 字符串（2026-09-27），扫读性差；当天播出的剧无任何视觉强调（TV Time/Trakt 均高亮 Today）。

**修复（已部署，Version 59c6a021）**
- 日历行日期人性化：Today（加粗+行背景 violet-950/40 高亮）/ Tomorrow / "Sun, Sep 27"（UTC 格式化），原始日期保留在 title 提示。

**证据（线上验证）**
- r10 临时追踪 The Simpsons 后 /calendar 显示 title="2026-09-27">Sun, Sep 27；验证后已 untrack，r10 恢复 3 条净零。

---

## Round 39 — 2026-08-06

**发现（pSEO/竞品驱动）**
- [P2] 首页缺少 WebSite + SearchAction 结构化数据（Trakt 等竞品均有），搜索引擎无法识别站内搜索入口（sitelinks searchbox 资格）。

**修复（已部署，Version 835735b5）**
- 匿名首页注入 schema.org WebSite JSON-LD，potentialAction 为 SearchAction，urlTemplate 指向 /search?q={search_term_string}。

**证据（线上验证）**
- curl 首页解析 ld+json 成功，urlTemplate=https://watchdeck.zalize.com/search?q={search_term_string}。

---

## Round 40 — 2026-08-06（QA 回归轮）

**发现（测试驱动，测试代理完整回归 36-39 轮 + 冒烟）**
- 无 P0/P1/P2。1 个 P3：Top genres 同计数并列时排序不确定（Map 插入序），截前 6 时结果随机。

**修复（已部署，Version b35db39b）**
- Top genres 排序加字母序二级排序（count desc, name asc），并列结果确定化；线上复验 r10 显示 Drama/Action/Adventure/Crime/Mystery/Sci-Fi & Fantasy。

**结果（回归目标 Version 835735b5）**
- R36 Top genres 卡片通过；R37 sitemap 182 loc / 98 详情 URL 通过；R38 日历 Today（高亮加粗）/Tomorrow/Sun, Sep 27 通过；R39 首页 WebSite+SearchAction JSON-LD 通过；冒烟（搜索 tab/标记撤销/Library 计数/年份页）通过；QA 基线 8/4/0 前后一致；r10 净零还原。

**证据**
- 测试代理报告 test-report-rounds36-39-regression.md + 录屏；PR #34 评论附截图。

---

## Round 41 — 2026-08-06

**发现（UX/视觉驱动）**
- [P2] /history 是无分组的流水列表，每行重复裸 ISO 日期，长列表扫读性差（Trakt history 按日分组）。

**修复（已部署，Version d6512e75）**
- History 按日分组渲染：Today/Yesterday/「Thu, Jan 2, 2025」小节标题（原始日期在 title 提示），行内不再重复日期。

**证据（线上验证）**
- r10 /history 呈现「Today」「Thu, Jan 2, 2025」「Wed, Jan 1, 2025」三个日期小节。

---

## Round 42 — 2026-08-06

**发现（安全/合规驱动）**
- [P1] 全站无任何安全响应头：缺 HSTS、CSP、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy（点击劫持/嗅探/降级风险）。

**修复（已部署，Version 7c6db593）**
- 新增全局响应头中间件：HSTS 1 年 includeSubDomains、nosniff、DENY、strict-origin-when-cross-origin、最小化 Permissions-Policy；HTML 响应附 CSP（default-src 'self'，img-src 允许 image.tmdb.org，style/script 暂含 'unsafe-inline'——现存内联事件处理器所需，移除内联处理器后收紧列为后续项）。

**证据（线上验证）**
- curl -I 首页六个安全头全部返回；/browse、/search 页面正常渲染（TMDB 海报在 img-src 白名单内）。

---

## Round 43 — 2026-08-06

**发现（安全驱动，承接 R42）**
- [P2] CSP script-src 因两处内联事件处理器（library 状态下拉 onchange、删号确认 onsubmit）被迫保留 'unsafe-inline'。

**修复（已部署，Version cd7a24a2）**
- 新增 public/app.js（事件委托：select[data-autosubmit] 自动提交、form[data-confirm] 确认弹窗），Layout 全站 defer 加载；两处内联处理器改为 data-* 属性；CSP script-src 收紧为 'self'。

**证据（线上验证）**
- 响应头 script-src 'self'；/app.js 200；r10 /library 下拉渲染 data-autosubmit。

**附带发现**
- [P2 → R44] 登录速率限制每次尝试都刷新 600s TTL 且成功登录不清零，导致持续尝试时锁定无限延长（QA 验证时实测触发）。

---

## Round 44 — 2026-08-06

**发现（QA 驱动，R43 回归时实测触发）**
- [P2] 登录/注册/忘记密码速率限制的两个缺陷：① 每次尝试都刷新 600s TTL——持续尝试时窗口永不过期，合法用户被无限锁定；② 成功登录不清零计数。

**修复（已部署，Version b74f9d45）**
- rateLimit 改为固定窗口：KV 值存 `count:expiresAt`，窗口起点由首次尝试决定、到期自动重置，TTL 不再随尝试刷新；登录成功后异步删除该 IP 的 login 桶。

**证据（线上验证）**
- 3 次错误密码返回 401（未误伤），随后正确密码 302 登录成功，KV 中 rl:login 键已被清除。

---

## Round 45 — 2026-08-06（QA 回归轮）

**发现（测试驱动，测试代理完整回归 41-44 轮 + 冒烟）**
- 无 P0/P1/P2。429 锁定正向路径（第 16 次尝试）按预算刻意未跑，仅验证桶创建与成功清零。

**结果（生产 Version b74f9d45）**
- R41 /history 按日分组（Today / Thu, Jan 2, 2025 / Wed, Jan 1, 2025，title 存 ISO）通过；R42 六个安全响应头全部返回、海报在 CSP 下正常渲染通过；R43 script-src 'self' 下 data-autosubmit 下拉自动提交（保留筛选参数）与删号 confirm 弹窗（已取消未删除）通过；R44 KV 记 count:expiresAt、登录成功后桶清零通过；冒烟（搜索角标/标记撤销/stats/日历）通过；QA 基线 8/4/0 前后一致；r10 净零还原。

**证据**
- 测试代理报告 test-report-round45-regression.md + 录屏；PR #34 评论附截图。

---

## Round 46 — 2026-08-06

**发现（pSEO/竞品驱动）**
- [P2] 剧集/电影详情页 JSON-LD 只有 TVSeries/Movie 单实体，缺 BreadcrumbList——搜索结果无法展示面包屑富结果（IMDb/TMDb 详情页均有）。

**修复（已部署，Version 650d41b9）**
- 详情页 JSON-LD 改为 @graph：TVSeries/Movie + BreadcrumbList（WatchDeck → Browse → 标题）。

**证据（线上验证）**
- /shows/95396-severance 与 /movies/27205-inception 的 ld+json 均含两个实体（TVSeries|Movie + BreadcrumbList）。

---

## Round 47 — 2026-08-06

**发现（竞品/pSEO 驱动）**
- [P2] 详情页无演员阵容——TV Time/Trakt/Serializd/IMDb 详情页均有 cast；纯文本人名也是 pSEO 长尾入口。

**修复（已部署，Version 6161a31e）**
- 新增 tmdb topCast()（TV 用 aggregate_credits、电影用 credits，7 天缓存，取前 8）；详情页 Recs 前插入 CastSection（头像+姓名+角色，响应式 2/4/8 列）。

**证据（线上验证）**
- /shows/95396-severance 显示 Top cast（Adam Scott、Britt Lower…）；/movies/27205-inception 显示 Leonardo DiCaprio 等。

---

## Round 48 — 2026-08-06

**发现（性能/UX 驱动）**
- [P1] 详情页 5-6 个数据源串行 await（season/recs/providers/cast/两条 D1），冷 TTFB 实测 ~2.0s。

**修复（已部署，Version 1b3c3e07）**
- shows/movies 路由改为 tvDetails/movieDetails 先行（404 判定），其余 season+recs+providers+cast+D1 查询 Promise.all 并行，逐项 .catch 降级。

**证据（线上验证）**
- 冷 TTFB 2.05s → 1.2-1.3s，暖缓存 0.09-0.18s；Top cast / More like this 区块正常渲染。

---

## Round 49 — 2026-08-06

**发现（SEO/运营驱动）**
- [P2] IndexNow 只有管理员手动接口，sitemap 扩容后（182 URL）无自动提交——「周更 pSEO + IndexNow」运营环节缺自动化。

**修复（已部署，Version 4ab81336）**
- 新增 submitSitemapToIndexNow()：抓自家 sitemap.xml、解析 loc、按 ≤100 分批 POST api.indexnow.org；挂到既有每日 08:00 UTC Cron，仅周一（UTC）执行，随邮件摘要并行 waitUntil，失败静默。

**证据**
- tsc 通过、已部署；下次周一 Cron 自动首跑（正向路径依赖 Cron 触发，无法即时线上验证；接口与 key 文件路由此前已验证 403/200）。

---

## Round 50 — 2026-08-06（QA 回归轮）

**发现（测试驱动，测试代理完整回归 46-49 轮 + 冒烟）**
- 无 P0/P1/P2。R49 周一 IndexNow Cron 正向路径按设计未实测（无法即时触发）。

**结果（生产 Version 4ab81336）**
- R46 详情页 @graph JSON-LD（TVSeries|Movie + BreadcrumbList）通过；R47 Top cast（BB aggregate_credits / Inception credits / Ariel 无照片占位图回退）通过；R48 并行化后登录态详情页全区块（状态/星级/笔记/看过勾选/流媒体/演员/推荐）无回归、TTFB 0.10-0.42s 通过；冒烟（搜索角标/标记撤销/Library 计数 3-2-0-1-0/stats/日历/history 日分组）通过；QA 基线 8/4/0 前后一致；r10 净零还原。

**证据**
- 测试代理报告 test-report-round50-regression.md + 录屏；PR #35 评论附截图。

---

## Round 51 — 2026-08-06

**发现（竞品驱动）**
- [P1] 日历/iCal/邮件提醒只覆盖 TV 下一集，watchlist 里的未上映电影完全不出现——TV Time 电影上映提醒是招牌功能，我们丢了「电影」半边。

**修复（已部署，Version 84af02ad）**
- CalendarItem 增加 mediaType（season/episode 可空）；upcomingItems 同时查 TV+电影（watching/watchlist，LIMIT 40），电影取未来 release_date；日历页标题改「Upcoming episodes & releases」、电影行显示「🎬 Movie release」；iCal 电影事件 UID wd-m-<id>、SUMMARY「— movie release」；每日邮件摘要同步包含当日上映电影。

**证据（线上验证）**
- r10 加 Avengers: Doomsday（watchlist）后：/calendar 显示「Movie release」行；.ics 含 UID:wd-m-1003596 / DTSTART 20261216；测试后已 untrack，r10 复核 3 tracked 净零。

---

## Round 52 — 2026-08-06

**发现（视觉+pSEO 驱动）**
- 移动端 375px 视觉走查（落地页/剧集页/browse）：布局、导航、演员网格、季 pills 均正常，无 P0-P2 视觉问题。
- [P2·pSEO] 详情页 JSON-LD 缺 aggregateRating——Google 富结果星级（搜索结果里直接显示评分）拿不到，竞品 IMDb/Trakt 详情页均有。

**修复（已部署，Version 72b4403a）**
- TvDetails/MovieDetails 增加 vote_count；TVSeries/Movie JSON-LD 注入 aggregateRating（TMDB vote_average/vote_count，bestRating 10），无投票时省略。

**证据（线上验证）**
- Breaking Bad：ratingValue 8.9 / ratingCount 18297；Inception：8.4 / 39752（curl 验证）。

---

## Round 53 — 2026-08-06

**发现（UX+竞品驱动）**
- [P2] /history 只能看不能改：误标的观看记录无法从历史页撤销，必须回到剧集页找到对应季集再点 undo（电影则要进电影页）——Trakt 历史页每行都有删除。

**修复（已部署，Version c5012a1d）**
- 历史每行新增「Remove」按钮：TV 行提交 /api/watch（undo=1，带 season/episode），电影行提交 /api/watch-movie（undo=1），redirect=/history；带 aria-label 标明删的是哪一条。

**证据（线上验证）**
- r10：标记 BB S03E04 → /history 出现该行 → Remove → 该行消失；episode_watches 复核 41 条净零；历史页 42 行均带 Remove 按钮。

---

## Round 54 — 2026-08-06

**发现（UX+竞品驱动）**
- [P2] 登录首页只有 Next Up（补旧番），完全看不到「本周要播什么」——TV Time 首页的 upcoming 提示是核心粘性来源，我们的用户必须专门点日历才知道。
- 竞品核查：Bingers 官网仍仅 App Store/Google Play 链接，无 Web 端，无重大动向。

**修复（已部署，Version bcd8ad9d）**
- /home 底部新增「Airing this week」紧凑列表：复用 upcomingItems，过滤未来 7 天内、最多 6 条（TV 显示 SxxExx，电影显示 Movie release），附「Full calendar →」链接；无内容时整段隐藏。

**证据（线上验证）**
- r10 暂时 watchlist 一部在播剧后 /home 出现「Airing this week + 该剧 + Full calendar」；无 7 天内内容时该段隐藏；测试后 untrack，r10 复核 3 tracked 净零。

---

## Round 55 — 2026-08-06（QA 回归轮）

**发现（测试驱动，测试代理完整回归 51-54 轮 + 冒烟）**
- 无 P0/P1/P2。未测项：R51 每日邮件摘要（Cron 无法即时触发，日历+iCal 路径已验证）；R53 电影行 Remove 按钮存在但未点击（Inception 属 r10 受保护基线数据），TV 行删除已完整验证。

**结果（生产 Version bcd8ad9d）**
- R51 电影上映进日历/iCal：Doomsday watchlist 后「🎬 Movie release · Wed, Dec 16」+ iCal UID wd-m-1003596 通过；
- R52 aggregateRating JSON-LD：BB 8.9/18297、Inception 8.4/39752，BreadcrumbList 完好；
- R53 历史 Remove：标记→Today 出现→Remove→消失，episode_watches 复核 41；
- R54 Airing this week：无 7 天内内容时隐藏（前置验证）；track 在播剧后出现且正确排除 12-16 的电影；
- 冒烟（搜索角标/Library 计数 3-2-0-1-0/stats/history 日分组）通过；QA 基线 8/4/0 前后一致；r10 净零还原。

**证据**
- 测试代理报告 test-report-round55-regression.md + 录屏；PR 评论附截图。

---

## Round 56 — 2026-08-06

**发现（竞品+UX 驱动）**
- 旧 P3 复核：流媒体标识的深链其实已是 title-specific（TMDB providers link 指向该片 watch 页），撤销该 P3。
- [P2] /stats 只有全量累计，没有任何「今年」维度——TV Time 年度回顾/Trakt yearly stats 是核心粘性与分享素材，我们完全缺席。

**修复（已部署，Version 6297c560）**
- UserStats 增加 epsThisYear/moviesThisYear（watched_at >= 今年 1 月 1 日的 D1 计数，并入既有 Promise.all）；/stats 与公开分享页统计卡下方新增「So far in 2026: N episodes and N movies watched」摘要行，双零时隐藏。

**证据（线上验证）**
- r10 /stats 显示「So far in 2026: 39 episodes and 1 movie watched」（41 条中 2 条为 2025-01 历史日期，口径正确）。

---

## Round 57 — 2026-08-06

**发现（无障碍/键盘 UX 驱动）**
- [P3] 全站无任何键盘快捷键；/search 落地后还要手动点输入框——Trakt/IMDb 等均支持「/」聚焦搜索。

**修复（已部署，Version 9a0e8bfc）**
- /app.js 新增全局「/」快捷键聚焦搜索框（输入框/textarea/contenteditable 内不劫持，CSP script-src 'self' 下合规）；导航搜索框加 title="Press / to search"；/search 无查询词时输入框 autofocus。

**证据（线上验证）**
- /app.js 含 keydown handler；/search 无 q 时渲染 autofocus、有 q 时不渲染（curl 验证）。

---

## Round 58 — 2026-08-06

**发现（pSEO/增长驱动）**
- [P2] sitemap 详情页只覆盖 trending+popular（时效性强、随热度轮换），完全没收录 top-rated 常青经典（肖申克、教父、Breaking Bad 类长尾搜索主力）。

**修复（已部署，Version fc68b759）**
- tmdb.ts 新增 topRated(type, page)（/tv|movie/top_rated，24h KV 缓存）；sitemap 并入 top_rated TV/电影各 2 页，经既有去重后 URL 从 182 → 254（+72 个常青详情页）。

**证据（线上验证）**
- sitemap.xml `<loc>` 计数 182 → 254（curl 验证）。

---

## Round 59 — 2026-08-06

**发现（竞品/导入漏斗驱动）**
- [P1] Netflix ViewingActivity.csv（Title,Date 两列）走通用 CSV 路径时把「Show: Season 4: Episode Name」整串当剧名，TMDB 必然匹配失败——Netflix 是最大的观看历史来源，Trakt 也只能靠第三方工具导。

**修复（已部署，Version d5f2e13d）**
- importer.ts 新增 isNetflixCsv（header 恰为 title,date）+ parseNetflixCsv：按「: Season/Part/Series/Volume/Chapter N/Limited Series」或 ≥3 段冒号切出剧名去重导入为 followed，独立标题按电影带观看日期导入（Netflix 不导出集号，已在 /import 文案说明）；/api/import/parse 优先走 Netflix 分支。
- 本地单测 + 线上 r10 实测：6 行样例 → shows [Stranger Things, Wednesday, Beef]、movies [The Gray Man, Glass Onion]，剧名全部干净。

**证据（线上验证）**
- /api/import/parse 返回上述解析结果（仅 parse 未 apply，r10 数据不变）。

---

## Round 60 — 2026-08-06（QA 回归轮）

**发现（测试代理完整回归 56-59 轮）**
- [P2] R59 Netflix 导入把 `7/23/2022` 原样写入 watched_at：/history 分组标题渲染「Invalid Date」，且字符串比较使 2022 观影计入「So far in 2026」。
- 覆盖备注：R56 公开分享页 StatsBody 复用未测（r10 无分享 token，创建会留残留）；/import UI parse 后自动 apply（无确认步），端到端用一次性账号 r60-qa 完成并自删（D1 复核清零）。

**结果（回归目标 Version d5f2e13d）**
- R56 「So far in 2026: 39 episodes and 1 movie watched」（41 中 2 条 2025 正确排除、单复数正确）通过；
- R57 「/」聚焦搜索、输入框内不劫持、/search 无 q autofocus / 有 q 不 autofocus 通过；
- R58 sitemap 恰 254 个 loc，含 /movies/278-the-shawshank-redemption 且页面 200 通过；
- R59 导入解析/干净剧名/文案通过，日期 P2 见上；
- 冒烟 + QA 基线 8/4/0 前后一致 + r10 净零通过。

**修复（已部署，Version 923f3395）**
- importer.ts 新增 netflixDate：M/D/YYYY → YYYY-MM-DD（已是 ISO 则保留，其他格式置 null 交由服务端取当前时间）；线上复验 parse 返回 2022-07-23 / 2022-12-24。

**证据**
- test-report-round60-regression.md + 录屏；PR #35 回归评论。

---

## Round 61 — 2026-08-06

**发现（R60 回归测试代理反馈的 UX 缺陷）**
- [P1] /import 上传后 parse 完立即自动写库，无任何确认步——传错文件（如别人的导出、错的 CSV）会直接污染账号数据，也是测试时只能用一次性账号的根因。

**修复（已部署，Version 2ed63a70）**
- ImportPage 新增「Ready to import」确认卡（找到 N shows / N watched episodes / N movies，"Nothing has been added yet"），Import now / Cancel 两按钮；import.js 在 parse 与 batch 写入之间加 Promise 确认门，Cancel 恢复 dropzone 不写任何数据。

**证据（线上验证）**
- /import HTML 含 confirm 卡、/import.js 含确认逻辑（curl 验证）；交互路径留待下轮回归代理点击验证。

---

## Round 62 — 2026-08-06

**发现（pSEO/前端走查驱动）**
- [P2] 详情页 meta description 用 `overview.slice(0,155)` 生硬截断（如 Breaking Bad 结尾是 "filled wi"），SERP 摘要观感差、无省略号。

**修复（已部署，Version 9ba358a4）**
- tmdb.ts 新增 metaDescription(text, max=155)：≤155 原样；超长回退到最后一个词边界（>80 时）去尾标点加 "…"；剧集/电影详情页统一改用。

**证据（线上验证）**
- Breaking Bad meta description 现以 "…He becomes filled…" 词边界+省略号收尾（curl 验证）。

---

## Round 63 — 2026-08-06

**发现（转化/竞品驱动）**
- [P1] 254 个 sitemap 详情页是主要 SEO 落地页，但匿名访客只看到一行小字文本链接「Join free to track this show」——无按钮级 CTA、无 TV Time 导入钩子，自然流量到达后无转化路径。竞品核查：Bingers 官网仍只有 App Store/Play 链接，无 Web 端（无重大动向）。

**修复（已部署，Version f9570e88）**
- 剧集/电影详情页匿名态改为按钮 CTA「Track this show/movie — join free」+「Coming from TV Time? Import your export →」双链接。

**证据（线上验证）**
- Breaking Bad / Inception 匿名页均渲染新 CTA（curl 验证）。

---

## Round 64 — 2026-08-06

**发现（无障碍/表单 UX 驱动）**
- [P2] 全部认证表单（signup/login/forgot/reset/settings 改密/删号）只有 placeholder 无可见 label（WCAG 3.3.2/占位符消失问题），且无 autocomplete 提示——密码管理器无法正确识别生成/填充密码。

**修复（已部署，Version f184c52f）**
- signup/login/forgot/reset 加可见 `<label for>`；全站密码/邮箱输入补 autocomplete：email、new-password（注册/重置/新密码）、current-password（登录/改密/删号确认）。

**证据（线上验证）**
- /signup 渲染 label + autocomplete=email/new-password；/login current-password（curl 验证）。

---

## Round 65 — 2026-08-06（QA 回归轮）

**发现与结果（测试代理完整回归 61-64 轮，目标 Version f184c52f）**
- 无 P0/P1/P2；R60 的两项遗留（导入自动写库、Netflix 原始日期）均确认修复并线上端到端复验。
- R61 确认卡：Cancel 不写库（D1 0 行）、Import now 正常导入 3 剧 2 电影；R60 日期修复端到端：watched_at 为 ISO、/history 正常日期标题、/stats 不再把 2022 观影计入 2026。
- R62 词边界 meta description、R63 匿名 CTA、R64 表单 label/autocomplete 全过。
- 覆盖备注：/reset/:token 表单的 autocomplete 仅源码核验（无法凭空铸造有效 token）。
- 冒烟 + QA 基线 8/4/0 前后一致 + r10 净零 + 一次性账号自删（D1 复核）。

**证据**
- test-report-round65-regression.md + 录屏；PR #36 回归评论。

---

## Round 66 — 2026-08-06

**驱动：⑤数据分析（analytics_events 路径审计）**
- 发现真实流量打到不存在的 URL 变体：`/show/95396`（9 次 404）、`/movies/27205` 无 slug（10 次，200 但产生重复内容 URL）；错 slug URL 也直接 200。

**修复（P2）**
- 新增单数别名 301：`/show/:idslug`、`/movie/:idslug`、`/tv/:idslug` → 复数路由。
- 详情页 slug 不匹配（缺失/错误）时 301 到规范 slug URL，shows 保留 ?season 查询串。

**证据**
- Version 2e551fd9；线上验证：/show/95396→301、/tv/95396→301、/movies/27205→301 /movies/27205-inception、/shows/95396-wrong-slug?season=2→301 …-severance?season=2、规范 URL 仍 200。

---

## Round 67 — 2026-08-06

**驱动：②UX 走查（搜索空结果死胡同）**
- 无结果搜索只显示一行「Nothing found.」，没有任何出路——对以搜索为核心入口的产品是转化死胡同。

**修复（P2）**
- /search 无媒体结果时展示 Trending 剧集/电影海报网格作为建议出路，文案改为「Nothing found — check the spelling, or browse what's trending below.」（type 过滤下仍提示 try All）。

**证据**
- Version c66de13e；线上验证：/search?q=zzzqqqxx 显示新文案 + Trending 区块；正常搜索（severance）结果不受影响。

---

## Round 68 — 2026-08-06

**驱动：④竞品/SEO（TV Time 难民搜索意图）**
- 落地页缺少针对「how to import TV Time data / is it free / can I export」等高意图长尾问题的内容与 FAQ 富结果资格。

**修复（P2）**
- 落地页新增 6 题 FAQ 区（`<details>` 折叠：TV Time 导入方法、免费、电影支持、Trakt/Serializd/Netflix 导入、数据可导出、无需装 App）。
- 首页 JSON-LD 改为 @graph：WebSite+SearchAction 之外注入 FAQPage（6 个 Question/Answer，与页面文案一致）。

**证据**
- Version 3a2847ce；线上验证：落地页渲染 6 个 FAQ 折叠项，JSON-LD 含 FAQPage + 6 Question。

---

## Round 69 — 2026-08-06

**驱动：③前端视觉（Core Web Vitals / CLS）**
- 详情页主海报、Next Up 卡片海报、Airing this week 缩略图未声明宽高比，图片加载时下方内容会跳动（CLS）。

**修复（P2）**
- 4 处 `<img>` 补 `aspect-[2/3]`（+object-cover）：show/movie 详情主海报、Next Up 卡海报、本周播出缩略图——布局在图片加载前即固定。

**证据**
- Version 9220d69b；线上验证详情页海报类名含 aspect-[2/3]。

---

## Round 70 — 2026-08-06（QA 回归轮）

**发现与结果（测试代理完整回归 66-69 轮，目标 Version 9220d69b）**
- 无 P0/P1/P2；1 个 P3：单数别名 301（/show、/movie、/tv）丢弃查询串（slug 纠正 301 会保留 ?season）。
- R66 重定向链全过（/show/95396→/shows/95396→/shows/95396-severance 200，错 slug 保留 ?season=2 且浏览器落在 S2）；R67 空搜索文案+Trending 建议全过；R68 FAQ 6 项折叠可用、JSON-LD @graph [WebSite, FAQPage(6 Question)] 解析通过；R69 海报 2:3 无变形。
- 冒烟 + QA 基线 8/4/0 前后一致 + r10 净零；本轮未创建账号。

**P3 修复**
- 三个单数别名 301 现附带原查询串（/show/95396?season=2 → /shows/95396?season=2），线上验证通过（Version 1b551df4）。

**证据**
- test-report-round70-regression.md + 录屏；PR #36 回归评论。

---

## Round 71 — 2026-08-06

**驱动：④竞品（TV Time 年度回顾/Trakt 年度统计均为招牌功能）**
- /stats 只有「今年至今」一行与近 12 个月柱状图，没有跨年份全史维度。

**修复（P1）**
- /stats（及公开分享页共用的 StatsBody）新增「By year」条形图：每年 episodes+movies 合计条 + 明细文案，SQL 用 episode_watches/movie_watches 按 strftime('%Y') UNION 聚合（最多 15 年，倒序）。

**证据**
- Version 1e319ca0；线上验证（r10 只读登录）：By year 显示 2026=39 eps·1 movie（100%）、2025=2 eps（5%）。

---

## Round 72 — 2026-08-06

**驱动：②UX 走查（R63 CTA 转化漏斗断点）**
- 详情页「Track this show/movie — join free」注册成功后落到 /import，丢失用户「想追这部剧」的原始意图。

**修复（P1）**
- 注册支持 next 返回路径：CTA 链接带 ?next=<详情页>，/signup GET 注入 hidden next，POST 成功后跳回 next（safeNext 校验仅接受站内相对路径，拒绝 //、\\ 开放重定向）；校验失败/重复邮箱的错误重渲染也保留 next。默认仍 /import。

**证据**
- Version 9251b087；线上验证：详情页 CTA href 含 ?next=%2Fshows%2F95396-severance，/signup 页面渲染 hidden next。

---

## Round 73 — 2026-08-06

**驱动：①QA 新用例（大库导入边界）**
- /library 静默 LIMIT 200：TV Time 大库难民（数百部剧）第 201 条起完全不可见且无任何提示；排序还在 JS 内存中做，只对当前 200 条生效。

**修复（P1）**
- 排序下推 SQL（recent=updated_at DESC / title=COLLATE NOCASE / progress=eps_watched DESC），全库全局排序。
- 新增分页：每页 120，COUNT 计算总页数并钳制 page，底部 Previous/Page x of y/Next 分页条（保留 status/sort/q 参数），仅多页时显示。

**证据**
- Version 02a57b25；线上验证（r10 只读登录）：title 排序 SQL 生效（Breaking Bad→Inception→Severance），3 条不足一页时无分页条，?page 越界被钳制。

---

## Round 74 — 2026-08-06

**驱动：⑤数据分析（imports 表复盘）**
- imports/tracked 的 source 一律硬编码 'tvtime'——Netflix/Trakt/Serializd CSV 导入全被误标，导入漏斗无法按来源分析。

**修复（P2）**
- /api/import/parse 返回检测到的 source（tvtime/netflix/csv）；import.js 随每个 batch 回传；/api/import/batch 白名单校验后写入 imports 与 tracked.source。

**证据**
- Version b8038c9c；线上验证（r10 登录，仅 parse 未写库）：Netflix 风格 CSV parse 返回 "source":"netflix"。

---

## Round 75 — 2026-08-06（QA 回归轮）

**发现与结果（测试代理完整回归 71-74 轮，目标 Version b8038c9c）**
- 无 P0/P1/P2/P3。
- R70 遗留 P3 复验已修复：/show/95396?season=2 别名 301 保留完整查询串。
- R71 By year：r10 /stats 2026=39 eps·1 movie（最宽条）、2025=2 eps，倒序正确。
- R72 next 返回路径：CTA→/signup?next=…→注册后回落 Severance 详情页且已登录；?next=https://evil.com 与 //evil.com 均不输出 hidden 字段。
- R73：title 排序 Breaking Bad→Inception→Severance，3 条无分页条，?page=99 被钳制仍正常渲染。
- R74：Netflix 头 CSV 端到端导入，imports.source 与 5 条 tracked.source 均为 'netflix'。
- 冒烟全过；QA 基线 8/4/0 前后一致（本轮未登录基线）；r10 净零（3/0/41，Severance 19）；一次性账号 r75 已自删（D1 复核 0 行）。

**证据**
- test-report-round75-regression.md + 录屏；PR #36 回归评论。

---

## Round 76 — 2026-08-06

**驱动：④竞品（Bingers 仅移动 App；我们 web 优先但缺「可安装」能力）+ ③视觉/移动端**
- 站点无 Web App Manifest、无 apple-touch-icon、无 theme-color——移动用户无法「添加到主屏幕」获得类 App 体验，iOS 收藏图标为截图缩略。

**修复（P1）**
- 新增 manifest.webmanifest（standalone、start_url=/home、深色主题、192/512 + maskable 图标）、icon-192/512.png、apple-touch-icon.png（由 favicon.svg 生成）、<meta theme-color>，Layout head 注入三个链接。

**证据**
- Version 444aa948；线上验证：/manifest.webmanifest 200 application/manifest+json，三个 PNG 200 image/png，首页 head 含 manifest/apple-touch-icon/theme-color。

---

## Round 77 — 2026-08-06

**驱动：①QA 新用例（/history 大历史边界，同 R73 思路）**
- /history 各取剧集/电影 100 条再内存合并截断：大导入用户（数千条流水）第 101 条起不可见且无翻页；两表各取 100 合并排序也可能错序。

**修复（P1）**
- 改为 UNION ALL 子查询全局按 watched_at DESC 排序 + LIMIT/OFFSET 分页（每页 100），COUNT 合计计算总页数并钳制 page；底部 Previous/Page x of y/Next 分页条（仅多页时显示）；Remove 行的 redirect 保留当前页码。

**证据**
- Version 146e2552；线上验证（r10 只读登录）：42 条流水单页全显（41 集 + 1 电影），不足一页无分页条，?page=99 被钳制正常渲染。

---

## Round 78 — 2026-08-06

**驱动：合规与安全审计（开放重定向纵深防御）**
- 10 个 POST API（track/untrack/notes/watch/watch-season/watch-up-to/watch-movie 等）把表单 redirect 参数原样传给 302，可被用作绝对 URL 开放重定向（CSRF Origin 校验挡住跨站 POST，但同源触发仍可能，属纵深防御缺口）。

**修复（P2 安全）**
- 全部 10 处改为 safeNext(form.redirect) ?? 默认路径——只接受站内相对路径（拒绝绝对 URL、//、\\）。

**证据**
- Version f8d54abb；线上验证（r10，幂等同状态 POST）：redirect=https://evil.com → 302 /home（回落默认），站内相对路径正常保留。

---

## Round 79 — 2026-08-06

**驱动：③视觉/社交分享 + ⑤数据（落地页是分享/引流主入口却无 og:image）**
- 仅详情页与分享页有 og:image；首页/browse/FAQ 等被分享到社交平台时无预览卡片，og:site_name 缺失。

**修复（P2）**
- 新增品牌 OG 卡 public/og-default.png（1200×630，渐变 logo+标语+域名）；Layout 对所有页面输出 og:site_name 与 og:image 回落（页面自带 ogImage 时优先，如详情页海报）。

**证据**
- Version cdb6632f；线上验证：/og-default.png 200，首页 og:image=og-default.png、og:site_name=WatchDeck，Severance 详情页仍为海报 og:image（未被覆盖）。

---

## Round 80 — 2026-08-06（QA 回归轮）

**发现与结果（测试代理完整回归 76-79 轮，目标 Version cdb6632f）**
- 无 P0/P1/P2/P3。
- R76：manifest/三个 PNG 图标全部 200 且 content-type 正确，首页与详情页 head 均含 manifest/apple-touch-icon/theme-color。
- R77：103 条流水一次性账号 → Page 1 of 2 分页条、第 2 页延续全局倒序、第 2 页 Remove 后回到 ?page=2；r10 42 条无分页条，?page=99 钳制正常。
- R78：/api/track redirect=https://evil.com 回落 /home，站内相对路径正常（10 个端点共用同一 safeNext 行，抽测 1 个）。
- R79：/og-default.png 200，非详情页输出 og:site_name+回落 og:image，详情页保留海报 og:image。
- 冒烟全过；基线 8/4/0 未动（未登录）；r10 净零 3/0/41（测试中一次误在 r10 会话里执行脚本 POST 短暂多出一条 tracked，已当场清除并 D1 复核）；103 条一次性账号已自删。

**证据**
- test-report-round80-regression.md + 录屏；PR #37 回归评论。

---

## Round 81 — 2026-08-06

**驱动：③视觉/无障碍（导航当前页无指示，WCAG 2.4.8 / 现代导航惯例）**
- 顶部导航所有链接同色，用户无法一眼看出身处哪个板块；无 aria-current。

**修复（P2）**
- app.js 在 DOMContentLoaded 时对 #site-nav 内匹配当前 pathname 的链接（前缀匹配子路径、排除 logo）加 aria-current="page" 与 text-violet-400/font-semibold 高亮。

**证据**
- Version 1cf0d4b5；线上验证：app.js 已含 site-nav 高亮逻辑，页面 nav 已带 id（浏览器端效果由 R85 回归复核）。

---

## Round 82 — 2026-08-06

**驱动：④竞品（Trakt ratings.csv 导出含 1-10 评分；我们 CSV 导入丢弃评分数据）**
- Trakt/Serializd 难民迁移时个人评分全部丢失，需手动重打。

**修复（P1）**
- 通用 CSV 导入解析 rating/your rating/user rating 列，1-10 分制自动折半归一到 1-5 星；批量导入把评分写入 tracked.rating（已有评分不覆盖，COALESCE 保护）；导入页文案注明。

**证据**
- Version c67c21d4；线上验证（r10 只读解析，未写库）：title,type,rating CSV → The Wire rating:5（9/10 折半）、Heat rating:4；端到端 apply 由 R85 回归覆盖。

---

## Round 83 — 2026-08-06

**驱动：②UX 走查 + ④竞品（TV Time/Trakt 均有评分分布画像；我们评分数据无可视化出口）**
- /stats 无「Your ratings」维度，R82 导入的评分数据没有展示价值出口。

**修复（P2）**
- userStats 新增 tracked.rating GROUP BY 统计；StatsBody 新增「Your ratings」5→1 星分布条形卡（无评分时隐藏），/stats 与公开分享页同时生效。

**证据**
- Version 2dd2db4c；线上验证（r10）：打 ★4 后 /stats 出现 Your ratings 卡，清除评分后卡片消失，r10 评分已复原（D1 复核 rating 非空行数 0）。

---

## Round 84 — 2026-08-06

**驱动：⑤数据（R66 曾观测到真实 404 流量）+ ②UX（404 死胡同）**
- 404 页只有一句话和 Go home 链接，无恢复路径。

**修复（P2）**
- 404 页新增搜索框（直达 /search）与 browse by genre / go home 出路。

**证据**
- Version 545a6bcf；线上验证：随机路径返回 404 且含搜索表单与 browse 链接。

---

## Round 85 — 2026-08-06（回归轮）

**驱动：①测试（QA 回归 R81-R84 + 复验 R76-R79）**

**回归结果（生产 Version 545a6bcf，分支 tip 93fd63e）**
- R81 活动导航高亮：/library、/history 对应链接紫色加粗，logo 与其他链接不高亮（像素级验证）；aria-current 与高亮类在 app.js 同一语句设置（curl 复核线上 app.js）。DOM 属性未能直接读取（CDP 旧标签页干扰），以视觉+代码构造证据通过。
- R82 CSV 评分导入端到端：throwaway 上传 rating CSV → Library 显示 The Wire ★5（9/10 折半）、Heat ★4，D1 rating=5/4、source='csv'；用 2/1 分重导不覆盖（COALESCE 验证）。
- R83 Your ratings 卡：有评分账号显示 5→1 分布（★5=1、★4=1），r10（零评分）不显示。
- R84 404 恢复：未知路径 HTTP 404 + 搜索框 + browse/home 出路，404 搜索 severance 直达真实结果页。
- 冒烟：home/search/detail/library/calendar/stats 全过。
- 完整性：保护基线 D1 只读核验不变（8 tracked/Severance 4/Friends 0，另有先前已存在的 Mandalorian ★4）；r10 净零（3/0/41、Severance 19、rating 空）；throwaway r85-qa-* 经 /settings 删除并 D1 复核。

**结论**：R81-R84 无 P0/P1/P2/P3 遗留。证据评论见 PR #37。

---

## Round 86 — 2026-08-06

**驱动：④竞品（TV Time 招牌「落后 N 集」计数）+ ②UX（Next Up 卡只显示下一集，看不出追剧欠账）**
- Next Up 卡片没有落后集数信息，用户无法一眼判断哪部剧欠账最多。

**修复（P2）**
- /home Next Up 计算遍历全部已播集统计未看数（季数据走 KV 缓存，无额外配额压力），卡片显示「aired 日期 · N eps left」（仅落后 >1 集时显示）。

**证据**
- Version a68bd9ed；线上验证（r10 只读浏览后登出）：Next Up 卡出现「eps left」徽章。

---

## Round 87 — 2026-08-06

**驱动：①测试/性能（R86 使 Next Up 需遍历全部季；长剧如 36 季的 Simpsons 冷缓存下逐季串行拉取会拖慢首屏）**

**修复（P1 性能回归预防）**
- /home 每部剧的季数据改为 Promise.all 并行拉取（原逐季 await 串行），遍历顺序不变，KV 缓存命中时零差异、冷缓存时首屏耗时随季数从 O(n) 串行降为并行。

**证据**
- Version a7d58fb4；线上验证（r10 只读浏览后登出）：/home 正常渲染含 eps left 徽章，整页 curl 1.07s。

---

## Round 88 — 2026-08-06

**驱动：④竞品（TV Time/Trakt/IMDb 详情页均有预告片入口）+ ②UX（详情页无试看出口，决定「要不要追」缺一环）**

**修复（P2）**
- 新增 tmdb.trailerUrl（/videos 端点，KV 缓存 7 天，优先 official YouTube Trailer）；剧集/电影详情页题材行追加「▶ Trailer」外链（新标签打开），无预告片时不显示。

**证据**
- Version 0787eda1；线上验证：Inception 页出现 youtube.com/watch?v=JE9z-gy4De4，Severance 页出现 xEQP4VVuyrY；Breaking Bad（TMDB 无 Trailer 条目）正确不显示。

---

## Round 89 — 2026-08-06

**驱动：②UX（R82/R83 引入的评分数据在 Library 无排序出口）+ ④竞品（Trakt/Serializd 支持按个人评分排序）**

**修复（P2）**
- Library 新增「Top rated」排序（rating IS NULL 排最后 → rating DESC → updated_at DESC），SQL 下推与既有分页兼容。

**证据**
- Version 0448d376；线上验证（r10 只读浏览后登出）：/library?sort=rating 渲染 Top rated 选中态，零评分账号回落按更新时间排序。

---

## Round 90 — 2026-08-06（回归轮）

**驱动：①测试（QA 回归 R86-R89）**

**回归结果（生产 Version 0448d376，分支 tip 610f513）**
- R86 落后集数徽章：r10 的 Breaking Bad 卡显示「aired 2010-04-04 · 40 eps left」= 62 已播 − 22 已看（对抗性核算精确匹配）；仅差 1 集的 Chernobyl（4/5）正确不显示徽章。
- R87 性能：/home 双账号正常快速渲染（并行化按设计无行为差异；登录态精确 TTFB 未仪表化，属可选项）。
- R88 预告片：Inception「▶ Trailer」新标签打开 watch?v=JE9z-gy4De4（rel=noopener 线上 HTML 复核）；Severance 链接存在；Breaking Bad 正确无链接。
- R89 Top rated 排序：★5 → ★4 → 未评分最后（未评分项恰为最近更新，可区分于 recency 序）；与 Completed 筛选组合正常；r10 零评分回落 recency 无错误。
- 冒烟全过；基线（8/Sev 4/Friends 0/Mandalorian ★4）D1 只读核验不变；r10 净零；throwaway r90-qa-* 已删除并 D1 复核。

**结论**：R86-R89 无 P0/P1/P2/P3 遗留。证据评论见 PR #37。

---

## Round 91 — 2026-08-06

**驱动：④竞品（Trakt 数据导出为 VIP 功能；TV Time 锁数据是难民痛点根源）+ ②UX（R29 JSON 导出对表格/其他工具不友好）**

**修复（P2）**
- /settings 新增 CSV 导出（/api/export.csv）：type,title,season,episode,watched_at,rating,status 扁平结构，含库条目/逐集流水/电影流水，标题带引号转义；与我们自己的 CSV 导入格式兼容（数据可携带权闭环）。

**证据**
- Version 881ad0bd；线上验证（r10 登录后登出）：CSV 首行表头正确，show/movie/episode 行齐全（Breaking Bad S01E01/E02 等）。

---

## Round 92 — 2026-08-06

**驱动：①测试（R82 只覆盖通用 CSV，TV Time ZIP 的评分被丢弃）+ ④竞品（TV Time 难民迁移时评分是核心资产）**

**修复（P2）**
- TV Time ZIP 导入解析评分：tracking 记录的 rating/user_rating/score 列 + 独立 *rating* CSV（tv_show_name/movie_name + rating），1-10 折半归一到 1-5，剧取首个有效评分；电影补齐 watchedAt 合并逻辑。写库仍走既有 COALESCE 不覆盖路径。

**证据**
- Version 438328db；线上验证（r10 只读解析，未写库）：合成 TV Time ZIP（tracking + user-rating CSV）→ The Wire rating:5（9/10 折半）+ 2 集流水、Heat rating:4，source:"tvtime"。

---

## Round 93 — 2026-08-06

**驱动：③视觉（375px 移动端走查：落地页/browse/详情页/404/落地页底部均正常，粘性导航半透明模糊为设计预期，无缺陷）+ ⑤数据（搜索词表存在大小写重复计数「Inception/inception」）+ 合规（隐私页未声明分析数据保留期）**

**修复（P2/P3）**
- 搜索词统计入库前 trim+小写归一（消除大小写重复计数）。
- 每日 Cron 自动清理 90 天前的 analytics_events 与 search_queries（数据最小化），隐私页同步声明「分析数据 90 天后自动删除」。

**证据**
- Version 0f65c823；线上验证：搜索「TeSt CaSe R93」入库为「test case r93」；/privacy 已含 90 天保留声明；移动端截图走查无缺陷。

---

## Round 94 — 2026-08-06

**驱动：④竞品（Trakt 搜索结果可直接快捷添加，我们必须进详情页才能加）+ ②UX（搜索→加 watchlist 需 3 步）**

**修复（P2）**
- 登录用户搜索结果卡片下方新增「+ Watchlist」一键加入按钮（已在库条目不显示，仍显示 ✓ In library 角标）；POST /api/track status=watchlist，redirect 经 safeNext 回落原搜索页（含 type 过滤参数）。匿名用户不显示。

**证据**
- Version 00c358d8；线上验证：r10 登录搜「the pitt」出现 + Watchlist 按钮，匿名同查询无按钮。写库正向路径留给测试代理用 throwaway 账号回归。

---

## Round 95 — 2026-08-06（回归轮）

**驱动：①测试（QA 回归 R91-R94）**

**回归结果（生产 Version 00c358d8）**
- R92 端到端：合成 TV Time ZIP（tracking + user-rating CSV）导入 → D1: The Wire ★5 + 2 集流水、Heat ★4 + 电影流水、source='tvtime'；用 2/1 分重导未覆盖（COALESCE）。
- R94：搜索卡「+ Watchlist」→ 回落原 URL（&type=tv 保留），角标翻转 ✓ In library，D1 status='watchlist'；匿名页面零按钮（curl 复核）。
- R91：/settings CSV 导出表头与逐行内容与 D1 精确一致；r10 只读导出 46 行（41 集、Severance 19、评分列空）。
- R93：「MiXeD CaSe R95」入库为小写；/privacy 90 天保留声明可见（Cron 清理正向路径无法即时触发，待观察项）。
- 冒烟全过；基线（8/Sev 4/Friends 0/Mandalorian ★4）不变；r10 净零；throwaway r95-qa-* 已删除并 D1 复核。

**结论**：R91-R94 无 P0/P1/P2/P3 遗留。证据评论见 PR #38。

---

## Round 96 — 2026-08-06

**驱动：④竞品/SEO 技术审计（robots.txt 缺私密路由；私密页与分享页无 noindex 信号，token 分享页可能被搜索引擎收录泄露个人统计）**

**修复（P1/P2）**
- robots.txt 补齐 Disallow: /stats /history /settings /forgot /reset /u/。
- 中间件对 /home /library /calendar /import /stats /history /settings /forgot /reset /u/* 统一输出 X-Robots-Tag: noindex（robots Disallow 只阻爬不阻收录，header 才是权威 noindex 信号；分享页为 secret-link 语义，照 Google Docs 惯例不收录）。公开页（/、/browse、详情页）无该 header，已验证。

**证据**
- Version 9ce69b66；线上验证：robots.txt 新 6 行生效；/stats(302)、/forgot(200)、/history、/settings、/u/abc 均返回 x-robots-tag: noindex；/、/browse、剧集详情页无此 header。

---

## Round 97 — 2026-08-06

**驱动：③前端性能（静态资产全部 max-age=0 must-revalidate，每次页面加载都要 304 往返；重复访客体验受损）**

**修复（P2）**
- 新增 public/_headers（Workers 静态资产原生支持）：styles.css/app.js/import.js → max-age=3600 + stale-while-revalidate=86400（部署后 1 小时内自愈，SWR 不阻塞渲染）；图标/占位图 → 7 天；og-default.png/manifest → 1 天。过期后仍走既有 ETag 协商。

**证据**
- Version a2d46315；线上验证：5 类资产 cache-control 逐一符合预期；/_headers 本身 404（不对外暴露）。

---

## Round 98 — 2026-08-06

**驱动：①测试/运维（R49 IndexNow 周任务、R51 每日摘要、R93 90 天清理三个 Cron 正向路径均「无法即时触发」，回归长期存在盲区）**

**修复（P2）**
- 新增管理员专用 POST /api/admin/cron（job=prune|digest|indexnow），复用 pruneAnalytics/sendAiringDigests/submitSitemapToIndexNow，使 Cron 任务可按需触发验证；非法 job 400。权限模型与 /api/stats、/api/indexnow 一致（ADMIN_EMAIL）。

**证据**
- Version b8c25b54；线上验证：匿名 403、非管理员（r10）403；管理员正向路径需老板凭据（与既有 /api/indexnow 同为待观察项）。

---

## Round 99 — 2026-08-06

**驱动：⑤安全/②UX（分享统计 token 可一键失效，但 iCal 订阅 token 一旦泄露无法撤销——安全能力不对称）**

**修复（P2）**
- 日历页新增「↻ Reset feed URL」：POST /api/feed/rotate 删除旧 feed token 并生成新 32 位 hex token，旧 .ics URL 立即 404；与分享页 token 失效能力对齐。

**证据**
- Version b9163eb1；/calendar 匿名 302 正常；旧 token 失效 + 新 token 可订阅的端到端验证留给 R100 回归（throwaway 账号）。
