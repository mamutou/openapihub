import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as streamInvoke } from "@/app/api/invoke/stream/route";
import {
  authorizeHubRequest,
  isLoopbackHostname,
  isLoopbackRequest,
} from "@/lib/auth";
import {
  detectStreamMode,
  extractTokensFromJsonLine,
} from "@/lib/sse";
import { ensureHubSeeded } from "@/lib/seed";
import { resetStoreForTests } from "@/lib/store";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HUB_API_TOKEN;
  delete process.env.HUB_BIND;
  delete process.env.HUB_ALLOW_OPEN;
  delete process.env.HUB_TEST_OPEN_GUARD;
  resetStoreForTests();
});

function streamRequest(body: unknown): NextRequest {
  return new NextRequest("http://127.0.0.1:43127/api/invoke/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "127.0.0.1:43127" },
    body: JSON.stringify(body),
  });
}

describe("upstream framing gate", () => {
  it("detects SSE / NDJSON / neither", () => {
    expect(detectStreamMode("text/event-stream; charset=utf-8")).toBe("sse");
    expect(detectStreamMode("application/x-ndjson")).toBe("ndjson");
    expect(detectStreamMode("application/jsonl")).toBe("ndjson");
    expect(detectStreamMode("application/json")).toBe("none");
    expect(detectStreamMode(null)).toBe("none");
  });

  it("extracts tokens from NDJSON dialects", () => {
    expect(extractTokensFromJsonLine('{"token":"云"}')).toEqual(["云"]);
    expect(extractTokensFromJsonLine('{"content":"端"}')).toEqual(["端"]);
    expect(extractTokensFromJsonLine('{"message":{"content":"本"}}')).toEqual([
      "本",
    ]);
    expect(extractTokensFromJsonLine('{"delta":{"content":"地"}}')).toEqual([
      "地",
    ]);
    expect(
      extractTokensFromJsonLine(
        JSON.stringify({ choices: [{ delta: { content: "x" } }] }),
      ),
    ).toEqual(["x"]);
    expect(extractTokensFromJsonLine('{"usage":{"total_tokens":3}}')).toEqual(
      [],
    );
    expect(extractTokensFromJsonLine("not json")).toEqual([]);
    expect(extractTokensFromJsonLine("[DONE]")).toEqual([]);
  });

  it("rejects a non-streaming upstream instead of reporting success", async () => {
    ensureHubSeeded("http://127.0.0.1:43127");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ answer: "buffered" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const res = await streamInvoke(
      streamRequest({
        capability: "text.transform",
        body: { op: "summarize", text: "hi" },
      }),
    );
    const payload = (await res.json()) as {
      code?: string;
      error?: string;
      invocation?: { status?: string; payloadsRetained?: boolean };
    };

    expect(res.status).toBe(502);
    expect(payload.code).toBe("UPSTREAM_NOT_STREAMING");
    expect(payload.error).toContain("流式");
    expect(payload.invocation?.status).toBe("error");
    // never persist the unary body
    expect(payload.invocation?.payloadsRetained).toBe(false);
  });

  it("streams NDJSON upstream frames as tokens", async () => {
    ensureHubSeeded("http://127.0.0.1:43127");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode('{"message":{"content":"a"}}\n'));
            controller.enqueue(enc.encode('{"message":{"content":"b"}}\n'));
            controller.close();
          },
        });
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson" },
        });
      }),
    );

    const res = await streamInvoke(
      streamRequest({
        capability: "text.transform",
        body: { op: "summarize", text: "hi" },
      }),
    );
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('event: token\ndata: {"token":"a"}');
    expect(text).toContain('event: token\ndata: {"token":"b"}');
    expect(text).toContain("event: done");
    expect(text).toContain('"tokens":2');
  });
});

describe("host-header guard", () => {
  it("classifies loopback hostnames only", () => {
    expect(isLoopbackHostname("localhost:43127")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("127.1.2.3:80")).toBe(true);
    expect(isLoopbackHostname("[::1]:43127")).toBe(true);
    expect(isLoopbackHostname("192.168.1.10:43127")).toBe(false);
    expect(isLoopbackHostname("hub.example.com")).toBe(false);
    expect(isLoopbackHostname("my-mac.local")).toBe(false);
  });

  it("reads the request Host header", () => {
    const lan = new NextRequest("http://192.168.1.10:43127/api/backends", {
      headers: { host: "192.168.1.10:43127" },
    });
    const local = new NextRequest("http://127.0.0.1:43127/api/backends", {
      headers: { host: "127.0.0.1:43127" },
    });
    expect(isLoopbackRequest(lan)).toBe(false);
    expect(isLoopbackRequest(local)).toBe(true);
  });

  it("challenges LAN-host requests even when HUB_BIND claims loopback", () => {
    process.env.HUB_TEST_OPEN_GUARD = "1";
    process.env.HUB_BIND = "127.0.0.1";
    const res = authorizeHubRequest(
      new NextRequest("http://192.168.1.10:43127/api/backends", {
        headers: { host: "192.168.1.10:43127" },
      }),
    );
    expect(res?.status).toBe(401);
    expect(
      authorizeHubRequest(
        new NextRequest("http://127.0.0.1:43127/api/backends", {
          headers: { host: "127.0.0.1:43127" },
        }),
      ),
    ).toBeNull();
  });
});
