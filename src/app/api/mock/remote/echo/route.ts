import { NextResponse } from "next/server";

/** remote mock 只提供流式；一元调用请走 /echo/stream */
export async function POST() {
  return NextResponse.json(
    {
      error: "remote mock 仅支持流式输出",
      use: "/api/mock/remote/echo/stream",
      ephemeral: true,
    },
    { status: 405 },
  );
}

export async function GET() {
  return NextResponse.json({
    flavor: "remote",
    streamingRequired: true,
    streamPath: "/echo/stream",
    capability: "echo.message",
  });
}
