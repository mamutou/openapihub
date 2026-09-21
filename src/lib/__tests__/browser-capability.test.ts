import { afterEach, describe, expect, it } from "vitest";
import { getCapabilitySpec, listCapabilityCatalog } from "@/lib/capabilities/catalog";
import { ensureHubSeeded } from "@/lib/seed";
import { findBackendsByCapability } from "@/lib/registry";
import { resetStoreForTests } from "@/lib/store";
import { POST as openPost } from "@/app/api/mock/caps/browser/open/route";
import { POST as extractPost } from "@/app/api/mock/caps/browser/extract/route";
import { POST as screenshotPost } from "@/app/api/mock/caps/browser/screenshot/route";
import { NextRequest } from "next/server";

afterEach(() => {
  resetStoreForTests();
});

describe("browser capability catalog", () => {
  it("lists browser.open / extract / screenshot with edge hints", () => {
    const ids = listCapabilityCatalog().map((c) => c.id);
    expect(ids).toContain("browser.open");
    expect(ids).toContain("browser.extract");
    expect(ids).toContain("browser.screenshot");
    for (const id of ["browser.open", "browser.extract", "browser.screenshot"]) {
      const spec = getCapabilitySpec(id)!;
      expect(spec.requiresEdge).toBe(true);
      expect(spec.streamRequired).toBe(false);
      expect(spec.suggestedLocality).toBe("local");
    }
  });

  it("seeds local browser mock backend", () => {
    ensureHubSeeded("http://127.0.0.1:43127");
    const backends = findBackendsByCapability("browser.open");
    expect(backends.some((b) => b.id === "bk_mock_browser")).toBe(true);
    expect(backends[0]?.locality).toBe("local");
  });
});

describe("browser mock routes", () => {
  it("open returns mock title and status", async () => {
    const req = new NextRequest("http://localhost/api/mock/caps/browser/open", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await openPost(req);
    const data = await res.json();
    expect(data.mock).toBe(true);
    expect(data.status).toBe(200);
    expect(data.title).toMatch(/Mock/);
    expect(data.finalUrl).toContain("example.com");
  });

  it("extract returns truncated text", async () => {
    const req = new NextRequest(
      "http://localhost/api/mock/caps/browser/extract",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com", maxChars: 40 }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await extractPost(req);
    const data = await res.json();
    expect(data.mock).toBe(true);
    expect(data.truncated).toBe(true);
    expect(data.text.length).toBeLessThanOrEqual(41);
  });

  it("screenshot returns placeholder png metadata", async () => {
    const req = new NextRequest(
      "http://localhost/api/mock/caps/browser/screenshot",
      {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com",
          includeBase64: true,
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await screenshotPost(req);
    const data = await res.json();
    expect(data.mock).toBe(true);
    expect(data.mimeType).toBe("image/png");
    expect(typeof data.imageBase64).toBe("string");
    expect(data.imageBase64.length).toBeGreaterThan(10);
  });
});
