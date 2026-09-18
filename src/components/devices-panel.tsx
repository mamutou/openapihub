"use client";

import { Cable, HeartPulse, Plug, PlugZap, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { HardwareProfile } from "@/lib/hardware/profiles";
import type { Device } from "@/lib/types";

type Props = {
  devices: Device[];
  profiles: HardwareProfile[];
  loading?: boolean;
  busyId?: string | null;
  schedulePreview?: string;
  onRefresh: () => void;
  onHeartbeat: (id: string) => void;
  onTogglePlug: (device: Device) => void;
  onToggleEnabled: (device: Device) => void;
  onPreviewSchedule: (capability: string) => void;
};

export function DevicesPanel({
  devices,
  profiles,
  loading,
  busyId,
  schedulePreview,
  onRefresh,
  onHeartbeat,
  onTogglePlug,
  onToggleEnabled,
  onPreviewSchedule,
}: Props) {
  const profileName = (id: string) =>
    profiles.find((p) => p.id === id)?.nameZh ?? id;

  return (
    <Card className="border-teal-900/10 bg-white/85 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Cable className="size-4 text-teal-800" />
            <CardTitle>设备 / 硬件</CardTitle>
            <Badge variant="outline">{devices.length} 台</Badge>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
            刷新设备
          </Button>
        </div>
        <CardDescription>
          可插拔硬件节点骨架：注册、心跳、模拟拔插。设备可绑定 Backend，调度器只选
          online 节点。discovery 目前为 manual / mock。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">加载设备…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无设备</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200/90 bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-medium text-slate-900">{d.name}</p>
                  <Badge
                    variant={
                      d.status === "online"
                        ? "default"
                        : d.status === "unplugged"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {d.status}
                  </Badge>
                  <Badge variant="outline">{profileName(d.hardwareProfileId)}</Badge>
                </div>
                <p className="font-mono text-[10px] break-all text-slate-500">
                  {d.baseUrl}
                </p>
                <p className="text-[11px] text-slate-600">
                  能力：{d.capabilities.join(", ")} · 延迟提示{" "}
                  {d.latencyHintMs}ms
                  {d.backendId ? ` · Backend ${d.backendId}` : ""}
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === d.id}
                    onClick={() => onHeartbeat(d.id)}
                  >
                    <HeartPulse className="size-3.5" />
                    心跳
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === d.id}
                    onClick={() => onTogglePlug(d)}
                  >
                    {d.pluggedIn ? (
                      <>
                        <Unplug className="size-3.5" />
                        模拟拔出
                      </>
                    ) : (
                      <>
                        <PlugZap className="size-3.5" />
                        插回
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busyId === d.id}
                    onClick={() => onToggleEnabled(d)}
                  >
                    <Plug className="size-3.5" />
                    {d.enabled ? "禁用" : "启用"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg border border-teal-800/15 bg-teal-50/40 p-3">
          <p className="text-xs font-medium text-slate-800">调度试调</p>
          <p className="mt-1 text-[11px] text-slate-600">
            按能力干跑 schedule()，查看为何选中该设备（不影响隐私硬门）。
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["llm.chat", "echo.message", "text.transform"].map((cap) => (
              <Button
                key={cap}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onPreviewSchedule(cap)}
              >
                {cap}
              </Button>
            ))}
          </div>
          {schedulePreview && (
            <p className="mt-2 text-xs leading-relaxed text-slate-700">
              {schedulePreview}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
