import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Optional personal-deploy token from env. Empty = open (dev-friendly). */
export function getConfiguredHubToken(): string | null {
  const token = process.env.HUB_API_TOKEN?.trim();
  return token ? token : null;
}

export function isHubAuthRequired(): boolean {
  return getConfiguredHubToken() !== null;
}

export function authorizeHubRequest(
  request: NextRequest,
): NextResponse | null {
  const expected = getConfiguredHubToken();
  if (!expected) return null;

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1]?.trim() ?? "";

  if (provided && provided === expected) return null;

  return NextResponse.json(
    {
      error: "需要 Authorization: Bearer <HUB_API_TOKEN>",
      code: "UNAUTHORIZED",
    },
    { status: 401 },
  );
}
