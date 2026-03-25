import type { Post } from "./post-types";

export type N8nWebhookAction =
  | "post.created"
  | "post.draft_saved"
  | "post.scheduled"
  | "post.published";

/**
 * Notion 更新成功後非同步通知 n8n（Webhook 節點）。
 * 失敗只記 log，不影響 API 回應。
 */
export function notifyN8nAsync(payload: {
  action: N8nWebhookAction;
  post: Post;
  source: "next-api";
}): void {
  const url = process.env.N8N_WEBHOOK_URL?.trim();
  if (!url) return;

  const secret = process.env.N8N_WEBHOOK_SECRET?.trim();
  const body = JSON.stringify({
    ...payload,
    occurredAt: new Date().toISOString(),
  });

  void (async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "notion-social-app/1.0",
      };
      if (secret) {
        headers["X-Webhook-Secret"] = secret;
      }
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
      });
      if (!res.ok) {
        console.error(
          "[n8n webhook] HTTP",
          res.status,
          await res.text().catch(() => ""),
        );
      }
    } catch (e) {
      console.error("[n8n webhook]", e);
    }
  })();
}

export function isN8nWebhookConfigured(): boolean {
  return Boolean(process.env.N8N_WEBHOOK_URL?.trim());
}
