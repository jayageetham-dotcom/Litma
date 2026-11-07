import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import MarkdownIt from "markdown-it";
import type { HelpArticle, HelpCategory, HelpData } from "./help-types";

/**
 * The help site's content: one Markdown file per category in apps/web/content/help (see the README there).
 * Read once at build time by app/help/page.tsx; the page itself is static.
 */
const DIR = join(process.cwd(), "content", "help");

const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

/** Pictures: `![alt](shots/x.webp "Caption")` becomes a framed figure; `phone-*` pictures are drawn as phones. */
md.renderer.rules.image = (tokens, idx) => {
  const t = tokens[idx];
  const src = t.attrGet("src") ?? "";
  const alt = md.utils.escapeHtml(t.content);
  const caption = t.attrGet("title");
  const url = /^(https?:)?\//.test(src) ? src : `/help/${src}`;
  const phone = /(^|\/)phone-/.test(src);
  return (
    `<figure class="help-shot${phone ? " is-phone" : ""}"><img src="${md.utils.escapeHtml(url)}" alt="${alt}" loading="lazy" decoding="async" />` +
    (caption ? `<figcaption>${md.utils.escapeHtml(caption)}</figcaption>` : "") +
    `</figure>`
  );
};

/** Links to other articles are written `(#article-id)`; they become `/help/?a=article-id`. */
const linkOpen = md.renderer.rules.link_open ?? ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const t = tokens[idx];
  const href = t.attrGet("href") ?? "";
  if (href.startsWith("#")) t.attrSet("href", `/help/?a=${href.slice(1)}`);
  else if (/^https?:|^mailto:/.test(href)) {
    t.attrSet("target", "_blank");
    t.attrSet("rel", "noreferrer");
  }
  return linkOpen(tokens, idx, opts, env, self);
};

/** `> **Tip:** …` and `> **Note:** …` become coloured callouts. */
function callouts(html: string) {
  return html.replace(/<blockquote>\s*<p><strong>(Tip|Note|Good to know|Phone|Desktop):?<\/strong>:?/g, (_m, kind: string) => {
    const k = kind.toLowerCase().replace(/\s+/g, "-");
    return `<blockquote class="help-callout is-${k}"><p><strong>${kind}</strong>`;
  });
}

/** A paragraph that holds only pictures shows them side by side. */
function pictureRows(html: string) {
  return html.replace(/<p>((?:\s*<figure[\s\S]*?<\/figure>\s*){2,})<\/p>/g, '<div class="help-shots">$1</div>').replace(/<p>\s*(<figure[\s\S]*?<\/figure>)\s*<\/p>/g, "$1");
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9ഀ-ൿ]+/g, "-")
    .replace(/^-|-$/g, "");

const plain = (s: string) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function frontMatter(src: string): [Record<string, string>, string] {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(src);
  if (!m) return [{}, src];
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return [meta, src.slice(m[0].length)];
}

function parseCategory(file: string, order: number): HelpCategory {
  const [meta, body] = frontMatter(readFileSync(join(DIR, file), "utf8"));
  const id = meta.id ?? file.replace(/^\d+-|\.md$/g, "");
  const articles: HelpArticle[] = [];
  // each "## Title {#id}" starts an article; text before the first one is the category's introduction
  const parts = body.split(/^## /m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    const head = part.slice(0, nl).trim();
    const text = part.slice(nl + 1).trim();
    const idm = /\{#([a-z0-9-]+)\}\s*$/.exec(head);
    const title = head.replace(/\s*\{#[a-z0-9-]+\}\s*$/, "");
    const lead = plain(text.split(/\n\s*\n/).find((b) => !b.trim().startsWith("!") && !b.trim().startsWith(">")) ?? "");
    const html = pictureRows(callouts(md.render(text)));
    // "On this page": the article's ### headings, with ids added for jumping
    const toc: { id: string; title: string }[] = [];
    const withIds = html.replace(/<h3>([\s\S]*?)<\/h3>/g, (_m, inner: string) => {
      const t = plain(inner);
      const hid = slug(t) || `s${toc.length + 1}`;
      toc.push({ id: hid, title: t });
      return `<h3 id="${hid}">${inner}</h3>`;
    });
    articles.push({
      id: idm?.[1] ?? slug(title),
      category: id,
      title,
      lead: lead.length > 190 ? `${lead.slice(0, 187).replace(/\s+\S*$/, "")}…` : lead,
      html: withIds,
      toc,
      text: plain(text).slice(0, 4000),
    });
  }
  return {
    id,
    order,
    title: meta.title ?? id,
    ml: meta.ml ?? "",
    summary: meta.summary ?? "",
    icon: meta.icon ?? "book-open",
    tint: meta.tint ?? "violet",
    intro: plain(parts[0] ?? ""),
    articles,
  };
}

export function loadHelp(): HelpData {
  const files = readdirSync(DIR)
    .filter((f) => /^\d+-.+\.md$/.test(f))
    .sort();
  const categories = files.map((f, i) => parseCategory(f, i));
  const seen = new Set<string>();
  for (const c of categories)
    for (const a of c.articles) {
      if (seen.has(a.id)) throw new Error(`Help: two articles share the id "${a.id}"`);
      seen.add(a.id);
    }
  return { categories, updated: new Date().toISOString().slice(0, 10) };
}
