import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  let message = "edge stream";
  try {
    const body = await request.json();
    if (typeof body.message === "string") message = body.message;
  } catch {
    /* ignore */
  }

  const parts = ["[edge] ", message, " · ", "local stream"];
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const token of parts) {
        await new Promise((r) => setTimeout(r, 20));
        controller.enqueue(
          encoder.encode(
            `event: token\ndata: ${JSON.stringify({ token })}\n\n`,
          ),
        );
      }
      controller.enqueue(
        encoder.encode(`event: end\ndata: ${JSON.stringify({ done: true })}\n\n`),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
