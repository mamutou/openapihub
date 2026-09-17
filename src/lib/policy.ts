import { getStore } from "@/lib/store";
import type { DataPolicy, DataPolicyFlags } from "@/lib/types";

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
    streamOnlyRemote: override?.streamOnlyRemote ?? policy.streamOnlyRemote,
    retainPayloads: override?.retainPayloads ?? policy.retainPayloads,
    remoteRetainFiles: false,
  };
}

export function updateDataPolicy(
  patch: Partial<Omit<DataPolicyFlags, "remoteRetainFiles">> & {
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
    streamOnlyRemote:
      patch.streamOnlyRemote !== undefined
        ? Boolean(patch.streamOnlyRemote)
        : store.policy.streamOnlyRemote,
    retainPayloads:
      patch.retainPayloads !== undefined
        ? Boolean(patch.retainPayloads)
        : store.policy.retainPayloads,
    remoteRetainFiles: false,
    byCapability:
      patch.byCapability !== undefined
        ? { ...store.policy.byCapability, ...patch.byCapability }
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
