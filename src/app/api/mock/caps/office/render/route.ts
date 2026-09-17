import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let filename = "document.docx";
  let action = "extract_text";
  try {
    const body = await request.json();
    if (typeof body.filename === "string") filename = body.filename;
    if (typeof body.action === "string") action = body.action;
  } catch {
    /* ignore */
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const mimeHint =
    ext === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : ext === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : ext === "pptx"
          ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          : "application/octet-stream";

  return NextResponse.json({
    filename,
    mimeHint,
    pages: 3,
    action,
    textPreview:
      action === "metadata"
        ? `元数据 mock：${filename} · 3 页`
        : `（mock 抽取）${filename} 的正文预览。真实模式可接 LibreOffice / 文档服务。`,
    mock: true as const,
  });
}
