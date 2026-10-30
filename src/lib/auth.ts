import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Optional personal-deploy token from env. */
export function getConfiguredHubToken(): string | null {
  const token = process.env.HUB_API_TOKEN?.trim();
  return token ? token : null;
}

/**
 * Bind address intent. package.json start/dev set HUB_BIND to match --hostname.
 * Default 127.0.0.1 (loopback-only).
 */
export function getConfiguredBind(): string {
  const bind =
    process.env.HUB_BIND?.trim() ||
    process.env.HOST?.trim() ||
    "127.0.0.1";
  return bind || "127.0.0.1";
}

export function isLoopbackBind(bind = getConfiguredBind()): boolean {
  const b = bind.toLowerCase();
  return b === "127.0.0.1" || b === "localhost" || b === "::1";
}

/** Strip an optional `:port` / `[v6]:port` suffix. */
function hostWithoutPort(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    if (end > 0) return trimmed.slice(1, end);
  }
  const colon = trimmed.lastIndexOf(":");
  if (colon > -1 && /^\d+$/.test(trimmed.slice(colon + 1))) {
    return trimmed.slice(0, colon);
  }
  return trimmed;
}

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostWithoutPort(hostname).replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (host === "localhost" || host === "::1") return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

/**
 * Host header the client actually used. HUB_BIND is only an intent hint: a
 * process started with `--hostname 0.0.0.0` but HUB_BIND=127.0.0.1 would
 * otherwise look loopback-only while being reachable from the LAN.
 */
export function isLoopbackRequest(request: NextRequest): boolean {
  const host = request.headers.get("host") ?? request.nextUrl.host ?? "";
  return isLoopbackHostname(hostWithoutPort(host));
}

/** Constant-time compare so a wrong token can't be found byte-by-byte. */
function timingSafeEqualString(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export function isOpenProxyAllowed(): boolean {
  return process.env.HUB_ALLOW_OPEN === "1";
}

/**
 * When true, management/invoke APIs must present a Bearer token
 * (or will be rejected even if HUB_API_TOKEN is unset).
 *
 * Triggers: non-loopback bind without HUB_ALLOW_OPEN.
 * Production on loopback stays open for personal local use unless token set.
 */
export function isOpenProxyDenied(): boolean {
  if (getConfiguredHubToken()) return false;
  if (isOpenProxyAllowed()) return false;
  // Unit tests stay open unless explicitly probing the guard
  if (process.env.VITEST && process.env.HUB_TEST_OPEN_GUARD !== "1") {
    return false;
  }
  return !isLoopbackBind();
}

export function isHubAuthRequired(): boolean {
  return getConfiguredHubToken() !== null || isOpenProxyDenied();
}

export type AuthStatus = {
  authRequired: boolean;
  openProxyDenied: boolean;
  bind: string;
  loopbackBind: boolean;
  allowOpen: boolean;
  hasToken: boolean;
  /** Requests whose Host header is not loopback are always challenged. */
  hostGuard: true;
  warning?: string;
};

export function getAuthStatus(): AuthStatus {
  const bind = getConfiguredBind();
  const loopbackBind = isLoopbackBind(bind);
  const hasToken = getConfiguredHubToken() !== null;
  const allowOpen = isOpenProxyAllowed();
  const openProxyDenied = isOpenProxyDenied();
  const authRequired = hasToken || openProxyDenied;

  let warning: string | undefined;
  if (openProxyDenied) {
    warning =
      "当前监听非本机地址且未设置 HUB_API_TOKEN：管理/invoke API 已拒绝开放访问。请设置 Token，改为 HUB_BIND=127.0.0.1，或显式 HUB_ALLOW_OPEN=1（不安全）。";
  } else if (!hasToken && !loopbackBind && allowOpen) {
    warning =
      "已启用 HUB_ALLOW_OPEN=1：非本机监听且无 Token，任意客户端可注册 Backend 并转发请求（SSRF 风险）。";
  } else if (!hasToken && loopbackBind) {
    warning =
      "未设置 HUB_API_TOKEN。仅本机访问时可接受；局域网部署请设置 Token，并用 start:lan + HUB_BIND=0.0.0.0。";
  }

  return {
    authRequired,
    openProxyDenied,
    bind,
    loopbackBind,
    allowOpen,
    hasToken,
    hostGuard: true,
    warning,
  };
}

let warnedOpenBind = false;

export function warnOpenBindOnce(): void {
  if (warnedOpenBind) return;
  const status = getAuthStatus();
  if (status.warning && (status.openProxyDenied || !status.loopbackBind)) {
    warnedOpenBind = true;
    console.warn(`[OpenAPIHub] ${status.warning}`);
  }
}

export function authorizeHubRequest(
  request: NextRequest,
): NextResponse | null {
  warnOpenBindOnce();
  const expected = getConfiguredHubToken();

  if (expected) {
    const header = request.headers.get("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const provided = match?.[1]?.trim() ?? "";
    if (provided && timingSafeEqualString(provided, expected)) return null;
    return NextResponse.json(
      {
        error: "需要 Authorization: Bearer <HUB_API_TOKEN>",
        code: "UNAUTHORIZED",
      },
      { status: 401 },
    );
  }

  if (isOpenProxyDenied()) {
    return NextResponse.json(
      {
        error:
          "非本机监听且未设置 HUB_API_TOKEN。请设置 Token，或 HUB_BIND=127.0.0.1，或显式 HUB_ALLOW_OPEN=1（不安全）",
        code: "OPEN_PROXY_DENIED",
      },
      { status: 401 },
    );
  }

  // Belt and braces: the client's Host header is proof of the actual reachable
  // address, so a LAN IP / public domain can never fall into the open local path.
  if (!isOpenProxyAllowed() && !isLoopbackRequest(request)) {
    return NextResponse.json(
      {
        error:
          "该请求经非本机地址访问（Host 不是 loopback）。局域网/反代访问必须设置 HUB_API_TOKEN，或显式 HUB_ALLOW_OPEN=1（不安全）",
        code: "LOOPBACK_REQUIRED",
      },
      { status: 401 },
    );
  }

  return null;
}
