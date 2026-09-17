import { createId, getStore, nowIso } from "@/lib/store";
import type {
  Invocation,
  InvocationMode,
  InvocationStatus,
  Locality,
} from "@/lib/types";

const MAX_INVOCATIONS = 200;

export function listInvocations(limit = 50): Invocation[] {
  return getStore().invocations.slice(0, Math.max(1, limit));
}

export function recordInvocation(input: {
  backendId: string;
  backendName: string;
  capability: string;
  path: string;
  method: string;
  locality: Locality;
  mode: InvocationMode;
  retainPayloads: boolean;
  requestBody: unknown;
  status: InvocationStatus;
  httpStatus?: number;
  responseBody?: unknown;
  error?: string;
  errorCode?: string;
  durationMs: number;
}): Invocation {
  const payloadsRetained = input.retainPayloads;
  const responseSummary = payloadsRetained
    ? summarizeResponse(input.responseBody, input.httpStatus, input.error)
    : summarizeMetadata(input);

  const invocation: Invocation = {
    id: createId("inv"),
    backendId: input.backendId,
    backendName: input.backendName,
    capability: input.capability,
    path: input.path,
    method: input.method,
    locality: input.locality,
    mode: input.mode,
    payloadsRetained,
    status: input.status,
    httpStatus: input.httpStatus,
    responseSummary,
    error: input.error,
    errorCode: input.errorCode,
    createdAt: nowIso(),
    durationMs: input.durationMs,
    ...(payloadsRetained
      ? {
          requestBody: input.requestBody ?? null,
          responseBody: input.responseBody,
        }
      : {}),
  };

  const store = getStore();
  store.invocations.unshift(invocation);
  if (store.invocations.length > MAX_INVOCATIONS) {
    store.invocations.length = MAX_INVOCATIONS;
  }

  return invocation;
}

function summarizeMetadata(input: {
  status: InvocationStatus;
  httpStatus?: number;
  durationMs: number;
  error?: string;
  mode: InvocationMode;
  locality: Locality;
}): string {
  if (input.mode === "stream") {
    if (input.status === "success") {
      return `已流式输出到本地 · ${input.locality} · ${input.durationMs} ms · 未保留正文`;
    }
    return `流式失败 · ${input.error ?? "error"} · 未保留正文`;
  }
  if (input.status === "success") {
    return `成功 · HTTP ${input.httpStatus ?? 200} · ${input.durationMs} ms · 载荷未留存`;
  }
  return `失败 · ${input.error ?? `HTTP ${input.httpStatus ?? "—"}`} · 载荷未留存`;
}

export function summarizeResponse(
  body: unknown,
  httpStatus?: number,
  error?: string,
): string {
  if (error && body == null) return error;
  if (body == null) return `HTTP ${httpStatus ?? "—"}（空响应）`;
  if (typeof body === "string") {
    const trimmed = body.trim();
    return trimmed.length > 160
      ? `${trimmed.slice(0, 160)}…`
      : trimmed || `HTTP ${httpStatus ?? "—"}`;
  }
  try {
    const text = JSON.stringify(body);
    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  } catch {
    return `HTTP ${httpStatus ?? "—"}`;
  }
}
