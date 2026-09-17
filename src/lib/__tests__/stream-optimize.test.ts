import { afterEach, describe, expect, it } from "vitest";
import {
  resolveCapabilityPath,
  getCapabilitySpec,
} from "@/lib/capabilities/catalog";
import { PolicyError, resolvePolicy } from "@/lib/policy";
import {
  assertStreamRequiredCapability,
  prepareStreamInvoke,
  resolveBackendForPolicy,
  routeInvoke,
} from "@/lib/router";
import { createBackend, seedDefaultBackends } from "@/lib/registry";
import { resetStoreForTests } from "@/lib/store";
import {
  extractTokensFromUpstreamEvent,
  formatSse,
  parseSseBlocks,
} from "@/lib/sse";

afterEach(() => {
  resetStoreForTests();
});

function seed() {
  seedDefaultBackends("http://localhost:43127");
}

describe("SSE normalize (no {raw} wrap)", () => {
  it("parseSseBlocks extracts named events", () => {
    const { events, rest } = parseSseBlocks(
      'event: token\ndata: {"token":"你好"}\n\nevent: done\ndata: {"ok":true}\n\npartial',
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      event: "token",
      data: '{"token":"你好"}',
    });
    expect(events[1].event).toBe("done");
    expect(rest).toBe("partial");
  });

  it("formatSse emits token/meta/done without raw nesting", () => {
    const token = formatSse("token", { token: "abc" });
    expect(token).toBe('event: token\ndata: {"token":"abc"}\n\n');
    expect(token).not.toContain('"raw"');
    expect(formatSse("meta", { type: "meta" })).toContain("event: meta");
    expect(formatSse("done", { invocation: null })).toContain("event: done");
  });

  it("extractTokensFromUpstreamEvent unwraps {token} and OpenAI delta", () => {
    expect(
      extractTokensFromUpstreamEvent({
        event: "token",
        data: JSON.stringify({ token: "云", index: 0 }),
      }),
    ).toEqual(["云"]);
    expect(
      extractTokensFromUpstreamEvent({
        event: "message",
        data: JSON.stringify({
          choices: [{ delta: { content: "端" } }],
        }),
      }),
    ).toEqual(["端"]);
    // Legacy nested raw payload is ignored (no longer forwarded as text)
    expect(
      extractTokensFromUpstreamEvent({
        event: "chunk",
        data: JSON.stringify({ raw: "event: token\ndata: hi" }),
      }),
    ).toEqual([]);
  });
});

describe("streamRequired hard gate", () => {
  it("assertStreamRequiredCapability blocks llm.chat and image.compose", () => {
    expect(() => assertStreamRequiredCapability("llm.chat")).toThrow(
      /streamRequired|流式/,
    );
    expect(() => assertStreamRequiredCapability("image.compose")).toThrow(
      PolicyError,
    );
    expect(() => assertStreamRequiredCapability("echo.message")).not.toThrow();
    expect(() => assertStreamRequiredCapability("mail.send")).not.toThrow();
  });

  it("routeInvoke rejects streamRequired even when a local backend exists", async () => {
    seed();
    createBackend({
      name: "Local LLM unary trap",
      baseUrl: "http://localhost:43127/api/mock/caps/llm",
      capabilities: ["llm.chat"],
      locality: "local",
      supportsStreaming: false,
    });
    await expect(
      routeInvoke({
        capability: "llm.chat",
        body: { messages: [{ role: "user", content: "hi" }] },
      }),
    ).rejects.toThrow(/streamRequired|流式/);
  });

  it("catalog marks llm.chat / image.compose as streamRequired", () => {
    expect(getCapabilitySpec("llm.chat")?.streamRequired).toBe(true);
    expect(getCapabilitySpec("image.compose")?.streamRequired).toBe(true);
    expect(getCapabilitySpec("echo.message")?.streamRequired).toBe(false);
  });
});

describe("echo capability path routing", () => {
  it("resolveCapabilityPath is catalog-driven", () => {
    expect(resolveCapabilityPath("echo.message", "unary")).toBe("/echo");
    expect(resolveCapabilityPath("echo.message", "stream")).toBe(
      "/echo/stream",
    );
    expect(resolveCapabilityPath("llm.chat", "stream")).toBe("/chat/stream");
    expect(resolveCapabilityPath("mail.send", "stream")).toBe("/send");
  });

  it("prepareStreamInvoke for echo.message uses /echo/stream on remote", () => {
    seed();
    const setup = prepareStreamInvoke({
      capability: "echo.message",
      body: { message: "路由试调" },
    });
    expect(setup.path).toBe("/echo/stream");
    expect(setup.backend.locality).toBe("remote");
    expect(setup.backend.supportsStreaming).toBe(true);
    expect(setup.targetUrl).toContain("/echo/stream");
    expect(setup.targetUrl).not.toMatch(/\/echo$/);
  });

  it("capability streaming prefers remote echo over local", () => {
    seed();
    const flags = resolvePolicy("echo.message");
    const backend = resolveBackendForPolicy(
      { capability: "echo.message" },
      flags,
      { streaming: true },
    );
    expect(backend.id).toBe("bk_remote_echo");
  });
});
