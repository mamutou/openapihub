import { NextRequest, NextResponse } from "next/server";
import { getDataPolicy, updateDataPolicy } from "@/lib/policy";
import { seedDefaultBackends } from "@/lib/registry";

export async function GET(request: NextRequest) {
  seedDefaultBackends(request.nextUrl.origin);
  const policy = getDataPolicy();
  return NextResponse.json({
    policy,
    hardConstraints: {
      streamOnlyRemote: true,
      remoteRetainFiles: false,
      note: "streamOnlyRemote 与 remoteRetainFiles 不可通过 PATCH 关闭；remote 一律只能 /api/invoke/stream",
    },
  });
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
      // streamOnlyRemote ignored — hard constraint
      retainPayloads:
        body.retainPayloads !== undefined
          ? Boolean(body.retainPayloads)
          : undefined,
      byCapability:
        body.byCapability && typeof body.byCapability === "object"
          ? body.byCapability
          : undefined,
    });
    return NextResponse.json({
      policy,
      hardConstraints: {
        streamOnlyRemote: true,
        remoteRetainFiles: false,
      },
      ignored:
        body.streamOnlyRemote === false ||
        (body.byCapability &&
          Object.values(body.byCapability).some(
            (v) =>
              v &&
              typeof v === "object" &&
              "streamOnlyRemote" in v &&
              (v as { streamOnlyRemote?: boolean }).streamOnlyRemote === false,
          ))
          ? ["streamOnlyRemote（硬约束，保持 true）"]
          : [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新策略失败" },
      { status: 400 },
    );
  }
}
