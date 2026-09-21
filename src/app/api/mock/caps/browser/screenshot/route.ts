import { NextRequest, NextResponse } from "next/server";

/** 1×1 PNG placeholder */
const PLACEHOLDER_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

/** Mock browser.screenshot — metadata + optional tiny PNG */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const url = readUrl(body);
  const fullPage = Boolean(body.fullPage);
  const includeBase64 = body.includeBase64 !== false;

  let host = "example.com";
  try {
    host = new URL(url).hostname;
  } catch {
    /* ignore */
  }

  const width = fullPage ? 1280 : 800;
  const height = fullPage ? 2400 : 600;
  const byteLength = Math.floor((PLACEHOLDER_PNG_BASE64.length * 3) / 4);

  return NextResponse.json({
    url,
    finalUrl: url,
    title: `Mock screenshot · ${host}`,
    width,
    height,
    mimeType: "image/png" as const,
    ...(includeBase64 ? { imageBase64: PLACEHOLDER_PNG_BASE64 } : {}),
    byteLength,
    fullPage,
    mock: true as const,
    source: "mock" as const,
    note: "占位 PNG。真实截图请接浏览器服务 Backend。Hub 仅在 retainPayloads=true 时把 base64 写入历史。",
  });
}
