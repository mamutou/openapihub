import { NextRequest } from "next/server";

/** Local NPU stick mock — streaming llm.chat */
export async function POST(request: NextRequest) {
  let messages: { role?: string; content?: string }[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body.messages)) messages = body.messages;
  } catch {
    messages = [];
  }
  const last =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "你好";

  const reply = `（mock NPU stick）本地推理：「${last}」。插拔由 Hub 设备面板控制。`;
  const tokens = Array.from(reply);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: start\ndata: ${JSON.stringify({
            capability: "llm.chat",
            model: "mock-npu",
            device: "mock-npu-stick",
            ephemeral: true,
          })}\n\n`,
        ),
      );
      for (const token of tokens) {
        await new Promise((r) => setTimeout(r, 8));
        controller.enqueue(
          encoder.encode(
            `event: token\ndata: ${JSON.stringify({ token })}\n\n`,
          ),
        );
      }
      controller.enqueue(
        encoder.encode(
          `event: end\ndata: ${JSON.stringify({
            done: true,
            finishReason: "stop",
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
    },
  });
}
