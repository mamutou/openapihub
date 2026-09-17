import type { Backend, DataPolicy, Invocation } from "@/lib/types";
import { DEFAULT_DATA_POLICY } from "@/lib/policy";

/** Bump when seed shape / privacy defaults / capability mocks change */
export const STORE_SEED_VERSION = 4;

type Store = {
  backends: Map<string, Backend>;
  invocations: Invocation[];
  policy: DataPolicy;
  seedVersion: number;
};

const globalForStore = globalThis as typeof globalThis & {
  __openapihubStore?: Store;
};

function createStore(): Store {
  return {
    backends: new Map(),
    invocations: [],
    policy: {
      ...DEFAULT_DATA_POLICY,
      byCapability: {},
      remoteRetainFiles: false,
    },
    seedVersion: 0,
  };
}

export function getStore(): Store {
  if (!globalForStore.__openapihubStore) {
    globalForStore.__openapihubStore = createStore();
  }
  // Hot-reload: reset policy defaults when seed version lags
  const store = globalForStore.__openapihubStore;
  if (store.seedVersion < STORE_SEED_VERSION) {
    store.policy = {
      ...DEFAULT_DATA_POLICY,
      byCapability: {},
      remoteRetainFiles: false,
    };
  }
  return store;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

/** Test-only: wipe in-memory state */
export function resetStoreForTests(): void {
  globalForStore.__openapihubStore = createStore();
}
