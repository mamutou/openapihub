import { afterEach, describe, expect, it, vi } from "vitest";
import { createTimeoutSignal, isAbortError } from "@/lib/http";
import {
  resolvePolicy,
  updateDataPolicy,
  PolicyError,
} from "@/lib/policy";
import {
  assertRemoteUnaryForbidden,
  resolveBackendForPolicy,
} from "@/lib/router";
import { seedDefaultBackends } from "@/lib/registry";
import { resetStoreForTests } from "@/lib/store";
import type { Backend } from "@/lib/types";

afterEach(() => {
  resetStoreForTests();
  vi.unstubAllGlobals();
});

function seed() {
  seedDefaultBackends("http://localhost:43127");
}

describe("remote unary hard gate", () => {
  it("rejects remote backend on unary resolve", () => {
    seed();
    const flags = resolvePolicy("llm.chat");
    expect(() =>
      resolveBackendForPolicy(
        { backendId: "bk_mock_llm", capability: "llm.chat" },
        flags,
        { streaming: false },
      ),
    ).toThrow(PolicyError);
  });

  it("rejects capability unary when only remote backends exist", () => {
    seed();
    const flags = resolvePolicy("llm.chat");
    expect(() =>
      resolveBackendForPolicy({ capability: "llm.chat" }, flags, {
        streaming: false,
      }),
    ).toThrow(/invoke\/stream|禁止一元/);
  });

  it("assertRemoteUnaryForbidden always blocks remote", () => {
    const remote: Backend = {
      id: "x",
      name: "r",
      baseUrl: "http://example",
      capabilities: ["llm.chat"],
      locality: "remote",
      supportsStreaming: true,
      enabled: true,
      createdAt: "",
      updatedAt: "",
    };
    expect(() => assertRemoteUnaryForbidden(remote)).toThrow(PolicyError);
  });
});

describe("streamOnlyRemote immutable", () => {
  it("stays true after PATCH-like updateDataPolicy(false)", () => {
    seed();
    const policy = updateDataPolicy({
      streamOnlyRemote: false,
      byCapability: { "llm.chat": { streamOnlyRemote: false } },
    } as Parameters<typeof updateDataPolicy>[0]);
    expect(policy.streamOnlyRemote).toBe(true);
    expect(resolvePolicy("llm.chat").streamOnlyRemote).toBe(true);
    // override scrubbed
    expect(policy.byCapability["llm.chat"]?.streamOnlyRemote).toBeUndefined();
  });

  it("still rejects remote unary after attempted disable", () => {
    seed();
    updateDataPolicy({
      streamOnlyRemote: false,
      byCapability: { "llm.chat": { streamOnlyRemote: false } },
    } as Parameters<typeof updateDataPolicy>[0]);
    const flags = resolvePolicy("llm.chat");
    expect(flags.streamOnlyRemote).toBe(true);
    expect(() =>
      resolveBackendForPolicy(
        { backendId: "bk_mock_llm" },
        flags,
        { streaming: false },
      ),
    ).toThrow(PolicyError);
  });
});

describe("timeout / abort hooks", () => {
  it("createTimeoutSignal aborts after ms", async () => {
    vi.useFakeTimers();
    const { signal, clear } = createTimeoutSignal(50);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(50);
    expect(signal.aborted).toBe(true);
    expect(isAbortError(signal.reason)).toBe(true);
    clear();
    vi.useRealTimers();
  });

  it("external abort propagates", () => {
    const external = new AbortController();
    const { signal, clear } = createTimeoutSignal(60_000, external.signal);
    external.abort(new DOMException("stop", "AbortError"));
    expect(signal.aborted).toBe(true);
    clear();
  });
});
