import { createId, getStore, nowIso } from "@/lib/store";
import type { Invocation, InvocationStatus } from "@/lib/types";

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
  requestBody: unknown;
  status: InvocationStatus;
  httpStatus?: number;
  responseSummary: string;
  responseBody?: unknown;
  error?: string;
  durationMs: number;
}): Invocation {
  const invocation: Invocation = {
    id: createId("inv"),
    ...input,
    createdAt: nowIso(),
  };

  const store = getStore();
  store.invocations.unshift(invocation);
  if (store.invocations.length > MAX_INVOCATIONS) {
    store.invocations.length = MAX_INVOCATIONS;
  }

  return invocation;
}

export function summarizeResponse(body: unknown, httpStatus: number): string {
  if (body == null) return `HTTP ${httpStatus}（空响应）`;
  if (typeof body === "string") {
    const trimmed = body.trim();
    return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed || `HTTP ${httpStatus}`;
  }
  try {
    const text = JSON.stringify(body);
    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  } catch {
    return `HTTP ${httpStatus}`;
  }
}
