import { NextRequest, NextResponse } from "next/server";
import { createId } from "@/lib/store";

export async function POST(request: NextRequest) {
  let to = "unknown@example.com";
  let subject = "(no subject)";
  try {
    const body = await request.json();
    if (typeof body.to === "string") to = body.to;
    if (typeof body.subject === "string") subject = body.subject;
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    messageId: createId("mail"),
    accepted: true,
    mock: true,
    to,
    subject,
    note: "mock 邮件：未真实投递。配置 SMTP/代理后可替换此后端。",
  });
}
