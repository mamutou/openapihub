/** 各标准能力的请求/响应形状；真实后端只需符合这些类型并注册 baseUrl */

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmChatRequest = {
  messages: LlmChatMessage[];
  model?: string;
  temperature?: number;
};

export type LlmChatUnaryResponse = {
  content: string;
  model?: string;
  finishReason?: string;
};

/** SSE token 事件：{ token: string } / 结束 { done: true } */

export type MailSendRequest = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export type MailSendResponse = {
  messageId: string;
  accepted: boolean;
  mock?: boolean;
};

export type TextTransformOp =
  | "summarize"
  | "rewrite"
  | "translate"
  | "uppercase"
  | "lowercase";

export type TextTransformRequest = {
  op: TextTransformOp | string;
  text: string;
  targetLang?: string;
};

export type TextTransformResponse = {
  op: string;
  result: string;
};

export type OfficeRenderRequest = {
  filename: string;
  action?: "metadata" | "extract_text";
  /** 可选：base64 片段占位，mock 不真正解析 */
  contentBase64?: string;
};

export type OfficeRenderResponse = {
  filename: string;
  mimeHint: string;
  pages?: number;
  textPreview: string;
  mock: true;
};

export type ImageComposeLayer = {
  type: "text" | "shape" | "image";
  content?: string;
};

export type ImageComposeRequest = {
  template: string;
  layers: ImageComposeLayer[];
  width?: number;
  height?: number;
};

/** 流式：token 描述合成进度；结束含 compositionId */

export type HomeControlRequest = {
  entityId: string;
  action: "turn_on" | "turn_off" | "toggle" | "set" | string;
  value?: string | number | boolean;
};

export type HomeControlResponse = {
  entityId: string;
  state: string;
  mock: boolean;
  source: "mock" | "home-assistant";
};
