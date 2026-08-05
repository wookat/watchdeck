# Benchmark Round 5 — 2026-08-05

老板硬验收线：达到同期竞品水平。本轮 = 3 项新功能 + Trakt/Simkl 再体验一轮 + 客观达标评估。

## 本轮交付（全部已上线 https://watchdeck.zalize.com）

1. **注册欢迎邮件**（Resend）：注册成功后即发一次性 onboarding 邮件，含导入 / 搜索 /
   提醒三个入口链接；明确"不发营销邮件"。无 `RESEND_API_KEY` 时静默降级不发送。
2. **公开分享页**：`/stats` 新增 "Share your profile" —— 生成 128-bit 随机 token 的只读链接
   `/u/<token>`，展示统计卡片 / Top10 / 月度条形图（不暴露邮箱，可随时一键失效）。
   页面底部带 "Start tracking free" 转化入口，兼作增长渠道。
3. **Trakt/Serializd CSV 导入**：`/api/import/parse` 现接受任意含 title 列的 CSV
   （可选 season/episode/watched-at/type 列），与 TV Time ZIP 同一入口拖拽即可。
   线上实测：4 行 CSV → 2 剧（1 追踪 1 关注）+ 2 集 + 1 电影全部正确入库。

## 竞品再体验（2026-08-05）

- **Trakt（app.trakt.tv 新版 web app，登录复用真实账号）**：本轮新观察 —
  连续打卡 streak 条（gamification）、首页内嵌"Thoughts? + 五星评分"提示、
  "follow the Trakt Team" 社交引导、Continue Watching / Calendar / Recommended 分区、
  全站 VIP 升级入口。整体 web 体验比 round-1 时的旧版明显现代化。
- **Simkl**：再次被 Cloudflare 人机验证拦截（与阶段 A 相同），不做绕过，无法深度体验；
  仅以公开资料对比。

## 达标评估（对照同期竞品，客观逐项）

| 能力 | Trakt | Serializd | WatchDeck | 达标? |
|---|---|---|---|---|
| TV Time ZIP 一键导入 | ✗（仅 VIP JSON 备份） | 仅 TV | ✅ TV+电影 | **超越** |
| 其他竞品 CSV 导入 | ✗ | ✗ | ✅（round-5） | **超越** |
| Web 端追剧闭环（按集/整季/进度/状态） | ✅ | 部分（无电影） | ✅ | 达标 |
| Next Up / Continue Watching | ✅ | ✗ | ✅ | 达标 |
| 日历 + iCal 订阅 | ✅（iCal 为 VIP） | ✗ | ✅ 免费 | **超越** |
| 播出邮件提醒 | ✗ | ✗ | ✅（round-4） | **超越** |
| 个人统计页 | VIP 付费 | ✗ | ✅ 免费 | **超越** |
| 公开分享 profile | ✅ | ✅ | ✅（round-5，token 制） | 达标 |
| 推荐（More like this） | ✅ | ✅ | ✅（round-4） | 达标 |
| 评分/评论 | ✅ | ✅（主打） | ✗ | **未达标** |
| 社交（关注/动态流） | ✅ | ✅ | ✗ | **未达标** |
| Scrobble/播放器自动记录 | ✅（生态核心） | ✗ | ✗ | 未达标（非 web 优先场景，暂不追） |
| Gamification（streaks） | ✅（新版） | ✗ | ✗ | 未达标（低优先） |
| 原生移动 App | ✅ | ✗ | ✗（响应式 web） | 定位差异，不追 |

**结论**：核心追剧 + 导入 + 提醒 + 统计维度已达到或超越同期竞品免费档；
差距集中在社区维度（评分/评论、社交动态）。对"TV Time 难民迁移"这一核心定位，
迁移-追剧-提醒闭环已全面领先；要全面达标需补上评分（个人维度，成本低）——
社交动态流成本高、冷启动难，建议列为观察项而非必做。

## 流量与意向（截至 2026-08-05，第一方无 Cookie 统计）

- 人类 PV 162（其中绝大部分为内部 QA/开发访问）、bot PV 1、覆盖 9 个国家/地区
- UV：无（无 Cookie/不存 IP，架构上不产生 UV 指标）
- Waitlist 意向邮箱：1；注册用户 3（含内部测试号）
- 判断：尚无自然流量，需依赖 pSEO 收录生效 + TV Time 社区渠道投放

## Round 6 候选

- 个人评分（1-10 或五星）：补齐"未达标"里成本最低的一项
- 分享页 OG image（分享卡片在社交平台的预览图，放大 round-5 分享页的增长价值)
- 冷启动获客：Reddit r/tvtime 等社区渠道内容投放（需老板确认对外发声口径）
