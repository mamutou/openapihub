import type { Locality } from "@/lib/types";

/** Hardware compute class for scheduling. */
export type ComputeKind = "cpu" | "gpu" | "npu" | "other";

/**
 * Privacy affinity of a hardware profile.
 * local-only: must stay on device/Hub local path
 * edge: LAN / edge box ok
 * cloud-ok: may leave the premises (still subject to Hub remote stream gates)
 */
export type PrivacyTier = "local-only" | "edge" | "cloud-ok";

export type HardwareProfile = {
  id: string;
  nameZh: string;
  description: string;
  computeKind: ComputeKind;
  supportsStreaming: boolean;
  privacyTier: PrivacyTier;
  maxConcurrency: number;
  labels: string[];
  /** Capabilities this profile typically exposes */
  defaultCapabilities: string[];
  /** Hint locality for derived Backends */
  suggestedLocality: Locality;
};

export const HARDWARE_PROFILES: HardwareProfile[] = [
  {
    id: "hp_mock_npu_stick",
    nameZh: "NPU 加速棒（模拟）",
    description: "可插拔本地 NPU 推理棒；适合 llm.chat 流式本地推理。",
    computeKind: "npu",
    supportsStreaming: true,
    privacyTier: "local-only",
    maxConcurrency: 2,
    labels: ["usb", "mock", "npu"],
    defaultCapabilities: ["llm.chat"],
    suggestedLocality: "local",
  },
  {
    id: "hp_mock_edge_box",
    nameZh: "边缘小盒（模拟）",
    description: "局域网边缘盒；适合 echo / 文本等轻量能力。",
    computeKind: "cpu",
    supportsStreaming: true,
    privacyTier: "edge",
    maxConcurrency: 4,
    labels: ["edge", "mock", "lan"],
    defaultCapabilities: ["echo.message", "text.transform"],
    suggestedLocality: "local",
  },
  {
    id: "hp_generic_http",
    nameZh: "通用 HTTP 节点",
    description: "手动注册的 API 化硬件或守护进程。",
    computeKind: "other",
    supportsStreaming: true,
    privacyTier: "edge",
    maxConcurrency: 8,
    labels: ["manual", "http"],
    defaultCapabilities: [],
    suggestedLocality: "local",
  },
];

export function listHardwareProfiles(): HardwareProfile[] {
  return HARDWARE_PROFILES;
}

export function getHardwareProfile(
  id: string,
): HardwareProfile | undefined {
  return HARDWARE_PROFILES.find((p) => p.id === id);
}

/** Higher = more private / stricter stay-local preference. */
export function privacyTierRank(tier: PrivacyTier): number {
  switch (tier) {
    case "local-only":
      return 3;
    case "edge":
      return 2;
    case "cloud-ok":
      return 1;
    default:
      return 0;
  }
}
