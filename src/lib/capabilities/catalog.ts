import type { Locality } from "@/lib/types";

export type CapabilityId =
  | "echo.message"
  | "llm.chat"
  | "mail.send"
  | "text.transform"
  | "office.render"
  | "image.compose"
  | "home.control"
  | "browser.open"
  | "browser.extract"
  | "browser.screenshot";

export type CapabilitySpec = {
  id: CapabilityId;
  nameZh: string;
  description: string;
  /** 是否通常需要端侧软硬件 / 外部服务 */
  requiresEdge: boolean;
  edgeHint: string;
  suggestedLocality: Locality | "either";
  /** 该能力禁止一元调用（含 local），必须走 /api/invoke/stream */
  streamRequired: boolean;
  /** 一元 / 非流式默认 path */
  defaultPath: string;
  /** 流式默认 path（缺省则用 defaultPath） */
  defaultStreamPath?: string;
  sampleBody: Record<string, unknown>;
};

/** 标准能力目录（控制台与路由共用） */
export const CAPABILITY_CATALOG: CapabilitySpec[] = [
  {
    id: "echo.message",
    nameZh: "Echo 演示",
    description: "往返回显，用于验证路由与隐私策略。",
    requiresEdge: false,
    edgeHint: "内置 mock 即可，无需端侧。",
    suggestedLocality: "either",
    streamRequired: false,
    defaultPath: "/echo",
    defaultStreamPath: "/echo/stream",
    sampleBody: { message: "OpenAPIHub 你好" },
  },
  {
    id: "llm.chat",
    nameZh: "大模型对话",
    description: "对话补全；remote 必须流式输出到本地收看。",
    requiresEdge: true,
    edgeHint: "需本地 Ollama 或 OpenAI 兼容 API（OPENAI_BASE_URL / OPENAI_API_KEY）。无密钥时用 mock。",
    suggestedLocality: "either",
    streamRequired: true,
    defaultPath: "/chat/stream",
    defaultStreamPath: "/chat/stream",
    sampleBody: {
      messages: [{ role: "user", content: "用一句话介绍 OpenAPIHub" }],
    },
  },
  {
    id: "mail.send",
    nameZh: "发送邮件",
    description: "通过 SMTP / 邮件 API 或本地代理发信。",
    requiresEdge: true,
    edgeHint: "需 SMTP 凭证或本地邮件代理；本切片提供 mock 回执。",
    suggestedLocality: "local",
    streamRequired: false,
    defaultPath: "/send",
    sampleBody: {
      to: "you@example.com",
      subject: "OpenAPIHub 试调",
      text: "这是一封 mock 邮件。",
    },
  },
  {
    id: "text.transform",
    nameZh: "文本处理",
    description: "摘要 / 改写 / 翻译等，用 op 字段区分。",
    requiresEdge: false,
    edgeHint: "可在 Hub 内完成，或转发到 LLM 后端。",
    suggestedLocality: "local",
    streamRequired: false,
    defaultPath: "/transform",
    sampleBody: {
      op: "summarize",
      text: "OpenAPIHub 把任意 API 化软件接入统一调用，输出留在本地。",
    },
  },
  {
    id: "office.render",
    nameZh: "Office 文档",
    description: "文档元数据与文本抽取（真实模式可接 LibreOffice 等）。",
    requiresEdge: true,
    edgeHint: "真实模式需 LibreOffice / 文档服务；当前为元数据+抽取 mock。",
    suggestedLocality: "local",
    streamRequired: false,
    defaultPath: "/render",
    sampleBody: {
      filename: "brief.docx",
      action: "extract_text",
    },
  },
  {
    id: "image.compose",
    nameZh: "模块化作图",
    description: "图层 / 模板合成；remote 生成须流式回传。",
    requiresEdge: true,
    edgeHint: "需本地画图引擎或远端生成服务；mock 流式描述合成过程。",
    suggestedLocality: "either",
    streamRequired: true,
    defaultPath: "/compose/stream",
    defaultStreamPath: "/compose/stream",
    sampleBody: {
      template: "poster",
      layers: [{ type: "text", content: "OpenAPIHub" }],
    },
  },
  {
    id: "home.control",
    nameZh: "家庭中心",
    description: "灯 / 开关 / 场景等设备读写。",
    requiresEdge: true,
    edgeHint: "需 Home Assistant 或硬件网关（HA_BASE_URL / HA_TOKEN 占位）；无配置时用 mock。",
    suggestedLocality: "local",
    streamRequired: false,
    defaultPath: "/control",
    sampleBody: {
      entityId: "light.living_room",
      action: "turn_on",
    },
  },
  {
    id: "browser.open",
    nameZh: "打开网页",
    description: "打开 URL，返回标题 / 最终地址 / HTTP 状态（需浏览器引擎或远程 browser 服务）。",
    requiresEdge: true,
    edgeHint: "真实模式接 Playwright/Puppeteer HTTP 服务为 Backend；无服务时用 mock。",
    suggestedLocality: "local",
    streamRequired: false,
    defaultPath: "/open",
    sampleBody: {
      url: "https://example.com",
    },
  },
  {
    id: "browser.extract",
    nameZh: "抽取网页",
    description: "抽取页面可见文本或简易 DOM 摘要。",
    requiresEdge: true,
    edgeHint: "同上；mock 返回假文本。默认不落正文。",
    suggestedLocality: "local",
    streamRequired: false,
    defaultPath: "/extract",
    sampleBody: {
      url: "https://example.com",
      maxChars: 800,
    },
  },
  {
    id: "browser.screenshot",
    nameZh: "网页截图",
    description: "截取页面；返回元数据与可选 base64。建议 local；公网 Backend 须遵守 remote 流式硬门。",
    requiresEdge: true,
    edgeHint: "真实模式由浏览器服务出图；mock 返回占位 PNG。base64 仅在 retainPayloads=true 时进入历史。",
    suggestedLocality: "local",
    streamRequired: false,
    defaultPath: "/screenshot",
    sampleBody: {
      url: "https://example.com",
      fullPage: false,
      includeBase64: true,
    },
  },
];

export function getCapabilitySpec(
  id: string,
): CapabilitySpec | undefined {
  return CAPABILITY_CATALOG.find((c) => c.id === id);
}

export function listCapabilityCatalog(): CapabilitySpec[] {
  return CAPABILITY_CATALOG;
}

/** Catalog-driven path: stream mode prefers defaultStreamPath */
export function resolveCapabilityPath(
  capabilityId: string,
  mode: "unary" | "stream",
): string | undefined {
  const spec = getCapabilitySpec(capabilityId);
  if (!spec) return undefined;
  if (mode === "stream") {
    return spec.defaultStreamPath ?? spec.defaultPath;
  }
  return spec.defaultPath;
}
