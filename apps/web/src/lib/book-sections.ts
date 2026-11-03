"use client";
import type { JSONContent } from "@tiptap/core";
import { renderDocHtml } from "./doc-html";
import { docClasses, settingsFor } from "./templates";
import { PAGE_SIZES } from "@/extensions/pagination";
import type { Book, BookItem, LitmaDoc } from "./types";
import type { PageSpec, Section } from "./paginate";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function docHtml(doc: Pick<LitmaDoc, "kind" | "settings">, content: JSONContent) {
  return renderDocHtml(doc, content);
}

function varsFor(font: string, size: number, lh: number): Record<string, string> {
  return { "--doc-font": `'${font}'`, "--doc-size": `${size}pt`, "--doc-lh": String(lh) };
}

const PROSE = new Set(["novel", "story", "essay", "feature", "diary", "blank"]);

/** Strip the document's own title-page blocks when the book prints its own chapter heading. */
function bodyOf(content: JSONContent, stripTitle: boolean): JSONContent {
  let blocks = content.content ?? [];
  if (stripTitle) blocks = blocks.filter((n) => !(n.type === "styledBlock" && ["title", "author", "subtitle"].includes(n.attrs?.variant)));
  while (blocks[0]?.type === "pageBreak") blocks = blocks.slice(1);
  return { ...content, content: blocks.length ? blocks : [{ type: "paragraph" }] };
}

// ── Single document ──
export function documentPrint(doc: LitmaDoc): { spec: PageSpec; sections: Section[] } {
  const s = { ...settingsFor(doc.kind), ...doc.settings };
  const size = PAGE_SIZES[s.pageSize] ?? PAGE_SIZES.A4;
  return {
    spec: { w: size.w, h: size.h, top: s.margins.top, bottom: s.margins.bottom, inner: s.margins.left, outer: s.margins.right, mirror: false },
    sections: [
      {
        kind: "flow",
        id: doc.id,
        html: docHtml(doc, doc.content),
        className: docClasses(doc.kind, s),
        vars: varsFor(s.font, s.fontSize, s.lineHeight),
        numbering: "arabic",
        runningHead: s.header || "",
      },
    ],
  };
}

// ── Book ──
export const ITEM_LABELS: Record<BookItem["type"], { en: string; ml: string }> = {
  cover: { en: "Front cover", ml: "മുഖചിത്രം" },
  "half-title": { en: "Half-title page", ml: "അർദ്ധശീർഷകം" },
  title: { en: "Title page", ml: "ശീർഷക താൾ" },
  copyright: { en: "Copyright page", ml: "പകർപ്പവകാശം" },
  dedication: { en: "Dedication", ml: "സമർപ്പണം" },
  epigraph: { en: "Epigraph", ml: "ആമുഖവാക്യം" },
  toc: { en: "Contents", ml: "ഉള്ളടക്കം" },
  text: { en: "Text page", ml: "താൾ" },
  part: { en: "Part divider", ml: "ഭാഗം" },
  document: { en: "Chapter", ml: "അദ്ധ്യായം" },
  "back-cover": { en: "Back cover", ml: "പിൻചട്ട" },
};

export function bookSpec(book: Book): PageSpec {
  const st = book.settings ?? {};
  const size = PAGE_SIZES[st.pageSize ?? "A4"] ?? PAGE_SIZES.A4;
  const m = st.margins ?? { top: 22, bottom: 24, inner: 24, outer: 20 };
  return { w: size.w, h: size.h, top: m.top, bottom: m.bottom, inner: m.inner, outer: m.outer, mirror: true };
}

export function bookSections(book: Book, docs: Map<string, LitmaDoc>): Section[] {
  const st = book.settings ?? {};
  const font = st.font ?? "Noto Serif Malayalam";
  const size = st.fontSize ?? 12;
  const lh = st.lineHeight ?? 1.8;
  const baseVars = varsFor(font, size, lh);
  const items = book.structure.filter((i) => i.type !== "cover" && i.type !== "back-cover");
  const firstBody = items.findIndex((i) => i.type === "document" || i.type === "part");
  const sections: Section[] = [];
  let chapterNo = 0;
  const year = st.year || String(new Date().getFullYear());
  const rich = (c?: JSONContent) => (c?.content?.length ? docHtml({ kind: "blank", settings: settingsFor("blank") }, c) : "");

  items.forEach((it, idx) => {
    const front = firstBody < 0 || idx < firstBody;
    const numbering = front ? "roman" : "arabic";
    const id = it.id;
    switch (it.type) {
      case "half-title":
        sections.push({ kind: "fixed", id, numbering, quietFirst: true, startRight: true, vars: baseVars, html: `<div class="pp-center"><p class="pp-ht">${esc(book.title)}</p></div>` });
        break;
      case "title":
        sections.push({
          kind: "fixed",
          id,
          numbering,
          quietFirst: true,
          startRight: true,
          vars: baseVars,
          html: `<div class="pp-title"><h1>${esc(book.title)}</h1>${book.subtitle ? `<p class="pp-sub">${esc(book.subtitle)}</p>` : ""}<p class="pp-by">${esc(book.author ?? "")}</p>${st.publisher ? `<p class="pp-pub">${esc(st.publisher)}</p>` : ""}</div>`,
        });
        break;
      case "copyright": {
        const auto = [
          `${esc(book.title)}${book.subtitle ? ` — ${esc(book.subtitle)}` : ""}`,
          `© ${esc(year)} ${esc(book.author ?? "")}. എല്ലാ അവകാശങ്ങളും നിക്ഷിപ്തം.`,
          st.edition ? esc(st.edition) : "",
          st.isbn ? `ISBN ${esc(st.isbn)}` : "",
          st.publisher ? `പ്രസാധകർ: ${esc(st.publisher)}` : "",
          "Typeset with Litma",
        ]
          .filter(Boolean)
          .map((l) => `<p>${l}</p>`)
          .join("");
        sections.push({ kind: "fixed", id, numbering, quietFirst: true, vars: baseVars, html: `<div class="pp-copyright">${rich(it.content) || auto}</div>` });
        break;
      }
      case "dedication":
        sections.push({ kind: "fixed", id, numbering, quietFirst: true, startRight: true, vars: baseVars, html: `<div class="pp-dedication">${rich(it.content)}</div>` });
        break;
      case "epigraph":
        sections.push({ kind: "fixed", id, numbering, quietFirst: true, startRight: true, vars: baseVars, html: `<div class="pp-epigraph">${rich(it.content)}</div>` });
        break;
      case "toc": {
        let n = 0;
        const entries = items
          .filter((x) => x.inToc !== false && (x.type === "document" || x.type === "part" || (x.type === "text" && items.indexOf(x) > idx)))
          .map((x) => {
            const title = x.title || (x.type === "document" ? docs.get(x.documentId ?? "")?.title : "") || ITEM_LABELS[x.type].ml;
            const num = x.type === "document" ? `<span class="pp-toc-no">${++n}</span>` : "";
            return `<li data-toc="${x.id}" class="pp-toc-${x.type}">${num}<span class="pp-toc-t">${esc(title)}</span><span class="pp-toc-dots"></span><span class="pp-toc-num"></span></li>`;
          })
          .join("");
        sections.push({ kind: "flow", id, numbering, quietFirst: true, startRight: true, className: "pp-plain", vars: baseVars, html: `<h2 class="pp-chapter">${esc(it.title || "ഉള്ളടക്കം")}</h2><ol class="pp-toc">${entries}</ol>` });
        break;
      }
      case "text":
        sections.push({
          kind: "flow",
          id,
          numbering,
          quietFirst: true,
          startRight: !!st.chaptersOnRight,
          runningHead: st.runningHead !== false ? it.title : undefined,
          className: "pp-plain tpl-essay",
          vars: baseVars,
          html: `<h2 class="pp-chapter">${esc(it.title ?? "")}</h2>${rich(it.content)}`,
        });
        break;
      case "part":
        sections.push({ kind: "fixed", id, numbering, quietFirst: true, startRight: true, vars: baseVars, html: `<div class="pp-part"><p class="pp-part-k">ഭാഗം</p><h2>${esc(it.title || "")}</h2></div>` });
        break;
      case "document": {
        const d = docs.get(it.documentId ?? "");
        if (!d) break;
        chapterNo++;
        const title = it.title || d.title;
        const showTitle = it.showTitle !== false;
        const own = { ...settingsFor(d.kind), ...d.settings };
        const vars = PROSE.has(d.kind) ? baseVars : varsFor(own.font, own.fontSize, own.lineHeight);
        const heading = showTitle ? `<h2 class="pp-chapter"><span class="pp-chapter-no">${chapterNo}</span>${esc(title)}</h2>` : "";
        sections.push({
          kind: "flow",
          id,
          numbering: "arabic",
          quietFirst: true,
          startRight: !!st.chaptersOnRight,
          runningHead: st.runningHead !== false ? title : undefined,
          className: docClasses(d.kind, own),
          vars,
          html: heading + docHtml(d, bodyOf(d.content, showTitle)),
        });
        break;
      }
    }
  });
  return sections;
}

export { DEFAULT_STRUCTURE } from "./book-structure";
