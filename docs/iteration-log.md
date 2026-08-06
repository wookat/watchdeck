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
