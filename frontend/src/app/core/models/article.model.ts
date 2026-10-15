export type ArticleStatus = 'draft' | 'published';

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  status: ArticleStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface Article extends ArticleSummary {
  /** Markdown; dòng riêng [[quan:slug]] / [[cho-choi:slug]] là thẻ quán / chỗ chơi */
  body: string;
  authorName: string | null;
}

export interface ArticlePage {
  items: ArticleSummary[];
  total: number;
  page: number;
  size: number;
}

export interface ArticleRequest {
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string;
  body: string;
  status: ArticleStatus;
}

/** Một khối trong thân bài: đoạn Markdown, hoặc thẻ quán / chỗ chơi */
export type ArticleBlock = { kind: 'markdown'; text: string } | { kind: 'place' | 'spot'; slug: string };

const EMBED = /^\s*\[\[(quan|cho-choi):([a-z0-9-]+)\]\]\s*$/;

/** Tách thân bài thành các khối: mỗi dòng [[quan:slug]] là một thẻ, phần còn lại là Markdown */
export function splitArticle(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text) blocks.push({ kind: 'markdown', text });
    buffer = [];
  };
  for (const line of body.split(/\r?\n/)) {
    const m = EMBED.exec(line);
    if (m) {
      flush();
      blocks.push({ kind: m[1] === 'quan' ? 'place' : 'spot', slug: m[2] });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return blocks;
}

/** "15/10/2026" */
export function dateText(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
