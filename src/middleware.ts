import { NextResponse, type NextRequest } from "next/server";
import { isLoopbackRequest, isOpenProxyAllowed } from "@/lib/auth";

/**
 * `/api/mock/*` are Hub-internal stand-ins for real backends. They carry no
 * secrets but they do expose a fake API surface, so they are loopback-only:
 * the Hub calls them itself, browsers on the LAN do not need them directly.
 * Set HUB_ALLOW_OPEN=1 to opt out (already documented as unsafe).
 */
export const config = {
  matcher: ["/api/mock/:path*"],
};

export function middleware(request: NextRequest) {
  if (isOpenProxyAllowed() || isLoopbackRequest(request)) {
    return NextResponse.next();
  }
  return NextResponse.json(
    {
      error:
        "mock 端点仅限本机访问（Hub 内部调用）。真实服务请注册为 Backend；如需开放 mock，显式设置 HUB_ALLOW_OPEN=1（不安全）",
      code: "MOCK_LOOPBACK_ONLY",
    },
    { status: 401 },
  );
}
