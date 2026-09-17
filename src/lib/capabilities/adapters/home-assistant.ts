/**
 * Home Assistant REST 适配占位。
 * 配置 HA_BASE_URL + HA_TOKEN 后，真实网关可对接 /api/services；
 * 无配置时使用 mock home.control。
 */
import type { HomeControlRequest } from "@/lib/capabilities/types";

export function homeAssistantConfigured(): boolean {
  return Boolean(
    process.env.HA_BASE_URL?.trim() && process.env.HA_TOKEN?.trim(),
  );
}

export function haServiceUrl(domain: string, service: string): string | null {
  const base = process.env.HA_BASE_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/api/services/${domain}/${service}`;
}

export function mapHomeActionToHa(req: HomeControlRequest): {
  domain: string;
  service: string;
  entity_id: string;
} {
  const [domain = "homeassistant"] = req.entityId.split(".");
  const service =
    req.action === "turn_on" || req.action === "turn_off" || req.action === "toggle"
      ? req.action
      : "turn_on";
  return { domain, service, entity_id: req.entityId };
}
