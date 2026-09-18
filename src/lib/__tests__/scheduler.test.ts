import { afterEach, describe, expect, it } from "vitest";
import {
  MOCK_DEVICE_BACKEND_IDS,
  MOCK_DEVICE_IDS,
  updateDevice,
} from "@/lib/devices";
import { schedule } from "@/lib/scheduler";
import { ensureHubSeeded } from "@/lib/seed";
import { resetStoreForTests } from "@/lib/store";
import { listHardwareProfiles } from "@/lib/hardware/profiles";

afterEach(() => {
  resetStoreForTests();
});

function seed() {
  ensureHubSeeded("http://127.0.0.1:43127");
}

describe("hardware scheduler", () => {
  it("lists hardware profiles with required fields", () => {
    const profiles = listHardwareProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(2);
    for (const p of profiles) {
      expect(p.computeKind).toMatch(/cpu|gpu|npu|other/);
      expect(typeof p.supportsStreaming).toBe("boolean");
      expect(p.privacyTier).toMatch(/local-only|edge|cloud-ok/);
      expect(p.maxConcurrency).toBeGreaterThan(0);
    }
  });

  it("prefers mock NPU stick for llm.chat when plugged in", () => {
    seed();
    const result = schedule({
      capability: "llm.chat",
      streaming: true,
      preferLocal: true,
      allowRemoteCompute: true,
    });
    expect(result.backendId).toBe(MOCK_DEVICE_BACKEND_IDS.npuStick);
    expect(result.deviceId).toBe(MOCK_DEVICE_IDS.npuStick);
    expect(result.reason).toMatch(/NPU|npu|score=/i);
  });

  it("stops selecting NPU after unplug", () => {
    seed();
    updateDevice(MOCK_DEVICE_IDS.npuStick, { pluggedIn: false });
    const result = schedule({
      capability: "llm.chat",
      streaming: true,
      preferLocal: false,
      allowRemoteCompute: true,
    });
    expect(result.backendId).not.toBe(MOCK_DEVICE_BACKEND_IDS.npuStick);
    expect(result.backendId).toBe("bk_mock_llm");
  });

  it("prefers edge box for echo.message streaming", () => {
    seed();
    const result = schedule({
      capability: "echo.message",
      streaming: true,
      preferLocal: true,
      allowRemoteCompute: true,
    });
    expect(result.backendId).toBe(MOCK_DEVICE_BACKEND_IDS.edgeBox);
  });
});
