# 产品线 #4 选品报告 —— WatchDeck（Web 优先剧集/电影追踪器）

日期：2026-08-05 ｜ 作者：project-lead ｜ 状态：已拍板（方向 1）

## 1. 执行摘要

**拍板结论：选方向 1 —— Web 优先的剧集/电影追踪器，核心卖点是 TV Time GDPR 导出文件一键导入 + 导入后 30 秒内恢复追剧状态。产品名 WatchDeck，域名 watchdeck.zalize.com。**

依据三捷径框架：
- **供需失衡窗口**：TV Time 于 2026-07-15 关停（26.4M 累计安装、约 2.8 万人请愿挽留），大量存量用户手握 GDPR 导出 ZIP 找不到顺手的去处，窗口真实且仍在。
- **低垂的果实**：现有承接者各有明显短板（见竞品矩阵）——Bingers 无 Web 端，Trakt 复杂且核心体验 VIP 化，Serializd 只做 TV 不做电影。
- **付费验证**：Trakt VIP（$2.99-4.99/月）证明该品类用户愿意付费；我们先免费攒流量，付费墙留开关。

## 2. 四个候选方向评估

| 方向 | 窗口强度 | 竞争 | 信任门槛 | 技术可行性(CF Workers) | 结论 |
|---|---|---|---|---|---|
| 1. TV Time 关停 → web 追踪器 | 高（7/15 刚关停，迁移期） | 中（Bingers/Trakt/Serializd 各有缺口） | 低（娱乐数据） | 高（TMDB API + D1 完美匹配） | ✅ 拍板 |
| 2. Minimalist 密码管理器关停 | 中 | 高（1Password/Bitwarden） | **极高**（密码=生命线，无品牌背书的新站没人敢存密码；一次性付费用户群更难转化） | 中（E2E 加密审计成本高） | ❌ 否决 |
| 3. ChatGPT Atlas 8/9 关停 | 中 | 高 | 中 | **低**（浏览器/Agent 壳需客户端分发，非 web 可承载） | ❌ 否决 |
| 4. 低分高需求品类（reading tracker 等） | 低（无时间窗口，随时可做） | 中 | 低 | 高 | 备选（无紧迫性） |

## 3. TV Time 窗口事实核验

- TV Time 2026-07-15 停止服务；公开报道口径为 26.4M+ 累计安装。
- Change.org 请愿约 2.5-2.8 万人签名要求保留。
- 关停前官方提供 GDPR 自助导出（gdpr.tvtime.com/gdpr/self-service），产出 ZIP，内含 CSV：`tracking-prod-records.csv`（观看记录）、`followed_tv_show.csv`（追剧列表）、`ratings-live-votes.csv`（评分）——文件名清单来自 Trakt 官方导入页说明（实测截图 ss_94fb747a.png）。
- 原创始人 Antonio Pinto 于 2026-08-04 上线继任产品 Bingers（移动端）。

## 4. 竞品深度体验（真实注册 + 完整流程）

### 4.1 Trakt（trakt.tv）— 已真实注册并走完整流程 ✅

注册方式：邮箱 6 位 OTP，无密码（ss_2290c8a2 / ss_fb750252）。

体验过的完整流程与证据截图：
- 登录后首页：Continue Watching / Start Watching / streak / Calendar / Recommended（ss_4a77d343）
- 搜索 Severance → 详情页（季/集、评分、Where to Watch by JustWatch、评论）（ss_48f9621e、ss_2721e0b4）
- 一键"Mark as watched?"整剧 19 集标记（ss_d14da0f6）
- 日历页（ss_2b003556）
- 数据导入页：支持 TV Time / IMDb / Letterboxd / JSON / CSV，TV Time ZIP 直传或解压传 3 个 CSV，一次最多 50 文件（ss_94fb747a）
- VIP 定价 $2.99-4.99/月：更多统计、全球 Where to Watch、更大 watchlist/library、更多 lists 等核心能力被围在付费墙内（ss_47180599）

**技术反推**：Rails 系传统服务端渲染 + 自有媒体数据库（有公开 API 生态）、JustWatch 提供流媒体渠道数据。
**强**：数据模型最成熟、导入最全、API 生态强。
**弱（我们的机会）**：信息层级复杂、首用摩擦大、免费档功能受限明显、面向"数据极客"而非普通 TV Time 难民。

### 4.2 Serializd（serializd.com）— 已真实注册并走完整流程 ✅

注册方式：用户名+邮箱+密码，即时可用无需邮箱验证（ss_c09f1f9c）。

体验过的流程与证据：
- 首页顶栏常驻横幅"TV Time shuts down July 15. Import your data to Serializd"（ss_7aeef74a）
- 注册后设置页：Import from TV Time / Import from Trakt / Import from list（ss_c09f1f9c）
- Severance 详情页：季列表、nanogenres、Currently watching / Mark watched / Watchlist / 评分日志、社区统计（124.1K watched）（ss_fb652b84）
- 专门的 /tvtime 导入页：上传 GDPR ZIP；明确声明**电影数据不导入**、TV Time 评论转为 Reviews、列表不支持导入、数据库映射可能不完全（ss_82e21f9e）
- 数据源：TMDB；平台 Web/iOS/Android；当前功能免费（Playwire 广告变现 + Patreon）。

**技术反推**：Next.js（next-route-announcer 可见）+ TMDB 数据源 + Playwire 广告。
**强**：Web 可用、TV Time 导入入口最显眼、社区（Letterboxd for TV）定位清晰。
**弱（我们的机会）**：**只做 TV 不做电影**（TV Time 用户两者都有）；导入丢电影、丢列表；偏日记/社区而非"迁移后高效管理下一集"。

### 4.3 Simkl（simkl.com）— 体验被阻断 ⚠️

多次访问均被 Cloudflare 人机验证拦截，未能完成注册与流程体验（ss_26f990ff、ss_ae5b72f8、ss_69eccb62）。此为体验阻塞记录而非产品评价；公开资料显示其主打自动 scrobble 与多源同步、界面较老。对本报告结论无决定性影响。

### 4.4 Bingers（bingers.app）— 官网核验 ✅（无 Web 应用可注册）

- 2026-08-04 上线，TV Time 原创始人 Antonio Pinto 出品，主打社区（评论/GIF/投票）+ TV Time 导入。
- **仅 iOS/Android，官网只有营销落地页，无 Web 应用**——这就是方向 1 的差异化缺口。
- 威胁：创始人光环 + 社区迁移号召力最强，若后续推出 Web 端将直接正面竞争。

## 5. 差异化定位（WatchDeck）

一句话：**"TV Time 难民的 Web 端新家：拖入你的导出 ZIP，30 秒后继续追你的下一集。"**

| 维度 | Bingers | Trakt | Serializd | WatchDeck |
|---|---|---|---|---|
| Web 端 | ❌ 无 | ✅ 但复杂 | ✅ 偏社区 | ✅ 核心主场 |
| TV Time 导入 | ✅ | ✅（需解压说明书） | ✅（丢电影/列表） | ✅ ZIP 直拖，TV+电影都要 |
| 电影支持 | ✅ | ✅ | ❌ | ✅ |
| 免费完整核心功能 | ✅ | ❌ VIP 墙 | ✅ | ✅（付费墙留开关不启用） |
| 导入后即时价值 | ? | 弱（信息过载） | 弱（偏日记） | **"你的下一集"首屏** |

MVP 范围：TV Time ZIP 导入（解析 3 个 CSV → TMDB 匹配）、搜索/详情（TMDB）、剧集进度追踪（标记到集）、watchlist、即将播出日历、"下一集"首屏。非目标（首版不做）：社交/评论、scrobble、移动 App、真实收款。

风险与反证：
- Bingers 上 Web / Trakt 简化 UI → 靠"迁移体验+速度"抢首批用户后以短周期迭代对标。
- TMDB 免费 Developer Plan 要求非商业+署名 → 首页/关于页署名 TMDB；一旦开启收费须升级 TMDB 商业授权（$149/mo）或换数据源，已列入合规清单。
- 窗口衰减（关停已 3 周）→ 尽快上线 + pSEO 承接 "tv time replacement/import" 长尾搜索。

## 6. 已落实的外部资源

- TMDB Developer Plan API key 已申请获批（应用名 WatchDeck，URL watchdeck.zalize.com），API 实测可用（search/tv 返回正常）。密钥存 Cloudflare Worker secret，不入库。
- Cloudflare 组织 token（Workers/D1/KV/DNS）已具备；zalize.com 子域可配。

## 7. 下一步（阶段 B）

1. 建仓 wookat/watchdeck：Cloudflare Workers + D1（用户/进度/watchlist）+ KV（TMDB 缓存）+ Tailwind。
2. MVP 核心流：注册/登录 → 导入 ZIP → "下一集"首屏 → 搜索/标记 → 日历。
3. 免费上线 + 无 Cookie 第一方统计 + 邮箱意向收集；pSEO + sitemap/robots + IndexNow + 与 astrosage/subsleuth/cv.zalize.com 互链。
4. 四道把关后部署 watchdeck.zalize.com，随后进入 benchmark-round-N 对标迭代循环。
