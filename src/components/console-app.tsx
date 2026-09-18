"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from "lucide-react";
import { CapabilityCatalogPanel } from "@/components/capability-catalog-panel";
import { DevicesPanel } from "@/components/devices-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CapabilitySpec } from "@/lib/capabilities/catalog";
import type { HardwareProfile } from "@/lib/hardware/profiles";
import {
  getHubApiToken,
  hubFetch,
  setHubApiToken,
} from "@/lib/hub-client";
import type { SuggestedBackend } from "@/lib/suggestions";
import type { Backend, DataPolicy, Device, Invocation, Locality } from "@/lib/types";
import { parseSseBlocks } from "@/lib/sse";

type LoadState = "idle" | "loading" | "error";

export function ConsoleApp() {
  const [backends, setBackends] = useState<Backend[]>([]);
  const [invocations, setInvocations] = useState<Invocation[]>([]);
  const [policy, setPolicy] = useState<DataPolicy | null>(null);
  const [backendsState, setBackendsState] = useState<LoadState>("loading");
  const [invocationsState, setInvocationsState] = useState<LoadState>("loading");
  const [policyState, setPolicyState] = useState<LoadState>("loading");
  const [backendsError, setBackendsError] = useState("");
  const [invocationsError, setInvocationsError] = useState("");
  const [policyError, setPolicyError] = useState("");
  const [policySaving, setPolicySaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formCapabilities, setFormCapabilities] = useState("echo.message");
  const [formLocality, setFormLocality] = useState<Locality>("local");
  const [formStreaming, setFormStreaming] = useState(false);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const [routeMode, setRouteMode] = useState<"capability" | "backend">(
    "backend",
  );
  const [capability, setCapability] = useState("echo.message");
  const [backendId, setBackendId] = useState("");
  const [invokePath, setInvokePath] = useState("/echo");
  const [invokeBody, setInvokeBody] = useState(
    '{\n  "message": "云算力 · 本地收看"\n}',
  );
  const [invoking, setInvoking] = useState(false);
  const [invokeError, setInvokeError] = useState("");
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [streamLive, setStreamLive] = useState("");
  const [catalog, setCatalog] = useState<CapabilitySpec[]>([]);
  const [adapters, setAdapters] = useState({
    openaiCompatible: false,
    homeAssistant: false,
  });
  const [suggestions, setSuggestions] = useState<SuggestedBackend[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [hubToken, setHubToken] = useState(() => getHubApiToken());
  const [tokenDraft, setTokenDraft] = useState(() => getHubApiToken());
  const [devices, setDevices] = useState<Device[]>([]);
  const [hardwareProfiles, setHardwareProfiles] = useState<HardwareProfile[]>(
    [],
  );
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceBusyId, setDeviceBusyId] = useState<string | null>(null);
  const [schedulePreview, setSchedulePreview] = useState("");
  const [lastScheduleReason, setLastScheduleReason] = useState("");

  const selectedBackend = backends.find((b) => b.id === backendId);
  const useStream =
    routeMode === "backend"
      ? selectedBackend?.locality === "remote"
      : false;

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await hubFetch("/api/capabilities", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载能力目录失败");
      setCatalog(data.capabilities ?? []);
      setAdapters(
        data.adapters ?? { openaiCompatible: false, homeAssistant: false },
      );
      setSuggestions(data.suggestions ?? []);
      setAuthRequired(Boolean(data.authRequired));
    } catch {
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadPolicy = useCallback(async (opts?: { showLoading?: boolean }) => {
    if (opts?.showLoading) setPolicyState("loading");
    try {
      const res = await hubFetch("/api/policy", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载策略失败");
      setPolicy(data.policy);
      if (typeof data.authRequired === "boolean") {
        setAuthRequired(data.authRequired);
      }
      setPolicyError("");
      setPolicyState("idle");
    } catch (error) {
      setPolicyState("error");
      setPolicyError(error instanceof Error ? error.message : "加载策略失败");
    }
  }, []);

  const loadBackends = useCallback(async (opts?: { showLoading?: boolean }) => {
    if (opts?.showLoading) setBackendsState("loading");
    try {
      const res = await hubFetch("/api/backends", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载后端失败");
      const list: Backend[] = data.backends ?? [];
      setBackends(list);
      setBackendsError("");
      setBackendsState("idle");
      setBackendId((current) => current || list.find((b) => b.locality === "remote")?.id || list[0]?.id || "");
    } catch (error) {
      setBackendsState("error");
      setBackendsError(error instanceof Error ? error.message : "加载后端失败");
    }
  }, []);

  const loadInvocations = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      if (opts?.showLoading) setInvocationsState("loading");
      try {
        const res = await hubFetch("/api/invocations?limit=40", {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "加载调用记录失败");
        setInvocations(data.invocations ?? []);
        setInvocationsError("");
        setInvocationsState("idle");
      } catch (error) {
        setInvocationsState("error");
        setInvocationsError(
          error instanceof Error ? error.message : "加载调用记录失败",
        );
      }
    },
    [],
  );

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const res = await hubFetch("/api/devices", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载设备失败");
      setDevices(data.devices ?? []);
      setHardwareProfiles(data.profiles ?? []);
    } catch {
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const res = await hubFetch("/api/capabilities", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setCatalog(data.capabilities ?? []);
          setAdapters(
            data.adapters ?? {
              openaiCompatible: false,
              homeAssistant: false,
            },
          );
          setSuggestions(data.suggestions ?? []);
          setAuthRequired(Boolean(data.authRequired));
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }

      try {
        const res = await hubFetch("/api/policy", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "加载策略失败");
        setPolicy(data.policy);
        if (typeof data.authRequired === "boolean") {
          setAuthRequired(data.authRequired);
        }
        setPolicyState("idle");
      } catch (error) {
        if (cancelled) return;
        setPolicyState("error");
        setPolicyError(error instanceof Error ? error.message : "加载策略失败");
      }
      try {
        const res = await hubFetch("/api/backends", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "加载后端失败");
        const list: Backend[] = data.backends ?? [];
        setBackends(list);
        setBackendsState("idle");
        const initial =
          list.find((b) => b.locality === "remote") ?? list[0];
        if (initial) {
          setBackendId((current) => current || initial.id);
          setInvokePath(
            initial.locality === "remote" ? "/echo/stream" : "/echo",
          );
        }
      } catch (error) {
        if (cancelled) return;
        setBackendsState("error");
        setBackendsError(error instanceof Error ? error.message : "加载后端失败");
      }
      try {
        const res = await hubFetch("/api/invocations?limit=40", {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "加载调用记录失败");
        setInvocations(data.invocations ?? []);
        setInvocationsState("idle");
      } catch (error) {
        if (cancelled) return;
        setInvocationsState("error");
        setInvocationsError(
          error instanceof Error ? error.message : "加载调用记录失败",
        );
      }

      try {
        const res = await hubFetch("/api/devices", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setDevices(data.devices ?? []);
          setHardwareProfiles(data.profiles ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setDevicesLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [hubToken]);

  function tryCapability(spec: CapabilitySpec) {
    setCapability(spec.id);
    const streamPath = spec.defaultStreamPath ?? spec.defaultPath;
    const wantsStream =
      spec.streamRequired || Boolean(spec.defaultStreamPath);
    setInvokeBody(JSON.stringify(spec.sampleBody, null, 2));
    setInvokeError("");
    setLastResult(null);
    setStreamLive("");

    const candidates = backends.filter(
      (b) => b.enabled && b.capabilities.includes(spec.id),
    );
    const match = wantsStream
      ? (candidates.find(
          (b) => b.supportsStreaming && b.locality === "remote",
        ) ??
          candidates.find((b) => b.supportsStreaming) ??
          candidates[0])
      : (candidates.find((b) => b.locality === "local") ?? candidates[0]);

    if (match) {
      setRouteMode("backend");
      setBackendId(match.id);
      const useStream =
        wantsStream &&
        (match.supportsStreaming || match.locality === "remote");
      setInvokePath(useStream ? streamPath : spec.defaultPath);
    } else {
      setRouteMode("capability");
      setInvokePath(wantsStream ? streamPath : spec.defaultPath);
    }

    document
      .getElementById("invoke-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveToken() {
    setHubApiToken(tokenDraft);
    setHubToken(tokenDraft.trim());
  }

  async function deviceHeartbeat(id: string) {
    setDeviceBusyId(id);
    try {
      const res = await hubFetch(`/api/devices/${id}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probe: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "心跳失败");
      await loadDevices();
      await loadBackends();
    } catch (error) {
      setBackendsError(error instanceof Error ? error.message : "心跳失败");
    } finally {
      setDeviceBusyId(null);
    }
  }

  async function toggleDevicePlug(device: Device) {
    setDeviceBusyId(device.id);
    try {
      const res = await hubFetch(`/api/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluggedIn: !device.pluggedIn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "拔插失败");
      await loadDevices();
      await loadBackends();
    } catch (error) {
      setBackendsError(error instanceof Error ? error.message : "拔插失败");
    } finally {
      setDeviceBusyId(null);
    }
  }

  async function toggleDeviceEnabled(device: Device) {
    setDeviceBusyId(device.id);
    try {
      const res = await hubFetch(`/api/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !device.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新设备失败");
      await loadDevices();
      await loadBackends();
    } catch (error) {
      setBackendsError(
        error instanceof Error ? error.message : "更新设备失败",
      );
    } finally {
      setDeviceBusyId(null);
    }
  }

  async function previewSchedule(capability: string) {
    setSchedulePreview("调度中…");
    try {
      const res = await hubFetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capability, streaming: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "调度失败");
      setSchedulePreview(data.schedule?.reason || JSON.stringify(data.schedule));
    } catch (error) {
      setSchedulePreview(
        error instanceof Error ? error.message : "调度失败",
      );
    }
  }

  async function addSuggestedBackend(suggestion: SuggestedBackend) {
    setSuggesting(true);
    setFormError("");
    try {
      const exists = backends.some(
        (b) =>
          b.baseUrl === suggestion.baseUrl.replace(/\/+$/, "") &&
          suggestion.capabilities.every((c) => b.capabilities.includes(c)),
      );
      if (exists) {
        setFormError("已存在相同 baseUrl 的 Backend，无需重复添加");
        return;
      }
      const res = await hubFetch("/api/backends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: suggestion.name,
          baseUrl: suggestion.baseUrl,
          capabilities: suggestion.capabilities,
          locality: suggestion.locality,
          supportsStreaming: suggestion.supportsStreaming,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "添加建议 Backend 失败");
      await loadBackends();
      if (data.backend?.id) setBackendId(data.backend.id);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "添加建议 Backend 失败",
      );
    } finally {
      setSuggesting(false);
    }
  }

  async function patchPolicy(
    patch: Partial<
      Pick<
        DataPolicy,
        "preferLocal" | "allowRemoteCompute" | "retainPayloads"
      >
    >,
  ) {
    setPolicySaving(true);
    setPolicyError("");
    try {
      const res = await hubFetch("/api/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新策略失败");
      setPolicy(data.policy);
    } catch (error) {
      setPolicyError(error instanceof Error ? error.message : "更新策略失败");
    } finally {
      setPolicySaving(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError("");
    try {
      const res = await hubFetch("/api/backends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          baseUrl: formBaseUrl,
          capabilities: formCapabilities.split(/[,，\s]+/).filter(Boolean),
          locality: formLocality,
          supportsStreaming:
            formLocality === "remote" ? true : formStreaming,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      setFormName("");
      setFormBaseUrl("");
      setFormCapabilities("echo.message");
      setFormLocality("local");
      setFormStreaming(false);
      await loadBackends();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(backend: Backend) {
    setBusyId(backend.id);
    try {
      const res = await hubFetch(`/api/backends/${backend.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !backend.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新失败");
      await loadBackends();
    } catch (error) {
      setBackendsError(error instanceof Error ? error.message : "更新失败");
    } finally {
      setBusyId(null);
    }
  }

  async function removeBackend(id: string) {
    setBusyId(id);
    try {
      const res = await hubFetch(`/api/backends/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      if (backendId === id) setBackendId("");
      await loadBackends();
    } catch (error) {
      setBackendsError(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  }

  async function invokeUnary(payload: object) {
    const res = await hubFetch("/api/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok && !data.invocation) {
      throw new Error(data.error || "调用失败");
    }
    setLastResult(data);
    if (data.schedule?.reason) {
      setLastScheduleReason(String(data.schedule.reason));
    }
    if (!res.ok) {
      setInvokeError(data.error || data.invocation?.error || "上游返回错误");
    }
  }

  async function invokeStream(payload: object) {
    setStreamLive("");
    const res = await hubFetch("/api/invoke/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `流式调用失败 (${res.status})`);
    }
    if (!res.body) throw new Error("响应没有可读流");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let live = "";
    let doneMeta: unknown = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseBlocks(buffer);
      buffer = parsed.rest;
      for (const ev of parsed.events) {
        if (ev.event === "token") {
          try {
            const data = JSON.parse(ev.data) as { token?: string };
            if (typeof data.token === "string") {
              live += data.token;
              setStreamLive(live);
            }
          } catch {
            /* ignore */
          }
        } else if (ev.event === "done" || ev.event === "meta") {
          try {
            doneMeta = JSON.parse(ev.data);
            if (ev.event === "meta") {
              const meta = doneMeta as {
                scheduleReason?: string;
              };
              if (meta.scheduleReason) {
                setLastScheduleReason(meta.scheduleReason);
              }
            }
            if (ev.event === "done") setLastResult(doneMeta);
          } catch {
            /* ignore */
          }
        } else if (ev.event === "error") {
          let message = "流式错误";
          try {
            const data = JSON.parse(ev.data) as { error?: string };
            if (data.error) message = data.error;
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
      }
    }
    if (!doneMeta) {
      setLastResult({ streamedToLocal: live, note: "流结束" });
    }
  }

  async function handleInvoke(e: React.FormEvent) {
    e.preventDefault();
    setInvoking(true);
    setInvokeError("");
    setLastResult(null);
    setStreamLive("");
    setLastScheduleReason("");

    let body: unknown = {};
    try {
      body = invokeBody.trim() ? JSON.parse(invokeBody) : {};
    } catch {
      setInvoking(false);
      setInvokeError("请求体必须是合法 JSON");
      return;
    }

    const base =
      routeMode === "capability"
        ? { capability, path: invokePath, method: "POST", body }
        : { backendId, path: invokePath, method: "POST", body };

    try {
      const spec = catalog.find((c) => c.id === capability);
      const mustStream =
        (routeMode === "backend" && selectedBackend?.locality === "remote") ||
        (routeMode === "capability" && Boolean(spec?.streamRequired)) ||
        invokePath.includes("stream");

      if (mustStream) {
        await invokeStream({
          ...base,
          ...(routeMode === "capability" ? { capability } : {}),
        });
      } else {
        await invokeUnary(base);
      }
    } catch (error) {
      setInvokeError(error instanceof Error ? error.message : "调用失败");
    } finally {
      setInvoking(false);
      await loadInvocations();
    }
  }

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#eef3f8_0%,_#f7f5f1_42%,_#f3efe8_100%)]">
      <header className="border-b border-black/5 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-teal-800/70 uppercase">
              API Hub · 算力可上云 · 输出在本地
            </p>
            <h1 className="mt-1 font-serif text-3xl tracking-tight text-slate-900 sm:text-4xl">
              OpenAPIHub
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              云端可做重计算，但 ephemeral、不落盘；结果经 API 流式回到本机控制台。Hub 默认只记元数据。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {authRequired && (
              <Badge variant={hubToken ? "default" : "destructive"}>
                {hubToken ? "已配置 Token" : "需要 HUB_API_TOKEN"}
              </Badge>
            )}
            {policy && (
              <>
                <Badge variant={policy.allowRemoteCompute ? "default" : "secondary"}>
                  {policy.allowRemoteCompute ? "允许云算力" : "禁用云算力"}
                </Badge>
                <Badge variant="outline">remote 仅流式（硬约束）</Badge>
                <Badge variant={policy.retainPayloads ? "secondary" : "outline"}>
                  {policy.retainPayloads ? "保留载荷" : "不落正文"}
                </Badge>
                <Badge variant="outline">remoteRetainFiles=false</Badge>
              </>
            )}
            <Button
              variant="outline"
              onClick={() => {
                void loadCatalog();
                void loadPolicy({ showLoading: true });
                void loadBackends({ showLoading: true });
                void loadInvocations({ showLoading: true });
                void loadDevices();
              }}
            >
              <RefreshCw className="size-3.5" />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
        {(authRequired || hubToken) && (
          <section className="space-y-3 lg:col-span-2">
            <Card className="border-teal-900/10 bg-white/85 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">本机 API Token</CardTitle>
                <CardDescription>
                  对应环境变量 <code className="text-xs">HUB_API_TOKEN</code>
                  。写入 sessionStorage，仅本浏览器标签页有效；未设置服务端
                  token 时可留空。
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="hub-token">Bearer Token</Label>
                  <Input
                    id="hub-token"
                    type="password"
                    autoComplete="off"
                    placeholder={
                      authRequired ? "必填：与 HUB_API_TOKEN 一致" : "可选"
                    }
                    value={tokenDraft}
                    onChange={(e) => setTokenDraft(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={saveToken}>
                  保存到本页
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        <section className="space-y-6 lg:col-span-2">
          <CapabilityCatalogPanel
            capabilities={catalog}
            adapters={adapters}
            suggestions={suggestions}
            loading={catalogLoading}
            suggesting={suggesting}
            onTry={tryCapability}
            onAddSuggestion={addSuggestedBackend}
          />
        </section>

        <section className="space-y-6 lg:col-span-2">
          <DevicesPanel
            devices={devices}
            profiles={hardwareProfiles}
            loading={devicesLoading}
            busyId={deviceBusyId}
            schedulePreview={schedulePreview}
            onRefresh={() => {
              void loadDevices();
            }}
            onHeartbeat={deviceHeartbeat}
            onTogglePlug={toggleDevicePlug}
            onToggleEnabled={toggleDeviceEnabled}
            onPreviewSchedule={previewSchedule}
          />
        </section>

        <section className="space-y-6 lg:col-span-2">
          <Card className="border-teal-900/10 bg-white/85 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-teal-800" />
                <CardTitle>数据策略 Data Policy</CardTitle>
              </div>
              <CardDescription>
                隐私边界是「输出与落盘在本地」，不是「禁止云算力」。remoteRetainFiles 固定为 false。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {policyState === "loading" && !policy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在加载策略…
                </div>
              )}
              {policyState === "error" && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>策略加载失败</AlertTitle>
                  <AlertDescription>{policyError}</AlertDescription>
                </Alert>
              )}
              {policy && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <div>
                      <p className="text-sm font-medium">preferLocal</p>
                      <p className="text-xs text-muted-foreground">默认 false</p>
                    </div>
                    <Switch
                      checked={policy.preferLocal}
                      disabled={policySaving}
                      onCheckedChange={(c) => void patchPolicy({ preferLocal: c })}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <div>
                      <p className="text-sm font-medium">allowRemoteCompute</p>
                      <p className="text-xs text-muted-foreground">默认 true</p>
                    </div>
                    <Switch
                      checked={policy.allowRemoteCompute}
                      disabled={policySaving}
                      onCheckedChange={(c) =>
                        void patchPolicy({ allowRemoteCompute: c })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 opacity-90">
                    <div>
                      <p className="text-sm font-medium">streamOnlyRemote</p>
                      <p className="text-xs text-muted-foreground">
                        硬约束：remote 禁止一元缓冲（不可关闭）
                      </p>
                    </div>
                    <Switch checked disabled aria-readonly />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <div>
                      <p className="text-sm font-medium">retainPayloads</p>
                      <p className="text-xs text-muted-foreground">默认 false</p>
                    </div>
                    <Switch
                      checked={policy.retainPayloads}
                      disabled={policySaving}
                      onCheckedChange={(c) =>
                        void patchPolicy({ retainPayloads: c })
                      }
                    />
                  </label>
                </div>
              )}
              {policyError && policy && (
                <p className="text-sm text-destructive">{policyError}</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <Card className="border-black/5 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle>后端注册表</CardTitle>
              <CardDescription>
                remote 需声明 supportsStreaming；本地可走一元调用。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {backendsState === "error" && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>加载失败</AlertTitle>
                  <AlertDescription>{backendsError}</AlertDescription>
                </Alert>
              )}
              {backendsState === "loading" && backends.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  加载后端…
                </div>
              )}
              <ul className="space-y-3">
                {backends.map((backend) => (
                  <li
                    key={backend.id}
                    className="rounded-xl border border-slate-200/80 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{backend.name}</p>
                          <Badge
                            variant={
                              backend.locality === "local"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {backend.locality}
                          </Badge>
                          {backend.supportsStreaming && (
                            <Badge variant="outline">streaming</Badge>
                          )}
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">
                          {backend.baseUrl}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={backend.enabled}
                          disabled={busyId === backend.id}
                          onCheckedChange={() => void toggleEnabled(backend)}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === backend.id}
                          onClick={() => void removeBackend(backend.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <form
                onSubmit={handleCreate}
                className="space-y-3 border-t border-slate-100 pt-4"
              >
                <p className="text-sm font-medium">注册新后端</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">名称</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="locality">Locality</Label>
                    <select
                      id="locality"
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      value={formLocality}
                      onChange={(e) => {
                        const v = e.target.value as Locality;
                        setFormLocality(v);
                        if (v === "remote") setFormStreaming(true);
                      }}
                    >
                      <option value="local">local</option>
                      <option value="remote">remote</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="capabilities">能力</Label>
                  <Input
                    id="capabilities"
                    value={formCapabilities}
                    onChange={(e) => setFormCapabilities(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    required
                  />
                </div>
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  添加后端
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6" id="invoke-panel">
          <Card className="border-black/5 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle>统一调用</CardTitle>
              <CardDescription>
                从能力目录点「试调」可预填。remote / 强制流式能力走
                <code className="text-xs"> /api/invoke/stream</code>。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvoke} className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={routeMode === "backend" ? "default" : "outline"}
                    onClick={() => setRouteMode("backend")}
                  >
                    指定后端
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={routeMode === "capability" ? "default" : "outline"}
                    onClick={() => setRouteMode("capability")}
                  >
                    按能力（本地一元）
                  </Button>
                </div>

                {routeMode === "capability" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="capability">Capability</Label>
                    <Input
                      id="capability"
                      value={capability}
                      onChange={(e) => setCapability(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      一元仅可选 local；remote 必须流式（硬约束）。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="backendSelect">后端</Label>
                    <select
                      id="backendSelect"
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      value={backendId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setBackendId(id);
                        const b = backends.find((x) => x.id === id);
                        setInvokePath(
                          b?.locality === "remote" ? "/echo/stream" : "/echo",
                        );
                      }}
                    >
                      {backends.map((b) => (
                        <option key={b.id} value={b.id} disabled={!b.enabled}>
                          {b.name} · {b.locality}
                          {b.supportsStreaming ? " · stream" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="path">路径</Label>
                  <Input
                    id="path"
                    value={invokePath}
                    onChange={(e) => setInvokePath(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="body">JSON 请求体</Label>
                  <Textarea
                    id="body"
                    value={invokeBody}
                    onChange={(e) => setInvokeBody(e.target.value)}
                    className="min-h-24 font-mono text-xs"
                  />
                </div>

                {invokeError && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>调用异常</AlertTitle>
                    <AlertDescription>{invokeError}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={invoking}>
                  {invoking && <Loader2 className="size-3.5 animate-spin" />}
                  {useStream ? "流式调用（云→本地）" : "发起调用"}
                </Button>

                {lastScheduleReason && (
                  <p className="text-xs leading-relaxed text-slate-600">
                    调度原因：{lastScheduleReason}
                  </p>
                )}

                {streamLive && (
                  <div className="rounded-lg border border-teal-800/20 bg-teal-50/60 p-3">
                    <p className="text-xs font-medium text-teal-900">本地实时收看</p>
                    <p className="mt-1 font-mono text-sm text-slate-800 whitespace-pre-wrap">
                      {streamLive}
                    </p>
                  </div>
                )}

                {lastResult != null && (
                  <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                    {JSON.stringify(lastResult, null, 2)}
                  </pre>
                )}
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="lg:col-span-2">
          <Card className="border-black/5 bg-white/80 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>结果中心</CardTitle>
                <CardDescription>
                  流式调用显示「已流式输出到本地 / 未保留正文」。默认无请求响应正文。
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadInvocations({ showLoading: true })}
              >
                <RefreshCw className="size-3.5" />
                刷新
              </Button>
            </CardHeader>
            <CardContent>
              {invocationsState === "error" && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>加载失败</AlertTitle>
                  <AlertDescription>{invocationsError}</AlertDescription>
                </Alert>
              )}
              {invocations.length === 0 && invocationsState !== "loading" && (
                <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-600">
                  暂无记录。用远端流式试调后，这里只会出现元数据。
                </div>
              )}
              {invocations.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="border-b text-xs tracking-wide text-slate-500 uppercase">
                      <tr>
                        <th className="py-2 pr-3 font-medium">时间</th>
                        <th className="py-2 pr-3 font-medium">后端</th>
                        <th className="py-2 pr-3 font-medium">模式</th>
                        <th className="py-2 pr-3 font-medium">状态</th>
                        <th className="py-2 pr-3 font-medium">耗时</th>
                        <th className="py-2 font-medium">摘要</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invocations.map((inv) => {
                        const canExpand =
                          inv.payloadsRetained &&
                          (inv.requestBody !== undefined ||
                            inv.responseBody !== undefined);
                        const open = expandedId === inv.id;
                        return (
                          <tr key={inv.id} className="border-b border-slate-100 align-top">
                            <td className="py-3 pr-3 whitespace-nowrap text-slate-500">
                              {new Date(inv.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 pr-3">
                              <div className="font-medium">{inv.backendName}</div>
                              <Badge variant="outline" className="mt-1">
                                {inv.locality}
                              </Badge>
                            </td>
                            <td className="py-3 pr-3">
                              <Badge variant={inv.mode === "stream" ? "default" : "secondary"}>
                                {inv.mode}
                              </Badge>
                            </td>
                            <td className="py-3 pr-3">
                              <Badge
                                variant={
                                  inv.status === "success" ? "default" : "destructive"
                                }
                              >
                                {inv.status}
                              </Badge>
                            </td>
                            <td className="py-3 pr-3">{inv.durationMs} ms</td>
                            <td className="py-3 max-w-md text-xs text-slate-600">
                              <div className="flex gap-1">
                                {canExpand ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedId(open ? null : inv.id)
                                    }
                                  >
                                    {open ? (
                                      <ChevronDown className="size-3.5" />
                                    ) : (
                                      <ChevronRight className="size-3.5" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="size-3.5" />
                                )}
                                <div>
                                  <p className="font-mono break-all">
                                    {inv.responseSummary}
                                  </p>
                                  {open && canExpand && (
                                    <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 text-[11px] text-slate-100">
                                      {JSON.stringify(
                                        {
                                          requestBody: inv.requestBody,
                                          responseBody: inv.responseBody,
                                        },
                                        null,
                                        2,
                                      )}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
