# OpenAPIHub — 个人可部署 API 中枢 / Personal Self-Hosted API Hub

[![CI](https://github.com/mamutou/openapihub/actions/workflows/ci.yml/badge.svg)](https://github.com/mamutou/openapihub/actions/workflows/ci.yml)

**License: Apache-2.0** · Copyright 2026 mamutou

**语言 / Language:** [简体中文](#中文) · [English](#english)

---

## 中文

> 统一的软件 API 调用与结果输出中枢。**算力可以上云；输出在本地；云端不留文件；remote 只走 API 流式。**
>
> 适合本机长期自用，不是企业多租户生产。

### 隐私模型（默认 · P0 硬门）

| 字段 | 默认 | 含义 |
|------|------|------|
| `preferLocal` | `false` | 可优先 local，**不禁止** remote |
| `allowRemoteCompute` | `true` | 允许把算力路由到云端 |
| `streamOnlyRemote` | `true`（**硬约束，不可关**） | remote 必须流式；禁止一元缓冲云端输出 |
| `retainPayloads` | `false` | Hub 历史只留元数据，不落正文 |
| `remoteRetainFiles` | `false`（硬约束） | 远端不得保留文件 |

状态默认写到 `data/hub-state.json`（backends / policy / 最近调用元数据），权限 `0600`。`.gitignore` 已忽略 `data/` 与 `.env*`。

「硬约束」是真的硬：`PATCH /api/policy` 传 `streamOnlyRemote:false` 会被忽略并在响应里回执 `ignored`；注册公网 `baseUrl` 声明 `local` 会被纠正为 `remote`；一元接口遇到远程后端一律 `403 POLICY_VIOLATION`。

### 快速开始（本机）

> **局域网 / Docker 必须设 `HUB_API_TOKEN`。** 默认 `npm start` 只绑 `127.0.0.1`；用 `npm run start:lan`（`HUB_BIND=0.0.0.0`）且无 Token 时，管理 / invoke API 会返回 401（除非显式 `HUB_ALLOW_OPEN=1`，不安全）。
>
> 除 `HUB_BIND` 外，鉴权还检查请求的 `Host` 头：经局域网 IP / 域名访问一律要求 Token（防止「实际绑了 `0.0.0.0` 却声明 `127.0.0.1`」时被静默暴露）。

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

Docker（单容器 · 默认 LAN 绑定，**必须**传 Token）：

```bash
docker build -t openapihub .
docker run --rm -p 43127:43127 \
  -v "$(pwd)/data:/app/data" \
  -e HUB_API_TOKEN=change-me \
  openapihub
```

健康检查：`GET /api/health`（公开，含 `authRequired` / `hostGuard` / 部署警告）。

### 环境变量

见 `.env.example`。常用项：

| 变量 | 说明 |
|------|------|
| `HUB_API_TOKEN` | **局域网必填**。设置后 invoke / 管理 API 需 `Authorization: Bearer <token>` |
| `HUB_BIND` | 与监听地址一致；非 loopback 且无 Token → API 拒绝（除非 `HUB_ALLOW_OPEN=1`） |
| `HUB_ALLOW_OPEN` | `1` 时允许无 Token 开放（不安全，仅排障） |
| `HUB_LOCAL_HOST_ALLOWLIST` | 额外视为 local 的主机名（只影响 backend locality 判定，不放宽鉴权） |
| `HUB_DATA_DIR` | 状态目录，默认 `./data` |
| `HUB_INVOCATION_LIMIT` | 保留的调用元数据条数，默认 `200` |
| `HUB_MAX_BODY_BYTES` | invoke 请求体上限，默认 8 MiB（超限 413 `BODY_TOO_LARGE`） |
| `UNARY_TIMEOUT_MS` / `STREAM_CONNECT_TIMEOUT_MS` | 上游超时（流式仅建连超时，非整段时长） |
| `OPENAI_BASE_URL` / `OPENAI_API_KEY` | **仅探测**，用于生成「添加建议 Backend」；也可被 `headerEnv` 引用 |
| `HA_BASE_URL` / `HA_TOKEN` | 同上（Home Assistant） |

**locality**：公网 / 非私网 `baseUrl` 不能标 `local`——注册时纠正为 `remote`，invoke 时再按 URL 推导，防止绕过一元硬门。私网判定覆盖 RFC1918、loopback、`.local`、IPv6 ULA `fc00::/7`、link-local `fe80::/10` 与 `::ffff:` 映射地址。

控制台：若需要 Token，在页顶输入（存 sessionStorage）。

### 接真实服务

Hub 只做「转发到 Backend.baseUrl + path」，不内嵌任何模型或浏览器。

#### 上游鉴权头（密钥不落 Hub）

需要 `Authorization` 的上游，注册 Backend 时用 `headerEnv` 把 **header 名映射到环境变量名**：

```bash
export OPENAI_API_KEY=sk-...        # 密钥只在 Hub 进程环境里

curl -X POST http://127.0.0.1:43127/api/backends \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HUB_API_TOKEN" \
  -d '{"name":"OpenAI","baseUrl":"https://api.openai.com/v1","capabilities":["llm.chat"],
       "locality":"remote","headerEnv":{"Authorization":"OPENAI_API_KEY"}}'
```

- Hub 只在调用那一刻从自己的进程环境读值，**state 文件里只有变量名**，登记接口不会回显密钥；
- 不带 scheme 的值自动补 `Bearer `；
- `X-OpenAPIHub-*`、`Content-Type`、`Accept` 为 Hub 保留，`headerEnv` 无法覆盖；
- 控制台「注册新后端」中的「鉴权环境变量」就是这个字段。

#### Ollama / OpenAI 兼容 → `llm.chat`

1. 本机跑 Ollama（或任意 OpenAI 兼容网关），例如 `http://127.0.0.1:11434/v1`。
2. 注册 Backend：`baseUrl` 填该地址，`capabilities: llm.chat`，本机填 `local`；公网填 `remote` 且必须支持流式。
3. 试调 path：OpenAI 兼容用 `/chat/completions`（body 记得 `stream:true`），Ollama 原生用 `/api/chat`（NDJSON），mock 用 `/chat/stream`。
4. 需要密钥时按上节加 `headerEnv`。

#### Home Assistant → `home.control`

1. 开启 HA 长期访问令牌；API 基址如 `http://127.0.0.1:8123`。
2. 注册 Backend：`capabilities: home.control`，path 按你的代理约定（mock 为 `/control`），令牌用 `headerEnv` 指向 `HA_TOKEN`。
3. 也可在 HA 侧做一层已鉴权代理，Hub 只存 baseUrl。

#### 浏览器引擎 → `browser.*`

Hub **不内嵌 Chromium**。自建 Playwright/Puppeteer HTTP 包装，再注册为 Backend：

1. 服务暴露例如：
   - `POST /open` → `{ url }` → `{ finalUrl, title, status }`
   - `POST /extract` → `{ url, maxChars? }` → `{ text, title, … }`
   - `POST /screenshot` → `{ url, includeBase64? }` → `{ imageBase64?, width, height, … }`
2. 注册 Backend：`capabilities: browser.open,browser.extract,browser.screenshot`，本机服务填 `local`（公网 URL 会被纠正为 `remote` 并受流式硬门约束）。
3. 无真实服务时用内置 mock `/api/mock/caps/browser/*`（仅 loopback 可达）。

截图 base64 体积大：保持 `retainPayloads=false`（默认），历史只留元数据。

### 能力一览

| 能力 ID | 说明 | Mock | 端侧 |
|---------|------|------|------|
| `echo.message` | 路由演示 | local / remote 流式 | 否 |
| `llm.chat` | 对话补全（强制流式） | `/api/mock/caps/llm` | Ollama / OpenAI 兼容 |
| `mail.send` | 发信 | `/api/mock/caps/mail` | SMTP / 邮件代理 |
| `text.transform` | 摘要 / 改写 / 翻译 | `/api/mock/caps/text` | 可选 LLM |
| `office.render` | 文档元数据 + 抽取 | `/api/mock/caps/office` | LibreOffice 等 |
| `image.compose` | 模块化作图（强制流式） | `/api/mock/caps/image` | 画图引擎 / 远端 |
| `home.control` | 家庭设备读写 | `/api/mock/caps/home` | Home Assistant |
| `browser.open` | 打开网页 | `/api/mock/caps/browser/open` | Playwright / Puppeteer 服务 |
| `browser.extract` | 抽取网页文本 | `/api/mock/caps/browser/extract` | 同上 |
| `browser.screenshot` | 网页截图 | `/api/mock/caps/browser/screenshot` | 同上 |

### API 一览

| 方法 + 路径 | 鉴权 | 说明 |
|-------------|------|------|
| `GET /api/health` | 公开 | 健康 / 鉴权状态 / 部署警告 |
| `GET /api/capabilities` | 公开 | 能力目录 + 适配器探测 + `suggestions` |
| `POST /api/invoke` | 需 Token（若已设） | 一元调用，**仅 local** |
| `POST /api/invoke/stream` | 同上 | 流式调用，remote 唯一入口 |
| `GET /api/invocations` | 同上 | 最近调用元数据（默认不含正文） |
| `GET/POST /api/backends`、`GET/PATCH/DELETE /api/backends/{id}` | 同上 | Backend 注册与维护 |
| `GET/POST /api/devices`、`GET/PATCH/DELETE /api/devices/{id}` | 同上 | 设备与绑定 Backend |
| `POST /api/devices/{id}/heartbeat` | 同上 | 探活 / 上报健康 |
| `GET /api/hardware/profiles` | 同上 | 硬件画像目录 |
| `GET/PATCH /api/policy` | 同上 | 数据策略（硬门不可关） |
| `POST /api/schedule` | 同上 | 调度 dry-run（「为何选中」） |
| `* /api/mock/*` | **仅 loopback** | 内置 mock，供 Hub 自己调用 |

### 试调示例

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

### 上游流式契约（接真实服务必读）

远程调用只走 `POST /api/invoke/stream`，因此 **Backend 必须返回真正的流**：

| 上游 `content-type` | Hub 行为 |
|--------------------|----------|
| `text/event-stream` | 逐帧解析 `data:`，识别 `{token}`、`choices[].delta.content`，转成 Hub 的 `event: token` |
| `application/x-ndjson`、`application/jsonl` | 逐行解析 JSON，识别 `{token}` / `{content}` / `{text}` / `{response}` / `{message:{content}}` / `{delta:{content}}`（Ollama `/api/chat` 即此类） |
| 其他（含 `application/json`） | **502 `UPSTREAM_NOT_STREAMING`**，并记录一条失败调用元数据；不会把一元响应假装成流 |

Hub 输出的帧：`event: meta`（选中的后端 / 设备 / 调度理由）· `event: token` · `event: usage` · `event: finish` · `event: done`（含 `tokens` 计数与 `finishReason`）· `event: error`。

`tokens` 为 0 说明上游流格式与上表都不匹配，先检查 path / body（OpenAI 兼容端点要 `stream:true` 且 path 指向 `/chat/completions`）。`usage`、`finish_reason` / `done_reason` 作为元数据透传（不含正文，同样不进历史）；tool-calls 等其它旁路字段目前丢弃。

Hub 不会替上游攒全文再回放——这正是 `streamOnlyRemote` 硬约束在实现层的落点。

### 限制（个人包）

- 单机文件状态，无多租户 / OAuth / HA；一次只有一个进程写 `hub-state.json`（权限 `0600`）
- 不托管密钥：Hub 从不把密钥写进 state / 历史 / 日志，只用 `headerEnv` 指向的环境变量临时读取
- `/api/mock/*` 仅限 loopback（Hub 内部调用）。局域网浏览器直接打会 401 `MOCK_LOOPBACK_ONLY`；内置 mock Backend 已固定走 `127.0.0.1`
- 无插件市场；能力靠自注册 Backend + mock
- 无速率限制；请求体只有 `content-length` 上限（默认 8 MiB），chunked 上传不设限
- 流式只透传 token 与 `usage` / `finish_reason`；tool-calls 等其它旁路字段丢弃
- 设备探活 / 调度是骨架（打分 + 健康探测），没有真实驱动层

### 模块

| 路径 | 职责 |
|------|------|
| `src/lib/capabilities/` | 目录、类型、可选适配占位 |
| `src/lib/hardware/` | Hardware Profile 目录 |
| `src/lib/devices.ts` | 可插拔设备生命周期 |
| `src/lib/scheduler.ts` | 按能力选 Device / Backend |
| `src/lib/policy.ts` / `router.ts` | Data Policy + P0 硬门 |
| `src/middleware.ts` | mock 端点的 loopback 闸门 |
| `src/components/console-app.tsx` | 控制台（含设备面板） |

### 技术栈

Next.js · TypeScript · Tailwind · shadcn/ui · Vitest

---

## English

> A single hub for calling software APIs and collecting results. **Compute may live in the cloud; output lands locally; nothing is filed remotely; remote is stream-only.**
>
> Built for one person on one machine, not for multi-tenant production.

### Privacy model (defaults · P0 hard gates)

| Flag | Default | Meaning |
|------|---------|---------|
| `preferLocal` | `false` | Prefer local, **never forbids** remote |
| `allowRemoteCompute` | `true` | Compute may be routed to the cloud |
| `streamOnlyRemote` | `true` (**hard, cannot be disabled**) | Remote must stream; no unary buffering of cloud output |
| `retainPayloads` | `false` | History keeps metadata only, no bodies |
| `remoteRetainFiles` | `false` (hard) | Remotes may not retain files |

State lives in `data/hub-state.json` (backends / policy / recent invocation metadata) with mode `0600`. `.gitignore` already excludes `data/` and `.env*`.

The hard gates are enforced, not advisory: `PATCH /api/policy` with `streamOnlyRemote:false` is ignored and echoed back under `ignored`; a public `baseUrl` declared `local` is coerced to `remote`; the unary endpoint returns `403 POLICY_VIOLATION` for any remote backend.

### Quick start (local)

> **LAN and Docker require `HUB_API_TOKEN`.** `npm start` binds `127.0.0.1` only. With `npm run start:lan` (`HUB_BIND=0.0.0.0`) and no token, management / invoke APIs return 401 unless you explicitly set `HUB_ALLOW_OPEN=1` (unsafe).
>
> Besides `HUB_BIND`, auth also inspects the request `Host` header: requests arriving via a LAN IP or domain always require a token, so a process that binds `0.0.0.0` while declaring `127.0.0.1` cannot be reached silently.

```bash
npm install
cp .env.example .env   # set HUB_API_TOKEN for LAN use
npm run build
npm start              # http://127.0.0.1:43127 (loopback only)
# LAN:
# HUB_API_TOKEN=change-me npm run start:lan
```

Development:

```bash
npm run dev            # 127.0.0.1:43127
# npm run dev:lan      # needs a token or HUB_ALLOW_OPEN=1
```

Docker (single container · LAN bind by default, token **required**):

```bash
docker build -t openapihub .
docker run --rm -p 43127:43127 \
  -v "$(pwd)/data:/app/data" \
  -e HUB_API_TOKEN=change-me \
  openapihub
```

Health probe: `GET /api/health` (public, reports `authRequired` / `hostGuard` / deploy warnings).

### Environment variables

See `.env.example`. The common ones:

| Variable | Purpose |
|----------|---------|
| `HUB_API_TOKEN` | **Required on LAN.** When set, invoke / management APIs need `Authorization: Bearer <token>` |
| `HUB_BIND` | Must match the listen address; non-loopback bind without a token denies the API (unless `HUB_ALLOW_OPEN=1`) |
| `HUB_ALLOW_OPEN` | `1` allows token-less access (unsafe, troubleshooting only) |
| `HUB_LOCAL_HOST_ALLOWLIST` | Extra hostnames treated as local (affects backend locality only, never auth) |
| `HUB_DATA_DIR` | State directory, default `./data` |
| `HUB_INVOCATION_LIMIT` | Invocation metadata rows to keep, default `200` |
| `HUB_MAX_BODY_BYTES` | Invoke request body cap, default 8 MiB (413 `BODY_TOO_LARGE` above it) |
| `UNARY_TIMEOUT_MS` / `STREAM_CONNECT_TIMEOUT_MS` | Upstream timeouts (connect timeout for streams, not full duration) |
| `OPENAI_BASE_URL` / `OPENAI_API_KEY` | **Probe only**, used to offer a one-click suggested backend; can also be referenced by `headerEnv` |
| `HA_BASE_URL` / `HA_TOKEN` | Same, for Home Assistant |

**Locality**: a public / non-private `baseUrl` can never be declared `local` — registration coerces it to `remote`, and invoke re-derives it from the URL, so the unary gate cannot be bypassed. Private detection covers RFC1918, loopback, `.local`, IPv6 ULA `fc00::/7`, link-local `fe80::/10` and `::ffff:` mapped addresses.

Console: enter the token at the top of the page when required (kept in `sessionStorage`).

### Wiring real services

The hub only forwards to `Backend.baseUrl + path`; it embeds no model and no browser.

#### Upstream auth headers (secrets never enter the hub)

For upstreams that need `Authorization`, register the backend with `headerEnv` mapping a **header name to an environment variable name**:

```bash
export OPENAI_API_KEY=sk-...        # the secret lives only in the hub's own env

curl -X POST http://127.0.0.1:43127/api/backends \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HUB_API_TOKEN" \
  -d '{"name":"OpenAI","baseUrl":"https://api.openai.com/v1","capabilities":["llm.chat"],
       "locality":"remote","headerEnv":{"Authorization":"OPENAI_API_KEY"}}'
```

- Values are read from the hub's process env at call time; **state holds the variable name only** and the registration API never echoes a secret;
- A value without a scheme gets `Bearer ` prefixed;
- `X-OpenAPIHub-*`, `Content-Type` and `Accept` are reserved and cannot be overridden;
- The console's "auth env var" field in the backend form is exactly this.

#### Ollama / OpenAI-compatible → `llm.chat`

1. Run Ollama (or any OpenAI-compatible gateway), e.g. `http://127.0.0.1:11434/v1`.
2. Register a backend with that `baseUrl` and `capabilities: llm.chat`; `local` for a machine-local service, `remote` (streaming required) for a public one.
3. Try path `/chat/completions` for OpenAI-compatible (body needs `stream:true`), `/api/chat` for native Ollama (NDJSON), `/chat/stream` for the mock.
4. Add `headerEnv` if the upstream needs a key.

#### Home Assistant → `home.control`

1. Create a long-lived access token; API base such as `http://127.0.0.1:8123`.
2. Register a backend with `capabilities: home.control`, your proxied path (mock is `/control`), and `headerEnv` pointing at `HA_TOKEN`.
3. Alternatively put an authenticated proxy in front and only store its base URL.

#### Browser engine → `browser.*`

The hub does **not** embed Chromium. Wrap Playwright/Puppeteer behind HTTP and register it:

1. Expose something like:
   - `POST /open` → `{ url }` → `{ finalUrl, title, status }`
   - `POST /extract` → `{ url, maxChars? }` → `{ text, title, … }`
   - `POST /screenshot` → `{ url, includeBase64? }` → `{ imageBase64?, width, height, … }`
2. Register a backend with `capabilities: browser.open,browser.extract,browser.screenshot`; `local` for a machine-local service (public URLs are coerced to `remote` and bound by the stream gate).
3. Without a real service, use the built-in mocks at `/api/mock/caps/browser/*` (loopback only).

Screenshot base64 is large: keep `retainPayloads=false` (default) so history stays metadata-only.

### Capabilities

| Capability ID | Purpose | Mock | Edge side |
|---------------|---------|------|-----------|
| `echo.message` | Routing demo | local / remote stream | no |
| `llm.chat` | Chat completion (stream required) | `/api/mock/caps/llm` | Ollama / OpenAI-compatible |
| `mail.send` | Send mail | `/api/mock/caps/mail` | SMTP / mail proxy |
| `text.transform` | Summarize / rewrite / translate | `/api/mock/caps/text` | optional LLM |
| `office.render` | Document metadata + text extraction | `/api/mock/caps/office` | LibreOffice etc. |
| `image.compose` | Modular image composition (stream required) | `/api/mock/caps/image` | render engine / remote |
| `home.control` | Read/write home devices | `/api/mock/caps/home` | Home Assistant |
| `browser.open` | Open a page | `/api/mock/caps/browser/open` | Playwright / Puppeteer service |
| `browser.extract` | Extract page text | `/api/mock/caps/browser/extract` | same |
| `browser.screenshot` | Screenshot a page | `/api/mock/caps/browser/screenshot` | same |

### API surface

| Method + path | Auth | Purpose |
|---------------|------|---------|
| `GET /api/health` | public | Health / auth state / deploy warnings |
| `GET /api/capabilities` | public | Capability catalog + adapter probes + `suggestions` |
| `POST /api/invoke` | token if set | Unary call, **local only** |
| `POST /api/invoke/stream` | token if set | Streaming call, the only remote entry point |
| `GET /api/invocations` | token if set | Recent invocation metadata (no bodies by default) |
| `GET/POST /api/backends`, `GET/PATCH/DELETE /api/backends/{id}` | token if set | Backend registry |
| `GET/POST /api/devices`, `GET/PATCH/DELETE /api/devices/{id}` | token if set | Devices and their bound backend |
| `POST /api/devices/{id}/heartbeat` | token if set | Health probe / report |
| `GET /api/hardware/profiles` | token if set | Hardware profile catalog |
| `GET/PATCH /api/policy` | token if set | Data policy (hard gates cannot be turned off) |
| `POST /api/schedule` | token if set | Scheduling dry-run ("why this backend") |
| `* /api/mock/*` | **loopback only** | Built-in mocks, called by the hub itself |

### Try it

```bash
# without HUB_API_TOKEN
curl http://127.0.0.1:43127/api/capabilities

curl -X POST http://127.0.0.1:43127/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{"capability":"text.transform","body":{"op":"summarize","text":"Hello OpenAPIHub."}}'

curl -N -X POST http://127.0.0.1:43127/api/invoke/stream \
  -H 'Content-Type: application/json' \
  -d '{"capability":"llm.chat","body":{"messages":[{"role":"user","content":"hello"}]}}'

# with HUB_API_TOKEN
curl -H "Authorization: Bearer $HUB_API_TOKEN" http://127.0.0.1:43127/api/backends
```

### Upstream streaming contract (read before wiring a real service)

Remote calls only ever use `POST /api/invoke/stream`, so **a backend must return a real stream**:

| Upstream `content-type` | Hub behaviour |
|-------------------------|---------------|
| `text/event-stream` | Parses `data:` frames, recognises `{token}` and `choices[].delta.content`, re-emits Hub `event: token` |
| `application/x-ndjson`, `application/jsonl` | Parses one JSON object per line, recognising `{token}` / `{content}` / `{text}` / `{response}` / `{message:{content}}` / `{delta:{content}}` (native Ollama `/api/chat`) |
| anything else (including `application/json`) | **502 `UPSTREAM_NOT_STREAMING`**, recorded as a failed invocation; a unary response is never passed off as a stream |

Frames the hub emits: `event: meta` (chosen backend / device / schedule reason) · `event: token` · `event: usage` · `event: finish` · `event: done` (with `tokens` count and `finishReason`) · `event: error`.

`tokens: 0` means the upstream matched none of the shapes above — check path and body (OpenAI-compatible endpoints need `stream:true` and a `/chat/completions` path). `usage` and `finish_reason` / `done_reason` are forwarded as metadata only (no bodies, nothing retained in history); tool-calls and other side channels are dropped for now.

The hub never accumulates the full text upstream and replays it — that is the `streamOnlyRemote` hard gate at the implementation level.

### Limits (personal package)

- Single-machine file state, no multi-tenant / OAuth / HA; one process writes `hub-state.json` (mode `0600`)
- No secret custody: keys never reach state, history or logs; only the env var named by `headerEnv` is read at call time
- `/api/mock/*` is loopback-only (the hub calls it itself). A LAN browser gets 401 `MOCK_LOOPBACK_ONLY`; built-in mock backends always target `127.0.0.1`
- No plugin marketplace; capabilities come from self-registered backends plus mocks
- No rate limiting; request bodies are capped by `content-length` only (8 MiB default), chunked uploads are unbounded
- Streaming forwards tokens plus `usage` / `finish_reason`; tool-calls and other side channels are dropped
- Device probing / scheduling is a skeleton (scoring + health probe), with no real driver layer

### Modules

| Path | Responsibility |
|------|----------------|
| `src/lib/capabilities/` | Catalog, types, optional adapter stubs |
| `src/lib/hardware/` | Hardware profile catalog |
| `src/lib/devices.ts` | Pluggable device lifecycle |
| `src/lib/scheduler.ts` | Pick a device / backend per capability |
| `src/lib/policy.ts` / `router.ts` | Data policy + P0 hard gates |
| `src/middleware.ts` | Loopback gate for mock endpoints |
| `src/components/console-app.tsx` | Console (including the device panel) |

### Stack

Next.js · TypeScript · Tailwind · shadcn/ui · Vitest

---

## License

Licensed under the [Apache License, Version 2.0](./LICENSE). Copyright 2026 mamutou.
