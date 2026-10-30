import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackend, updateBackend } from "@/lib/registry";
import { getBackend } from "@/lib/registry";
import { resolveUpstreamHeaders } from "@/lib/router";
import { ensureHubSeeded, hubSelfOrigin } from "@/lib/seed";
import { isRequestBodyTooLarge } from "@/lib/http";
import { isPrivateOrLoopbackHost } from "@/lib/locality";
import {
  extractSidechannelFromEvent,
  extractSidechannelFromJsonLine,
} from "@/lib/sse";
import { writePersistedState } from "@/lib/persist";
import { resetStoreForTests } from "@/lib/store";

afterEach(() => {
  delete process.env.TEST_API_KEY;
  delete process.env.TEST_RAW_KEY;
  delete process.env.HUB_DATA_DIR;
  delete process.env.HUB_PERSIST;
  resetStoreForTests();
});

function seed() {
  ensureHubSeeded("http://127.0.0.1:43127");
}

describe("upstream auth headers from env", () => {
  it("injects Authorization from the named env var and adds Bearer", () => {
    seed();
    const backend = createBackend({
      name: "OpenAI compatible",
      baseUrl: "https://api.example.com/v1",
      capabilities: ["llm.chat"],
      locality: "remote",
      headerEnv: { Authorization: "TEST_API_KEY" },
    });
    process.env.TEST_API_KEY = "sk-test";
    expect(resolveUpstreamHeaders(backend)).toEqual({
      Authorization: "Bearer sk-test",
    });
  });

  it("keeps an explicit scheme and never invents a value", () => {
    seed();
    const backend = createBackend({
      name: "Proxy",
      baseUrl: "https://proxy.example.com",
      capabilities: ["llm.chat"],
      locality: "remote",
      headerEnv: { Authorization: "TEST_RAW_KEY", "X-Api-Key": "TEST_API_KEY" },
    });
    process.env.TEST_RAW_KEY = "Bearer already-schemed";
    expect(resolveUpstreamHeaders(backend).Authorization).toBe(
      "Bearer already-schemed",
    );
    expect(resolveUpstreamHeaders(backend)["X-Api-Key"]).toBeUndefined();
  });

  it("ignores reserved hub headers and unknown env names", () => {
    seed();
    const backend = createBackend({
      name: "Reserved",
      baseUrl: "http://127.0.0.1:11434/v1",
      capabilities: ["llm.chat"],
      locality: "local",
      headerEnv: {
        "X-OpenAPIHub-Locality": "TEST_API_KEY",
        "Content-Type": "TEST_API_KEY",
      },
    });
    process.env.TEST_API_KEY = "secret";
    expect(resolveUpstreamHeaders(backend)).toEqual({});
  });

  it("stores env names only, never values", () => {
    seed();
    process.env.TEST_API_KEY = "sk-should-not-be-persisted";
    const backend = createBackend({
      name: "Storage check",
      baseUrl: "https://api.example.com/v1",
      capabilities: ["llm.chat"],
      locality: "remote",
      headerEnv: { Authorization: "TEST_API_KEY" },
    });
    const check = JSON.stringify(getBackend(backend.id));
    expect(check).toContain("TEST_API_KEY");
    expect(check).not.toContain("sk-should-not-be-persisted");
  });

  it("rejects malformed header/env names", () => {
    seed();
    expect(() =>
      createBackend({
        name: "bad header",
        baseUrl: "https://api.example.com",
        capabilities: ["llm.chat"],
        locality: "remote",
        headerEnv: { "Bad Header\n": "TEST_API_KEY" },
      }),
    ).toThrow(/headerEnv/);
    expect(() =>
      createBackend({
        name: "bad env",
        baseUrl: "https://api.example.com",
        capabilities: ["llm.chat"],
        locality: "remote",
        headerEnv: { Authorization: "not a var" },
      }),
    ).toThrow(/headerEnv/);
  });

  it("clears the mapping on update", () => {
    seed();
    const backend = createBackend({
      name: "clear",
      baseUrl: "https://api.example.com",
      capabilities: ["llm.chat"],
      locality: "remote",
      headerEnv: { Authorization: "TEST_API_KEY" },
    });
    const cleared = updateBackend(backend.id, { headerEnv: null });
    expect(cleared.headerEnv).toBeUndefined();
  });
});

describe("private host coverage", () => {
  it("treats IPv6 ULA / link-local / mapped v4 as local", () => {
    expect(isPrivateOrLoopbackHost("fd12:3456::1")).toBe(true);
    expect(isPrivateOrLoopbackHost("fc00::5")).toBe(true);
    expect(isPrivateOrLoopbackHost("fe80::1")).toBe(true);
    expect(isPrivateOrLoopbackHost("::ffff:192.168.1.5")).toBe(true);
    expect(isPrivateOrLoopbackHost("2001:4860:4860::8888")).toBe(false);
  });
});

describe("request body cap", () => {
  const withLength = (value: string | null) => ({
    headers: { get: () => value },
  });

  it("rejects only oversized known lengths", () => {
    expect(isRequestBodyTooLarge(withLength(String(50 * 1024 * 1024)))).toBe(
      true,
    );
    expect(isRequestBodyTooLarge(withLength("1024"))).toBe(false);
    expect(isRequestBodyTooLarge(withLength(null))).toBe(false);
    expect(isRequestBodyTooLarge(withLength("abc"))).toBe(false);
  });
});

describe("stream side-channel", () => {
  it("forwards usage and finish_reason", () => {
    expect(
      extractSidechannelFromJsonLine(
        JSON.stringify({
          choices: [{ delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 3, completion_tokens: 5 },
        }),
      ),
    ).toEqual({
      usage: { prompt_tokens: 3, completion_tokens: 5 },
      finishReason: "stop",
    });
    expect(
      extractSidechannelFromEvent({
        event: "message",
        data: JSON.stringify({ done_reason: "length" }),
      }),
    ).toEqual({ finishReason: "length" });
    expect(extractSidechannelFromEvent({ event: "x", data: "[DONE]" })).toEqual(
      {},
    );
  });
});

describe("mock self-origin", () => {
  it("routes mocks through loopback even when reached via LAN", () => {
    expect(hubSelfOrigin("http://192.168.1.10:43127")).toBe(
      "http://127.0.0.1:43127",
    );
    expect(hubSelfOrigin("http://127.0.0.1:43127/")).toBe(
      "http://127.0.0.1:43127",
    );
    expect(hubSelfOrigin("not a url")).toBe("not a url");
  });

  it("seeds mock backends on loopback", () => {
    ensureHubSeeded("http://192.168.1.10:43127");
    const mock = getBackend("bk_mock_llm");
    expect(mock?.baseUrl.startsWith("http://127.0.0.1:43127")).toBe(true);
  });
});

describe("state file permissions", () => {
  it("writes hub-state.json as 0600", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oahub-"));
    process.env.HUB_DATA_DIR = dir;
    process.env.HUB_PERSIST = "1";
    writePersistedState({
      version: 1,
      seedVersion: 7,
      policy: {
        preferLocal: false,
        allowRemoteCompute: true,
        streamOnlyRemote: true,
        retainPayloads: false,
        remoteRetainFiles: false,
        byCapability: {},
      },
      backends: [],
      devices: [],
      invocations: [],
    });
    const mode = fs.statSync(path.join(dir, "hub-state.json")).mode & 0o777;
    expect(mode & 0o077).toBe(0);
  });
});
