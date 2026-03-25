import type {
  PageObjectResponse,
  QueryDatabaseResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { Client } from "@notionhq/client";

import type { NotionConfig } from "./notion-config";
import type { Post } from "./post-types";

export type { Post } from "./post-types";

function getNotionClient() {
  const token = process.env.NOTION_API_KEY?.trim();
  if (!token) {
    throw new Error("缺少 NOTION_API_KEY");
  }
  return new Client({ auth: token });
}

function richTextToPlain(rich: RichTextItemResponse[]): string {
  return rich.map((t) => t.plain_text).join("");
}

function titleFromPage(
  page: PageObjectResponse,
  titleProp: string,
): string {
  const prop = page.properties[titleProp];
  if (!prop || prop.type !== "title") {
    return "（無標題）";
  }
  const t = richTextToPlain(prop.title);
  return t.trim() || "（無標題）";
}

function statusFromPage(page: PageObjectResponse, statusProp: string): string {
  const prop = page.properties[statusProp];
  if (!prop || prop.type !== "select" || !prop.select) {
    return "";
  }
  return prop.select.name;
}

function contentFromPage(
  page: PageObjectResponse,
  contentProp: string,
): string {
  const prop = page.properties[contentProp];
  if (!prop || prop.type !== "rich_text") {
    return "";
  }
  return richTextToPlain(prop.rich_text);
}

function scheduledFromPage(
  page: PageObjectResponse,
  scheduledProp: string,
): string | null {
  const prop = page.properties[scheduledProp];
  if (!prop || prop.type !== "date" || !prop.date) {
    return null;
  }
  return prop.date.start ?? null;
}

function platformsFromPage(
  page: PageObjectResponse,
  platformsProp: string,
): string[] {
  const prop = page.properties[platformsProp];
  if (!prop || prop.type !== "multi_select") {
    return [];
  }
  return prop.multi_select.map((o) => o.name);
}

function urlFromPage(
  page: PageObjectResponse,
  urlProp: string,
): string | null {
  const prop = page.properties[urlProp];
  if (!prop || prop.type !== "url") {
    return null;
  }
  return prop.url ?? null;
}

function selectNameFromPage(
  page: PageObjectResponse,
  propName: string,
): string | null {
  const prop = page.properties[propName];
  if (!prop || prop.type !== "select" || !prop.select) {
    return null;
  }
  return prop.select.name;
}

function numberFromPage(
  page: PageObjectResponse,
  propName: string,
): number | null {
  const prop = page.properties[propName];
  if (!prop || prop.type !== "number") {
    return null;
  }
  if (prop.number === null || prop.number === undefined) {
    return null;
  }
  return prop.number;
}

export function mapPageToPost(
  page: PageObjectResponse,
  cfg: NotionConfig,
): Post {
  const base: Post = {
    id: page.id,
    title: titleFromPage(page, cfg.props.title),
    status: statusFromPage(page, cfg.props.status),
    content: contentFromPage(page, cfg.props.content),
    scheduledAt: scheduledFromPage(page, cfg.props.scheduled),
    platforms: platformsFromPage(page, cfg.props.platforms),
  };

  if (cfg.extraProps.publishedUrl) {
    base.publishedUrl = urlFromPage(page, cfg.extraProps.publishedUrl);
  }
  if (cfg.extraProps.pillar) {
    base.pillar = selectNameFromPage(page, cfg.extraProps.pillar);
  }
  if (cfg.extraProps.lastSyncError) {
    base.lastSyncError = contentFromPage(page, cfg.extraProps.lastSyncError);
  }
  if (cfg.extraProps.campaign) {
    base.campaign = selectNameFromPage(page, cfg.extraProps.campaign);
  }
  if (cfg.extraProps.estimatedTraffic) {
    base.estimatedTraffic = numberFromPage(
      page,
      cfg.extraProps.estimatedTraffic,
    );
  }
  if (cfg.extraProps.actualCost) {
    base.actualCost = numberFromPage(page, cfg.extraProps.actualCost);
  }
  if (cfg.extraProps.businessNote) {
    base.businessNote = contentFromPage(page, cfg.extraProps.businessNote);
  }
  if (cfg.extraProps.performanceNote) {
    base.performanceNote = contentFromPage(
      page,
      cfg.extraProps.performanceNote,
    );
  }
  if (cfg.extraProps.audienceVerbatim) {
    base.audienceVerbatim = contentFromPage(
      page,
      cfg.extraProps.audienceVerbatim,
    );
  }
  if (cfg.extraProps.clientProject) {
    base.clientProject = contentFromPage(page, cfg.extraProps.clientProject);
  }

  return base;
}

export async function queryPosts(
  cfg: NotionConfig,
  statusFilter: string | null,
): Promise<Post[]> {
  const notion = getNotionClient();

  const filter =
    statusFilter && statusFilter !== "all"
      ? {
          property: cfg.props.status,
          select: { equals: statusFilter },
        }
      : undefined;

  const res: QueryDatabaseResponse = await notion.databases.query({
    database_id: cfg.databaseId,
    filter,
    sorts: [
      {
        timestamp: "created_time",
        direction: "descending",
      },
    ],
  });

  return res.results
    .filter((p): p is PageObjectResponse => "properties" in p)
    .map((p) => mapPageToPost(p, cfg));
}

export async function createDraft(
  cfg: NotionConfig,
  input: { title: string; content?: string },
): Promise<Post> {
  const notion = getNotionClient();

  const created = await notion.pages.create({
    parent: { database_id: cfg.databaseId },
    properties: {
      [cfg.props.title]: {
        title: [{ text: { content: input.title || "未命名草稿" } }],
      },
      [cfg.props.status]: {
        select: { name: cfg.status.draft },
      },
      [cfg.props.content]: {
        rich_text: input.content
          ? [{ text: { content: input.content } }]
          : [],
      },
      [cfg.props.platforms]: {
        multi_select: [],
      },
    },
  });

  if (!("properties" in created)) {
    throw new Error("建立頁面回傳格式異常");
  }
  return mapPageToPost(created as PageObjectResponse, cfg);
}

export type UpdatePostInput = {
  content?: string;
  scheduledAt?: string | null;
  platforms?: string[];
  /** 若指定，寫入 Status select */
  status?: string;
  /** 內容支柱（須與 Notion Select 選項一致） */
  pillar?: string | null;
  campaign?: string | null;
  estimatedTraffic?: number | null;
  actualCost?: number | null;
  businessNote?: string;
  performanceNote?: string;
  audienceVerbatim?: string;
  clientProject?: string;
};

export async function updatePost(
  cfg: NotionConfig,
  pageId: string,
  input: UpdatePostInput,
): Promise<Post> {
  const notion = getNotionClient();

  const properties: Record<string, unknown> = {};

  if (input.content !== undefined) {
    properties[cfg.props.content] = {
      rich_text: [{ text: { content: input.content } }],
    };
  }

  if (input.scheduledAt !== undefined) {
    properties[cfg.props.scheduled] = {
      date: input.scheduledAt ? { start: input.scheduledAt } : null,
    };
  }

  if (input.platforms !== undefined) {
    properties[cfg.props.platforms] = {
      multi_select: input.platforms.map((name) => ({ name })),
    };
  }

  if (input.status !== undefined) {
    properties[cfg.props.status] = {
      select: { name: input.status },
    };
  }

  if (input.pillar !== undefined && cfg.extraProps.pillar) {
    properties[cfg.extraProps.pillar] = input.pillar
      ? { select: { name: input.pillar } }
      : { select: null };
  }

  if (input.campaign !== undefined && cfg.extraProps.campaign) {
    properties[cfg.extraProps.campaign] = input.campaign
      ? { select: { name: input.campaign } }
      : { select: null };
  }

  if (input.estimatedTraffic !== undefined && cfg.extraProps.estimatedTraffic) {
    properties[cfg.extraProps.estimatedTraffic] = {
      number: input.estimatedTraffic,
    };
  }

  if (input.actualCost !== undefined && cfg.extraProps.actualCost) {
    properties[cfg.extraProps.actualCost] = {
      number: input.actualCost,
    };
  }

  const rich = (text: string) => ({
    rich_text: text ? [{ text: { content: text } }] : [],
  });

  if (input.businessNote !== undefined && cfg.extraProps.businessNote) {
    properties[cfg.extraProps.businessNote] = rich(input.businessNote);
  }
  if (input.performanceNote !== undefined && cfg.extraProps.performanceNote) {
    properties[cfg.extraProps.performanceNote] = rich(input.performanceNote);
  }
  if (
    input.audienceVerbatim !== undefined &&
    cfg.extraProps.audienceVerbatim
  ) {
    properties[cfg.extraProps.audienceVerbatim] = rich(
      input.audienceVerbatim,
    );
  }
  if (input.clientProject !== undefined && cfg.extraProps.clientProject) {
    properties[cfg.extraProps.clientProject] = rich(input.clientProject);
  }

  const updated = await notion.pages.update({
    page_id: pageId,
    properties: properties as never,
  });

  if (!("properties" in updated)) {
    throw new Error("更新頁面回傳格式異常");
  }
  return mapPageToPost(updated as PageObjectResponse, cfg);
}
