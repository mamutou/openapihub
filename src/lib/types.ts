export type Locality = "local" | "remote";

export type Backend = {
  id: string;
  name: string;
  baseUrl: string;
  capabilities: string[];
  locality: Locality;
  /** remote 在 streamOnlyRemote 下必须为 true */
  supportsStreaming: boolean;
  enabled: boolean;
  /** Optional link to a Device (hardware node) */
  deviceId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateBackendInput = {
  name: string;
  baseUrl: string;
  capabilities: string[];
  locality: Locality;
  supportsStreaming?: boolean;
  enabled?: boolean;
  deviceId?: string;
};

export type UpdateBackendInput = {
  name?: string;
  baseUrl?: string;
  capabilities?: string[];
  locality?: Locality;
  supportsStreaming?: boolean;
  enabled?: boolean;
  deviceId?: string | null;
};

export type DataPolicyFlags = {
  preferLocal: boolean;
  allowRemoteCompute: boolean;
  streamOnlyRemote: boolean;
  retainPayloads: boolean;
  /** 硬约束声明：远端不得保留文件 */
  remoteRetainFiles: false;
};

export type DataPolicy = DataPolicyFlags & {
  byCapability: Record<string, Partial<Omit<DataPolicyFlags, "remoteRetainFiles">>>;
};

export type InvocationStatus = "success" | "error";

export type InvocationMode = "unary" | "stream";

export type Invocation = {
  id: string;
  backendId: string;
  backendName: string;
  capability: string;
  path: string;
  method: string;
  locality: Locality;
  mode: InvocationMode;
  payloadsRetained: boolean;
  requestBody?: unknown;
  status: InvocationStatus;
  httpStatus?: number;
  responseSummary: string;
  responseBody?: unknown;
  error?: string;
  errorCode?: string;
  createdAt: string;
  durationMs: number;
  /** Optional scheduler explanation when capability-routed */
  scheduleReason?: string;
  deviceId?: string;
};

export type InvokeRequest = {
  capability?: string;
  backendId?: string;
  path?: string;
  method?: string;
  body?: unknown;
};

export type DeviceTransport = "http" | "mock";
export type DeviceDiscovery = "manual" | "mock";
export type DeviceStatus =
  | "online"
  | "offline"
  | "unhealthy"
  | "disabled"
  | "unplugged";

export type Device = {
  id: string;
  name: string;
  transport: DeviceTransport;
  baseUrl: string;
  status: DeviceStatus;
  lastSeen?: string;
  capabilities: string[];
  hardwareProfileId: string;
  /** Linked Backend used by router/scheduler */
  backendId?: string;
  discovery: DeviceDiscovery;
  /** Mock hot-plug: false = physically removed */
  pluggedIn: boolean;
  enabled: boolean;
  /** Soft latency hint for scoring (ms) */
  latencyHintMs: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateDeviceInput = {
  name: string;
  transport?: DeviceTransport;
  baseUrl: string;
  capabilities: string[];
  hardwareProfileId: string;
  discovery?: DeviceDiscovery;
  pluggedIn?: boolean;
  enabled?: boolean;
  latencyHintMs?: number;
  /** When true, auto-create + bind a Backend */
  bindBackend?: boolean;
};

export type UpdateDeviceInput = {
  name?: string;
  baseUrl?: string;
  capabilities?: string[];
  hardwareProfileId?: string;
  pluggedIn?: boolean;
  enabled?: boolean;
  latencyHintMs?: number;
  status?: DeviceStatus;
  backendId?: string | null;
};
