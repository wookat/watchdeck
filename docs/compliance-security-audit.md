# WatchDeck 合规与安全审计（v1，上线四道把关之四）

日期：2026-08-05 ｜ 审计范围：watchdeck.zalize.com（commit main）

## 安全

| 项 | 状态 | 说明 |
|---|---|---|
| 密码存储 | ✅ | PBKDF2-SHA256，100k 迭代，随机 16 字节盐（src/auth.ts） |
| 会话 | ✅ | 256-bit 随机 token，HttpOnly + Secure + SameSite=Lax cookie，30 天过期，登出即删 |
| SQL 注入 | ✅ | 全部 D1 prepared statement 绑定参数，无字符串拼接 |
| XSS | ✅ | Hono JSX 自动转义所有插值；无 dangerouslySetInnerHTML |
| 秘密管理 | ✅ | TMDB token / IndexNow key 均为 Worker secret；仓库无任何凭据；.dev.vars 已 gitignore |
| 上传限制 | ✅ | 导入 ZIP 限 30 MB，仅解析 CSV 条目，服务端解析不落盘 |
| 状态枚举校验 | ✅ | track status 服务端白名单校验 |
| CSRF | ✅ | hono/csrf Origin 校验（round-2 修复）+ SameSite=Lax |
| /api/stats | ✅ | 仅 ADMIN_EMAIL 账号可读（round-2 修复） |
| 速率限制 | ✅ | KV 计数：登录 15/10min、注册 10/10min（round-2 修复） |

## 隐私 / 合规

| 项 | 状态 | 说明 |
|---|---|---|
| 统计 | ✅ | 第一方、无 Cookie、无指纹：仅 path/referrer/国家/UA 分类，不存 IP、不存用户 ID |
| 收集的个人数据 | ✅ | 仅邮箱（账号+意向表单）；导入数据为用户主动上传的观影记录 |
| TMDB 署名 | ✅ | 页脚含 TMDB 署名及"not endorsed or certified"声明，符合 TMDB 免费 API 条款 |
| TMDB 商用限制 | ⚠️ | 当前免费非商业档；开启收费前必须升级 TMDB 商业授权或更换数据源 |
| 付费墙 | ✅ | PAYWALL_ENABLED=false，无真实收款代码路径 |
| TV Time 数据 | ✅ | 仅处理用户自己的 GDPR 导出文件，属用户自有数据 |

## 结论

无 P0/P1 安全或合规问题，可维持上线状态。P2 项（CSRF token、stats 访问控制、登录速率限制）列入 benchmark-round-1 迭代。
