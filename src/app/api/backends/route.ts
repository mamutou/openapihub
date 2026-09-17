import { NextRequest, NextResponse } from "next/server";
import {
  createBackend,
  listBackends,
  seedDefaultBackends,
} from "@/lib/registry";

function ensureSeeded(request: NextRequest) {
  seedDefaultBackends(request.nextUrl.origin);
}

export async function GET(request: NextRequest) {
  ensureSeeded(request);
  return NextResponse.json({ backends: listBackends() });
}

export async function POST(request: NextRequest) {
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
