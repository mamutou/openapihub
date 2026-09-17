import {
  createId,
  getStore,
  nowIso,
} from "@/lib/store";
import type {
  Backend,
  CreateBackendInput,
  UpdateBackendInput,
} from "@/lib/types";

function normalizeCapabilities(capabilities: string[]): string[] {
  return [
    ...new Set(
      capabilities
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function seedDefaultBackends(origin: string): void {
  const store = getStore();
  if (store.seeded) return;

  const now = nowIso();
  const defaults: Backend[] = [
    {
      id: "bk_local_echo",
      name: "本地 Echo（模拟）",
      baseUrl: `${origin}/api/mock/local`,
      capabilities: ["echo.message"],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bk_remote_echo",
      name: "远端 Echo（模拟）",
      baseUrl: `${origin}/api/mock/remote`,
      capabilities: ["echo.message"],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const backend of defaults) {
    store.backends.set(backend.id, backend);
  }
  store.seeded = true;
}

export function listBackends(): Backend[] {
  return [...getStore().backends.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export function getBackend(id: string): Backend | undefined {
  return getStore().backends.get(id);
}

export function createBackend(input: CreateBackendInput): Backend {
  const name = input.name.trim();
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const capabilities = normalizeCapabilities(input.capabilities);

  if (!name) throw new Error("后端名称不能为空");
  if (!baseUrl) throw new Error("baseUrl 不能为空");
  if (capabilities.length === 0) throw new Error("至少声明一个 capability");

  const now = nowIso();
  const backend: Backend = {
    id: createId("bk"),
    name,
    baseUrl,
    capabilities,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };

  getStore().backends.set(backend.id, backend);
  return backend;
}

export function updateBackend(
  id: string,
  input: UpdateBackendInput,
): Backend {
  const existing = getBackend(id);
  if (!existing) throw new Error("后端不存在");

  const next: Backend = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    baseUrl:
      input.baseUrl !== undefined
        ? normalizeBaseUrl(input.baseUrl)
        : existing.baseUrl,
    capabilities:
      input.capabilities !== undefined
        ? normalizeCapabilities(input.capabilities)
        : existing.capabilities,
    enabled: input.enabled ?? existing.enabled,
    updatedAt: nowIso(),
  };

  if (!next.name) throw new Error("后端名称不能为空");
  if (!next.baseUrl) throw new Error("baseUrl 不能为空");
  if (next.capabilities.length === 0) {
    throw new Error("至少声明一个 capability");
  }

  getStore().backends.set(id, next);
  return next;
}

export function deleteBackend(id: string): boolean {
  return getStore().backends.delete(id);
}

export function findBackendsByCapability(capability: string): Backend[] {
  return listBackends().filter(
    (b) => b.enabled && b.capabilities.includes(capability),
  );
}
