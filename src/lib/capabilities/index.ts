export {
  CAPABILITY_CATALOG,
  getCapabilitySpec,
  listCapabilityCatalog,
  type CapabilityId,
  type CapabilitySpec,
} from "@/lib/capabilities/catalog";

export type * from "@/lib/capabilities/types";

/**
 * 可选真实适配占位（仅探测环境变量，Hub 不会代发）：
 * - llm.chat → OPENAI_BASE_URL + OPENAI_API_KEY
 * - home.control → HA_BASE_URL + HA_TOKEN
 * 无 env 或有 env 时，默认调用链仍走已注册 Backend / mock。
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
