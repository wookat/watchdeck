# 留存漏斗数据导出（近 30 天，聚合、无 PII）

导出时间：2026-08-16（首版 2026-08-14）｜ 数据源：D1 `analytics_events`（第一方，90 天留存）、`users`/`tracked`/`sessions` 聚合计数。无邮箱、无 IP、无 UA 原文。

## 首访 → 注册 → 添加剧集 → 回访

| 漏斗阶段 | 口径 | 近 30 天 | 其中可确认真实外部用户 |
|---|---|---|---|
| 首访（页面浏览） | 非 bot/funnel/qa 的 pageview 总数 | 23,205 | **0**（外部 referrer 为 0，全部直接访问/站内/QA） |
| 注册 | `users.created_at` 在 30 天内，剔除 QA 邮箱口径后 | 9 − 8 QA = **1**（老板本人） | **0**（8 个 QA 命名账号 + 1 个老板本人账号） |
| 添加剧集 | 注册且 `tracked` 表有 ≥1 条记录（剔除 QA 后） | 0 | 0 |
| 回访 | 注册且注册 1 天后仍有新 session 创建（剔除 QA 后） | 0 | 0 |

## 导入子漏斗（既有 funnel 埋点，30 天）

| 事件 | 次数 |
|---|---|
| import-parse-ok | 21 |
| import-batch-done | 17 |
| import-parse-empty | 1 |
| import-parse-fail | 0 |

## 口径与诚实声明

- **无访客级标识**：第一方 analytics 只记录 path/referrer/country/ua_class，无 cookie/指纹级访客 ID，「首访」只能以 pageview 总量 + 外部 referrer 为代理指标，无法做真实 UV 去重。
- **QA 数据不计业务成果**：9 个账号中 8 个为 QA 基线/QA 命名账号（id 1–6、46、55），1 个为老板本人（id 38）；QA 账号的追剧/回访行为均为回归测试，不代表真实留存。
- **QA 流量标记口径（R245 起统一）**：QA/内部访问统一带 `x-qa: 1` 请求头或 UA 含 `ZalizeQA`，采集端落库为 `ua_class='qa'`，admin 面板与后续导出一律剔除（历史数据无标记，只能靠账号层剔除）。
- **QA 邮箱前缀剔除口径（R253 起，账号层兜底）**：邮箱匹配 `qa*` / `devinqa*` / `smoke-test*` / `round5*` / `r10-qa*` 前缀或 `@example.com` 域的账号一律按 QA 口径剔除、不计业务成果（数据保留不删除）。id 55 `devinqa46a@…`（2026-08-16 注册，未带 QA 标记被误计为 desktop）经核查按此口径归类 QA。
- **结论**：近 30 天真实外部用户漏斗各阶段均为 0，与历轮数据面一致——瓶颈在获客投放（外部 referrer 持续为 0），非产品转化。GSC/Bing Webmaster 开通后可补搜索端真实数据。
