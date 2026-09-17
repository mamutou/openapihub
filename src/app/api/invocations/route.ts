import { NextRequest, NextResponse } from "next/server";
import { listInvocations } from "@/lib/invocations";
import { seedDefaultBackends } from "@/lib/registry";

export async function GET(request: NextRequest) {
  seedDefaultBackends(request.nextUrl.origin);
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 50;
  return NextResponse.json({
    invocations: listInvocations(Number.isFinite(limit) ? limit : 50),
  });
}
