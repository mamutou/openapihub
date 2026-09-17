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
};

export type UpdateBackendInput = {
  name?: string;
  baseUrl?: string;
  capabilities?: string[];
  locality?: Locality;
  supportsStreaming?: boolean;
  enabled?: boolean;
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
};

export type InvokeRequest = {
  capability?: string;
  backendId?: string;
  path?: string;
  method?: string;
  body?: unknown;
};
