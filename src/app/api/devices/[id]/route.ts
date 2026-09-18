import { NextRequest, NextResponse } from "next/server";
import { authorizeHubRequest } from "@/lib/auth";
import {
  deleteDevice,
  getDevice,
  updateDevice,
} from "@/lib/devices";
import { ensureHubSeeded } from "@/lib/seed";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  ensureHubSeeded(request.nextUrl.origin);
  const { id } = await params;
  const device = getDevice(id);
  if (!device) {
    return NextResponse.json({ error: "设备不存在" }, { status: 404 });
  }
  return NextResponse.json({ device });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  ensureHubSeeded(request.nextUrl.origin);
  const { id } = await params;
  try {
    const body = await request.json();
    const capabilities = body.capabilities
      ? Array.isArray(body.capabilities)
        ? body.capabilities.map(String)
        : String(body.capabilities).split(/[,，\s]+/)
      : undefined;
    const device = updateDevice(id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      baseUrl: body.baseUrl !== undefined ? String(body.baseUrl) : undefined,
      capabilities,
      hardwareProfileId:
        body.hardwareProfileId !== undefined
          ? String(body.hardwareProfileId)
          : undefined,
      pluggedIn:
        body.pluggedIn !== undefined ? Boolean(body.pluggedIn) : undefined,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
      latencyHintMs:
        body.latencyHintMs !== undefined
          ? Number(body.latencyHintMs)
          : undefined,
      status: body.status,
      backendId:
        body.backendId === null
          ? null
          : body.backendId !== undefined
            ? String(body.backendId)
            : undefined,
    });
    return NextResponse.json({ device });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失败";
    const status = message === "设备不存在" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  ensureHubSeeded(request.nextUrl.origin);
  const { id } = await params;
  const ok = deleteDevice(id);
  if (!ok) {
    return NextResponse.json({ error: "设备不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
