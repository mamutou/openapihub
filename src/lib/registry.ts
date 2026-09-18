import {
  createId,
  getStore,
  nowIso,
  persistStore,
  STORE_SEED_VERSION,
} from "@/lib/store";
import { coerceLocalityForUrl } from "@/lib/locality";
import type {
  Backend,
  CreateBackendInput,
  Locality,
  UpdateBackendInput,
} from "@/lib/types";

/** Built-in mock backends: keep baseUrl in sync with current Hub origin. */
const MOCK_BACKEND_PATHS: Record<string, string> = {
  bk_local_echo: "/api/mock/local",
  bk_remote_echo: "/api/mock/remote",
  bk_mock_llm: "/api/mock/caps/llm",
  bk_mock_mail: "/api/mock/caps/mail",
  bk_mock_text: "/api/mock/caps/text",
  bk_mock_office: "/api/mock/caps/office",
  bk_mock_image: "/api/mock/caps/image",
  bk_mock_home: "/api/mock/caps/home",
};

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

function normalizeLocality(value: unknown): Locality {
  return value === "remote" ? "remote" : "local";
}

function buildDefaultBackends(origin: string, now: string): Backend[] {
  return [
    {
      id: "bk_local_echo",
      name: "本地 Echo（模拟）",
      baseUrl: `${origin}/api/mock/local`,
      capabilities: ["echo.message"],
      locality: "local",
      supportsStreaming: false,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bk_remote_echo",
      name: "远端 Echo（流式 · 模拟）",
      baseUrl: `${origin}/api/mock/remote`,
      capabilities: ["echo.message"],
      locality: "remote",
      supportsStreaming: true,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bk_mock_llm",
      name: "LLM Chat Mock（流式）",
      baseUrl: `${origin}/api/mock/caps/llm`,
      capabilities: ["llm.chat"],
      locality: "remote",
      supportsStreaming: true,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bk_mock_mail",
      name: "邮件 Mock",
      baseUrl: `${origin}/api/mock/caps/mail`,
      capabilities: ["mail.send"],
      locality: "local",
      supportsStreaming: false,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bk_mock_text",
      name: "文本处理 Mock",
      baseUrl: `${origin}/api/mock/caps/text`,
      capabilities: ["text.transform"],
      locality: "local",
      supportsStreaming: false,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bk_mock_office",
      name: "Office Mock",
      baseUrl: `${origin}/api/mock/caps/office`,
      capabilities: ["office.render"],
      locality: "local",
      supportsStreaming: false,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bk_mock_image",
      name: "作图 Mock（流式）",
      baseUrl: `${origin}/api/mock/caps/image`,
      capabilities: ["image.compose"],
      locality: "remote",
      supportsStreaming: true,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bk_mock_home",
      name: "家庭中心 Mock",
      baseUrl: `${origin}/api/mock/caps/home`,
      capabilities: ["home.control"],
      locality: "local",
      supportsStreaming: false,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function refreshMockOrigins(origin: string): boolean {
  const store = getStore();
  const now = nowIso();
  let changed = false;
  for (const [id, suffix] of Object.entries(MOCK_BACKEND_PATHS)) {
    const backend = store.backends.get(id);
    if (!backend) continue;
    const nextUrl = `${origin}${suffix}`;
    if (backend.baseUrl !== nextUrl) {
      store.backends.set(id, {
        ...backend,
        baseUrl: nextUrl,
        updatedAt: now,
      });
      changed = true;
    }
  }
  return changed;
}

/**
 * Ensure defaults exist. With file persistence, user backends survive restarts;
 * built-in mock IDs only get origin URL refresh (not wiped).
 */
export function seedDefaultBackends(origin: string): void {
  const store = getStore();
  const base = origin.replace(/\/+$/, "");

  if (store.seedVersion >= STORE_SEED_VERSION && store.backends.size > 0) {
    if (refreshMockOrigins(base)) persistStore();
    return;
  }

  // First boot or empty store after seed bump: install mocks without wiping
  // user-created backends (ids not in MOCK_BACKEND_PATHS).
  const now = nowIso();
  const defaults = buildDefaultBackends(base, now);
  for (const backend of defaults) {
    if (!store.backends.has(backend.id)) {
      store.backends.set(backend.id, backend);
    }
  }
  refreshMockOrigins(base);
  store.seedVersion = STORE_SEED_VERSION;
  persistStore();
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
  const declared = normalizeLocality(input.locality);
  const coercion = coerceLocalityForUrl(baseUrl, declared);
  const locality = coercion.locality;
  let supportsStreaming =
    input.supportsStreaming ?? locality === "remote";
  if (coercion.coerced) {
    // Public URL forced remote → must be stream-capable for P0
    supportsStreaming = true;
  }

  if (!name) throw new Error("后端名称不能为空");
  if (!baseUrl) throw new Error("baseUrl 不能为空");
  if (capabilities.length === 0) throw new Error("至少声明一个 capability");

  const now = nowIso();
  const backend: Backend = {
    id: createId("bk"),
    name,
    baseUrl,
    capabilities,
    locality,
    supportsStreaming,
    enabled: input.enabled ?? true,
    deviceId: input.deviceId,
    createdAt: now,
    updatedAt: now,
  };

  getStore().backends.set(backend.id, backend);
  persistStore();
  return backend;
}

export function updateBackend(
  id: string,
  input: UpdateBackendInput,
): Backend {
  const existing = getBackend(id);
  if (!existing) throw new Error("后端不存在");

  const baseUrl =
    input.baseUrl !== undefined
      ? normalizeBaseUrl(input.baseUrl)
      : existing.baseUrl;
  const declared =
    input.locality !== undefined
      ? normalizeLocality(input.locality)
      : existing.locality;
  const coercion = coerceLocalityForUrl(baseUrl, declared);
  const locality = coercion.locality;

  let supportsStreaming =
    input.supportsStreaming !== undefined
      ? Boolean(input.supportsStreaming)
      : existing.supportsStreaming;
  if (coercion.coerced) {
    supportsStreaming = true;
  }

  const next: Backend = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    baseUrl,
    capabilities:
      input.capabilities !== undefined
        ? normalizeCapabilities(input.capabilities)
        : existing.capabilities,
    locality,
    supportsStreaming,
    enabled: input.enabled ?? existing.enabled,
    deviceId:
      input.deviceId === null
        ? undefined
        : input.deviceId !== undefined
          ? input.deviceId
          : existing.deviceId,
    updatedAt: nowIso(),
  };

  if (!next.name) throw new Error("后端名称不能为空");
  if (!next.baseUrl) throw new Error("baseUrl 不能为空");
  if (next.capabilities.length === 0) {
    throw new Error("至少声明一个 capability");
  }

  getStore().backends.set(id, next);
  persistStore();
  return next;
}

export function deleteBackend(id: string): boolean {
  const ok = getStore().backends.delete(id);
  if (ok) persistStore();
  return ok;
}

export function findBackendsByCapability(capability: string): Backend[] {
  return listBackends().filter(
    (b) => b.enabled && b.capabilities.includes(capability),
  );
}
