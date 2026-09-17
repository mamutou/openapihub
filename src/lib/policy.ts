import { getStore } from "@/lib/store";
import type { DataPolicy, DataPolicyFlags } from "@/lib/types";

/**
 * streamOnlyRemote / remoteRetainFiles 为硬约束：API 不可关闭。
 * remote 算力可上云，但云路径不得一元攒全文。
 */
export const DEFAULT_DATA_POLICY: DataPolicy = {
  preferLocal: false,
  allowRemoteCompute: true,
  streamOnlyRemote: true,
  retainPayloads: false,
  remoteRetainFiles: false,
  byCapability: {},
};

export function getDataPolicy(): DataPolicy {
  return getStore().policy;
}

function scrubCapabilityOverrides(
  byCapability: DataPolicy["byCapability"],
): DataPolicy["byCapability"] {
  const next: DataPolicy["byCapability"] = {};
  for (const [key, value] of Object.entries(byCapability)) {
    if (!value || typeof value !== "object") continue;
    const rest = { ...value };
    delete rest.streamOnlyRemote;
    next[key] = rest;
  }
  return next;
}

export function resolvePolicy(capability?: string): DataPolicyFlags {
  const policy = getDataPolicy();
  const override =
    capability && policy.byCapability[capability]
      ? policy.byCapability[capability]
      : undefined;

  return {
    preferLocal: override?.preferLocal ?? policy.preferLocal,
    allowRemoteCompute:
      override?.allowRemoteCompute ?? policy.allowRemoteCompute,
    // Hard invariant — ignore overrides
    streamOnlyRemote: true,
    retainPayloads: override?.retainPayloads ?? policy.retainPayloads,
    remoteRetainFiles: false,
  };
}

export function updateDataPolicy(
  patch: Partial<Omit<DataPolicyFlags, "remoteRetainFiles" | "streamOnlyRemote">> & {
    streamOnlyRemote?: boolean;
    byCapability?: DataPolicy["byCapability"];
  },
): DataPolicy {
  const store = getStore();
  const next: DataPolicy = {
    ...store.policy,
    preferLocal:
      patch.preferLocal !== undefined
        ? Boolean(patch.preferLocal)
        : store.policy.preferLocal,
    allowRemoteCompute:
      patch.allowRemoteCompute !== undefined
        ? Boolean(patch.allowRemoteCompute)
        : store.policy.allowRemoteCompute,
    // Immutable hard gates
    streamOnlyRemote: true,
    retainPayloads:
      patch.retainPayloads !== undefined
        ? Boolean(patch.retainPayloads)
        : store.policy.retainPayloads,
    remoteRetainFiles: false,
    byCapability:
      patch.byCapability !== undefined
        ? scrubCapabilityOverrides({
            ...store.policy.byCapability,
            ...patch.byCapability,
          })
        : store.policy.byCapability,
  };
  store.policy = next;
  return next;
}

export class PolicyError extends Error {
  readonly code = "POLICY_VIOLATION";

  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}
