"use client";
import { generateHTML, type JSONContent } from "@tiptap/core";
import { buildExtensions } from "@/components/editor/extensions";
import { settingsFor } from "./templates";
import type { LitmaDoc } from "./types";
import { endnotesHtml } from "@/extensions/footnote";

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
 * extensions/blocks.ts does this in the editor, but plugins don't run in generateHTML).
 * Footnotes are listed at the end, as the editor shows them.
 */
export function renderDocHtml(doc: Pick<LitmaDoc, "kind" | "settings">, content: JSONContent): string {
  const s = { ...settingsFor(doc.kind), ...doc.settings };
  const html = generateHTML(content, buildExtensions(doc.kind, s, "english")) + endnotesHtml(footnotesOf(content));
  return html.replace(/<p((?:\s[^>]*)?)>(?=<span[^>]*\bclass="[^"]*\btc\b)/g, (_m, attrs: string) =>
    /\bclass="/.test(attrs) ? `<p${attrs.replace(/\bclass="/, 'class="own-first-colour ')}>` : `<p class="own-first-colour"${attrs}>`
  );
}
