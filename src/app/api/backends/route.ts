import { NextRequest, NextResponse } from "next/server";
import { authorizeHubRequest } from "@/lib/auth";
import { createBackend, listBackends } from "@/lib/registry";
import { ensureHubSeeded } from "@/lib/seed";

function ensureSeeded(request: NextRequest) {
  ensureHubSeeded(request.nextUrl.origin);
}

export async function GET(request: NextRequest) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  ensureSeeded(request);
  return NextResponse.json({ backends: listBackends() });
}

export async function POST(request: NextRequest) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  ensureSeeded(request);
  try {
    const body = await request.json();
    const capabilities = Array.isArray(body.capabilities)
      ? body.capabilities.map(String)
      : typeof body.capabilities === "string"
        ? body.capabilities.split(/[,，\s]+/)
        : [];
    const locality = body.locality === "remote" ? "remote" : "local";

    const backend = createBackend({
      name: String(body.name ?? ""),
      baseUrl: String(body.baseUrl ?? ""),
      capabilities,
      locality,
      supportsStreaming:
        body.supportsStreaming !== undefined
          ? Boolean(body.supportsStreaming)
          : locality === "remote",
      enabled: body.enabled !== false,
    });

    return NextResponse.json({ backend }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建失败" },
      { status: 400 },
    );
  }
}
