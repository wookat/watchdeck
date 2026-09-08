# 留存漏斗数据导出（近 30 天，聚合、无 PII）

导出时间：2026-09-08（R255 双口径改版；首版 2026-08-14）｜ 数据源：D1 `analytics_events`（第一方，90 天留存）、`users`/`tracked`/`sessions` 聚合计数。无邮箱、无 IP、无 UA 原文。

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

## 双口径统计（R255 起）：beacon 人访为主，服务端 hits 只作旁证

背景（2026-09-08 CEO 流量核查）：30 天 9.0M 行 `analytics_events` 中 3.26M 行 `ua_class IN ('desktop','mobile')`，其中 ≥3.25M 为伪装浏览器 UA 的爬虫扫库（/person 1.43M、/signup 单页 773k、/movies 702k），旧分类器（仅 UA 关键词）未识别。一手取证（wrangler tail + D1）得到 3 个可判特征：

| 特征 | 证据 | 判定 |
|---|---|---|
| **Referer 为裸 origin 且无尾斜杠**（`https://watchdeck.zalize.com`） | 7d desktop/mobile 141,151 行中 87,787 行；浏览器 origin-only referer 必带尾斜杠（`https://host/`，7d 仅 6 行） | 确定性非浏览器 |
| **缺 Sec-Fetch-Mode** | tail 抓包中约半数 Chrome UA 请求无任何 `Sec-Fetch-*`/`Accept-Language`（2021+ 全部浏览器必带） | 确定性非浏览器 |
| **不执行 JS** | 上述裸 referer 流量 100% 无 beacon（上线后 15 分钟窗口：desktop hits 有、beacon 0） | 人访口径直接排除 |
| 来源 ASN | 32934（Meta）占 tail 样本 78%；其 `meta-externalagent` 会执行 JS 并发 beacon（UA 含 crawler 已归 bot） | 旁证，兜底 |

### 采集端（勿增实体：同表加 3 列，不删历史）

```sql
ALTER TABLE analytics_events ADD COLUMN src TEXT;      -- 'beacon' = JS 执行的同源页面浏览；NULL = 服务端 HTML hit
ALTER TABLE analytics_events ADD COLUMN visitor TEXT;  -- sha256(日期|IP|UA) 截断 16 hex，日轮换匿名去重，仅 beacon 行
ALTER TABLE analytics_events ADD COLUMN asn INTEGER;   -- cf.asn 旁证
```

- **服务端 hit**（`src IS NULL`）：`ua_class` 新增 `crawler` 桶 = 浏览器 UA 但（缺 `Sec-Fetch-Mode` ∨ Referer 匹配 `^https?://[^/]+$` ∨ ASN ∈ {32934, 16509, 14618, 15169, 396982, 8075}）；原 `qa`/`bot` 规则不变。
- **beacon**（`src='beacon'`）：`app.js` DOMContentLoaded 后 `navigator.sendBeacon('/api/pv', {p: pathname, r: document.referrer})`；服务端只在 `Sec-Fetch-Site: same-origin` 且 `Sec-Fetch-Dest: empty` 时落库，其余 204 丢弃（curl 无头实测不落库）。
- 历史行 `src/visitor/asn` 均为 NULL，保留不删；新口径只对 R255 上线（2026-09-08 23:07 UTC）之后的数据成立。

### 口径 SQL

```sql
-- 人访 PV / 匿名去重访客（主口径）
SELECT COUNT(*) AS human_pv, COUNT(DISTINCT visitor) AS human_visitors
FROM analytics_events
WHERE src = 'beacon' AND ua_class NOT IN ('bot','crawler','qa') AND ts >= datetime('now','-7 days');

-- 服务端 hits 分桶（旁证）
SELECT ua_class, COUNT(*) FROM analytics_events
WHERE src IS NULL AND ts >= datetime('now','-7 days') GROUP BY ua_class ORDER BY 2 DESC;

-- 0 行为账号（单列，不计入 users）
SELECT COUNT(*) FROM users u
WHERE NOT EXISTS (SELECT 1 FROM tracked t WHERE t.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM episode_watches w WHERE w.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM movie_watches m WHERE m.user_id = u.id);
```

`/api/stats`（admin）已切换：`daily/countries/topPaths/referrers` 用人访口径并带 `visitors`；`serverHits7d` 按桶给旁证；`users` = 总账号 − `zeroActivityUsers`。

### 修复前后 7d 对比（查询时间见各行）

| 口径 | 值 | SQL |
|---|---|---|
| 修复前「去 bot/QA 后 PV」（2026-09-08 23:05 UTC） | desktop 141,110 + mobile 20 = **141,130** | `SELECT ua_class, COUNT(*) FROM analytics_events WHERE ts >= datetime('now','-7 days') GROUP BY ua_class` |
| 修复前 7d 总 hits | 1,330,867（bot 1,189,737） | 同上 |
| 修复后「人访 PV」（2026-09-08 23:14 UTC，上线后 7 分钟窗口） | **0** | 上文人访 SQL |
| 修复后「人访去重访客」（同上） | **0** | 上文人访 SQL |
| 修复后同窗口服务端 hits 分桶（2 分钟样本） | bot 213 · crawler 9（全部裸 origin referer）· desktop 0 | `… WHERE src IS NULL AND ts >= datetime('now','-2 minutes') GROUP BY ua_class` |
| 修复后同窗口 beacon 分桶 | bot 83（Meta `meta-externalagent`，会执行 JS）· 人访 0 | `… WHERE src='beacon' … GROUP BY ua_class` |

结论：旧口径 7d 141k「真实 PV」在新口径下归零，与 referrer 分析（7d 可信外部来访个位数）一致——差额全部是爬虫。beacon 人访窗口从 2026-09-08 起累积，7d 完整对比请于 2026-09-15 后重跑上文 SQL。

### 账号口径

- 总账号 12：8 QA 命名 + 1 老板（id 38）+ **3 个 0 行为账号**（id 56/57/58，`@web.de`，2026-08-26 爬虫峰期注册、0 tracked/0 集/1 session，疑似自动注册）。导出与 `/api/stats` 均把 0 行为账号单列（`zeroActivityUsers`），不计入 users。
- signup/login 自 R255 起接 Cloudflare Turnstile（managed 模式，服务端 siteverify fail-closed；未配置 secret 时跳过以便本地开发）。**当前线上为 Cloudflare 官方测试密钥（始终通过、零防护）**——现有 6 个 CF token 均无 Turnstile Write 权限无法自建 widget，待老板在 dash → Turnstile 建 widget（域 watchdeck.zalize.com）后替换 `TURNSTILE_SITE_KEY`（wrangler.jsonc vars）与 `wrangler secret put TURNSTILE_SECRET`。

## 口径与诚实声明

- **无访客级标识**：第一方 analytics 只记录 path/referrer/country/ua_class，无 cookie/指纹级访客 ID，「首访」只能以 pageview 总量 + 外部 referrer 为代理指标，无法做真实 UV 去重。
- **QA 数据不计业务成果**：9 个账号中 8 个为 QA 基线/QA 命名账号（id 1–6、46、55），1 个为老板本人（id 38）；QA 账号的追剧/回访行为均为回归测试，不代表真实留存。
- **QA 流量标记口径（R245 起统一）**：QA/内部访问统一带 `x-qa: 1` 请求头或 UA 含 `ZalizeQA`，采集端落库为 `ua_class='qa'`，admin 面板与后续导出一律剔除（历史数据无标记，只能靠账号层剔除）。
- **QA 邮箱前缀剔除口径（R253 起，账号层兜底）**：邮箱匹配 `qa*` / `devinqa*` / `smoke-test*` / `round5*` / `r10-qa*` 前缀或 `@example.com` 域的账号一律按 QA 口径剔除、不计业务成果（数据保留不删除）。id 55 `devinqa46a@…`（2026-08-16 注册，未带 QA 标记被误计为 desktop）经核查按此口径归类 QA。
- **结论**：近 30 天真实外部用户漏斗各阶段均为 0，与历轮数据面一致——瓶颈在获客投放（外部 referrer 持续为 0），非产品转化。GSC/Bing Webmaster 开通后可补搜索端真实数据。
