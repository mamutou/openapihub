import type { Locality } from "@/lib/types";

/**
 * Hosts treated as local for locality inference.
 * Extend via HUB_LOCAL_HOST_ALLOWLIST=host1,host2
 */
function allowlistHosts(): Set<string> {
  const raw = process.env.HUB_LOCAL_HOST_ALLOWLIST?.trim() ?? "";
  const set = new Set<string>([
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0", // hub-relative mock origins sometimes use this
  ]);
  if (raw) {
    for (const part of raw.split(/[,;\s]+/)) {
      const h = part.trim().toLowerCase();
      if (h) set.add(h);
    }
  }
  return set;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const octet = Number(p);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

/** RFC1918 + loopback + link-local. */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (allowlistHosts().has(host)) return true;
  if (host.endsWith(".local")) return true;
  if (host === "::1" || host.startsWith("fe80:")) return true;

  const n = ipv4ToInt(host);
  if (n === null) return false;

  // 127.0.0.0/8
  if ((n >>> 24) === 127) return true;
  // 10.0.0.0/8
  if ((n >>> 24) === 10) return true;
  // 172.16.0.0/12
  if ((n >>> 24) === 172 && ((n >>> 16) & 0xf0) === 16) return true;
  // 192.168.0.0/16
  if ((n >>> 16) === 0xc0a8) return true;
  // 169.254.0.0/16 link-local
  if ((n >>> 16) === 0xa9fe) return true;

  return false;
}

/**
 * Infer locality from baseUrl host. Public / unknown → remote.
 */
export function inferLocalityFromUrl(baseUrl: string): Locality {
  try {
    const url = new URL(baseUrl.includes("://") ? baseUrl : `http://${baseUrl}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "remote";
    }
    return isPrivateOrLoopbackHost(url.hostname) ? "local" : "remote";
  } catch {
    return "remote";
  }
}

export type LocalityCoercion = {
  locality: Locality;
  coerced: boolean;
  inferred: Locality;
  reason?: string;
};

/**
 * Registration: public URL cannot be declared local — coerce to remote.
 */
export function coerceLocalityForUrl(
  baseUrl: string,
  declared: Locality,
): LocalityCoercion {
  const inferred = inferLocalityFromUrl(baseUrl);
  if (declared === "local" && inferred === "remote") {
    return {
      locality: "remote",
      coerced: true,
      inferred,
      reason:
        "baseUrl 主机不是 loopback/私网，已将 locality 纠正为 remote（禁止用 local 绕过一元硬门）",
    };
  }
  return { locality: declared, coerced: false, inferred };
}

/**
 * Runtime effective locality: never treat a public URL as local.
 */
export function effectiveLocality(backend: {
  baseUrl: string;
  locality: Locality;
}): Locality {
  const inferred = inferLocalityFromUrl(backend.baseUrl);
  if (inferred === "remote") return "remote";
  return backend.locality;
}

/** Alias used by suggestions / older call sites */
export function localityFromUrl(url: string): Locality {
  return inferLocalityFromUrl(url);
}
