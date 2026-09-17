import { NextRequest } from "next/server";

/** llm.chat remote mock — SSE 流式，ephemeral */
export async function POST(request: NextRequest) {
  let messages: { role?: string; content?: string }[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body.messages)) messages = body.messages;
  } catch {
    messages = [];
  }
  const last =
    [...messages].reverse().find((m) => m.role === "user")?.content ??
    "你好";

  const reply = `（mock llm）收到：「${last}」。算力可在云端，答案流式回到本地，远端不落盘。`;
  const tokens = Array.from(reply);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: start\ndata: ${JSON.stringify({
            capability: "llm.chat",
            model: "mock-llm",
            ephemeral: true,
          })}\n\n`,
        ),
      );
      for (const token of tokens) {
        await new Promise((r) => setTimeout(r, 12));
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
      "X-Mock-Ephemeral": "1",
    },
  });
}
