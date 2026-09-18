import { NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth";

/** Lightweight probe for console / deploy health. */
export async function GET() {
  const auth = getAuthStatus();
  return NextResponse.json({
    ok: true,
    service: "openapihub",
    authRequired: auth.authRequired,
    bind: auth.bind,
    loopbackBind: auth.loopbackBind,
    openProxyDenied: auth.openProxyDenied,
    warning: auth.warning,
  });
}
