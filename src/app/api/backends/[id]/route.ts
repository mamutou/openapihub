import { NextRequest, NextResponse } from "next/server";
import {
  deleteBackend,
  getBackend,
  seedDefaultBackends,
  updateBackend,
} from "@/lib/registry";

type Params = { params: Promise<{ id: string }> };

function ensureSeeded(request: NextRequest) {
  seedDefaultBackends(request.nextUrl.origin);
}

export async function GET(request: NextRequest, { params }: Params) {
  ensureSeeded(request);
  const { id } = await params;
  const backend = getBackend(id);
  if (!backend) {
    return NextResponse.json({ error: "后端不存在" }, { status: 404 });
  }
  return NextResponse.json({ backend });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  ensureSeeded(request);
  const { id } = await params;
  try {
    const body = await request.json();
    const capabilities = body.capabilities
      ? Array.isArray(body.capabilities)
        ? body.capabilities.map(String)
        : String(body.capabilities).split(/[,，\s]+/)
      : undefined;

    const backend = updateBackend(id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      baseUrl: body.baseUrl !== undefined ? String(body.baseUrl) : undefined,
      capabilities,
      locality:
        body.locality !== undefined
          ? body.locality === "remote"
            ? "remote"
            : "local"
          : undefined,
      supportsStreaming:
        body.supportsStreaming !== undefined
          ? Boolean(body.supportsStreaming)
          : undefined,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
    });

    return NextResponse.json({ backend });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失败";
    const status = message === "后端不存在" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  ensureSeeded(request);
  const { id } = await params;
  const ok = deleteBackend(id);
  if (!ok) {
    return NextResponse.json({ error: "后端不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
