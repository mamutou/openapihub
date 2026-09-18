import { NextResponse } from "next/server";
import { isHubAuthRequired } from "@/lib/auth";

/** Lightweight probe for console / deploy health. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "openapihub",
    authRequired: isHubAuthRequired(),
  });
}
