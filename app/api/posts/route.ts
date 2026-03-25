import { NextResponse } from "next/server";

import { getNotionConfig } from "@/lib/notion-config";
import { isN8nWebhookConfigured, notifyN8nAsync } from "@/lib/n8n-webhook";
import { createDraft, queryPosts } from "@/lib/notion-posts";

export async function GET(request: Request) {
  try {
    const cfg = getNotionConfig();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const posts = await queryPosts(cfg, status);
    return NextResponse.json({
      posts,
      statuses: cfg.status,
      platformOptions: [...cfg.platformOptions],
      pillarOptions: [...cfg.pillarOptions],
      ui: {
        n8nWebhook: isN8nWebhookConfigured(),
        pillarSelect:
          Boolean(cfg.extraProps.pillar) && cfg.pillarOptions.length > 0,
        showPublishedLink: Boolean(cfg.extraProps.publishedUrl),
        showSyncError: Boolean(cfg.extraProps.lastSyncError),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "伺服器錯誤";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cfg = getNotionConfig();
    const body = (await request.json()) as {
      title?: string;
      content?: string;
    };
    const post = await createDraft(cfg, {
      title: body.title?.trim() || "未命名草稿",
      content: body.content,
    });
    notifyN8nAsync({ action: "post.created", post, source: "next-api" });
    return NextResponse.json({ post }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "伺服器錯誤";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
