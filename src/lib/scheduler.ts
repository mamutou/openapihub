import {
  getHardwareProfile,
  privacyTierRank,
  type PrivacyTier,
} from "@/lib/hardware/profiles";
import { getDevice, isDeviceSchedulable, listDevices } from "@/lib/devices";
import { effectiveLocality } from "@/lib/locality";
import { listBackends } from "@/lib/registry";
import type { Backend, Device, Locality } from "@/lib/types";

export type ScheduleInput = {
  capability: string;
  streaming?: boolean;
  preferLocal?: boolean;
  allowRemoteCompute?: boolean;
  /** Default true — skip unhealthy / unplugged devices */
  healthyOnly?: boolean;
  /**
   * Minimum privacy affinity. Candidates with lower rank are skipped.
   * Example: require "edge" → drops cloud-ok profiles when preferLocal paths exist.
   */
  minPrivacyTier?: PrivacyTier;
};

export type ScheduleCandidate = {
  backendId: string;
  backendName: string;
  locality: Locality;
  deviceId?: string;
  deviceName?: string;
  hardwareProfileId?: string;
  score: number;
  reasons: string[];
};

export type ScheduleResult = {
  backendId: string;
  deviceId?: string;
  score: number;
  reason: string;
  candidates: ScheduleCandidate[];
};

/**
 * Score a backend (+ optional device) for capability routing.
 * Extension points: cost, power budget, queue depth — add as negative terms later.
 */
export function scoreCandidate(opts: {
  backend: Backend;
  device?: Device;
  input: ScheduleInput;
}): ScheduleCandidate {
  const { device, input } = opts;
  const backend = {
    ...opts.backend,
    locality: effectiveLocality(opts.backend),
  };
  const reasons: string[] = [];
  let score = 50;

  if (backend.locality === "local") {
    score += input.preferLocal ? 25 : 10;
    reasons.push(input.preferLocal ? "preferLocal→local +25" : "local +10");
  } else {
    score += input.preferLocal ? -20 : 5;
    reasons.push(input.preferLocal ? "preferLocal惩罚 remote -20" : "remote +5");
  }

  if (input.streaming) {
    if (backend.supportsStreaming) {
      score += 15;
      reasons.push("supportsStreaming +15");
    } else {
      score -= 40;
      reasons.push("缺流式 -40");
    }
  }

  if (device) {
    const profile = getHardwareProfile(device.hardwareProfileId);
    if (profile) {
      score += privacyTierRank(profile.privacyTier) * 8;
      reasons.push(
        `privacyTier=${profile.privacyTier} +${privacyTierRank(profile.privacyTier) * 8}`,
      );
      if (profile.computeKind === "npu" && input.capability === "llm.chat") {
        score += 12;
        reasons.push("npu↔llm.chat +12");
      }
    }
    const latency = device.latencyHintMs;
    const latencyBonus = Math.max(0, 20 - Math.floor(latency / 5));
    score += latencyBonus;
    reasons.push(`latencyHint ${latency}ms +${latencyBonus}`);
    if (isDeviceSchedulable(device)) {
      score += 8;
      reasons.push("设备 online +8");
    }
  } else {
    reasons.push("无设备绑定（纯 Backend）");
  }

  // Reserved hooks for future cost/power (currently no-op documentation)
  // score -= costWeight * estimatedCost
  // score -= powerWeight * watts

  return {
    backendId: backend.id,
    backendName: backend.name,
    locality: backend.locality,
    deviceId: device?.id,
    deviceName: device?.name,
    hardwareProfileId: device?.hardwareProfileId,
    score,
    reasons,
  };
}

/**
 * Pick best Backend for a capability. Manual backendId bypasses this in router.
 */
export function schedule(input: ScheduleInput): ScheduleResult {
  const healthyOnly = input.healthyOnly !== false;
  const backends = listBackends().filter(
    (b) => b.enabled && b.capabilities.includes(input.capability),
  );

  if (!input.allowRemoteCompute) {
    // caller usually pre-filters; keep invariant here too
  }

  const devicesByBackend = new Map<string, Device>();
  for (const d of listDevices()) {
    if (d.backendId) devicesByBackend.set(d.backendId, d);
  }

  const candidates: ScheduleCandidate[] = [];

  for (const raw of backends) {
    const backend = {
      ...raw,
      locality: effectiveLocality(raw),
      supportsStreaming:
        effectiveLocality(raw) === "remote"
          ? true
          : raw.supportsStreaming,
    };
    if (!input.allowRemoteCompute && backend.locality === "remote") continue;
    if (input.streaming && backend.locality === "remote" && !backend.supportsStreaming) {
      continue;
    }
    if (!input.streaming && backend.locality === "remote") {
      // P0: remote never unary — exclude from unary schedule pool
      continue;
    }

    const device = devicesByBackend.get(backend.id) ?? (
      backend.deviceId ? getDevice(backend.deviceId) : undefined
    );

    if (device) {
      if (healthyOnly && !isDeviceSchedulable(device)) {
        continue;
      }
      const profile = getHardwareProfile(device.hardwareProfileId);
      if (input.minPrivacyTier && profile) {
        if (privacyTierRank(profile.privacyTier) < privacyTierRank(input.minPrivacyTier)) {
          continue;
        }
      }
      // local-only hardware must not be treated as cloud path
      if (profile?.privacyTier === "local-only" && backend.locality === "remote") {
        continue;
      }
    }

    candidates.push(scoreCandidate({ backend, device, input }));
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    throw new Error(
      `调度失败：没有可用候选（capability=${input.capability}, streaming=${Boolean(input.streaming)}）`,
    );
  }

  const best = candidates[0];
  const reason = [
    `选中 ${best.deviceName ?? best.backendName}`,
    `score=${best.score}`,
    best.reasons.join("；"),
  ].join(" · ");

  return {
    backendId: best.backendId,
    deviceId: best.deviceId,
    score: best.score,
    reason,
    candidates,
  };
}
