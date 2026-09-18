import { seedMockDevices } from "@/lib/devices";
import { seedDefaultBackends } from "@/lib/registry";

/** Seed built-in backends + mock hardware devices (idempotent). */
export function ensureHubSeeded(origin: string): void {
  seedDefaultBackends(origin);
  seedMockDevices(origin);
}
