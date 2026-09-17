import type { Backend, Invocation } from "@/lib/types";

type Store = {
  backends: Map<string, Backend>;
  invocations: Invocation[];
  seeded: boolean;
};

const globalForStore = globalThis as typeof globalThis & {
  __openapihubStore?: Store;
};

function createStore(): Store {
  return {
    backends: new Map(),
    invocations: [],
    seeded: false,
  };
}

export function getStore(): Store {
  if (!globalForStore.__openapihubStore) {
    globalForStore.__openapihubStore = createStore();
  }
  return globalForStore.__openapihubStore;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
