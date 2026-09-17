import {
  findBackendsByCapability,
  getBackend,
} from "@/lib/registry";
import { getCapabilitySpec } from "@/lib/capabilities/catalog";
import {
  UNARY_TIMEOUT_MS,
  abortErrorMessage,
  createTimeoutSignal,
  isAbortError,
} from "@/lib/http";
import { recordInvocation } from "@/lib/invocations";
import { PolicyError, resolvePolicy } from "@/lib/policy";
import type {
  Backend,
  DataPolicyFlags,
  Invocation,
  InvokeRequest,
} from "@/lib/types";

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function assertRemoteComputeAllowed(
  backend: Backend,
  allowRemoteCompute: boolean,
): void {
  if (backend.locality === "remote" && !allowRemoteCompute) {
    throw new PolicyError(
      `当前策略关闭了云端算力（allowRemoteCompute=false），无法路由到 remote 后端「${backend.name}」`,
    );
  }
}

/** Hard gate: remote never unary-buffered, regardless of policy toggles. */
export function assertRemoteUnaryForbidden(backend: Backend): void {
  if (backend.locality === "remote") {
    throw new PolicyError(
      `remote 后端「${backend.name}」只能走流式调用 POST /api/invoke/stream（硬约束：禁止一元缓冲云端输出）`,
    );
  }
}

function pickPreferred(matches: Backend[], preferLocal: boolean): Backend {
  if (!preferLocal) return matches[0];
  return matches.find((b) => b.locality === "local") ?? matches[0];
}

export function resolveBackendForPolicy(
  request: InvokeRequest,
  flags: DataPolicyFlags,
  opts?: { streaming?: boolean },
): Backend {
  const streaming = opts?.streaming ?? false;

  if (request.backendId) {
    const backend = getBackend(request.backendId);
    if (!backend) throw new Error("指定的后端不存在");
    if (!backend.enabled) throw new Error("指定的后端已停用");
    if (
      request.capability &&
      !backend.capabilities.includes(request.capability)
    ) {
      throw new Error(
        `后端「${backend.name}」不支持能力 ${request.capability}`,
      );
    }
    assertRemoteComputeAllowed(backend, flags.allowRemoteCompute);
    if (streaming) {
      if (backend.locality === "remote" && !backend.supportsStreaming) {
        throw new PolicyError(
          `remote 后端「${backend.name}」未声明 supportsStreaming，无法流式调用`,
        );
      }
    } else {
      assertRemoteUnaryForbidden(backend);
    }
    return backend;
  }

  if (!request.capability) {
    throw new Error("请提供 capability 或 backendId");
  }

  let matches = findBackendsByCapability(request.capability);
  if (matches.length === 0) {
    throw new Error(`没有已启用的后端支持能力 ${request.capability}`);
  }

  if (!flags.allowRemoteCompute) {
    matches = matches.filter((b) => b.locality === "local");
    if (matches.length === 0) {
      throw new PolicyError(
        `allowRemoteCompute=false，能力 ${request.capability} 没有可用的 local 后端`,
      );
    }
  }

  if (streaming) {
    const streamable = matches.filter(
      (b) => b.locality === "local" || b.supportsStreaming,
    );
    if (streamable.length === 0) {
      throw new PolicyError(
        `没有支持流式的后端可用于能力 ${request.capability}`,
      );
    }
    matches = streamable;
  } else {
    // Unary: local only (remote hard-forbidden)
    const unaryOk = matches.filter((b) => b.locality === "local");
    if (unaryOk.length === 0) {
      throw new PolicyError(
        `能力 ${request.capability} 仅有 remote 后端；请改用 POST /api/invoke/stream（remote 禁止一元缓冲）`,
      );
    }
    matches = unaryOk;
  }

  return pickPreferred(matches, flags.preferLocal);
}

function capabilityForPolicy(request: InvokeRequest): string | undefined {
  if (request.capability) return request.capability;
  if (request.backendId) {
    return getBackend(request.backendId)?.capabilities[0];
  }
  return undefined;
}

export function policyHeaders(flags: DataPolicyFlags): Record<string, string> {
  return {
    "X-OpenAPIHub-Remote-Retain-Files": flags.remoteRetainFiles ? "true" : "false",
    "X-OpenAPIHub-Ephemeral": "true",
  };
}

/** 非流式调用：仅 local；remote 硬拒绝 */
export async function routeInvoke(
  request: InvokeRequest,
  opts?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<{ invocation: Invocation; data: unknown }> {
  const policyFlags = resolvePolicy(capabilityForPolicy(request));
  const backend = resolveBackendForPolicy(request, policyFlags, {
    streaming: false,
  });
  const capability =
    request.capability ?? backend.capabilities[0] ?? "unknown";
  const effectiveFlags = resolvePolicy(capability);
  assertRemoteComputeAllowed(backend, effectiveFlags.allowRemoteCompute);
  assertRemoteUnaryForbidden(backend);

  const path =
    request.path?.trim() ||
    getCapabilitySpec(capability)?.defaultPath ||
    "/echo";
  const method = (request.method ?? "POST").toUpperCase();
  const targetUrl = joinUrl(backend.baseUrl, path);
  const started = Date.now();
  const timeoutMs = opts?.timeoutMs ?? UNARY_TIMEOUT_MS;
  const { signal, clear } = createTimeoutSignal(timeoutMs, opts?.signal);

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-OpenAPIHub-Capability": capability,
        "X-OpenAPIHub-Locality": backend.locality,
        ...policyHeaders(effectiveFlags),
      },
      body:
        method === "GET" || method === "HEAD"
          ? undefined
          : JSON.stringify(request.body ?? {}),
      cache: "no-store",
      signal,
    });

    const contentType = upstream.headers.get("content-type") ?? "";
    let responseBody: unknown;
    if (contentType.includes("application/json")) {
      responseBody = await upstream.json();
    } else {
      responseBody = await upstream.text();
    }

    const durationMs = Date.now() - started;
    const status = upstream.ok ? "success" : "error";
    const invocation = recordInvocation({
      backendId: backend.id,
      backendName: backend.name,
      capability,
      path,
      method,
      locality: backend.locality,
      mode: "unary",
      retainPayloads: effectiveFlags.retainPayloads,
      requestBody: request.body ?? null,
      status,
      httpStatus: upstream.status,
      responseBody,
      error: upstream.ok
        ? undefined
        : `上游返回 HTTP ${upstream.status}`,
      errorCode: upstream.ok ? undefined : `HTTP_${upstream.status}`,
      durationMs,
    });

    return { invocation, data: responseBody };
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = abortErrorMessage(error, "调用上游失败");
    const invocation = recordInvocation({
      backendId: backend.id,
      backendName: backend.name,
      capability,
      path,
      method,
      locality: backend.locality,
      mode: "unary",
      retainPayloads: effectiveFlags.retainPayloads,
      requestBody: request.body ?? null,
      status: "error",
      responseBody: undefined,
      error: message,
      errorCode: isAbortError(error) ? "ABORTED" : "UPSTREAM_ERROR",
      durationMs,
    });
    return { invocation, data: { error: message } };
  } finally {
    clear();
  }
}

export type StreamInvokeSetup = {
  backend: Backend;
  capability: string;
  path: string;
  method: string;
  targetUrl: string;
  flags: DataPolicyFlags;
  requestBody: unknown;
  started: number;
};

export function prepareStreamInvoke(request: InvokeRequest): StreamInvokeSetup {
  const policyFlags = resolvePolicy(capabilityForPolicy(request));
  const backend = resolveBackendForPolicy(request, policyFlags, {
    streaming: true,
  });
  const capability =
    request.capability ?? backend.capabilities[0] ?? "unknown";
  const flags = resolvePolicy(capability);
  assertRemoteComputeAllowed(backend, flags.allowRemoteCompute);

  if (backend.locality === "remote") {
    if (!backend.supportsStreaming) {
      throw new PolicyError(
        `remote 后端「${backend.name}」不支持流式（supportsStreaming=false）`,
      );
    }
  }

  const path =
    request.path?.trim() ||
    getCapabilitySpec(capability)?.defaultPath ||
    (backend.locality === "remote" ? "/echo/stream" : "/echo");
  const method = (request.method ?? "POST").toUpperCase();
  const targetUrl = joinUrl(backend.baseUrl, path);

  return {
    backend,
    capability,
    path,
    method,
    targetUrl,
    flags,
    requestBody: request.body ?? null,
    started: Date.now(),
  };
}

export function finalizeStreamInvocation(
  setup: StreamInvokeSetup,
  outcome: {
    status: "success" | "error";
    httpStatus?: number;
    error?: string;
    errorCode?: string;
    assembledText?: string;
  },
): Invocation {
  return recordInvocation({
    backendId: setup.backend.id,
    backendName: setup.backend.name,
    capability: setup.capability,
    path: setup.path,
    method: setup.method,
    locality: setup.backend.locality,
    mode: "stream",
    retainPayloads: setup.flags.retainPayloads,
    requestBody: setup.requestBody,
    status: outcome.status,
    httpStatus: outcome.httpStatus,
    responseBody: setup.flags.retainPayloads
      ? { streamedText: outcome.assembledText ?? "" }
      : undefined,
    error: outcome.error,
    errorCode: outcome.errorCode,
    durationMs: Date.now() - setup.started,
  });
}
