import { NextRequest, NextResponse } from "next/server";
import { authorizeHubRequest } from "@/lib/auth";
import { resolvePolicy } from "@/lib/policy";
import { schedule } from "@/lib/scheduler";
import { ensureHubSeeded } from "@/lib/seed";

/** Dry-run scheduler for console “为何选中”. */
export async function POST(request: NextRequest) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  ensureHubSeeded(request.nextUrl.origin);

  try {
    const body = await request.json();
    const capability = String(body.capability ?? "");
    if (!capability) {
      return NextResponse.json({ error: "需要 capability" }, { status: 400 });
    }
    const flags = resolvePolicy(capability);
    const result = schedule({
      capability,
      streaming: body.streaming !== false,
      preferLocal:
        body.preferLocal !== undefined
          ? Boolean(body.preferLocal)
          : flags.preferLocal,
      allowRemoteCompute:
        body.allowRemoteCompute !== undefined
          ? Boolean(body.allowRemoteCompute)
          : flags.allowRemoteCompute,
      healthyOnly: body.healthyOnly !== false,
      minPrivacyTier: body.minPrivacyTier,
    });
    return NextResponse.json({ schedule: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "调度失败" },
      { status: 400 },
    );
  }
}
