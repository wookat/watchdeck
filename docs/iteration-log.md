# WatchDeck 持续迭代日志

每轮由五个驱动找改进点：①测试 ②UX 走查 ③前端视觉 ④竞品调研 ⑤用户/数据分析。
格式：轮次 / 发现（驱动+优先级）/ 修复 / 证据。

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

（Round 2 记录见 PR #10 分支；本轮基于 main 独立分支。）

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
