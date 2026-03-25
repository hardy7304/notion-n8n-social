/** API 與前端共用的貼文 DTO（勿在此檔 import Notion SDK） */
export type Post = {
  id: string;
  title: string;
  status: string;
  content: string;
  scheduledAt: string | null;
  platforms: string[];
  publishedUrl?: string | null;
  pillar?: string | null;
  lastSyncError?: string | null;
};
