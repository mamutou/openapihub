/** Shared SSE parsing / Hub event framing */

export type SseEvent = { event: string; data: string };

export function parseSseBlocks(buffer: string): {
  events: SseEvent[];
  rest: string;
} {
  const events: SseEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    if (!part.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    events.push({ event, data: dataLines.join("\n") });
  }
  return { events, rest };
}

export function formatSse(event: string, data: unknown): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${payload}\n\n`;
}

/**
 * Map upstream mock/provider SSE into Hub-normalized token payloads.
 * Recognizes { token } and common OpenAI-ish delta shapes; otherwise ignores.
 */
export function extractTokensFromUpstreamEvent(ev: SseEvent): string[] {
  if (!ev.data || ev.data === "[DONE]") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(ev.data);
  } catch {
    // Plain text data line
    if (ev.event === "token" || ev.event === "message") return [ev.data];
    return [];
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.token === "string") return [obj.token];
    // OpenAI chat.completion.chunk style
    const choices = obj.choices;
    if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
      const delta = (choices[0] as { delta?: { content?: string } }).delta;
      if (delta && typeof delta.content === "string" && delta.content) {
        return [delta.content];
      }
    }
  }
  return [];
}

export function isUpstreamTerminal(ev: SseEvent): boolean {
  if (ev.event === "end" || ev.event === "done") return true;
  if (ev.data === "[DONE]") return true;
  try {
    const obj = JSON.parse(ev.data) as { done?: boolean };
    return obj?.done === true;
  } catch {
    return false;
  }
}

/**
 * NDJSON / JSON-lines upstream (e.g. Ollama /api/chat with stream:true, custom
 * services that emit one JSON object per line instead of SSE frames).
 * Recognizes { token | content | text | response }, { message: { content } },
 * { delta } / { delta: { content } }, and OpenAI-ish choices[0].
 * Anything else → no tokens (never forwarded as opaque text).
 */
export function extractTokensFromJsonLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "[DONE]") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;

  for (const key of ["token", "content", "text", "response"] as const) {
    const value = obj[key];
    if (typeof value === "string" && value) return [value];
  }

  const message = obj.message;
  if (message && typeof message === "object") {
    const content = (message as { content?: unknown }).content;
    if (typeof content === "string" && content) return [content];
  }

  const delta = obj.delta;
  if (typeof delta === "string" && delta) return [delta];
  if (delta && typeof delta === "object") {
    const content = (delta as { content?: unknown }).content;
    if (typeof content === "string" && content) return [content];
  }

  const choices = obj.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const first = choices[0] as {
      delta?: { content?: unknown };
      message?: { content?: unknown };
    };
    const content = first.delta?.content ?? first.message?.content;
    if (typeof content === "string" && content) return [content];
  }

  return [];
}

/** Upstream stream framing accepted by the Hub. */
export type UpstreamStreamMode = "sse" | "ndjson" | "none";

export function detectStreamMode(contentType: string | null): UpstreamStreamMode {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("text/event-stream")) return "sse";
  if (/(ndjson|jsonl|json-lines|x-ndjson)/.test(type)) return "ndjson";
  return "none";
}

