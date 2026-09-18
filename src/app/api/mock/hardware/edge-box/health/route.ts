import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    device: "mock-edge-box",
    computeKind: "cpu",
    privacyTier: "edge",
    capabilities: ["echo.message", "text.transform"],
    note: "模拟边缘小盒",
  });
}
