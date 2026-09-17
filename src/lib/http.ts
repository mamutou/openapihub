/** Upstream fetch timeouts / abort helpers (injectable for tests). */

export const UNARY_TIMEOUT_MS = 30_000;
/** Time allowed to establish the upstream stream connection (not full stream duration). */
export const STREAM_CONNECT_TIMEOUT_MS = 60_000;

export function createTimeoutSignal(
  ms: number,
  external?: AbortSignal,
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(
      new DOMException(`上游请求超时（${ms}ms）`, "TimeoutError"),
    );
  }, ms);

  const onExternalAbort = () => {
    controller.abort(external?.reason ?? new DOMException("已取消", "AbortError"));
  };

  if (external) {
    if (external.aborted) onExternalAbort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      if (external) external.removeEventListener("abort", onExternalAbort);
    },
  };
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "AbortError" || name === "TimeoutError";
}

export function abortErrorMessage(error: unknown, fallback: string): string {
  if (isAbortError(error)) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("超时")) return msg;
    return "请求已取消或超时";
  }
  return error instanceof Error ? error.message : fallback;
}
