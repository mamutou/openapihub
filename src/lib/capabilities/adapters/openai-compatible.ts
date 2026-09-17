/**
 * OpenAI 兼容 Chat Completions 适配占位。
 * 配置 OPENAI_BASE_URL + OPENAI_API_KEY 后，可由真实后端进程调用；
 * Hub 本切片不内嵌代理密钥调用，仅提供类型与探测，避免默认出网。
 */
import type { LlmChatRequest } from "@/lib/capabilities/types";

export function openaiCompatibleConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_BASE_URL?.trim() && process.env.OPENAI_API_KEY?.trim(),
  );
}

export function buildOpenAiChatPayload(req: LlmChatRequest) {
  return {
    model: req.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
    stream: true,
  };
}

export function openaiCompatibleEndpoint(): string | null {
  const base = process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/chat/completions`;
}
