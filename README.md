# OpenAPIHub — 个人可部署最小包

[![CI](https://github.com/mamutou/openapihub/actions/workflows/ci.yml/badge.svg)](https://github.com/mamutou/openapihub/actions/workflows/ci.yml)

**License: Apache-2.0** · Copyright 2026 mamutou

统一的软件 API 调用与结果输出中枢。**算力可以上云；输出在本地；云端不留文件；remote 只走 API 流式。**

适合本机长期自用，不是企业多租户生产。

## 隐私模型（默认 · P0 硬门）

| 字段 | 默认 | 含义 |
|------|------|------|
| `preferLocal` | `false` | 可优先 local，**不禁止** remote |
| `allowRemoteCompute` | `true` | 允许把算力路由到云端 |
| `streamOnlyRemote` | `true`（**硬约束，不可关**） | remote 必须流式；禁止一元缓冲云端输出 |
| `retainPayloads` | `false` | Hub 历史只留元数据，不落正文 |
| `remoteRetainFiles` | `false`（硬约束） | 远端不得保留文件 |

状态默认写到 `data/hub-state.json`（backends / policy / 最近调用元数据）。`.gitignore` 已忽略 `data/` 与 `.env*`。

## 本机部署（推荐）

> **局域网 / Docker 必须设 `HUB_API_TOKEN`。** 默认 `npm start` 只绑 `127.0.0.1`；用 `npm run start:lan`（`HUB_BIND=0.0.0.0`）且无 Token 时，管理/invoke API 会返回 401（除非显式 `HUB_ALLOW_OPEN=1`，不安全）。
>
> 除 `HUB_BIND` 外，鉴权还会检查请求的 `Host` 头：经局域网 IP / 域名的请求一律要求 Token（防止「实际绑了 0.0.0.0 却声明 127.0.0.1」时被静默暴露）。

```bash
npm install
cp .env.example .env   # 局域网务必填写 HUB_API_TOKEN
npm run build
npm start              # http://127.0.0.1:43127 （仅本机）
# 局域网：
# HUB_API_TOKEN=change-me npm run start:lan
```

开发模式：

```bash
npm run dev            # 127.0.0.1:43127
# npm run dev:lan      # 需 Token 或 HUB_ALLOW_OPEN=1
```

可选 Docker（单容器 · 默认 LAN 绑定，**必须**传 Token）：

```bash
docker build -t openapihub .
docker run --rm -p 43127:43127 \
  -v "$(pwd)/data:/app/data" \
  -e HUB_API_TOKEN=change-me \
  openapihub
```

健康检查：`GET /api/health`。

## 环境变量

见 `.env.example`。常用项：

| 变量 | 说明 |
|------|------|
| `HUB_API_TOKEN` | **局域网必填**。设置后，invoke / 管理 API 需 `Authorization: Bearer …` |
| `HUB_BIND` | 与监听地址一致；非 loopback 且无 Token → API 拒绝（除非 `HUB_ALLOW_OPEN=1`） |
| `HUB_ALLOW_OPEN` | `1` 时允许无 Token 开放（不安全，仅排障） |
| `HUB_LOCAL_HOST_ALLOWLIST` | 额外视为 local 的主机名 |
| `HUB_DATA_DIR` | 状态目录，默认 `./data` |
| `HUB_INVOCATION_LIMIT` | 保留的调用元数据条数，默认 `200` |
| `UNARY_TIMEOUT_MS` / `STREAM_CONNECT_TIMEOUT_MS` | 上游超时 |
| `HUB_MAX_BODY_BYTES` | invoke 请求体上限，默认 8 MiB（超限 413 `BODY_TOO_LARGE`） |
| `OPENAI_BASE_URL` / `OPENAI_API_KEY` | **仅探测**；不代发 |
| `HA_BASE_URL` / `HA_TOKEN` | 同上（Home Assistant） |

**locality**：公网 / 非私网 `baseUrl` 不能标 `local`——注册时会纠正为 `remote`；invoke 再按 URL 推导，防止绕过一元硬门。

控制台：若需要 Token，在页顶输入（存 sessionStorage）。

## 接真实服务（仍不强制代发）

Hub **不会**用你的 `OPENAI_API_KEY` / `HA_TOKEN` 代发请求。正确做法是把可直连的服务注册为 Backend：

### Ollama / OpenAI 兼容 → `llm.chat`

1. 本机跑 Ollama（或任意 OpenAI 兼容网关），例如 `http://127.0.0.1:11434/v1`。
2. 在控制台「注册 Backend」：
   - baseUrl：`http://127.0.0.1:11434/v1`（或你的网关）
   - capabilities：`llm.chat`
   - locality：本机填 `local`；公网填 `remote` 且须支持流式
   - path 试调：`/chat/completions` 或按你的服务路径（mock 用 `/chat/stream`）
3. 若已配置 `OPENAI_*`，能力目录会出现「添加建议 Backend」一键预填 baseUrl（仍不代持密钥）。

> 注意：当前 Hub 以「转发到 Backend.baseUrl + path」为主。若上游需要 `Authorization: Bearer <key>`，请在上游网关侧终结密钥，或使用已带鉴权的本地代理；本包不为密钥做代持转发。

### Home Assistant → `home.control`

1. 开启 HA 长期访问令牌；API 基址如 `http://127.0.0.1:8123`。
2. 注册 Backend：`capabilities: home.control`，path 按你的代理约定（mock 为 `/control`）。
3. 密钥留在 HA / 本地代理；Hub 只存 baseUrl。

### 浏览器引擎 → `browser.*`

Hub **不内嵌 Chromium**。自建 Playwright/Puppeteer HTTP 包装（或现成 browser API），再注册为 Backend：

1. 服务暴露例如：
   - `POST /open` → `{ url }` → `{ finalUrl, title, status }`
   - `POST /extract` → `{ url, maxChars? }` → `{ text, title, … }`
   - `POST /screenshot` → `{ url, includeBase64? }` → `{ imageBase64?, width, height, … }`
2. 控制台注册 Backend：
   - baseUrl：`http://127.0.0.1:9222`（示例）
   - capabilities：`browser.open,browser.extract,browser.screenshot`
   - locality：本机服务填 `local`（公网 URL 会被纠正为 `remote` 并受流式硬门约束）
3. 无真实服务时，内置 mock：`/api/mock/caps/browser/*`（`mock:true`）。

截图 base64 体积大：保持 `retainPayloads=false`（默认），历史只留元数据。

## 能力一览

| 能力 ID | 说明 | Mock | 端侧 |
|---------|------|------|------|
| `echo.message` | 路由演示 | local / remote 流式 | 否 |
| `llm.chat` | 对话补全（强制流式） | `/api/mock/caps/llm` | Ollama / OpenAI 兼容 |
| `mail.send` | 发信 | `/api/mock/caps/mail` | SMTP / 邮件代理 |
| `text.transform` | 摘要/改写/翻译 | `/api/mock/caps/text` | 可选 LLM |
| `office.render` | 文档元数据+抽取 | `/api/mock/caps/office` | LibreOffice 等 |
| `image.compose` | 模块化作图（强制流式） | `/api/mock/caps/image` | 画图引擎/远端 |
| `home.control` | 家庭设备读写 | `/api/mock/caps/home` | Home Assistant |
| `browser.open` | 打开网页 | `/api/mock/caps/browser/open` | Playwright/Puppeteer 服务 |
| `browser.extract` | 抽取网页文本 | `/api/mock/caps/browser/extract` | 同上 |
| `browser.screenshot` | 网页截图 | `/api/mock/caps/browser/screenshot` | 同上 |

目录 API：`GET /api/capabilities`（公开，含 `authRequired` / `suggestions`）。

## 试调示例

```bash
# 未设置 HUB_API_TOKEN 时
curl http://127.0.0.1:43127/api/capabilities

curl -X POST http://127.0.0.1:43127/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{"capability":"text.transform","body":{"op":"summarize","text":"Hello OpenAPIHub."}}'

curl -N -X POST http://127.0.0.1:43127/api/invoke/stream \
  -H 'Content-Type: application/json' \
  -d '{"capability":"llm.chat","body":{"messages":[{"role":"user","content":"你好"}]}}'

# 设置了 HUB_API_TOKEN 时加头
curl -H "Authorization: Bearer $HUB_API_TOKEN" http://127.0.0.1:43127/api/backends
```

### 上游鉴权头（密钥不落 Hub）

需要 `Authorization` 的上游，注册 Backend 时用 `headerEnv` 把 **header 名映射到环境变量名**：

```bash
curl -X POST http://127.0.0.1:43127/api/backends \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HUB_API_TOKEN" \
  -d '{"name":"OpenAI","baseUrl":"https://api.openai.com/v1","capabilities":["llm.chat"],
       "locality":"remote","headerEnv":{"Authorization":"OPENAI_API_KEY"}}'
```

- Hub 只在调用那一刻从自己的进程环境读值，**state 文件里只有变量名**，登记接口不会回显密钥；
- 不带 scheme 的值自动补 `Bearer `；
- `X-OpenAPIHub-*`、`Content-Type`、`Accept` 为 Hub 保留，`headerEnv` 无法覆盖；
- 控制台「注册新后端」里的「鉴权环境变量」就是这个字段。

`OPENAI_API_KEY` 仍由你启动 Hub 时注入（`OPENAI_API_KEY=sk-... npm start`），Hub 不做密钥托管。

## 上游流式契约（接真实服务必读）

远程调用只走 `POST /api/invoke/stream`，因此 **Backend 必须返回真正的流**：

| 上游 `content-type` | Hub 行为 |
|--------------------|----------|
| `text/event-stream` | 逐帧解析 `data:`，识别 `{token}`、`choices[].delta.content`，转成 Hub 的 `event: token` |
| `application/x-ndjson`、`application/jsonl` | 逐行解析 JSON，识别 `{token}` / `{content}` / `{text}` / `{response}` / `{message:{content}}` / `{delta:{content}}`（Ollama `/api/chat` 即此类） |
| 其他（含 `application/json`） | **502 `UPSTREAM_NOT_STREAMING`**，并记录一条失败调用元数据；不会把一元响应假装成流 |

`done` 事件带 `tokens` 计数与 `finishReason`：若 `tokens` 为 0，说明上游流格式与上述都不匹配，先检查 path / body（例如 OpenAI 兼容端点要 `stream: true` 且 path 指到 `/chat/completions`）。

上游的 `usage`、`finish_reason` / `done_reason` 作为元数据以 `event: usage`、`event: finish` 透传（不含正文，同样不进历史）。tool-calls 等其它旁路字段目前丢弃。

Hub 不会替上游攒全文再回放——这正是 `streamOnlyRemote` 硬约束在实现层的落点。

## 限制（个人包）

- 单机文件状态，无多租户 / OAuth / HA；一次只有一个进程写 `hub-state.json`（权限 0600）
- 不托管密钥：Hub 从不把密钥写进 state / 历史 / 日志，只用 `headerEnv` 指向的环境变量临时读取
- `/api/mock/*` 仅限 loopback（Hub 内部调用）。局域网浏览器直接打这些端点会 401 `MOCK_LOOPBACK_ONLY`；Hub 自己的 mock Backend 已固定走 `127.0.0.1`
- 无插件市场；能力靠自注册 Backend + mock
- 无速率限制；请求体只有 `content-length` 上限（默认 8 MiB），chunked 上传不设限
- 流式只透传 token 与 `usage` / `finish_reason`；tool-calls 等其它旁路字段丢弃
- 设备探活/调度是骨架（打分 + 健康探测），没有真实驱动层

## 模块

| 路径 | 职责 |
|------|------|
| `src/lib/capabilities/` | 目录、类型、可选适配占位 |
| `src/lib/hardware/` | Hardware Profile 目录 |
| `src/lib/devices.ts` | 可插拔设备生命周期 |
| `src/lib/scheduler.ts` | 按能力选 Device/Backend |
| `src/lib/policy.ts` / `router.ts` | Data Policy + P0 硬门 |
| `src/components/console-app.tsx` | 控制台（含设备面板） |

## 技术栈

Next.js · TypeScript · Tailwind · shadcn/ui

## License

Licensed under the [Apache License, Version 2.0](./LICENSE). Copyright 2026 mamutou.
