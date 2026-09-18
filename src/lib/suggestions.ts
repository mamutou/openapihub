import {
  hasHomeAssistantConfig,
  hasOpenAiCompatibleConfig,
} from "@/lib/capabilities";
import type { CreateBackendInput, Locality } from "@/lib/types";

export type SuggestedBackend = CreateBackendInput & {
  reason: string;
};

function localityFromUrl(url: string): Locality {
  try {
    const host = new URL(url).hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    ) {
      return "local";
    }
  } catch {
    /* ignore */
  }
  return "remote";
}

/** Env-detected Backend presets — Hub still does not proxy secrets. */
export function listSuggestedBackends(): SuggestedBackend[] {
  const out: SuggestedBackend[] = [];

  if (hasOpenAiCompatibleConfig()) {
    const baseUrl = process.env.OPENAI_BASE_URL!.trim().replace(/\/+$/, "");
    const locality = localityFromUrl(baseUrl);
    out.push({
      name:
        locality === "local"
          ? "Ollama / 本地 OpenAI 兼容"
          : "OpenAI 兼容（远端）",
      baseUrl,
      capabilities: ["llm.chat"],
      locality,
      supportsStreaming: true,
      enabled: true,
      reason:
        "检测到 OPENAI_BASE_URL；密钥留在你的后端服务侧，Hub 不代持 OPENAI_API_KEY 转发。",
    });
  }

  if (hasHomeAssistantConfig()) {
    const baseUrl = process.env.HA_BASE_URL!.trim().replace(/\/+$/, "");
    out.push({
      name: "Home Assistant",
      baseUrl,
      capabilities: ["home.control"],
      locality: localityFromUrl(baseUrl),
      supportsStreaming: false,
      enabled: true,
      reason:
        "检测到 HA_BASE_URL；请在 HA 侧用长期令牌保护 API。Hub 注册的是 baseUrl，不代持 HA_TOKEN。",
    });
  }

  return out;
}
