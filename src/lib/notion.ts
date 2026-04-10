import 'server-only';
import { Client } from '@notionhq/client';
import { createLogger } from '@/lib/logger';

/**
 * Notion API client wrapper for the Yedapo integration.
 *
 * Required env vars (set in .env.local / Vercel):
 *   - NOTION_CLIENT_ID
 *   - NOTION_CLIENT_SECRET
 *   - NOTION_REDIRECT_URI  (defaults to `${NEXT_PUBLIC_APP_URL}/api/integrations/notion/callback`)
 */

const log = createLogger('notion');

const NOTION_OAUTH_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';
const NOTION_VERSION = '2022-06-28';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  owner: unknown;
  duplicated_template_id?: string | null;
}

export interface NotionSearchPage {
  id: string;
  title: string;
  url: string;
}

export interface NotionDatabaseRef {
  id: string;
  url: string;
}

export interface CreateSummaryPageProps {
  title: string;
  podcastName: string;
  publishedAt?: string | null;
  duration?: string | null;
  episodeUrl?: string | null;
  markdown: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export function getNotionRedirectUri(): string {
  const explicit = process.env.NOTION_REDIRECT_URI;
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/integrations/notion/callback`;
}

export function buildNotionAuthorizeUrl(state: string): string {
  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) {
    throw new Error('NOTION_CLIENT_ID is not set');
  }
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    owner: 'user',
    redirect_uri: getNotionRedirectUri(),
    state,
  });
  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

function notionClient(accessToken: string): Client {
  return new Client({ auth: accessToken, notionVersion: NOTION_VERSION });
}

// ─────────────────────────────────────────────────────────────
// OAuth token exchange
// ─────────────────────────────────────────────────────────────

/**
 * Exchanges an OAuth authorization code for a workspace access token.
 * Uses HTTP Basic auth (client_id:client_secret base64) per Notion's spec.
 */
export async function exchangeNotionCode(
  code: string,
  redirectUri: string,
): Promise<NotionTokenResponse> {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('NOTION_CLIENT_ID / NOTION_CLIENT_SECRET not set');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(NOTION_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    log.error('Notion token exchange failed', { status: res.status, body });
    throw new Error(`Notion token exchange failed: ${res.status}`);
  }

  const json = (await res.json()) as NotionTokenResponse;
  return json;
}

// ─────────────────────────────────────────────────────────────
// Search for shared pages
// ─────────────────────────────────────────────────────────────

/**
 * Returns up to 10 top-level pages the user has explicitly shared with
 * the Yedapo integration. We prefer a "page" (vs database) as a parent for
 * our new database.
 */
export async function searchSharedPages(
  accessToken: string,
): Promise<NotionSearchPage[]> {
  const notion = notionClient(accessToken);

  try {
    const res = await notion.search({
      filter: { property: 'object', value: 'page' },
      page_size: 10,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
    });

    const pages: NotionSearchPage[] = [];
    for (const item of res.results) {
      // Only pages (not databases)
      if ((item as { object?: string }).object !== 'page') continue;
      const page = item as {
        id: string;
        url?: string;
        properties?: Record<string, unknown>;
        parent?: { type?: string };
      };

      // Skip pages that live inside a database (those are rows, not containers)
      if (page.parent?.type === 'database_id') continue;

      let title = 'Untitled';
      const props = page.properties || {};
      for (const key of Object.keys(props)) {
        const prop = props[key] as { type?: string; title?: Array<{ plain_text?: string }> };
        if (prop?.type === 'title' && Array.isArray(prop.title)) {
          title = prop.title.map((t) => t.plain_text || '').join('') || 'Untitled';
          break;
        }
      }

      pages.push({
        id: page.id,
        title,
        url: page.url || '',
      });
    }
    return pages;
  } catch (err) {
    log.warn('Notion searchSharedPages failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Create "Yedapo Summaries" database
// ─────────────────────────────────────────────────────────────

/**
 * Creates a Notion database titled "Yedapo Summaries" under the given parent
 * page, with columns: Title, Podcast, Date, Duration, URL.
 */
export async function createYedapoDatabase(
  accessToken: string,
  parentPageId: string,
): Promise<NotionDatabaseRef> {
  const notion = notionClient(accessToken);

  const db = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    icon: { type: 'emoji', emoji: '🎧' },
    title: [
      {
        type: 'text',
        text: { content: 'Yedapo Summaries' },
      },
    ],
    properties: {
      Title: { title: {} },
      Podcast: { rich_text: {} },
      Date: { date: {} },
      Duration: { rich_text: {} },
      URL: { url: {} },
    },
  });

  return {
    id: db.id,
    url: (db as unknown as { url?: string }).url || '',
  };
}

// ─────────────────────────────────────────────────────────────
// Create summary page in database
// ─────────────────────────────────────────────────────────────

/**
 * Notion has a 2000-char limit per rich_text chunk. We split long strings
 * into 1900-char slices to stay well under the limit.
 */
function chunkText(text: string, max = 1900): string[] {
  if (!text) return [''];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + max));
    i += max;
  }
  return chunks;
}

function textToRichText(text: string): Array<{
  type: 'text';
  text: { content: string };
}> {
  return chunkText(text).map((content) => ({
    type: 'text' as const,
    text: { content },
  }));
}

type NotionBlock = Record<string, unknown>;

/**
 * Converts a markdown string to Notion blocks.
 *
 * Supports:
 *  - `# heading 1`, `## heading 2`, `### heading 3`
 *  - `- [ ] todo`, `- [x] done`
 *  - `- list item`
 *  - `> quote`
 *  - `---` divider
 *  - blank lines ignored
 *  - everything else → paragraph
 *
 * Inline formatting (bold/italic/links) is passed through as plain text so
 * the page is readable and legal — we prioritise reliability over fidelity.
 */
export function markdownToBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: NotionBlock[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (!line.trim()) continue;

    // Divider
    if (/^---+$/.test(line.trim())) {
      blocks.push({ object: 'block', type: 'divider', divider: {} });
      continue;
    }

    // Headings
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: textToRichText(h1[1]) },
      });
      continue;
    }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: textToRichText(h2[1]) },
      });
      continue;
    }
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: textToRichText(h3[1]) },
      });
      continue;
    }

    // To-do
    const todo = line.match(/^-\s+\[([ xX])\]\s+(.*)$/);
    if (todo) {
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: textToRichText(todo[2]),
          checked: todo[1].toLowerCase() === 'x',
        },
      });
      continue;
    }

    // Bullet
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: textToRichText(bullet[1]) },
      });
      continue;
    }

    // Quote
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: textToRichText(quote[1]) },
      });
      continue;
    }

    // Paragraph (strip common inline markdown markers for readability)
    const plain = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`([^`]*)`/g, '$1');
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: textToRichText(plain) },
    });
  }

  return blocks;
}

/**
 * Creates a new page inside the Yedapo Summaries database with episode
 * metadata in the properties and the markdown body as page blocks.
 *
 * Notion caps `children` at 100 blocks per create call — we pass the first 100
 * here and append the rest via blocks.children.append.
 */
export async function createSummaryPage(
  accessToken: string,
  databaseId: string,
  props: CreateSummaryPageProps,
): Promise<{ id: string; url: string }> {
  const notion = notionClient(accessToken);

  const blocks = markdownToBlocks(props.markdown);
  const firstBatch = blocks.slice(0, 100);
  const rest = blocks.slice(100);

  const properties: Record<string, unknown> = {
    Title: {
      title: [{ type: 'text', text: { content: props.title.slice(0, 2000) } }],
    },
    Podcast: {
      rich_text: textToRichText(props.podcastName || ''),
    },
  };

  if (props.publishedAt) {
    // Notion expects ISO 8601 date; fallback to start-of-day if parse fails.
    let isoDate: string | null = null;
    try {
      isoDate = new Date(props.publishedAt).toISOString();
    } catch {
      isoDate = null;
    }
    if (isoDate) {
      properties.Date = { date: { start: isoDate } };
    }
  }

  if (props.duration) {
    properties.Duration = { rich_text: textToRichText(props.duration) };
  }

  if (props.episodeUrl) {
    properties.URL = { url: props.episodeUrl };
  }

  const page = await notion.pages.create({
    parent: { type: 'database_id', database_id: databaseId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: properties as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children: firstBatch as any,
  });

  // Append remaining blocks in batches of 100
  if (rest.length > 0) {
    for (let i = 0; i < rest.length; i += 100) {
      const batch = rest.slice(i, i + 100);
      try {
        await notion.blocks.children.append({
          block_id: page.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          children: batch as any,
        });
      } catch (err) {
        log.warn('Notion append blocks failed (partial page created)', {
          error: err instanceof Error ? err.message : String(err),
          pageId: page.id,
        });
        break;
      }
    }
  }

  return {
    id: page.id,
    url: (page as unknown as { url?: string }).url || '',
  };
}
