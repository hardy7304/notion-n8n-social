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
  /** 活動檔期（Select） */
  campaign?: string | null;
  /** 預估導流（Number） */
  estimatedTraffic?: number | null;
  /** 實際花費（Number） */
  actualCost?: number | null;
  businessNote?: string;
  performanceNote?: string;
  audienceVerbatim?: string;
  clientProject?: string;
};
