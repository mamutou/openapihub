import { NextRequest, NextResponse } from "next/server";
import { isHubAuthRequired } from "@/lib/auth";
import {
  hasHomeAssistantConfig,
  hasOpenAiCompatibleConfig,
  listCapabilityCatalog,
} from "@/lib/capabilities";
import { ensureHubSeeded } from "@/lib/seed";
import { listSuggestedBackends } from "@/lib/suggestions";

/** Public probe — no Bearer required (so console can detect authRequired). */
export async function GET(request: NextRequest) {
  ensureHubSeeded(request.nextUrl.origin);
  return NextResponse.json({
    capabilities: listCapabilityCatalog(),
    adapters: {
      openaiCompatible: hasOpenAiCompatibleConfig(),
      homeAssistant: hasHomeAssistantConfig(),
    },
    suggestions: listSuggestedBackends(),
    authRequired: isHubAuthRequired(),
    note: "adapters 仅探测环境变量，Hub 不代发密钥；suggestions 可一键预填 Backend（仍不代持密钥）。",
  });
}
