# Web IQ Search for Codex

一个轻量 Codex 搜索插件：通过 MCP 只提供一个只读工具 `webiq_search`，后端使用 Microsoft Web IQ Web Search v3。

- 零 npm 依赖、无需构建，运行时只有一个 `server.mjs`
- 默认连接本机 `ghc-api`：`http://127.0.0.1:8313/v3/search/web`
- 参数只有 `query` 和可选的 `max_results`（1–10）
- 固定请求 passage，默认每条最多 3000 字符，总输出最多 48 KiB
- 搜索结果明确标记为不可信内容，并保留标题和来源 URL

## 使用

先启动启用了 Web IQ 的 `ghc-api`，然后从已配置的 marketplace 安装 **Web IQ Search**，新建会话即可使用。

直连 Microsoft 时设置：

```powershell
$env:WEBIQ_ENDPOINT = "https://api.microsoft.ai"
$env:WEBIQ_API_KEY = "..."
```

支持以下宿主无关的环境变量：

| 变量 | 默认值 |
| --- | --- |
| `WEBIQ_ENDPOINT` | `http://127.0.0.1:8313/v3/search/web` |
| `WEBIQ_API_KEY` | 未设置 |
| `WEBIQ_TOKEN` | 未设置 |
| `WEBIQ_TIMEOUT_MS` | `30000`（限制 1000–300000） |
| `WEBIQ_MAX_RESULTS` | `5`（限制 1–10） |
| `WEBIQ_MAX_LENGTH` | `3000`（限制 200–20000） |

## 验证

```powershell
npm test
```

需要 Node.js 20.11 或更高版本。
