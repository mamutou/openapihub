import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  authorizeHubRequest,
  getAuthStatus,
  isOpenProxyDenied,
} from "@/lib/auth";
import {
  coerceLocalityForUrl,
  effectiveLocality,
  inferLocalityFromUrl,
} from "@/lib/locality";
import { createBackend } from "@/lib/registry";
import {
  assertRemoteUnaryForbidden,
  resolveBackendForPolicy,
} from "@/lib/router";
import { resolvePolicy, PolicyError } from "@/lib/policy";
import { ensureHubSeeded } from "@/lib/seed";
import { resetStoreForTests } from "@/lib/store";

afterEach(() => {
  delete process.env.HUB_API_TOKEN;
  delete process.env.HUB_BIND;
  delete process.env.HUB_ALLOW_OPEN;
  delete process.env.HUB_TEST_OPEN_GUARD;
  delete process.env.HUB_LOCAL_HOST_ALLOWLIST;
  resetStoreForTests();
});

describe("locality ↔ URL", () => {
  it("infers private and public hosts", () => {
    expect(inferLocalityFromUrl("http://127.0.0.1:11434/v1")).toBe("local");
    expect(inferLocalityFromUrl("http://192.168.1.10/api")).toBe("local");
    expect(inferLocalityFromUrl("http://10.0.0.5")).toBe("local");
    expect(inferLocalityFromUrl("https://example.com")).toBe("remote");
    expect(inferLocalityFromUrl("https://api.openai.com/v1")).toBe("remote");
  });

  it("coerces declared local + public URL to remote", () => {
    const c = coerceLocalityForUrl("https://example.com", "local");
    expect(c.coerced).toBe(true);
    expect(c.locality).toBe("remote");
  });

  it("createBackend coerces public URL marked local", () => {
    ensureHubSeeded("http://127.0.0.1:43127");
    const backend = createBackend({
      name: "Fake Local Cloud",
      baseUrl: "https://example.com",
      capabilities: ["text.transform"],
      locality: "local",
      supportsStreaming: false,
    });
    expect(backend.locality).toBe("remote");
    expect(backend.supportsStreaming).toBe(true);
  });

  it("unary invoke on coerced public URL is 403-class PolicyError", () => {
    ensureHubSeeded("http://127.0.0.1:43127");
    const backend = createBackend({
      name: "Bypass Attempt",
      baseUrl: "https://example.com",
      capabilities: ["text.transform"],
      locality: "local",
    });
    const flags = resolvePolicy("text.transform");
    expect(() =>
      resolveBackendForPolicy(
        { backendId: backend.id, capability: "text.transform" },
        flags,
        { streaming: false },
      ),
    ).toThrow(PolicyError);
    expect(() =>
      assertRemoteUnaryForbidden({
        ...backend,
        locality: "local", // even if disk still said local
      }),
    ).toThrow(/禁止一元|流式/);
  });

  it("effectiveLocality ignores false local on public host", () => {
    expect(
      effectiveLocality({
        baseUrl: "https://cdn.example.org",
        locality: "local",
      }),
    ).toBe("remote");
  });
});

describe("open proxy / bind guard", () => {
  it("denies open management when HUB_BIND is 0.0.0.0 without token", () => {
    process.env.HUB_TEST_OPEN_GUARD = "1";
    process.env.HUB_BIND = "0.0.0.0";
    expect(isOpenProxyDenied()).toBe(true);
    expect(getAuthStatus().authRequired).toBe(true);
    const res = authorizeHubRequest(
      new NextRequest("http://localhost/api/backends"),
    );
    expect(res?.status).toBe(401);
  });

  it("allows open on loopback without token", () => {
    process.env.HUB_TEST_OPEN_GUARD = "1";
    process.env.HUB_BIND = "127.0.0.1";
    expect(isOpenProxyDenied()).toBe(false);
    expect(
      authorizeHubRequest(new NextRequest("http://localhost/api/backends")),
    ).toBeNull();
  });

  it("HUB_ALLOW_OPEN overrides non-loopback deny", () => {
    process.env.HUB_TEST_OPEN_GUARD = "1";
    process.env.HUB_BIND = "0.0.0.0";
    process.env.HUB_ALLOW_OPEN = "1";
    expect(isOpenProxyDenied()).toBe(false);
  });

  it("token still required check when set", () => {
    process.env.HUB_BIND = "0.0.0.0";
    process.env.HUB_API_TOKEN = "secret";
    const bare = authorizeHubRequest(
      new NextRequest("http://localhost/api/backends"),
    );
    expect(bare?.status).toBe(401);
    const ok = authorizeHubRequest(
      new NextRequest("http://localhost/api/backends", {
        headers: { Authorization: "Bearer secret" },
      }),
    );
    expect(ok).toBeNull();
  });
});
