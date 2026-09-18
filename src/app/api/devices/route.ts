import { NextRequest, NextResponse } from "next/server";
import { authorizeHubRequest } from "@/lib/auth";
import {
  createDevice,
  listDevices,
} from "@/lib/devices";
import { listHardwareProfiles } from "@/lib/hardware/profiles";
import { ensureHubSeeded } from "@/lib/seed";

export async function GET(request: NextRequest) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  ensureHubSeeded(request.nextUrl.origin);
  return NextResponse.json({
    devices: listDevices(),
    profiles: listHardwareProfiles(),
  });
}

export async function POST(request: NextRequest) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  ensureHubSeeded(request.nextUrl.origin);
  try {
    const body = await request.json();
    const capabilities = Array.isArray(body.capabilities)
      ? body.capabilities.map(String)
      : typeof body.capabilities === "string"
        ? body.capabilities.split(/[,，\s]+/)
        : [];
    const device = createDevice({
      name: String(body.name ?? ""),
      baseUrl: String(body.baseUrl ?? ""),
      capabilities,
      hardwareProfileId: String(body.hardwareProfileId ?? "hp_generic_http"),
      transport: body.transport === "mock" ? "mock" : "http",
      discovery: body.discovery === "mock" ? "mock" : "manual",
      pluggedIn: body.pluggedIn !== false,
      enabled: body.enabled !== false,
      latencyHintMs:
        body.latencyHintMs !== undefined
          ? Number(body.latencyHintMs)
          : undefined,
      bindBackend: body.bindBackend !== false,
    });
    return NextResponse.json({ device }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建失败" },
      { status: 400 },
    );
  }
}
