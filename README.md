# OpenAPIHub

统一的软件 API 调用与结果输出中枢：注册任意 API 化软件（本地或远端），按能力路由调用，并集中查看结果。

## 本版能力（MVP）

- **后端注册表**：创建 / 列表 / 启停 / 删除（name、baseUrl、capabilities、enabled）
- **统一调用**：`POST /api/invoke`，按 `capability` 或 `backendId` 转发到目标后端
- **结果中心**：记录每次调用的状态、耗时与响应摘要
- **控制台 UI**：管理后端、试调、查看结果（含空 / 加载 / 错误状态）
- **内置 mock**：本地风格与远端风格各一个，共享能力 `echo.message`

内存存储，无鉴权、无数据库。

## 本地运行

```bash
npm install
npm run dev -- --port 43127
```

打开 [http://127.0.0.1:43127](http://127.0.0.1:43127)。

## 快速试调

1. 打开控制台，确认已预置「本地 Echo」与「远端 Echo」
2. 在「统一调用」中选择「指定后端」，切换两个后端发起同一请求
3. 在「结果中心」查看调用记录与响应摘要

### API 示例

```bash
# 列出后端
curl http://127.0.0.1:43127/api/backends

# 按能力调用
curl -X POST http://127.0.0.1:43127/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{"capability":"echo.message","path":"/echo","body":{"message":"hello"}}'

# 指定后端调用
curl -X POST http://127.0.0.1:43127/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{"backendId":"bk_remote_echo","path":"/echo","body":{"message":"hello"}}'

# 调用历史
curl http://127.0.0.1:43127/api/invocations
```

## 模块边界

| 模块 | 路径 | 职责 |
|------|------|------|
| registry | `src/lib/registry.ts` | 后端 CRUD / 能力查找 |
| router | `src/lib/router.ts` | 统一转发与错误记录 |
| invocations | `src/lib/invocations.ts` | 调用历史 |
| mock | `src/app/api/mock/*` | 本地 / 远端模拟后端 |
| UI | `src/components/console-app.tsx` | 控制台 |

## 技术栈

Next.js · TypeScript · Tailwind CSS · shadcn/ui
