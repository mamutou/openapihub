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
      : "edge-box echo";

  return NextResponse.json({
    flavor: "edge-box",
    capability: "echo.message",
    echo: message,
    device: "mock-edge-box",
    receivedAt: new Date().toISOString(),
  });
}
