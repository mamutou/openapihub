import { NextRequest, NextResponse } from "next/server";
import { homeAssistantConfigured } from "@/lib/capabilities/adapters/home-assistant";

export async function POST(request: NextRequest) {
  let entityId = "light.demo";
  let action = "turn_on";
  try {
    const body = await request.json();
    if (typeof body.entityId === "string") entityId = body.entityId;
    if (typeof body.action === "string") action = body.action;
  } catch {
    /* ignore */
  }

  const ha = homeAssistantConfigured();
  const state =
    action === "turn_off" ? "off" : action === "toggle" ? "toggled" : "on";

  return NextResponse.json({
    entityId,
    state,
    action,
    mock: !ha,
    source: ha ? ("home-assistant" as const) : ("mock" as const),
    note: ha
      ? "检测到 HA_BASE_URL/HA_TOKEN；本 mock 仍返回模拟状态。请将真实 HA 注册为独立后端。"
      : "未配置 Home Assistant，返回 mock 状态。设置 HA_BASE_URL + HA_TOKEN 后可对接真实网关。",
  });
}
