# Benchmark Round 3 —— pSEO 聚合页 + 导入手动绑定 + 播出提醒

日期：2026-08-05 ｜ 按老板批准的优先级执行

## 本轮交付

| 项 | 对标 | 实现 |
|---|---|---|
| pSEO 题材聚合页 | Trakt 的 popular/genre 列表页 | ✅ `/browse`（TV+电影全题材索引）+ `/browse/{tv,movie}/{genreId-slug}`（TMDB discover，分页至 20 页，canonical + meta description），全部题材页已加入 sitemap.xml |
| 导入未匹配手动绑定 | Trakt 导入报告 | ✅ `/api/import/batch` 返回未匹配标题清单，导入完成页逐条列出并链接到 `/search?q=<标题>` 手动搜索绑定 |
| 播出提醒 | TV Time 推送通知 | ✅ 以 iCal 订阅实现：`/calendar` 提供 "Subscribe (iCal)" 按钮，`/feed/<32位token>.ics` 输出追踪剧集的下集播出日历（Google/Apple Calendar 可订阅并自带提醒），token 随机 128-bit、可撤销（删行即失效） |

## 说明

- 邮件提醒需要邮件服务商 API key（如 Resend）；在未配置前采用 iCal 订阅达成同等提醒效果，零外部依赖、无需收集更多个人数据。若老板希望上邮件提醒，提供 RESEND_API_KEY 即可下轮接入。
- 播出日历事件为全天事件，含剧集页链接。

## 下一轮候选（round-4）

- 邮件播出提醒（待邮件服务商 key）
- 剧集页"相似推荐"（TMDB recommendations）
- Library 排序（按最近观看/字母/进度）
