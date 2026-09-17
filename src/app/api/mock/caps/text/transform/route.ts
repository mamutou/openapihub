import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let op = "summarize";
  let text = "";
  let targetLang = "en";
  try {
    const body = await request.json();
    if (typeof body.op === "string") op = body.op;
    if (typeof body.text === "string") text = body.text;
    if (typeof body.targetLang === "string") targetLang = body.targetLang;
  } catch {
    /* ignore */
  }

  let result: string;
  switch (op) {
    case "uppercase":
      result = text.toUpperCase();
      break;
    case "lowercase":
      result = text.toLowerCase();
      break;
    case "rewrite":
      result = `【改写】${text}`;
      break;
    case "translate":
      result = `【${targetLang}】${text}`;
      break;
    case "summarize":
    default:
      result =
        text.length <= 40
          ? text
          : `${text.slice(0, 40)}…（摘要 mock，共 ${text.length} 字）`;
      break;
  }

  return NextResponse.json({ op, result, engine: "hub-local-mock" });
}
