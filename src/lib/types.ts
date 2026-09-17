export type Backend = {
  id: string;
  name: string;
  baseUrl: string;
  capabilities: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateBackendInput = {
  name: string;
  baseUrl: string;
  capabilities: string[];
  enabled?: boolean;
};

export type UpdateBackendInput = {
  name?: string;
  baseUrl?: string;
  capabilities?: string[];
  enabled?: boolean;
};

export type InvocationStatus = "success" | "error";

export type Invocation = {
  id: string;
  backendId: string;
  backendName: string;
  capability: string;
  path: string;
  method: string;
  requestBody: unknown;
  status: InvocationStatus;
  httpStatus?: number;
  responseSummary: string;
  responseBody?: unknown;
  error?: string;
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
