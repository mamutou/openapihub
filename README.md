# OpenAPIHub

统一的软件 API 调用与结果输出中枢。**算力可以上云；输出在本地；云端不留文件；remote 只走 API 流式。**

## 隐私模型（默认）

| 字段 | 默认 | 含义 |
|------|------|------|
| `preferLocal` | `false` | 可优先 local，**不禁止** remote |
| `allowRemoteCompute` | `true` | 允许把算力路由到云端 |
| `streamOnlyRemote` | `true` | remote 必须流式；非流式 remote 拒绝 |
| `retainPayloads` | `false` | Hub 历史只留元数据，不落正文 |
| `remoteRetainFiles` | `false` | 硬约束：远端不得保留文件 |

## 能力一览

| 能力 ID | 说明 | Mock | 端侧 |
|---------|------|------|------|
| `echo.message` | 路由演示 | local / remote 流式 | 否 |
| `llm.chat` | 对话补全（流式） | `/api/mock/caps/llm` | Ollama / OpenAI 兼容 |
| `mail.send` | 发信 | `/api/mock/caps/mail` | SMTP / 邮件代理 |
| `text.transform` | 摘要/改写/翻译 | `/api/mock/caps/text` | 可选 LLM |
| `office.render` | 文档元数据+抽取 | `/api/mock/caps/office` | LibreOffice 等 |
| `image.compose` | 模块化作图（流式） | `/api/mock/caps/image` | 画图引擎/远端 |
| `home.control` | 家庭设备读写 | `/api/mock/caps/home` | Home Assistant |

目录 API：`GET /api/capabilities`。控制台顶部「能力目录」可一键试调。

### 接真实服务（可选）

```bash
# LLM（OpenAI 兼容）— 占位探测；请将真实服务注册为 Backend 的 baseUrl
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
export OPENAI_API_KEY=ollama
export OPENAI_MODEL=llama3.2

# Home Assistant — 占位探测；真实调用请注册 HA 为 Backend
export HA_BASE_URL=http://127.0.0.1:8123
export HA_TOKEN=your_long_lived_token
```

类型与适配边界：`src/lib/capabilities/`。无 env 时一律走 mock。

## 本地运行

```bash
npm install
npm run dev
```

[http://localhost:43127](http://localhost:43127)（端口 43127）

## 试调示例

```bash
# 能力目录
curl http://localhost:43127/api/capabilities

# 文本处理（本地一元）
curl -X POST http://localhost:43127/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{"capability":"text.transform","body":{"op":"summarize","text":"Hello OpenAPIHub privacy-first hub."}}'

# LLM 流式（remote）
curl -N -X POST http://localhost:43127/api/invoke/stream \
  -H 'Content-Type: application/json' \
  -d '{"capability":"llm.chat","body":{"messages":[{"role":"user","content":"你好"}]}}'

# 作图流式
curl -N -X POST http://localhost:43127/api/invoke/stream \
  -H 'Content-Type: application/json' \
  -d '{"capability":"image.compose","body":{"template":"poster","layers":[{"type":"text","content":"Hi"}]}}'
```

## 模块

| 路径 | 职责 |
|------|------|
| `src/lib/capabilities/` | 目录、类型、可选适配占位 |
| `src/lib/policy.ts` | Data Policy |
| `src/lib/router.ts` | 策略门禁 + 一元/流式 |
| `src/app/api/mock/caps/*` | 各能力 mock |
| `src/components/console-app.tsx` | 控制台 |

## 技术栈

Next.js · TypeScript · Tailwind · shadcn/ui
