import { NextRequest, NextResponse } from "next/server";

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  await delay(180);

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
      : "Hello from remote mock";

  return NextResponse.json({
    flavor: "remote",
    capability: "echo.message",
    region: "mock-us-west",
    latencyHintMs: 180,
    data: {
      echo: message,
      transformed: message.toUpperCase(),
    },
    note: "这是远端风格 mock 后端：略有延迟，响应结构更“服务化”。",
    receivedAt: new Date().toISOString(),
  });
}

export async function GET() {
  await delay(80);
  return NextResponse.json({
    flavor: "remote",
    status: "ok",
    region: "mock-us-west",
    capability: "echo.message",
  });
}
