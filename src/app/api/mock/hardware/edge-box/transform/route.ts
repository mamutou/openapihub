import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let op = "summarize";
  let text = "";
  try {
    const body = await request.json();
    if (typeof body.op === "string") op = body.op;
    if (typeof body.text === "string") text = body.text;
  } catch {
    /* ignore */
  }
  return NextResponse.json({
    device: "mock-edge-box",
    capability: "text.transform",
    op,
    result: `[edge ${op}] ${text.slice(0, 120)}`,
  });
}
