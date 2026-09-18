import { getHardwareProfile } from "@/lib/hardware/profiles";
import {
  createBackend,
  getBackend,
  updateBackend,
} from "@/lib/registry";
import {
  createId,
  getStore,
  nowIso,
  persistStore,
  STORE_SEED_VERSION,
} from "@/lib/store";
import type {
  CreateDeviceInput,
  Device,
  DeviceStatus,
  UpdateDeviceInput,
} from "@/lib/types";

/** Built-in mock devices — ids stable across restarts. */
export const MOCK_DEVICE_IDS = {
  npuStick: "dev_mock_npu_stick",
  edgeBox: "dev_mock_edge_box",
} as const;

export const MOCK_DEVICE_BACKEND_IDS = {
  npuStick: "bk_dev_npu_stick",
  edgeBox: "bk_dev_edge_box",
} as const;

function normalizeCapabilities(capabilities: string[]): string[] {
  return [...new Set(capabilities.map((c) => c.trim()).filter(Boolean))];
}

function deriveStatus(device: Pick<Device, "enabled" | "pluggedIn" | "status">): DeviceStatus {
  if (!device.pluggedIn) return "unplugged";
  if (!device.enabled) return "disabled";
  if (device.status === "unhealthy" || device.status === "offline") {
    return device.status;
  }
  return "online";
}

function syncLinkedBackend(device: Device): void {
  if (!device.backendId) return;
  const backend = getBackend(device.backendId);
  if (!backend) return;
  const profile = getHardwareProfile(device.hardwareProfileId);
  const enabled =
    device.pluggedIn &&
    device.enabled &&
    device.status === "online";
  updateBackend(device.backendId, {
    name: `${device.name}（设备）`,
    baseUrl: device.baseUrl,
    capabilities: device.capabilities,
    locality: profile?.suggestedLocality ?? backend.locality,
    supportsStreaming: profile?.supportsStreaming ?? backend.supportsStreaming,
    enabled,
    deviceId: device.id,
  });
}

export function listDevices(): Device[] {
  return [...getStore().devices.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export function getDevice(id: string): Device | undefined {
  return getStore().devices.get(id);
}

export function createDevice(input: CreateDeviceInput): Device {
  const name = input.name.trim();
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  const capabilities = normalizeCapabilities(input.capabilities);
  const profile = getHardwareProfile(input.hardwareProfileId);

  if (!name) throw new Error("设备名称不能为空");
  if (!baseUrl) throw new Error("baseUrl 不能为空");
  if (!profile) throw new Error("未知的 hardwareProfileId");
  if (capabilities.length === 0) {
    throw new Error("至少声明一个 capability");
  }

  const now = nowIso();
  const device: Device = {
    id: createId("dev"),
    name,
    transport: input.transport ?? "http",
    baseUrl,
    status: "online",
    lastSeen: now,
    capabilities,
    hardwareProfileId: input.hardwareProfileId,
    discovery: input.discovery ?? "manual",
    pluggedIn: input.pluggedIn !== false,
    enabled: input.enabled !== false,
    latencyHintMs:
      typeof input.latencyHintMs === "number" && input.latencyHintMs >= 0
        ? input.latencyHintMs
        : 40,
    createdAt: now,
    updatedAt: now,
  };
  device.status = deriveStatus(device);

  if (input.bindBackend !== false) {
    const backend = createBackend({
      name: `${device.name}（设备）`,
      baseUrl: device.baseUrl,
      capabilities: device.capabilities,
      locality: profile.suggestedLocality,
      supportsStreaming: profile.supportsStreaming,
      enabled:
        device.pluggedIn && device.enabled && device.status !== "unhealthy",
      deviceId: device.id,
    });
    device.backendId = backend.id;
  }

  getStore().devices.set(device.id, device);
  persistStore();
  return device;
}

export function updateDevice(id: string, input: UpdateDeviceInput): Device {
  const existing = getDevice(id);
  if (!existing) throw new Error("设备不存在");

  if (input.hardwareProfileId) {
    const profile = getHardwareProfile(input.hardwareProfileId);
    if (!profile) throw new Error("未知的 hardwareProfileId");
  }

  const next: Device = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    baseUrl:
      input.baseUrl !== undefined
        ? input.baseUrl.trim().replace(/\/+$/, "")
        : existing.baseUrl,
    capabilities:
      input.capabilities !== undefined
        ? normalizeCapabilities(input.capabilities)
        : existing.capabilities,
    hardwareProfileId:
      input.hardwareProfileId ?? existing.hardwareProfileId,
    pluggedIn:
      input.pluggedIn !== undefined ? Boolean(input.pluggedIn) : existing.pluggedIn,
    enabled:
      input.enabled !== undefined ? Boolean(input.enabled) : existing.enabled,
    latencyHintMs:
      input.latencyHintMs !== undefined
        ? Math.max(0, Number(input.latencyHintMs) || 0)
        : existing.latencyHintMs,
    backendId:
      input.backendId === null
        ? undefined
        : input.backendId !== undefined
          ? input.backendId
          : existing.backendId,
    updatedAt: nowIso(),
  };

  if (input.status !== undefined) {
    next.status = input.status;
  }
  next.status = deriveStatus({
    enabled: next.enabled,
    pluggedIn: next.pluggedIn,
    status: input.status ?? next.status,
  });

  if (!next.name) throw new Error("设备名称不能为空");
  if (!next.baseUrl) throw new Error("baseUrl 不能为空");
  if (next.capabilities.length === 0) {
    throw new Error("至少声明一个 capability");
  }

  getStore().devices.set(id, next);
  syncLinkedBackend(next);
  persistStore();
  return next;
}

export function deleteDevice(id: string): boolean {
  const device = getDevice(id);
  if (!device) return false;
  getStore().devices.delete(id);
  if (device.backendId) {
    try {
      updateBackend(device.backendId, { enabled: false, deviceId: null });
    } catch {
      /* backend may already be gone */
    }
  }
  persistStore();
  return true;
}

/** Record heartbeat / probe result without changing plug state. */
export function applyDeviceHealth(
  id: string,
  ok: boolean,
  detail?: { latencyHintMs?: number },
): Device {
  const existing = getDevice(id);
  if (!existing) throw new Error("设备不存在");
  if (!existing.pluggedIn) {
    return updateDevice(id, { status: "unplugged" });
  }
  if (!existing.enabled) {
    return updateDevice(id, { status: "disabled" });
  }
  const patch: UpdateDeviceInput = {
    status: ok ? "online" : "unhealthy",
  };
  if (detail?.latencyHintMs !== undefined) {
    patch.latencyHintMs = detail.latencyHintMs;
  }
  const next = updateDevice(id, patch);
  next.lastSeen = nowIso();
  getStore().devices.set(id, next);
  persistStore();
  return next;
}

export async function probeDeviceHealth(id: string): Promise<Device> {
  const device = getDevice(id);
  if (!device) throw new Error("设备不存在");
  if (!device.pluggedIn) {
    return applyDeviceHealth(id, false);
  }

  const healthUrl = `${device.baseUrl.replace(/\/+$/, "")}/health`;
  const started = Date.now();
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    const latency = Date.now() - started;
    if (!res.ok) return applyDeviceHealth(id, false, { latencyHintMs: latency });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      pluggedIn?: boolean;
    };
    if (body.pluggedIn === false) {
      return updateDevice(id, { pluggedIn: false, status: "unplugged" });
    }
    return applyDeviceHealth(id, body.ok !== false, { latencyHintMs: latency });
  } catch {
    return applyDeviceHealth(id, false);
  }
}

/**
 * Ensure mock plug-devices + linked backends exist.
 * Called alongside seedDefaultBackends.
 */
export function seedMockDevices(origin: string): void {
  const store = getStore();
  const base = origin.replace(/\/+$/, "");
  const now = nowIso();

  const npuUrl = `${base}/api/mock/hardware/npu-stick`;
  const edgeUrl = `${base}/api/mock/hardware/edge-box`;

  if (!store.devices.has(MOCK_DEVICE_IDS.npuStick)) {
    const npuProfile = getHardwareProfile("hp_mock_npu_stick")!;
    // Ensure stable backend id
    if (!store.backends.has(MOCK_DEVICE_BACKEND_IDS.npuStick)) {
      store.backends.set(MOCK_DEVICE_BACKEND_IDS.npuStick, {
        id: MOCK_DEVICE_BACKEND_IDS.npuStick,
        name: "Mock NPU Stick（设备）",
        baseUrl: npuUrl,
        capabilities: [...npuProfile.defaultCapabilities],
        locality: "local",
        supportsStreaming: true,
        enabled: true,
        deviceId: MOCK_DEVICE_IDS.npuStick,
        createdAt: now,
        updatedAt: now,
      });
    }
    store.devices.set(MOCK_DEVICE_IDS.npuStick, {
      id: MOCK_DEVICE_IDS.npuStick,
      name: "Mock NPU Stick",
      transport: "mock",
      baseUrl: npuUrl,
      status: "online",
      lastSeen: now,
      capabilities: [...npuProfile.defaultCapabilities],
      hardwareProfileId: "hp_mock_npu_stick",
      backendId: MOCK_DEVICE_BACKEND_IDS.npuStick,
      discovery: "mock",
      pluggedIn: true,
      enabled: true,
      latencyHintMs: 18,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const d = store.devices.get(MOCK_DEVICE_IDS.npuStick)!;
    if (d.baseUrl !== npuUrl) {
      d.baseUrl = npuUrl;
      d.updatedAt = now;
      store.devices.set(d.id, d);
      if (d.backendId && store.backends.has(d.backendId)) {
        const b = store.backends.get(d.backendId)!;
        b.baseUrl = npuUrl;
        b.updatedAt = now;
        store.backends.set(b.id, b);
      }
    }
  }

  if (!store.devices.has(MOCK_DEVICE_IDS.edgeBox)) {
    const edgeProfile = getHardwareProfile("hp_mock_edge_box")!;
    if (!store.backends.has(MOCK_DEVICE_BACKEND_IDS.edgeBox)) {
      store.backends.set(MOCK_DEVICE_BACKEND_IDS.edgeBox, {
        id: MOCK_DEVICE_BACKEND_IDS.edgeBox,
        name: "Mock Edge Box（设备）",
        baseUrl: edgeUrl,
        capabilities: [...edgeProfile.defaultCapabilities],
        locality: "local",
        supportsStreaming: true,
        enabled: true,
        deviceId: MOCK_DEVICE_IDS.edgeBox,
        createdAt: now,
        updatedAt: now,
      });
    }
    store.devices.set(MOCK_DEVICE_IDS.edgeBox, {
      id: MOCK_DEVICE_IDS.edgeBox,
      name: "Mock Edge Box",
      transport: "mock",
      baseUrl: edgeUrl,
      status: "online",
      lastSeen: now,
      capabilities: [...edgeProfile.defaultCapabilities],
      hardwareProfileId: "hp_mock_edge_box",
      backendId: MOCK_DEVICE_BACKEND_IDS.edgeBox,
      discovery: "mock",
      pluggedIn: true,
      enabled: true,
      latencyHintMs: 35,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const d = store.devices.get(MOCK_DEVICE_IDS.edgeBox)!;
    if (d.baseUrl !== edgeUrl) {
      d.baseUrl = edgeUrl;
      d.updatedAt = now;
      store.devices.set(d.id, d);
      if (d.backendId && store.backends.has(d.backendId)) {
        const b = store.backends.get(d.backendId)!;
        b.baseUrl = edgeUrl;
        b.updatedAt = now;
        store.backends.set(b.id, b);
      }
    }
  }

  // Keep seed version in sync when devices introduced
  if (store.seedVersion < STORE_SEED_VERSION) {
    store.seedVersion = STORE_SEED_VERSION;
  }
  persistStore();
}

export function isDeviceSchedulable(device: Device): boolean {
  return (
    device.pluggedIn &&
    device.enabled &&
    device.status === "online" &&
    Boolean(device.backendId)
  );
}
