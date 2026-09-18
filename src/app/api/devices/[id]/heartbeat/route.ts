import { NextRequest, NextResponse } from "next/server";
import { authorizeHubRequest } from "@/lib/auth";
import { applyDeviceHealth, getDevice, probeDeviceHealth } from "@/lib/devices";
import { ensureHubSeeded } from "@/lib/seed";

type Params = { params: Promise<{ id: string }> };

/** Heartbeat / health probe for a device. */
export async function POST(request: NextRequest, { params }: Params) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  ensureHubSeeded(request.nextUrl.origin);
  const { id } = await params;
  if (!getDevice(id)) {
    return NextResponse.json({ error: "设备不存在" }, { status: 404 });
  }

  let body: { ok?: boolean; probe?: boolean; latencyHintMs?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const device =
      body.probe === false && typeof body.ok === "boolean"
        ? applyDeviceHealth(id, body.ok, {
            latencyHintMs: body.latencyHintMs,
          })
        : await probeDeviceHealth(id);
    return NextResponse.json({ device });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "心跳失败" },
      { status: 400 },
    );
  }
}
