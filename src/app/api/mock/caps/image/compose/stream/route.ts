import { NextRequest } from "next/server";

/** image.compose remote mock — 流式描述合成 */
export async function POST(request: NextRequest) {
  let template = "blank";
  let layers: { type?: string; content?: string }[] = [];
  try {
    const body = await request.json();
    if (typeof body.template === "string") template = body.template;
    if (Array.isArray(body.layers)) layers = body.layers;
  } catch {
    /* ignore */
  }

  const steps = [
    `加载模板「${template}」`,
    `叠加 ${layers.length} 个图层`,
    ...layers.map(
      (l, i) => `图层 ${i + 1}：${l.type ?? "unknown"} ${l.content ?? ""}`.trim(),
    ),
    "栅格化 → 流式回传本地（远端不留文件）",
    "完成 composition",
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: start\ndata: ${JSON.stringify({
            capability: "image.compose",
            template,
            ephemeral: true,
          })}\n\n`,
        ),
      );
      for (const step of steps) {
        await new Promise((r) => setTimeout(r, 80));
        controller.enqueue(
          encoder.encode(
            `event: token\ndata: ${JSON.stringify({ token: `${step}\n` })}\n\n`,
          ),
        );
      }
      controller.enqueue(
        encoder.encode(
          `event: end\ndata: ${JSON.stringify({
            done: true,
            compositionId: `cmp_${Date.now().toString(36)}`,
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
