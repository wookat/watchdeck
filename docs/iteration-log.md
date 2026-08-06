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
