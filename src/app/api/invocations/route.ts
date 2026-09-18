import { NextRequest, NextResponse } from "next/server";
import { authorizeHubRequest } from "@/lib/auth";
import { listInvocations } from "@/lib/invocations";
import { seedDefaultBackends } from "@/lib/registry";

export async function GET(request: NextRequest) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  seedDefaultBackends(request.nextUrl.origin);
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 50;
  return NextResponse.json({
    invocations: listInvocations(Number.isFinite(limit) ? limit : 50),
  });
}
