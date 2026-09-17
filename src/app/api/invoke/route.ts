import { NextRequest, NextResponse } from "next/server";
import { seedDefaultBackends } from "@/lib/registry";
import { routeInvoke } from "@/lib/router";
import type { InvokeRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  seedDefaultBackends(request.nextUrl.origin);

  let body: InvokeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  try {
    const { invocation, data } = await routeInvoke({
      capability: body.capability ? String(body.capability) : undefined,
      backendId: body.backendId ? String(body.backendId) : undefined,
      path: body.path ? String(body.path) : undefined,
      method: body.method ? String(body.method) : undefined,
      body: body.body,
    });

    const status =
      invocation.status === "success" ? 200 : invocation.httpStatus ?? 502;

    return NextResponse.json(
      {
        invocation,
        result: data,
      },
      { status },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "调用失败" },
      { status: 400 },
    );
  }
}
