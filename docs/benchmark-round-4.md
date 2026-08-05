# Benchmark Round 4 —— 邮件播出提醒 + 相似推荐 + Library 排序

日期：2026-08-05 ｜ 按老板批准的候选顺序执行（RESEND_API_KEY 已由组织提供）

## 本轮交付

| 项 | 对标 | 实现 |
|---|---|---|
| 邮件播出提醒 | TV Time 推送通知 | ✅ Resend（发信域 zalize.com 已验证，实测发送成功）：日历页新增 "Email me on air dates" 开关（users.remind_email），Worker Cron（每日 08:00 UTC）向开启用户发送当日播出剧集摘要邮件，含退订指引；未配 key 时自动降级为 iCal-only |
| 相似推荐 | Trakt "Related"、Serializd 推荐 | ✅ 剧集页/电影页底部 "More like this"（TMDB recommendations，12 张卡片，KV 缓存 24h），兼作内链增强 pSEO |
| Library 排序 | Trakt 列表排序 | ✅ 三种排序：Recently updated（默认）/ Title A–Z / Most watched，与状态筛选可组合 |

## 说明

- Cron 触发器：`0 8 * * *`；`scheduled` handler 调 `sendAiringDigests`，只对 `remind_email = 1` 用户逐个计算当日播出集并发送。
- 邮件为纯通知用途，不含跟踪像素，与无 Cookie 统计原则一致。

## 下一轮候选（round-5）

- 注册欢迎邮件 + 邮件内一键开启提醒
- 分享页（公开只读的用户 profile/年度回顾）
- 导入支持 Trakt/Serializd CSV
