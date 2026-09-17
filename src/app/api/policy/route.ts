import { NextRequest, NextResponse } from "next/server";
import { getDataPolicy, updateDataPolicy } from "@/lib/policy";
import { seedDefaultBackends } from "@/lib/registry";

export async function GET(request: NextRequest) {
  seedDefaultBackends(request.nextUrl.origin);
  return NextResponse.json({ policy: getDataPolicy() });
}

export async function PATCH(request: NextRequest) {
  seedDefaultBackends(request.nextUrl.origin);
  try {
    const body = await request.json();
    const policy = updateDataPolicy({
      preferLocal:
        body.preferLocal !== undefined ? Boolean(body.preferLocal) : undefined,
      allowRemoteCompute:
        body.allowRemoteCompute !== undefined
          ? Boolean(body.allowRemoteCompute)
          : body.allowEgress !== undefined
            ? Boolean(body.allowEgress)
            : undefined,
      streamOnlyRemote:
        body.streamOnlyRemote !== undefined
          ? Boolean(body.streamOnlyRemote)
          : undefined,
      retainPayloads:
        body.retainPayloads !== undefined
          ? Boolean(body.retainPayloads)
          : undefined,
      byCapability:
        body.byCapability && typeof body.byCapability === "object"
          ? body.byCapability
          : undefined,
    });
    return NextResponse.json({ policy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新策略失败" },
      { status: 400 },
    );
  }
}
