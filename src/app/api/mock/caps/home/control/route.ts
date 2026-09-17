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

  const haEnvPresent = homeAssistantConfigured();
  const state =
    action === "turn_off" ? "off" : action === "toggle" ? "toggled" : "on";

  return NextResponse.json({
    entityId,
    state,
    action,
    // Honest: this handler never proxies to HA — always mock
    mock: true,
    source: "mock" as const,
    haEnvDetected: haEnvPresent,
    note: haEnvPresent
      ? "检测到 HA_BASE_URL/HA_TOKEN，但 Hub 不会代发；本响应仍为 mock。请将真实 HA 注册为 Backend 的 baseUrl。"
      : "未配置 Home Assistant env；返回 mock。配置 HA_BASE_URL + HA_TOKEN 仅作探测，不会自动代发。",
  });
}
