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
