"use client";
import type { JSONContent } from "@tiptap/core";
import { AlignmentType, Document, HeadingLevel, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, BorderStyle } from "docx";
import type { LitmaDoc } from "./types";
import { PAGE_SIZES } from "@/extensions/pagination";

function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const safe = (t: string) => t.replace(/[\\/:*?"<>|]+/g, " ").trim() || "litma";

import { toMarkdown, toPlainText } from "@litma/shared/serialize";
export { toMarkdown, toPlainText };

// ── Word (.docx) ──
function runs(n: JSONContent, base: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}): TextRun[] {
  const res: TextRun[] = [];
  const walk = (c: JSONContent) => {
    if (c.type === "hardBreak") {
      res.push(new TextRun({ text: "", break: 1 }));
      return;
    }
    if (c.type !== "text") return (c.content ?? []).forEach(walk);
    const marks = new Set((c.marks ?? []).map((m) => m.type));
    res.push(
      new TextRun({
        text: c.text ?? "",
        bold: base.bold || marks.has("bold"),
        italics: base.italics || marks.has("italic"),
        underline: marks.has("underline") ? {} : undefined,
        strike: marks.has("strike"),
        size: base.size,
        color: base.color,
      })
    );
  };
  walk(n);
  return res;
}

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

export async function exportDocx(d: LitmaDoc) {
  const s = d.settings;
  const pt = (v: number) => Math.round(v * 2); // half-points
  const body: (Paragraph | Table)[] = [];
  let scene = 0;
  const prose = d.kind === "novel" || d.kind === "story";
  for (const n of d.content.content ?? []) {
    const align = ALIGN[n.attrs?.textAlign as string];
    switch (n.type) {
      case "heading":
        body.push(new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][(n.attrs?.level ?? 1) - 1], children: runs(n), alignment: align }));
        break;
      case "styledBlock": {
        const v = n.attrs?.variant as string;
        const center = ["title", "subtitle", "author", "chapter", "pullquote", "caption"].includes(v);
        const big = v === "title" ? 20 : v === "chapter" ? 16 : v === "pullquote" ? 15 : v === "subhead" ? 13.5 : s.fontSize;
        body.push(
          new Paragraph({
            alignment: center ? AlignmentType.CENTER : v === "epigraph" ? AlignmentType.RIGHT : align,
            spacing: { before: v === "chapter" ? 480 : 120, after: v === "title" || v === "chapter" ? 360 : 120 },
            children: runs(n, { bold: ["title", "chapter", "subhead", "pullquote"].includes(v), italics: ["stage", "epigraph"].includes(v), size: pt(big) }),
          })
        );
        break;
      }
      case "sceneHeading":
        body.push(new Paragraph({ spacing: { before: 360 }, children: [new TextRun({ text: `Scene: ${++scene}`, bold: true, size: pt(s.fontSize + 3) })] }));
        body.push(new Paragraph({ children: runs(n, { bold: true }) }));
        break;
      case "sceneTime":
        body.push(new Paragraph({ children: runs(n) }));
        break;
      case "sceneCast":
        body.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 200 }, children: runs(n, { size: pt(s.fontSize - 1) }) }));
        break;
      case "action":
        body.push(new Paragraph({ indent: { right: 4200 }, spacing: { after: 160 }, children: runs(n) }));
        break;
      case "transition":
        body.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: runs(n, { bold: true }) }));
        break;
      case "dialogue": {
        const [cue, speech] = n.content ?? [];
        const sp = d.kind === "screenplay";
        body.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: sp ? 46 : 20, type: WidthType.PERCENTAGE },
                    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
                    children: [new Paragraph({ alignment: sp ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [...runs(cue, { bold: !sp }), new TextRun(":")] })],
                  }),
                  new TableCell({
                    width: { size: sp ? 44 : 80, type: WidthType.PERCENTAGE },
                    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
                    children: [new Paragraph({ children: runs(speech) })],
                  }),
                  ...(sp ? [new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [new Paragraph("")] })] : []),
                ],
              }),
            ],
          })
        );
        break;
      }
      case "pageBreak":
        body.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case "horizontalRule":
        body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [new TextRun("⁂")] }));
        break;
      case "blockquote":
        (n.content ?? []).forEach((c) => body.push(new Paragraph({ indent: { left: 720 }, children: runs(c, { italics: true }) })));
        break;
      case "bulletList":
      case "orderedList":
        (n.content ?? []).forEach((li, i) =>
          body.push(new Paragraph({ indent: { left: 540, hanging: 300 }, children: [new TextRun(n.type === "orderedList" ? `${i + 1}. ` : "• "), ...runs(li)] }))
        );
        break;
      default:
        body.push(
          new Paragraph({
            alignment: align ?? (prose ? AlignmentType.JUSTIFIED : undefined),
            indent: prose ? { firstLine: 400 } : undefined,
            spacing: { after: prose ? 40 : 140, line: Math.round(s.lineHeight * 240) },
            children: runs(n),
          })
        );
    }
  }
  const size = PAGE_SIZES[s.pageSize] ?? PAGE_SIZES.A4;
  const tw = (mm: number) => Math.round((mm / 25.4) * 1440);
  const docx = new Document({
    creator: "Litma",
    title: d.title,
    styles: { default: { document: { run: { font: s.font, size: pt(s.fontSize) } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: tw(size.w), height: tw(size.h) },
            margin: { top: tw(s.margins.top), bottom: tw(s.margins.bottom), left: tw(s.margins.left), right: tw(s.margins.right) },
          },
        },
        children: body,
      },
    ],
  });
  download(`${safe(d.title)}.docx`, await Packer.toBlob(docx));
}

export function exportText(d: LitmaDoc) {
  download(`${safe(d.title)}.txt`, new Blob([toPlainText(d.content)], { type: "text/plain;charset=utf-8" }));
}
export function exportMarkdown(d: LitmaDoc) {
  download(`${safe(d.title)}.md`, new Blob([toMarkdown(d.content)], { type: "text/markdown;charset=utf-8" }));
}
export function exportHTML(d: LitmaDoc, html: string) {
  const page = `<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>${d.title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+Malayalam&family=Noto+Sans+Malayalam&family=Manjari&display=swap">
<style>body{max-width:42rem;margin:3rem auto;padding:0 1rem;font-family:'${d.settings.font}',serif;line-height:${d.settings.lineHeight};font-size:${d.settings.fontSize}pt}
.sb-title{font-size:2em;text-align:center;font-weight:700}.sb-author,.sb-chapter{text-align:center}.sp-dialogue{display:grid;grid-template-columns:40% 1fr;gap:1em}.sp-cue{text-align:right}.sp-cue:after{content:":"}.sp-cast,.sp-transition{text-align:right}</style>
</head><body>${html}</body></html>`;
  download(`${safe(d.title)}.html`, new Blob([page], { type: "text/html;charset=utf-8" }));
}
