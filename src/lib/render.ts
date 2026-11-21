import { Marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { db } from './db';

const marked = new Marked({ gfm: true, breaks: true });

/**
 * Math delimiters: $$...$$ and \[...\] for display math, $...$ and \(...\) for inline.
 * Math is pulled out before Markdown runs so Markdown can't mangle backslashes or underscores.
 * Code spans/blocks are protected first so `$` inside code stays literal.
 */
const CODE_RE = /```[\s\S]*?```|`[^`\n]+`/g;
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g;

/** Private-use character marking placeholders; never appears in normal text. */
const MARK = '';
const CODE_TOKEN = new RegExp(`${MARK}C(\\d+)${MARK}`, 'g');
const MATH_PARA = new RegExp(`<p>${MARK}M(\\d+)${MARK}</p>`, 'g');
const MATH_TOKEN = new RegExp(`${MARK}M(\\d+)${MARK}`, 'g');

function renderMath(tex: string, display: boolean): string {
  return katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false, output: 'html' });
}

export function renderMarkdown(text: string): string {
  const code: string[] = [];
  const math: string[] = [];
  let src = text.replace(CODE_RE, (m) => `${MARK}C${code.push(m) - 1}${MARK}`);
  src = src.replace(MATH_RE, (_m, d1, d2, i1, i2) => {
    const display = d1 !== undefined || d2 !== undefined;
    const html = renderMath(d1 ?? d2 ?? i1 ?? i2, display);
    const token = `${MARK}M${math.push(html) - 1}${MARK}`;
    // Put display math on its own paragraph so it's centered.
    return display ? `\n\n${token}\n\n` : token;
  });
  src = src.replace(/\\\$/g, '$');
  src = src.replace(CODE_TOKEN, (_m, i) => code[+i]);
  let html = marked.parse(src, { async: false }) as string;
  html = html.replace(MATH_PARA, (_m, i) => math[+i]);
  html = html.replace(MATH_TOKEN, (_m, i) => math[+i]);
  return sanitize(html);
}

/** Strip anything executable. Cards are your own content, but imported backups shouldn't run scripts. */
function sanitize(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

// ---------- Images ----------

const urlCache = new Map<string, string>();

async function imageUrl(id: string): Promise<string | null> {
  const hit = urlCache.get(id);
  if (hit) return hit;
  const row = await db.images.get(id);
  if (!row) return null;
  const url = URL.createObjectURL(row.blob);
  urlCache.set(id, url);
  return url;
}

/** Render card text to HTML, resolving `img:<id>` references to locally stored images. */
export async function renderCard(text: string): Promise<string> {
  let html = renderMarkdown(text);
  const ids = [...new Set([...html.matchAll(/src="img:([0-9a-f-]{36})"/g)].map((m) => m[1]))];
  for (const id of ids) {
    const url = (await imageUrl(id)) ?? '';
    html = html.replaceAll(`src="img:${id}"`, `src="${url}"`);
  }
  return html;
}

/** Plain-text preview for lists: strips Markdown, shows math source compactly. */
export function plainPreview(text: string, max = 90): string {
  const s = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[image]')
    .replace(/\$\$([\s\S]+?)\$\$/g, '$1')
    .replace(/(?<!\\)\$([^$\n]+?)\$/g, '$1')
    .replace(/\*\*|`|^#+\s*|^>\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s || '(empty)';
}
