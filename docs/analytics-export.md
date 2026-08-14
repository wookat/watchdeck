# 留存漏斗数据导出（近 30 天，聚合、无 PII）

导出时间：2026-08-14 ｜ 数据源：D1 `analytics_events`（第一方，90 天留存）、`users`/`tracked`/`sessions` 聚合计数。无邮箱、无 IP、无 UA 原文。

## 首访 → 注册 → 添加剧集 → 回访

| 漏斗阶段 | 口径 | 近 30 天 | 其中可确认真实外部用户 |
|---|---|---|---|
| 首访（页面浏览） | 非 bot、非 funnel 事件的 pageview 总数 | 3,590 | **0**（外部 referrer 为 0，全部直接访问/站内/QA） |
| 注册 | `users.created_at` 在 30 天内 | 8 | **0**（7 个 QA 命名账号 + 1 个老板本人账号） |
| 添加剧集 | 注册且 `tracked` 表有 ≥1 条记录 | 7 | 0 |
| 回访 | 注册且注册 1 天后仍有新 session 创建 | 1 | 0 |

## 导入子漏斗（既有 funnel 埋点，30 天）

| 事件 | 次数 |
|---|---|
| import-parse-ok | 21 |
| import-batch-done | 17 |
| import-parse-empty | 1 |
| import-parse-fail | 0 |

## 口径与诚实声明

- **无访客级标识**：第一方 analytics 只记录 path/referrer/country/ua_class，无 cookie/指纹级访客 ID，「首访」只能以 pageview 总量 + 外部 referrer 为代理指标，无法做真实 UV 去重。
- **QA 数据不计业务成果**：8 个账号全部为 QA 基线账号（id 1–6、46）或老板本人（id 38）；「添加剧集 7/8」「回访 1/8」均为 QA 回归行为，不代表真实留存。
- **结论**：近 30 天真实外部用户漏斗各阶段均为 0，与历轮数据面一致——瓶颈在获客投放（外部 referrer 持续为 0），非产品转化。GSC/Bing Webmaster 开通后可补搜索端真实数据。
