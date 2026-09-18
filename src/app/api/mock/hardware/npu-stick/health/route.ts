import { NextResponse } from "next/server";

/** Mock NPU stick health — Hub owns plug state; this reports process liveness. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    device: "mock-npu-stick",
    computeKind: "npu",
    privacyTier: "local-only",
    capabilities: ["llm.chat"],
    note: "模拟可插拔 NPU；拔插由 Hub Device.pluggedIn 控制",
  });
}
