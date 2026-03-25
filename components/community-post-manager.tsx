"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/datetime-local";
import type { Post } from "@/lib/post-types";
import { cn } from "@/lib/utils";
import { CalendarClock, Link2, Loader2, Plus, Send, Zap } from "lucide-react";

type UiFeatures = {
  n8nWebhook: boolean;
  pillarSelect: boolean;
  showPublishedLink: boolean;
  showSyncError: boolean;
};

const DEFAULT_STATUSES = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
} as const;

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes("draft") || s.includes("草稿")) {
    return "bg-secondary text-secondary-foreground";
  }
  if (s.includes("schedul") || s.includes("排程")) {
    return "bg-primary text-primary-foreground";
  }
  if (s.includes("publish") || s.includes("發佈")) {
    return "border-green-600/50 bg-green-500/10 text-green-700 dark:text-green-400";
  }
  return "";
}

function formatSchedule(iso: string | null): string {
  if (!iso) return "未設定";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "未設定";
  return d.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommunityPostManager() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [statuses, setStatuses] = React.useState(DEFAULT_STATUSES);
  const [platformList, setPlatformList] = React.useState<string[]>([
    "FB",
    "IG",
    "Threads",
    "LINE",
  ]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<string>(DEFAULT_STATUSES.draft);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [editorTitle, setEditorTitle] = React.useState("");
  const [editorContent, setEditorContent] = React.useState("");
  const [editorScheduled, setEditorScheduled] = React.useState("");
  const [editorPlatforms, setEditorPlatforms] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [editorPillar, setEditorPillar] = React.useState("");
  const [pillarOptionsList, setPillarOptionsList] = React.useState<string[]>(
    [],
  );
  const [uiFeatures, setUiFeatures] = React.useState<UiFeatures>({
    n8nWebhook: false,
    pillarSelect: false,
    showPublishedLink: false,
    showSyncError: false,
  });
  const [saving, setSaving] = React.useState(false);
  const firstStatusSync = React.useRef(true);

  const selected = posts.find((p) => p.id === selectedId) ?? null;

  const loadPosts = React.useCallback(async () => {
    setLoading(true);
    try {
      const q =
        filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/posts${q}`);
      const data = (await res.json()) as {
        posts?: Post[];
        statuses?: typeof DEFAULT_STATUSES;
        platformOptions?: string[];
        pillarOptions?: string[];
        ui?: Partial<UiFeatures>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "讀取失敗");
      }
      setPosts(data.posts ?? []);
      if (data.ui) {
        setUiFeatures((prev) => ({ ...prev, ...data.ui }));
      }
      if (data.statuses) {
        const merged = { ...DEFAULT_STATUSES, ...data.statuses };
        setStatuses(merged);
        if (firstStatusSync.current) {
          setFilter(merged.draft);
          firstStatusSync.current = false;
        }
      }
      if (data.platformOptions?.length) {
        setPlatformList(data.platformOptions);
      }
      if (data.pillarOptions) {
        setPillarOptionsList(data.pillarOptions);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "讀取失敗");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  React.useEffect(() => {
    if (!selected) {
      setEditorTitle("");
      setEditorContent("");
      setEditorScheduled("");
      setEditorPlatforms(new Set());
      setEditorPillar("");
      return;
    }
    setEditorTitle(selected.title);
    setEditorContent(selected.content);
    setEditorScheduled(toDatetimeLocalValue(selected.scheduledAt));
    setEditorPlatforms(new Set(selected.platforms));
    setEditorPillar(selected.pillar ?? "");
  }, [selected]);

  const buildPatchBody = (extra: Record<string, unknown>) => {
    const body: Record<string, unknown> = { ...extra };
    if (uiFeatures.pillarSelect) {
      body.pillar = editorPillar.trim() ? editorPillar.trim() : null;
    }
    return body;
  };

  const patchPost = async (body: Record<string, unknown>) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/posts/${encodeURIComponent(selectedId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as { post?: Post; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "更新失敗");
      }
      toast.success("已更新");
      await loadPosts();
      if (data.post) {
        setSelectedId(data.post.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = () => {
    if (!selectedId) {
      toast.error("請先選擇一篇文章");
      return;
    }
    const scheduledIso = fromDatetimeLocalValue(editorScheduled);
    void patchPost(
      buildPatchBody({
        content: editorContent,
        platforms: platformList.filter((p) => editorPlatforms.has(p)),
        scheduledAt: scheduledIso,
        postNow: false,
        saveAsDraft: false,
      }),
    );
  };

  const handlePostNow = () => {
    if (!selectedId) {
      toast.error("請先選擇一篇文章");
      return;
    }
    void patchPost(
      buildPatchBody({
        content: editorContent,
        platforms: platformList.filter((p) => editorPlatforms.has(p)),
        scheduledAt: fromDatetimeLocalValue(editorScheduled),
        postNow: true,
      }),
    );
  };

  const handleSaveDraft = () => {
    if (!selectedId) {
      toast.error("請先選擇一篇文章");
      return;
    }
    void patchPost(
      buildPatchBody({
        content: editorContent,
        platforms: platformList.filter((p) => editorPlatforms.has(p)),
        scheduledAt: fromDatetimeLocalValue(editorScheduled),
        saveAsDraft: true,
      }),
    );
  };

  const handleNewDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新草稿", content: "" }),
      });
      const data = (await res.json()) as { post?: Post; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "建立失敗");
      }
      toast.success("已建立草稿");
      setFilter(statuses.draft);
      await loadPosts();
      if (data.post) {
        setSelectedId(data.post.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "建立失敗");
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = (name: string, checked: boolean) => {
    setEditorPlatforms((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">
          社群內容管理
        </h1>
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select
            value={filter}
            onValueChange={(v) => {
              if (v != null) setFilter(v);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value={statuses.draft}>草稿</SelectItem>
              <SelectItem value={statuses.scheduled}>已排程</SelectItem>
              <SelectItem value={statuses.published}>已發佈</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadPosts()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "重新整理"
            )}
          </Button>
        </div>
        {uiFeatures.n8nWebhook && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          >
            <Zap className="size-3" />
            n8n Webhook 已啟用
          </Badge>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void handleNewDraft()} disabled={saving}>
            <Plus className="mr-1 size-4" />
            新增草稿
          </Button>
          <Button size="sm" onClick={handlePostNow} disabled={!selectedId || saving}>
            <Send className="mr-1 size-4" />
            立即發文
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(240px,320px)_1fr]">
        <aside className="flex flex-col border-b border-border md:border-r md:border-b-0">
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            草稿與文章列表
          </div>
          <ScrollArea className="min-h-[200px] flex-1 md:min-h-0">
            <ul className="flex flex-col gap-0.5 p-2">
              {loading && posts.length === 0 && (
                <li className="space-y-2 px-1 py-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-lg bg-muted/80"
                    />
                  ))}
                </li>
              )}
              {!loading && posts.length === 0 && (
                <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                  沒有符合條件的文章
                </li>
              )}
              {posts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg border border-transparent px-3 py-2 text-left text-sm transition-colors hover:bg-accent/80",
                      selectedId === p.id && "border-border bg-accent",
                    )}
                  >
                    <span className="line-clamp-2 font-medium leading-snug">
                      {p.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs font-normal",
                          statusBadgeClass(p.status),
                        )}
                      >
                        {p.status || "—"}
                      </Badge>
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <CalendarClock className="size-3" />
                        {formatSchedule(p.scheduledAt)}
                      </span>
                      {p.pillar ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {p.pillar}
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
              請從左側選擇一篇文章，或新增草稿
            </div>
          ) : (
            <Card className="m-4 flex min-h-0 flex-1 flex-col border shadow-none">
              <CardHeader className="space-y-1 pb-2">
                <Input
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  className="border-none px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
                  readOnly
                  title="標題請於 Notion 內修改（此處顯示資料庫標題）"
                />
                <p className="text-xs text-muted-foreground">
                  內文與排程可由此處同步至 Notion；儲存後若已設定 Webhook 會通知
                  n8n。
                </p>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                {uiFeatures.showSyncError && selected.lastSyncError ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    <span className="font-medium">同步錯誤（由自動化回寫）</span>
                    <p className="mt-1 whitespace-pre-wrap text-xs opacity-90">
                      {selected.lastSyncError}
                    </p>
                  </div>
                ) : null}
                {uiFeatures.showPublishedLink && selected.publishedUrl ? (
                  <a
                    href={selected.publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                  >
                    <Link2 className="size-4 shrink-0" />
                    開啟已發佈貼文連結
                  </a>
                ) : null}
                {uiFeatures.pillarSelect ? (
                  <div className="space-y-2">
                    <Label htmlFor="pillar">內容支柱</Label>
                    <Select
                      value={editorPillar || "__unset__"}
                      onValueChange={(v) => {
                        if (v != null) {
                          setEditorPillar(v === "__unset__" ? "" : v);
                        }
                      }}
                    >
                      <SelectTrigger id="pillar" className="w-full max-w-sm">
                        <SelectValue placeholder="選擇主題" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset__">未設定</SelectItem>
                        {pillarOptionsList.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : selected.pillar ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">內容支柱</span>
                    <Badge variant="secondary">{selected.pillar}</Badge>
                    <span className="text-xs">（請設定 NOTION_PILLAR_OPTIONS 以在此編輯）</span>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="content">內文</Label>
                  <Textarea
                    id="content"
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    placeholder="輸入貼文內容…"
                    className="min-h-[200px] flex-1 resize-y"
                  />
                </div>

                <div className="space-y-3">
                  <Label>發文平台</Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {platformList.map((name) => (
                      <label
                        key={name}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50"
                      >
                        <Checkbox
                          checked={editorPlatforms.has(name)}
                          onCheckedChange={(v) =>
                            togglePlatform(name, Boolean(v))
                          }
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule">排程時間</Label>
                  <Input
                    id="schedule"
                    type="datetime-local"
                    value={editorScheduled}
                    onChange={(e) => setEditorScheduled(e.target.value)}
                  />
                </div>

                <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSaveDraft}
                    disabled={saving}
                  >
                    儲存草稿
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSchedule}
                    disabled={saving}
                  >
                    排程發文
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
