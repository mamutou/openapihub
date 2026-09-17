import {
  createId,
  getStore,
  nowIso,
  STORE_SEED_VERSION,
} from "@/lib/store";
import type {
  Backend,
  CreateBackendInput,
  Locality,
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

function normalizeLocality(value: unknown): Locality {
  return value === "remote" ? "remote" : "local";
}

export function seedDefaultBackends(origin: string): void {
  const store = getStore();
  if (store.seedVersion >= STORE_SEED_VERSION) return;

  store.backends.clear();
  // Keep invocation history across seed upgrades / HMR module reloads
  const now = nowIso();
  const defaults: Backend[] = [
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

  for (const backend of defaults) {
    store.backends.set(backend.id, backend);
  }
  store.seedVersion = STORE_SEED_VERSION;
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
  const locality = normalizeLocality(input.locality);
  const supportsStreaming =
    input.supportsStreaming ?? locality === "remote";

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

  const locality =
    input.locality !== undefined
      ? normalizeLocality(input.locality)
      : existing.locality;

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
    locality,
    supportsStreaming:
      input.supportsStreaming !== undefined
        ? Boolean(input.supportsStreaming)
        : existing.supportsStreaming,
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
