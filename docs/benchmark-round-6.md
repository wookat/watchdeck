# Benchmark Round 6 — 2026-08-05

老板批准 round-6 前两项：个人评分、分享页 OG 卡片。社区投放列老板待办，本轮不做。

## 本轮交付（全部已上线 https://watchdeck.zalize.com）

1. **个人评分（5 星）**：剧集/电影详情页新增 "Your rating" 五星控件（再点同星 = 清除），
   写入 `tracked.rating`（已有列，无需迁移）；Library 卡片显示 `★ n`。
   未追踪的条目评分时自动建立追踪（TV → watching，电影 → completed）。
2. **分享页 OG 卡片**：`/u/<token>/og.png` 用 `workers-og`（satori+resvg）在 Worker 内
   实时渲染 1200×630 PNG（用户名 + 四项统计 + 品牌落款），Inter 字体经 KV 缓存 30 天；
   `/u/<token>` 页注入 `og:image` / `og:url` / `og:description` / `twitter:card`，
   贴到 X/Discord/微信等即出带数字的分享卡。全站 Layout 同时补齐基础 og:title/description。

线上验证：评分 302 写库、Library 显示 ★ 4、og.png 200（40KB PNG，肉眼校验版式）、
og:image meta 正确指向。注：workers.dev 域访问 og.png 报 CF 1042（子请求限制），
自定义域 watchdeck.zalize.com 正常——产品入口一律为自定义域，无影响。

## 达标验收对照（对 round-5 表的增量更新）

| 能力 | Trakt | Serializd | WatchDeck | 达标? |
|---|---|---|---|---|
| 个人评分 | ✅（1-10） | ✅（5星，主打） | ✅（5星，round-6） | **达标** |
| 分享卡片（OG image） | ✅ | ✅ | ✅（round-6，动态数字卡） | **达标** |

结合 round-5 表：核心追剧闭环、导入（ZIP+CSV）、日历+iCal、邮件提醒、统计、分享、
推荐、评分 —— 全部达到或超越 Trakt/Serializd 免费档水平。

剩余未达标项及处置建议：
- **评论/日记**（Serializd 主打）：文本 UGC 需审核与反滥用配套，投入产出低，建议不追；
- **社交动态流**（Trakt）：冷启动依赖用户量，建议观察自然流量后再定；
- **Scrobble 播放器自动记录**（Trakt 生态核心）：非 web 优先场景，明确不追。

**结论：以「TV Time 难民的 web 端追剧器」定位衡量，已具备提请达标验收条件。**
上述三项为定位外或需用户规模支撑的功能，不影响同期竞品水平判定。

## Round 7 候选（验收后视老板指示）

- 冷启动获客（社区投放，老板待办：真人账号+口径）
- 评论/日记（如老板认为必要）
- 年度回顾专页（分享页的季节性放大）
