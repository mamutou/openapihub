import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const message =
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof (payload as { message: unknown }).message === "string"
      ? (payload as { message: string }).message
      : "你好，OpenAPIHub";

  return NextResponse.json({
    flavor: "local",
    capability: "echo.message",
    echo: message,
    note: "这是本地风格 mock 后端：响应快、字段精简。",
    receivedAt: new Date().toISOString(),
  });
}

export async function GET() {
  return NextResponse.json({
    flavor: "local",
    status: "ok",
    capability: "echo.message",
  });
}
