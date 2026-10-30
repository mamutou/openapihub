import fs from "node:fs";
import path from "node:path";
import type { Backend, DataPolicy, Device, Invocation } from "@/lib/types";

export type PersistedHubState = {
  version: 1;
  seedVersion: number;
  policy: DataPolicy;
  backends: Backend[];
  devices?: Device[];
  /** Metadata-only by default (no request/response bodies unless retainPayloads). */
  invocations: Invocation[];
};

/** Persist only when not in Vitest, unless HUB_DATA_DIR is explicitly set. */
export function persistEnabled(): boolean {
  if (process.env.HUB_PERSIST === "0") return false;
  if (process.env.HUB_PERSIST === "1") return true;
  if (process.env.VITEST && !process.env.HUB_DATA_DIR) return false;
  return true;
}

export function getDataDir(): string {
  const custom = process.env.HUB_DATA_DIR?.trim();
  if (custom) return path.resolve(custom);
  return path.join(process.cwd(), "data");
}

export function getStateFilePath(): string {
  return path.join(getDataDir(), "hub-state.json");
}

export function readPersistedState(): PersistedHubState | null {
  if (!persistEnabled()) return null;
  const file = getStateFilePath();
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as PersistedHubState;
    if (!parsed || parsed.version !== 1) return null;
    if (!Array.isArray(parsed.backends)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedState(state: PersistedHubState): void {
  if (!persistEnabled()) return;
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = getStateFilePath();
  const tmp = `${file}.${process.pid}.tmp`;
  const json = JSON.stringify(state, null, 2);
  // 0600: state may carry retained payloads and backend URLs.
  fs.writeFileSync(tmp, json, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* best effort (e.g. exotic filesystems) */
  }
}
