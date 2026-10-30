import { isLoopbackHostname } from "@/lib/auth";
import { seedMockDevices } from "@/lib/devices";
import { seedDefaultBackends } from "@/lib/registry";

/**
 * Built-in mocks are called by the Hub process itself, so their URLs always
 * target loopback. A console opened through a LAN address therefore still works,
 * while `/api/mock/*` stays unreachable from other machines (see middleware).
 */
export function hubSelfOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if (isLoopbackHostname(url.hostname)) return origin.replace(/\/+$/, "");
    return `http://127.0.0.1${url.port ? `:${url.port}` : ""}`;
  } catch {
    return origin.replace(/\/+$/, "");
  }
}

/** Seed built-in backends + mock hardware devices (idempotent). */
export function ensureHubSeeded(origin: string): void {
  const self = hubSelfOrigin(origin);
  seedDefaultBackends(self);
  seedMockDevices(self);
}
