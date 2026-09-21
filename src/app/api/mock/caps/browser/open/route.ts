import { NextRequest, NextResponse } from "next/server";

function readUrl(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "url" in body &&
    typeof (body as { url: unknown }).url === "string"
  ) {
    return (body as { url: string }).url.trim();
  }
  return "https://example.com";
}

/** Mock browser.open — no real Chromium */
export async function POST(request: NextRequest) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const url = readUrl(body);
  let host = "example.com";
  try {
    host = new URL(url).hostname;
  } catch {
    /* keep default */
  }

  return NextResponse.json({
    url,
    finalUrl: url,
    title: `Mock page · ${host}`,
    status: 200,
    mock: true as const,
    source: "mock" as const,
    note: "Hub 未内嵌 Chromium。请将 Playwright/Puppeteer HTTP 服务注册为 Backend（capabilities: browser.open）。",
  });
}
