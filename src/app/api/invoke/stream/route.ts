import { NextRequest, NextResponse } from "next/server";
import { authorizeHubRequest } from "@/lib/auth";
import {
  STREAM_CONNECT_TIMEOUT_MS,
  abortErrorMessage,
  createTimeoutSignal,
  isAbortError,
} from "@/lib/http";
import { PolicyError } from "@/lib/policy";
import { ensureHubSeeded } from "@/lib/seed";
import {
  finalizeStreamInvocation,
  policyHeaders,
  prepareStreamInvoke,
  type StreamInvokeSetup,
} from "@/lib/router";
import {
  detectStreamMode,
  extractTokensFromJsonLine,
  extractTokensFromUpstreamEvent,
  formatSse,
  parseSseBlocks,
} from "@/lib/sse";
import type { InvokeRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = authorizeHubRequest(request);
  if (denied) return denied;
  ensureHubSeeded(request.nextUrl.origin);

  let body: InvokeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  let setup: StreamInvokeSetup;
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

  const upstreamAbort = new AbortController();
  const { signal: connectSignal, clear: clearConnectTimeout } =
    createTimeoutSignal(STREAM_CONNECT_TIMEOUT_MS, upstreamAbort.signal);

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
      signal: connectSignal,
    });
    clearConnectTimeout();
  } catch (error) {
    clearConnectTimeout();
    const message = abortErrorMessage(error, "连接上游失败");
    const invocation = finalizeStreamInvocation(setup, {
      status: "error",
      error: message,
      errorCode: isAbortError(error) ? "ABORTED" : "UPSTREAM_ERROR",
    });
    return NextResponse.json(
      {
        error: message,
        invocation,
        code: isAbortError(error) ? "ABORTED" : "UPSTREAM_ERROR",
      },
      { status: isAbortError(error) ? 504 : 502 },
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

  // Hub only accepts streaming upstreams. A unary JSON response here would be
  // silently swallowed (0 tokens) while the caller sees "success" — so refuse.
  const upstreamContentType = upstream.headers.get("content-type");
  const streamMode = detectStreamMode(upstreamContentType);
  if (streamMode === "none") {
    const message =
      `上游未返回流式响应（HTTP ${upstream.status}，content-type=${
        upstreamContentType ?? "未知"
      }）：Hub 只接受 text/event-stream 或 NDJSON 流，禁止一元缓冲云端输出`;
    const invocation = finalizeStreamInvocation(setup, {
      status: "error",
      httpStatus: upstream.status,
      error: message,
      errorCode: "UPSTREAM_NOT_STREAMING",
    });
    return NextResponse.json(
      {
        error: message,
        code: "UPSTREAM_NOT_STREAMING",
        invocation,
        hint:
          "把 Backend 的 path 指向真正的流式端点（例如 OpenAI 兼容 /chat/completions 且 body.stream=true，或 Ollama /api/chat），或改用 /api/invoke（仅 local）",
      },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let assembled = "";
  const retain = setup.flags.retainPayloads;
  let finalized = false;
  let tokensSeen = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const finalizeOnce = (
    outcome: Parameters<typeof finalizeStreamInvocation>[1],
  ) => {
    if (finalized) return null;
    finalized = true;
    return finalizeStreamInvocation(setup, outcome);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const meta = {
        type: "meta" as const,
        backendId: setup.backend.id,
        backendName: setup.backend.name,
        locality: setup.backend.locality,
        capability: setup.capability,
        deviceId: setup.schedule?.deviceId ?? setup.backend.deviceId,
        scheduleReason: setup.schedule?.reason,
        scheduleScore: setup.schedule?.score,
        remoteRetainFiles: false,
        retainPayloads: retain,
        note: "云端 ephemeral · 输出在本地收看 · Hub 默认不落正文",
      };
      controller.enqueue(encoder.encode(formatSse("meta", meta)));

      reader = upstream.body!.getReader();
      let buffer = "";

      const emitTokens = (tokens: string[]) => {
        for (const token of tokens) {
          if (retain) assembled += token;
          tokensSeen += 1;
          controller.enqueue(encoder.encode(formatSse("token", { token })));
        }
      };

      /** Feed raw text; `flush` finishes a trailing frame/line. */
      const consume = (chunk: string, flush = false) => {
        buffer += chunk;
        if (streamMode === "sse") {
          const parsed = parseSseBlocks(flush ? `${buffer}\n\n` : buffer);
          buffer = flush ? "" : parsed.rest;
          for (const ev of parsed.events) {
            emitTokens(extractTokensFromUpstreamEvent(ev));
          }
          return;
        }
        const lines = buffer.split("\n");
        buffer = flush ? "" : lines.pop() ?? "";
        for (const line of lines) {
          emitTokens(extractTokensFromJsonLine(line));
        }
      };

      try {
        while (true) {
          if (upstreamAbort.signal.aborted) {
            throw new DOMException("客户端已断开或请求已取消", "AbortError");
          }
          const { done, value } = await reader.read();
          if (done) break;
          consume(decoder.decode(value, { stream: true }));
        }

        // Flush trailing frame/line without a final terminator
        consume("", true);

        const invocation = finalizeOnce({
          status: "success",
          httpStatus: upstream.status,
          assembledText: retain ? assembled : undefined,
        });
        controller.enqueue(
          encoder.encode(
            formatSse("done", {
              tokens: tokensSeen,
              invocation: invocation
                ? {
                    id: invocation.id,
                    status: invocation.status,
                    locality: invocation.locality,
                    mode: invocation.mode,
                    payloadsRetained: invocation.payloadsRetained,
                    responseSummary: invocation.responseSummary,
                    durationMs: invocation.durationMs,
                  }
                : null,
            }),
          ),
        );
        controller.close();
      } catch (error) {
        const message = abortErrorMessage(error, "流式传输中断");
        const invocation = finalizeOnce({
          status: "error",
          httpStatus: upstream.status,
          error: message,
          errorCode: isAbortError(error) ? "ABORTED" : "STREAM_INTERRUPTED",
          assembledText: retain ? assembled : undefined,
        });
        try {
          controller.enqueue(
            encoder.encode(
              formatSse("error", {
                error: message,
                invocation: invocation
                  ? {
                      id: invocation.id,
                      responseSummary: invocation.responseSummary,
                    }
                  : null,
              }),
            ),
          );
          controller.close();
        } catch {
          try {
            controller.error(error);
          } catch {
            /* already closed */
          }
        }
      }
    },
    cancel() {
      upstreamAbort.abort(new DOMException("客户端断开流", "AbortError"));
      void reader?.cancel().catch(() => undefined);
      finalizeOnce({
        status: "error",
        httpStatus: upstream.status,
        error: "客户端断开流，已取消上游",
        errorCode: "CLIENT_CANCELLED",
        assembledText: retain ? assembled : undefined,
      });
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
