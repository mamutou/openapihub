const TOKEN_KEY = "openapihub.hubApiToken";

export function getHubApiToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(TOKEN_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setHubApiToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = token.trim();
    if (trimmed) sessionStorage.setItem(TOKEN_KEY, trimmed);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** fetch with optional Bearer from sessionStorage */
export async function hubFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getHubApiToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
