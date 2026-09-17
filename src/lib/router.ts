import {
  findBackendsByCapability,
  getBackend,
} from "@/lib/registry";
import {
  recordInvocation,
  summarizeResponse,
} from "@/lib/invocations";
import type { Backend, Invocation, InvokeRequest } from "@/lib/types";

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function resolveBackend(request: InvokeRequest): Backend {
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
    return backend;
  }

  if (!request.capability) {
    throw new Error("请提供 capability 或 backendId");
  }

  const matches = findBackendsByCapability(request.capability);
  if (matches.length === 0) {
    throw new Error(`没有已启用的后端支持能力 ${request.capability}`);
  }
  return matches[0];
}

export async function routeInvoke(
  request: InvokeRequest,
): Promise<{ invocation: Invocation; data: unknown }> {
  const backend = resolveBackend(request);
  const capability = request.capability ?? backend.capabilities[0] ?? "unknown";
  const path = request.path?.trim() || "/echo";
  const method = (request.method ?? "POST").toUpperCase();
  const targetUrl = joinUrl(backend.baseUrl, path);
  const started = Date.now();

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-OpenAPIHub-Capability": capability,
      },
      body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(request.body ?? {}),
      cache: "no-store",
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
      requestBody: request.body ?? null,
      status,
      httpStatus: upstream.status,
      responseSummary: summarizeResponse(responseBody, upstream.status),
      responseBody,
      error: upstream.ok
        ? undefined
        : `上游返回 HTTP ${upstream.status}`,
      durationMs,
    });

    return { invocation, data: responseBody };
  } catch (error) {
    const durationMs = Date.now() - started;
    const message =
      error instanceof Error ? error.message : "调用上游失败";
    const invocation = recordInvocation({
      backendId: backend.id,
      backendName: backend.name,
      capability,
      path,
      method,
      requestBody: request.body ?? null,
      status: "error",
      responseSummary: message,
      error: message,
      durationMs,
    });
    return { invocation, data: { error: message } };
  }
}
