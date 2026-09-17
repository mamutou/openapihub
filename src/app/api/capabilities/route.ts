import { NextResponse } from "next/server";
import {
  hasHomeAssistantConfig,
  hasOpenAiCompatibleConfig,
  listCapabilityCatalog,
} from "@/lib/capabilities";
import { seedDefaultBackends } from "@/lib/registry";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  seedDefaultBackends(request.nextUrl.origin);
  return NextResponse.json({
    capabilities: listCapabilityCatalog(),
    adapters: {
      openaiCompatible: hasOpenAiCompatibleConfig(),
      homeAssistant: hasHomeAssistantConfig(),
    },
  });
}
