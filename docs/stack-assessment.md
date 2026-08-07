# 技术栈评估（专项 R1 批，2026-08）

约束：保持 Cloudflare 平台（老板技术选型原则：托管平台优先）。

## 竞品技术栈对照（公开可观察）

| 竞品 | 前端 | 渲染 | 托管 |
|------|------|------|------|
| Trakt（新 Web 端） | Svelte SPA | CSR | Cloudflare 前置 |
| JustWatch | Vue 3 + Vite | SSR（重 SEO） | 自有 + CDN |
| Letterboxd | 服务端模板 + JS islands | SSR | Cloudflare 前置 |
| TVmaze | 服务端模板 | SSR | 自托管 nginx |
| Watcharr（开源） | Svelte | CSR | 自托管 |

## 我们当前栈

Cloudflare Workers + Hono + hono/jsx SSR + D1 + KV + Tailwind CSS v4 + TMDB + Resend + workers-og。

## 结论：保持，不升级框架

1. **SSR 是本产品正确形态**：pSEO（254+ URL）与 OG/结构化数据是获客主轴，JustWatch/Letterboxd 两个 SEO 最强竞品都是 SSR；Trakt 的 CSR SPA 反而 SEO 弱（其流量靠品牌与 App）。hono/jsx SSR 冷 TTFB 已优化到 ~0.4s，无性能缺口。
2. **迁移 React/Next 或 Svelte 无明确收益**：无复杂客户端状态（交互全部 form POST + 少量 app.js），引入 hydration 只会加 JS 体积、伤 CWV。评估过 Cloudflare Pages + Astro：对纯 SSR 动态站无增益，且失去单 Worker 的 cron/D1 一体化。
3. **已具备的现代化要素**：Tailwind v4、_headers 缓存策略、并行数据拉取、KV 缓存、PWA manifest。
4. **值得做的渐进增强**（不换栈）：
   - critical CSS 评估（BetaSeries 模式）——当前 styles.css 已 <40KB 且缓存 1h+SWR，收益低，暂缓；
   - 若未来需要富交互（拖拽排序清单等），在单页内用 islands（petite-vue/htmx 级别）而非全站框架。

**决定：栈不变；把精力投入功能与设计复刻（收益更高）。**
