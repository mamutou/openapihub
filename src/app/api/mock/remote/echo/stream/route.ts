import { NextRequest, NextResponse } from "next/server";

/**
 * Remote mock：仅提供流式输出。约定 ephemeral，不落盘。
 * SSE 逐段回传，演示「云算力 + 本地收看」。
 */
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
      : "cloud compute · ephemeral";

  const retainHeader = request.headers.get("x-openapihub-remote-retain-files");
  const parts = [
    "☁ ",
    message,
    " → ",
    "streamed to local hub",
    " · ",
    "no remote file retain",
    retainHeader === "true" ? " (!)" : "",
  ];

  const encoder = new TextEncoder();
  let index = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: start\ndata: ${JSON.stringify({
            flavor: "remote",
            capability: "echo.message",
            ephemeral: true,
            remoteRetainFiles: false,
          })}\n\n`,
        ),
      );

      for (const part of parts) {
        await new Promise((r) => setTimeout(r, 90));
        controller.enqueue(
          encoder.encode(
            `event: token\ndata: ${JSON.stringify({
              index,
              token: part,
            })}\n\n`,
          ),
        );
        index += 1;
      }

      await new Promise((r) => setTimeout(r, 60));
      controller.enqueue(
        encoder.encode(
          `event: end\ndata: ${JSON.stringify({
            flavor: "remote",
            region: "mock-us-west",
            note: "远端仅流式回传，不保留文件。",
            receivedAt: new Date().toISOString(),
          })}\n\n`,
        ),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Mock-Ephemeral": "1",
    },
  });
}

export async function GET() {
  return NextResponse.json({
    flavor: "remote",
    status: "ok",
    streaming: true,
    path: "/echo/stream",
    capability: "echo.message",
  });
}
