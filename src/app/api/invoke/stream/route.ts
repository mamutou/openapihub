import { NextRequest, NextResponse } from "next/server";
import { PolicyError } from "@/lib/policy";
import { seedDefaultBackends } from "@/lib/registry";
import {
  finalizeStreamInvocation,
  policyHeaders,
  prepareStreamInvoke,
} from "@/lib/router";
import type { InvokeRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  seedDefaultBackends(request.nextUrl.origin);

  let body: InvokeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  let setup: ReturnType<typeof prepareStreamInvoke>;
  try {
    setup = prepareStreamInvoke({
      capability: body.capability ? String(body.capability) : undefined,
      backendId: body.backendId ? String(body.backendId) : undefined,
      path: body.path ? String(body.path) : undefined,
      method: body.method ? String(body.method) : undefined,
      body: body.body,
    });
  } catch (error) {
    if (error instanceof PolicyError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "调用失败" },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(setup.targetUrl, {
      method: setup.method,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
        "X-OpenAPIHub-Capability": setup.capability,
        "X-OpenAPIHub-Locality": setup.backend.locality,
        ...policyHeaders(setup.flags),
      },
      body:
        setup.method === "GET" || setup.method === "HEAD"
          ? undefined
          : JSON.stringify(setup.requestBody ?? {}),
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "连接上游失败";
    const invocation = finalizeStreamInvocation(setup, {
      status: "error",
      error: message,
      errorCode: "UPSTREAM_ERROR",
    });
    return NextResponse.json(
      { error: message, invocation },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    const invocation = finalizeStreamInvocation(setup, {
      status: "error",
      httpStatus: upstream.status,
      error: text || `上游返回 HTTP ${upstream.status}`,
      errorCode: `HTTP_${upstream.status}`,
    });
    return NextResponse.json(
      { error: invocation.error, invocation },
      { status: upstream.status || 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let assembled = "";
  let closedWithError: string | undefined;
  const retain = setup.flags.retainPayloads;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const meta = {
        type: "meta" as const,
        backendId: setup.backend.id,
        backendName: setup.backend.name,
        locality: setup.backend.locality,
        capability: setup.capability,
        remoteRetainFiles: false,
        retainPayloads: retain,
        note: "云端 ephemeral · 输出在本地收看 · Hub 默认不落正文",
      };
      controller.enqueue(
        encoder.encode(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`),
      );

      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (retain) assembled += chunk;
          // Relay upstream bytes as SSE data frames for the local UI
          controller.enqueue(
            encoder.encode(
              `event: chunk\ndata: ${JSON.stringify({ raw: chunk })}\n\n`,
            ),
          );
        }
        const invocation = finalizeStreamInvocation(setup, {
          status: "success",
          httpStatus: upstream.status,
          assembledText: retain ? assembled : undefined,
        });
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              invocation: {
                id: invocation.id,
                status: invocation.status,
                locality: invocation.locality,
                mode: invocation.mode,
                payloadsRetained: invocation.payloadsRetained,
                responseSummary: invocation.responseSummary,
                durationMs: invocation.durationMs,
              },
            })}\n\n`,
          ),
        );
        controller.close();
      } catch (error) {
        closedWithError =
          error instanceof Error ? error.message : "流式传输中断";
        const invocation = finalizeStreamInvocation(setup, {
          status: "error",
          httpStatus: upstream.status,
          error: closedWithError,
          errorCode: "STREAM_INTERRUPTED",
          assembledText: retain ? assembled : undefined,
        });
        try {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                error: closedWithError,
                invocation: {
                  id: invocation.id,
                  responseSummary: invocation.responseSummary,
                },
              })}\n\n`,
            ),
          );
          controller.close();
        } catch {
          controller.error(error);
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-OpenAPIHub-Stream": "1",
      "X-OpenAPIHub-Remote-Retain-Files": "false",
    },
  });
}
