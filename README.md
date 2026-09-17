# OpenAPIHub

统一的软件 API 调用与结果输出中枢。**算力可以上云；输出在本地；云端不留文件；remote 只走 API 流式。**

## 隐私模型（默认）

| 字段 | 默认 | 含义 |
|------|------|------|
| `preferLocal` | `false` | 可优先 local，**不禁止** remote |
| `allowRemoteCompute` | `true` | 允许把算力路由到云端 |
| `streamOnlyRemote` | `true` | remote 必须流式；非流式 remote 拒绝 |
| `retainPayloads` | `false` | Hub 历史只留元数据，不落正文 |
| `remoteRetainFiles` | `false` | 硬约束：远端不得保留文件（请求头告知） |

旧版「默认禁止离境」已废弃。隐私边界是**输出与落盘在本地**，不是禁止云算力。

## 本版能力

- 后端注册：`locality` + `supportsStreaming`
- Data Policy：`GET/PATCH /api/policy`
- 一元调用：`POST /api/invoke`（local；remote 在 streamOnly 下 403）
- 流式调用：`POST /api/invoke/stream`（代理 SSE，边收边转本地；默认不持久化 chunk）
- 结果中心：元数据；流式显示「已流式输出到本地 · 未保留正文」
- Mock：local 一元；remote **仅** `/echo/stream` 流式

## 本地运行

```bash
npm install
npm run dev
```

端口 `43127` → [http://127.0.0.1:43127](http://127.0.0.1:43127) 或 [http://localhost:43127](http://localhost:43127)（推荐用 `localhost`，避免部分环境下 HMR 告警）。


## 演示：云算力 + 本地流式收看 + 无正文落盘

```bash
# 1) 策略应为 allowRemoteCompute=true, retainPayloads=false
curl http://127.0.0.1:43127/api/policy

# 2) remote 一元会被拒绝
curl -i -X POST http://127.0.0.1:43127/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{"backendId":"bk_remote_echo","path":"/echo","body":{"message":"no"}}'

# 3) 流式：边收边在控制台显示；Hub 只记元数据
curl -N -X POST http://127.0.0.1:43127/api/invoke/stream \
  -H 'Content-Type: application/json' \
  -d '{"backendId":"bk_remote_echo","body":{"message":"hello cloud"}}'

# 4) 历史无正文
curl http://127.0.0.1:43127/api/invocations
```

控制台：指定「远端 Echo（流式）」→ 点「流式调用」→ 看「本地实时收看」→ 结果中心摘要含「未保留正文」。

## 模块

| 路径 | 职责 |
|------|------|
| `src/lib/policy.ts` | Data Policy |
| `src/lib/router.ts` | 策略门禁 + 一元/流式准备 |
| `src/app/api/invoke/stream` | SSE 代理到本地 |
| `src/app/api/mock/remote/echo/stream` | 远端流式 mock |
| `src/components/console-app.tsx` | 控制台 |

## 技术栈

Next.js · TypeScript · Tailwind · shadcn/ui
