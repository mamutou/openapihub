import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { authorizeHubRequest, isHubAuthRequired } from "@/lib/auth";
import { createBackend, listBackends } from "@/lib/registry";
import { updateDataPolicy, resolvePolicy } from "@/lib/policy";
import { ensureHubSeeded } from "@/lib/seed";
import { getStateFilePath } from "@/lib/persist";
import { resetStoreForTests, getStore } from "@/lib/store";
import { listSuggestedBackends } from "@/lib/suggestions";

afterEach(() => {
  delete process.env.HUB_API_TOKEN;
  delete process.env.HUB_DATA_DIR;
  delete process.env.HUB_PERSIST;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.HA_BASE_URL;
  delete process.env.HA_TOKEN;
  resetStoreForTests();
});

describe("optional HUB_API_TOKEN", () => {
  it("allows when unset", () => {
    expect(isHubAuthRequired()).toBe(false);
    const req = new NextRequest("http://localhost/api/backends");
    expect(authorizeHubRequest(req)).toBeNull();
  });

  it("rejects missing/wrong bearer when set", () => {
    process.env.HUB_API_TOKEN = "secret-token";
    expect(isHubAuthRequired()).toBe(true);
    const bare = new NextRequest("http://localhost/api/backends");
    expect(authorizeHubRequest(bare)?.status).toBe(401);
    const wrong = new NextRequest("http://localhost/api/backends", {
      headers: { Authorization: "Bearer nope" },
    });
    expect(authorizeHubRequest(wrong)?.status).toBe(401);
    const ok = new NextRequest("http://localhost/api/backends", {
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(authorizeHubRequest(ok)).toBeNull();
  });
});

describe("file persistence", () => {
  it("survives in-memory reset when HUB_DATA_DIR is set", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hub-data-"));
    process.env.HUB_DATA_DIR = dir;
    process.env.HUB_PERSIST = "1";
    resetStoreForTests({ rehydrate: true });

    ensureHubSeeded("http://127.0.0.1:43127");
    createBackend({
      name: "Personal Ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
      capabilities: ["llm.chat"],
      locality: "local",
      supportsStreaming: true,
    });
    updateDataPolicy({ preferLocal: true });
    expect(fs.existsSync(getStateFilePath())).toBe(true);
    expect(listBackends().some((b) => b.name === "Personal Ollama")).toBe(
      true,
    );
    expect(resolvePolicy().preferLocal).toBe(true);

    // Simulate process restart
    resetStoreForTests({ rehydrate: true });
    const store = getStore();
    expect(store.backends.size).toBeGreaterThan(0);
    expect(
      [...store.backends.values()].some((b) => b.name === "Personal Ollama"),
    ).toBe(true);
    expect(store.policy.preferLocal).toBe(true);
    expect(store.policy.streamOnlyRemote).toBe(true);
    expect(store.policy.remoteRetainFiles).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("suggested backends from env", () => {
  it("returns llm suggestion without leaking secrets", () => {
    process.env.OPENAI_BASE_URL = "http://127.0.0.1:11434/v1";
    process.env.OPENAI_API_KEY = "sk-secret";
    const list = listSuggestedBackends();
    expect(list.some((s) => s.capabilities.includes("llm.chat"))).toBe(true);
    expect(JSON.stringify(list)).not.toContain("sk-secret");
  });
});
