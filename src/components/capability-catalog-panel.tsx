"use client";

import { Cpu, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CapabilitySpec } from "@/lib/capabilities/catalog";

type Props = {
  capabilities: CapabilitySpec[];
  adapters: { openaiCompatible: boolean; homeAssistant: boolean };
  loading?: boolean;
  onTry: (spec: CapabilitySpec) => void;
};

export function CapabilityCatalogPanel({
  capabilities,
  adapters,
  loading,
  onTry,
}: Props) {
  return (
    <Card className="border-teal-900/10 bg-white/85 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Cpu className="size-4 text-teal-800" />
          <CardTitle>能力目录</CardTitle>
          <Badge variant="outline">{capabilities.length} 项</Badge>
        </div>
        <CardDescription>
          标准能力 ID + mock 试调。标有「需端侧」的项在真实环境需部署软硬件；无后端时 mock 仍可跑通。
        </CardDescription>
        <div className="space-y-1 pt-1 text-xs text-muted-foreground">
          <p>
            适配器状态（<strong className="font-medium text-slate-700">仅探测 env，不代发请求</strong>
            ；真实调用请自行注册 Backend baseUrl）：
          </p>
          <div className="flex flex-wrap gap-2">
            <span>
              OpenAI 兼容：
              {adapters.openaiCompatible
                ? "检测到 OPENAI_*（未代发）"
                : "未配置"}
            </span>
            <span>·</span>
            <span>
              Home Assistant：
              {adapters.homeAssistant
                ? "检测到 HA_*（未代发）"
                : "未配置"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && capabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground">加载能力目录…</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((cap) => (
              <li
                key={cap.id}
                className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-medium text-slate-900">{cap.nameZh}</p>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {cap.id}
                  </Badge>
                  {cap.requiresEdge && (
                    <Badge variant="secondary">
                      <Radio className="size-3" />
                      需端侧
                    </Badge>
                  )}
                  {cap.streamRequired && (
                    <Badge variant="default">强制流式</Badge>
                  )}
                  <Badge variant="outline">{cap.suggestedLocality}</Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {cap.description}
                </p>
                <p className="mt-1 text-[11px] text-amber-900/80">
                  {cap.edgeHint}
                </p>
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onTry(cap)}
                  >
                    试调此能力
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
