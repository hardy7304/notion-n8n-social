function trimOrUndefined(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

/**
 * Notion 資料庫欄位與狀態名稱。
 * 請在 Notion 建立對應屬性，或透過環境變數覆寫名稱。
 */
export function getNotionConfig() {
  const databaseId = process.env.NOTION_DATABASE_ID?.trim();
  if (!databaseId) {
    throw new Error("缺少 NOTION_DATABASE_ID");
  }

  const pillarOptionsRaw = process.env.NOTION_PILLAR_OPTIONS ?? "";
  const pillarOptions = pillarOptionsRaw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    databaseId,
    props: {
      title: process.env.NOTION_PROP_TITLE ?? "Title",
      status: process.env.NOTION_PROP_STATUS ?? "Status",
      content: process.env.NOTION_PROP_CONTENT ?? "Content",
      scheduled: process.env.NOTION_PROP_SCHEDULED ?? "Scheduled",
      platforms: process.env.NOTION_PROP_PLATFORMS ?? "Platforms",
    },
    /** 選填：進階欄位（設了環境變數才讀寫） */
    extraProps: {
      /** Notion 類型 URL：貼文上線後連結，供 n8n 回寫 */
      publishedUrl: trimOrUndefined(process.env.NOTION_PROP_PUBLISHED_URL),
      /** Notion 類型 Select：內容支柱／主題 */
      pillar: trimOrUndefined(process.env.NOTION_PROP_PILLAR),
      /** Notion 類型 Rich text：n8n 最後同步錯誤訊息 */
      lastSyncError: trimOrUndefined(process.env.NOTION_PROP_LAST_SYNC_ERROR),
    },
    /** 與 Notion「內容支柱」Select 選項一致，逗號分隔 */
    pillarOptions,
    status: {
      draft: process.env.NOTION_STATUS_DRAFT ?? "Draft",
      scheduled: process.env.NOTION_STATUS_SCHEDULED ?? "Scheduled",
      published: process.env.NOTION_STATUS_PUBLISHED ?? "Published",
    },
    /** multi_select 選項須與 Notion 完全一致 */
    platformOptions: ["FB", "IG", "Threads", "LINE"] as const,
  } as const;
}

export type NotionConfig = ReturnType<typeof getNotionConfig>;
