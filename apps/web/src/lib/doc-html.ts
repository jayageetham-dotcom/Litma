"use client";
import { generateHTML, type JSONContent } from "@tiptap/core";
import { buildExtensions } from "@/components/editor/extensions";
import { settingsFor } from "./templates";
import type { LitmaDoc } from "./types";
import { endnotesHtml } from "@/extensions/footnote";
import { firstAksharaLength } from "@litma/shared/akshara";

function footnotesOf(content: JSONContent): string[] {
  const out: string[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === "footnote") out.push(String(n.attrs?.text ?? ""));
    (n.content ?? []).forEach(walk);
  };
  walk(content);
  return out;
}

/**
 * A work as HTML for reading, books and print, with the same classes the editor adds live:
 * paragraphs that start with the writer's own text colour get `own-first-colour`, so a
 * novel or story drop cap keeps that colour instead of the accent (FirstLetterColour in
 * extensions/blocks.ts does this in the editor, but plugins don't run in generateHTML), and the
 * first akshara after a chapter heading is wrapped in `<span class="drop-cap">` like the editor's.
 * Footnotes are listed at the end, as the editor shows them.
 */
export function renderDocHtml(doc: Pick<LitmaDoc, "kind" | "settings">, content: JSONContent): string {
  const s = { ...settingsFor(doc.kind), ...doc.settings };
  const html = generateHTML(content, buildExtensions(doc.kind, s, "english")) + endnotesHtml(footnotesOf(content));
  const coloured = html.replace(/<p((?:\s[^>]*)?)>(?=<span[^>]*\bclass="[^"]*\btc\b)/g, (_m, attrs: string) =>
    /\bclass="/.test(attrs) ? `<p${attrs.replace(/\bclass="/, 'class="own-first-colour ')}>` : `<p class="own-first-colour"${attrs}>`
  );
  return withDropCaps(coloured);
}

const MARK_TAGS = /^(SPAN|STRONG|EM|U|S|MARK|B|I|A)$/;

/** Wrap the first akshara of each paragraph after a chapter heading in `<span class="drop-cap">`. */
function withDropCaps(html: string): string {
  if (typeof document === "undefined" || !html.includes("sb-chapter")) return html;
  const box = document.createElement("template");
  box.innerHTML = html;
  let changed = false;
  for (const chapter of Array.from(box.content.querySelectorAll("p.sb-chapter"))) {
    const p = chapter.nextElementSibling;
    if (!p || p.tagName !== "P" || p.classList.contains("sb")) continue;
    // the first text, through any mark spans (bold, colour…), but not inside a footnote or other node
    let node: ChildNode | null = p.firstChild;
    while (node && node.nodeType === 1 && MARK_TAGS.test((node as Element).tagName)) node = node.firstChild;
    if (!node || node.nodeType !== 3) continue;
    const text = node as Text;
    const len = firstAksharaLength(text.data);
    if (!len) continue;
    if (len < text.data.length) text.splitText(len);
    const span = document.createElement("span");
    span.className = "drop-cap";
    text.replaceWith(span);
    span.appendChild(text);
    changed = true;
  }
  return changed ? box.innerHTML : html;
}
