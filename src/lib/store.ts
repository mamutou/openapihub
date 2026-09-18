import type { Backend, DataPolicy, Device, Invocation } from "@/lib/types";
import { DEFAULT_DATA_POLICY } from "@/lib/policy";
import {
  persistEnabled,
  readPersistedState,
  writePersistedState,
  type PersistedHubState,
} from "@/lib/persist";

/** Bump when seed shape / privacy defaults / capability mocks / devices change */
export const STORE_SEED_VERSION = 6;

type Store = {
  backends: Map<string, Backend>;
  devices: Map<string, Device>;
  invocations: Invocation[];
  policy: DataPolicy;
  seedVersion: number;
};

const globalForStore = globalThis as typeof globalThis & {
  __openapihubStore?: Store;
  __openapihubHydrated?: boolean;
};

function defaultPolicy(): DataPolicy {
  return {
    ...DEFAULT_DATA_POLICY,
    byCapability: {},
    remoteRetainFiles: false,
    streamOnlyRemote: true,
  };
}

function createStore(): Store {
  return {
    backends: new Map(),
    devices: new Map(),
    invocations: [],
    policy: defaultPolicy(),
    seedVersion: 0,
  };
}

function sanitizePolicy(policy: DataPolicy | undefined): DataPolicy {
  const base = defaultPolicy();
  if (!policy || typeof policy !== "object") return base;
  return {
    preferLocal: Boolean(policy.preferLocal),
    allowRemoteCompute: policy.allowRemoteCompute !== false,
    streamOnlyRemote: true,
    retainPayloads: Boolean(policy.retainPayloads),
    remoteRetainFiles: false,
    byCapability:
      policy.byCapability && typeof policy.byCapability === "object"
        ? policy.byCapability
        : {},
  };
}

/** Strip bodies unless retainPayloads for disk safety. */
function sanitizeInvocationForDisk(inv: Invocation): Invocation {
  if (inv.payloadsRetained) return inv;
  return {
    id: inv.id,
    backendId: inv.backendId,
    backendName: inv.backendName,
    capability: inv.capability,
    path: inv.path,
    method: inv.method,
    locality: inv.locality,
    mode: inv.mode,
    payloadsRetained: inv.payloadsRetained,
    status: inv.status,
    httpStatus: inv.httpStatus,
    responseSummary: inv.responseSummary,
    error: inv.error,
    errorCode: inv.errorCode,
    createdAt: inv.createdAt,
    durationMs: inv.durationMs,
    scheduleReason: inv.scheduleReason,
    deviceId: inv.deviceId,
  };
}

function hydrateFromDisk(store: Store): void {
  const disk = readPersistedState();
  if (!disk) return;
  store.seedVersion = disk.seedVersion ?? 0;
  store.policy = sanitizePolicy(disk.policy);
  store.backends = new Map(
    (disk.backends ?? []).filter((b) => b?.id).map((b) => [b.id, b]),
  );
  store.devices = new Map(
    (disk.devices ?? []).filter((d) => d?.id).map((d) => [d.id, d]),
  );
  store.invocations = (disk.invocations ?? []).map(sanitizeInvocationForDisk);
}

export function getStore(): Store {
  if (!globalForStore.__openapihubStore) {
    globalForStore.__openapihubStore = createStore();
  }
  const store = globalForStore.__openapihubStore;

  if (!globalForStore.__openapihubHydrated) {
    globalForStore.__openapihubHydrated = true;
    if (persistEnabled()) {
      hydrateFromDisk(store);
    }
  }

  // Hot-reload / seed bump: harden policy flags without wiping backends
  if (store.seedVersion < STORE_SEED_VERSION) {
    store.policy = {
      ...sanitizePolicy(store.policy),
      streamOnlyRemote: true,
      remoteRetainFiles: false,
    };
  }

  return store;
}

export function persistStore(): void {
  if (!persistEnabled()) return;
  const store = getStore();
  const payload: PersistedHubState = {
    version: 1,
    seedVersion: store.seedVersion,
    policy: sanitizePolicy(store.policy),
    backends: [...store.backends.values()],
    devices: [...store.devices.values()],
    invocations: store.invocations.map(sanitizeInvocationForDisk),
  };
  writePersistedState(payload);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

/** Test-only: wipe in-memory state. Pass rehydrate to re-read disk on next getStore. */
export function resetStoreForTests(opts?: { rehydrate?: boolean }): void {
  globalForStore.__openapihubStore = createStore();
  globalForStore.__openapihubHydrated = opts?.rehydrate ? false : true;
}
