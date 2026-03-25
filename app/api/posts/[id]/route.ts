import { NextResponse } from "next/server";

import { getNotionConfig } from "@/lib/notion-config";
import { notifyN8nAsync } from "@/lib/n8n-webhook";
import { updatePost } from "@/lib/notion-posts";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const cfg = getNotionConfig();
    const { id } = await context.params;
    const pageId = decodeURIComponent(id);

    const body = (await request.json()) as {
      content?: string;
      scheduledAt?: string | null;
      platforms?: string[];
      /** 立即發文 → 已發佈 */
      postNow?: boolean;
      /** 僅儲存草稿，不改為排程 */
      saveAsDraft?: boolean;
      /** 直接指定 Status（最高優先） */
      status?: string;
      /** 內容支柱（須與 Notion 與 NOTION_PILLAR_OPTIONS 一致） */
      pillar?: string | null;
    };

    let status: string;
    if (body.status) {
      status = body.status;
    } else if (body.postNow) {
      status = cfg.status.published;
    } else if (body.saveAsDraft) {
      status = cfg.status.draft;
    } else {
      status = cfg.status.scheduled;
    }

    const post = await updatePost(cfg, pageId, {
      content: body.content,
      scheduledAt: body.scheduledAt,
      platforms: body.platforms,
      status,
      pillar: body.pillar,
    });

    let webhookAction: Parameters<typeof notifyN8nAsync>[0]["action"];
    if (body.postNow) {
      webhookAction = "post.published";
    } else if (body.saveAsDraft) {
      webhookAction = "post.draft_saved";
    } else {
      webhookAction = "post.scheduled";
    }
    notifyN8nAsync({ action: webhookAction, post, source: "next-api" });

    return NextResponse.json({ post });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "伺服器錯誤";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
