export {
  CAPABILITY_CATALOG,
  getCapabilitySpec,
  listCapabilityCatalog,
  type CapabilityId,
  type CapabilitySpec,
} from "@/lib/capabilities/catalog";

export type * from "@/lib/capabilities/types";

/**
 * 可选真实适配占位：
 * - llm.chat → OPENAI_BASE_URL + OPENAI_API_KEY（见 adapters/openai-compatible.ts）
 * - home.control → HA_BASE_URL + HA_TOKEN（见 adapters/home-assistant.ts）
 * 无环境变量时控制台与路由一律走 mock。
 */
export function hasOpenAiCompatibleConfig(): boolean {
  return Boolean(
    process.env.OPENAI_BASE_URL?.trim() && process.env.OPENAI_API_KEY?.trim(),
  );
}

export function hasHomeAssistantConfig(): boolean {
  return Boolean(
    process.env.HA_BASE_URL?.trim() && process.env.HA_TOKEN?.trim(),
  );
}
