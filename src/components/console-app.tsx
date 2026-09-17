"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import type { Backend, Invocation } from "@/lib/types";

type LoadState = "idle" | "loading" | "error";

export function ConsoleApp() {
  const [backends, setBackends] = useState<Backend[]>([]);
  const [invocations, setInvocations] = useState<Invocation[]>([]);
  const [backendsState, setBackendsState] = useState<LoadState>("loading");
  const [invocationsState, setInvocationsState] = useState<LoadState>("loading");
  const [backendsError, setBackendsError] = useState("");
  const [invocationsError, setInvocationsError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formCapabilities, setFormCapabilities] = useState("echo.message");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const [routeMode, setRouteMode] = useState<"capability" | "backend">("capability");
  const [capability, setCapability] = useState("echo.message");
  const [backendId, setBackendId] = useState("");
  const [invokePath, setInvokePath] = useState("/echo");
  const [invokeBody, setInvokeBody] = useState('{\n  "message": "OpenAPIHub 你好"\n}');
  const [invoking, setInvoking] = useState(false);
  const [invokeError, setInvokeError] = useState("");
  const [lastResult, setLastResult] = useState<unknown>(null);

  const loadBackends = useCallback(async () => {
    setBackendsState("loading");
    setBackendsError("");
    try {
      const res = await fetch("/api/backends", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载后端失败");
      const list: Backend[] = data.backends ?? [];
      setBackends(list);
      setBackendsState("idle");
      setBackendId((current) => current || list[0]?.id || "");
    } catch (error) {
      setBackendsState("error");
      setBackendsError(error instanceof Error ? error.message : "加载后端失败");
    }
  }, []);

  const loadInvocations = useCallback(async () => {
    setInvocationsState("loading");
    setInvocationsError("");
    try {
      const res = await fetch("/api/invocations?limit=40", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载调用记录失败");
      setInvocations(data.invocations ?? []);
      setInvocationsState("idle");
    } catch (error) {
      setInvocationsState("error");
      setInvocationsError(
        error instanceof Error ? error.message : "加载调用记录失败",
      );
    }
  }, []);

  useEffect(() => {
    void loadBackends();
    void loadInvocations();
  }, [loadBackends, loadInvocations]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError("");
    try {
      const res = await fetch("/api/backends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          baseUrl: formBaseUrl,
          capabilities: formCapabilities.split(/[,，\s]+/).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      setFormName("");
      setFormBaseUrl("");
      setFormCapabilities("echo.message");
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
      const res = await fetch(`/api/backends/${backend.id}`, {
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
      const res = await fetch(`/api/backends/${id}`, { method: "DELETE" });
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

  async function handleInvoke(e: React.FormEvent) {
    e.preventDefault();
    setInvoking(true);
    setInvokeError("");
    setLastResult(null);

    let body: unknown = {};
    try {
      body = invokeBody.trim() ? JSON.parse(invokeBody) : {};
    } catch {
      setInvoking(false);
      setInvokeError("请求体必须是合法 JSON");
      return;
    }

    try {
      const payload =
        routeMode === "capability"
          ? { capability, path: invokePath, method: "POST", body }
          : { backendId, path: invokePath, method: "POST", body };

      const res = await fetch("/api/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok && !data.invocation) {
        throw new Error(data.error || "调用失败");
      }
      setLastResult(data);
      await loadInvocations();
      if (!res.ok) {
        setInvokeError(data.error || data.invocation?.error || "上游返回错误");
      }
    } catch (error) {
      setInvokeError(error instanceof Error ? error.message : "调用失败");
    } finally {
      setInvoking(false);
    }
  }

  const enabledBackends = backends.filter((b) => b.enabled);

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#eef3f8_0%,_#f7f5f1_42%,_#f3efe8_100%)]">
      <header className="border-b border-black/5 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-teal-800/70 uppercase">
              API Hub
            </p>
            <h1 className="mt-1 font-serif text-3xl tracking-tight text-slate-900 sm:text-4xl">
              OpenAPIHub
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              注册任意 API 化软件，统一入站调用并集中查看结果。调用与部署位置解耦，同类后端可随时切换。
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void loadBackends();
                void loadInvocations();
              }}
            >
              <RefreshCw className="size-3.5" />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <section className="space-y-6 lg:col-span-1">
          <Card className="border-black/5 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle>后端注册表</CardTitle>
              <CardDescription>
                管理可调用的后端实例：名称、baseUrl、能力标签与启停状态。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {backendsState === "loading" && backends.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在加载后端列表…
                </div>
              )}

              {backendsState === "error" && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>加载失败</AlertTitle>
                  <AlertDescription>{backendsError}</AlertDescription>
                </Alert>
              )}

              {backendsState !== "loading" && backends.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600">
                  还没有后端。请先注册一个，或刷新以加载内置 mock。
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
                          <p className="truncate font-medium text-slate-900">
                            {backend.name}
                          </p>
                          <Badge variant={backend.enabled ? "default" : "secondary"}>
                            {backend.enabled ? "已启用" : "已停用"}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">
                          {backend.baseUrl}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {backend.capabilities.map((cap) => (
                            <Badge key={cap} variant="outline">
                              {cap}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={backend.enabled}
                          disabled={busyId === backend.id}
                          onCheckedChange={() => void toggleEnabled(backend)}
                          aria-label={`切换 ${backend.name}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === backend.id}
                          onClick={() => void removeBackend(backend.id)}
                          aria-label={`删除 ${backend.name}`}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleCreate} className="space-y-3 border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-800">注册新后端</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">名称</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="例如：本地 OCR 服务"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="capabilities">能力（逗号分隔）</Label>
                    <Input
                      id="capabilities"
                      value={formCapabilities}
                      onChange={(e) => setFormCapabilities(e.target.value)}
                      placeholder="echo.message"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder="http://127.0.0.1:43127/api/mock/local"
                    required
                  />
                </div>
                {formError && (
                  <p className="text-sm text-destructive">{formError}</p>
                )}
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  添加后端
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6 lg:col-span-1">
          <Card className="border-black/5 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle>统一调用</CardTitle>
              <CardDescription>
                按能力或指定后端转发请求。可在本地/远端 mock 之间切换同一能力。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvoke} className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={routeMode === "capability" ? "default" : "outline"}
                    onClick={() => setRouteMode("capability")}
                  >
                    按能力路由
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={routeMode === "backend" ? "default" : "outline"}
                    onClick={() => setRouteMode("backend")}
                  >
                    指定后端
                  </Button>
                </div>

                {routeMode === "capability" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="capability">Capability</Label>
                    <Input
                      id="capability"
                      value={capability}
                      onChange={(e) => setCapability(e.target.value)}
                      placeholder="echo.message"
                    />
                    <p className="text-xs text-muted-foreground">
                      将选用第一个已启用且声明该能力的后端
                      {enabledBackends.filter((b) =>
                        b.capabilities.includes(capability),
                      ).length > 0
                        ? `（当前：${
                            enabledBackends.find((b) =>
                              b.capabilities.includes(capability),
                            )?.name
                          }）`
                        : "（当前无匹配）"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="backendSelect">后端</Label>
                    <select
                      id="backendSelect"
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={backendId}
                      onChange={(e) => setBackendId(e.target.value)}
                    >
                      <option value="">选择后端…</option>
                      {backends.map((b) => (
                        <option key={b.id} value={b.id} disabled={!b.enabled}>
                          {b.name}
                          {!b.enabled ? "（已停用）" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="path">路径（相对 baseUrl）</Label>
                  <Input
                    id="path"
                    value={invokePath}
                    onChange={(e) => setInvokePath(e.target.value)}
                    placeholder="/echo"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="body">JSON 请求体</Label>
                  <Textarea
                    id="body"
                    value={invokeBody}
                    onChange={(e) => setInvokeBody(e.target.value)}
                    className="min-h-28 font-mono text-xs"
                  />
                </div>

                {invokeError && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>调用异常</AlertTitle>
                    <AlertDescription>{invokeError}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={invoking} className="w-full sm:w-auto">
                  {invoking && <Loader2 className="size-3.5 animate-spin" />}
                  发起调用
                </Button>

                {lastResult != null && (
                  <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
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
                  最近调用记录：状态、耗时与响应摘要。
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadInvocations()}
              >
                <RefreshCw className="size-3.5" />
                刷新
              </Button>
            </CardHeader>
            <CardContent>
              {invocationsState === "loading" && invocations.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在加载调用记录…
                </div>
              )}

              {invocationsState === "error" && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>加载失败</AlertTitle>
                  <AlertDescription>{invocationsError}</AlertDescription>
                </Alert>
              )}

              {invocationsState !== "loading" && invocations.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-600">
                  暂无调用记录。在上方发起一次试调后，结果会出现在这里。
                </div>
              )}

              {invocations.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                      <tr>
                        <th className="py-2 pr-3 font-medium">时间</th>
                        <th className="py-2 pr-3 font-medium">后端</th>
                        <th className="py-2 pr-3 font-medium">能力</th>
                        <th className="py-2 pr-3 font-medium">状态</th>
                        <th className="py-2 pr-3 font-medium">耗时</th>
                        <th className="py-2 font-medium">摘要</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invocations.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-b border-slate-100 align-top last:border-0"
                        >
                          <td className="py-3 pr-3 whitespace-nowrap text-slate-500">
                            {new Date(inv.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 pr-3 font-medium text-slate-800">
                            {inv.backendName}
                          </td>
                          <td className="py-3 pr-3 font-mono text-xs">
                            {inv.capability}
                          </td>
                          <td className="py-3 pr-3">
                            <Badge
                              variant={
                                inv.status === "success"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {inv.status}
                              {inv.httpStatus ? ` · ${inv.httpStatus}` : ""}
                            </Badge>
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap text-slate-600">
                            {inv.durationMs} ms
                          </td>
                          <td className="py-3 max-w-md break-all font-mono text-xs text-slate-600">
                            {inv.responseSummary}
                          </td>
                        </tr>
                      ))}
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
