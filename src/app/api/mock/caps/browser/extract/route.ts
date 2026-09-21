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

/** Mock browser.extract */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const url = readUrl(body);
  const maxChars =
    typeof body.maxChars === "number" && body.maxChars > 0
      ? Math.floor(body.maxChars)
      : 800;
  const selector =
    typeof body.selector === "string" ? body.selector : "body";

  let host = "example.com";
  try {
    host = new URL(url).hostname;
  } catch {
    /* ignore */
  }

  const full = [
    `这是 OpenAPIHub browser.extract mock 文本。`,
    `目标：${url}`,
    `选择器：${selector}`,
    `主机：${host}`,
    `真实部署请注册 Playwright/Puppeteer 服务为 Backend（capability browser.extract）。`,
    `默认 retainPayloads=false，Hub 历史不落正文。`,
  ].join("\n");

  const truncated = full.length > maxChars;
  const text = truncated ? `${full.slice(0, maxChars)}…` : full;

  return NextResponse.json({
    url,
    finalUrl: url,
    title: `Mock extract · ${host}`,
    text,
    truncated,
    mock: true as const,
    source: "mock" as const,
  });
}
