"use client";
import type { JSONContent } from "@tiptap/core";
import { AlignmentType, Document, FootnoteReferenceRun, HeadingLevel, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, BorderStyle } from "docx";
import type { LitmaDoc } from "./types";
import { track } from "./analytics";
import { PAGE_SIZES } from "@/extensions/pagination";
import { renderDocHtml } from "./doc-html";
import { docClasses } from "./templates";

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
/** Footnotes met while writing the body, numbered from 1 (Word numbers them itself). */
let notes: string[] = [];

function runs(n: JSONContent, base: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}): (TextRun | FootnoteReferenceRun)[] {
  const res: (TextRun | FootnoteReferenceRun)[] = [];
  const walk = (c: JSONContent) => {
    if (c.type === "hardBreak") {
      res.push(new TextRun({ text: "", break: 1 }));
      return;
    }
    if (c.type === "footnote") {
      notes.push(String(c.attrs?.text ?? ""));
      res.push(new FootnoteReferenceRun(notes.length));
      return;
    }
    if (c.type !== "text") return (c.content ?? []).forEach(walk);
    const marks = new Set((c.marks ?? []).map((m) => m.type));
    // the writer's own font size (toolbar), in points
    const own = parseFloat(String((c.marks ?? []).find((m) => m.type === "textStyle")?.attrs?.fontSize ?? ""));
    res.push(
      new TextRun({
        text: c.text ?? "",
        bold: base.bold || marks.has("bold"),
        italics: base.italics || marks.has("italic"),
        underline: marks.has("underline") ? {} : undefined,
        strike: marks.has("strike"),
        size: own ? Math.round(own * 2) : base.size,
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
  track("export", { format: "docx", kind: d.kind });
  const s = d.settings;
  const pt = (v: number) => Math.round(v * 2); // half-points
  const body: (Paragraph | Table)[] = [];
  notes = [];
  let scene = 0;
  let chapter = 0;
  let act = 0;
  let dscene = 0;
  let stanza = 0;
  const en = s.headingLabels === "en";
  // numbered headings read the way the work shows them on screen
  const sceneLabel = d.kind === "screenplay" ? (s.headingLabels === "ml" ? "രംഗം " : en ? "Scene " : "Scene: ") : en ? "Scene " : "രംഗം ";
  const prose = d.kind === "novel" || d.kind === "story";
  const label = (text: string, size = s.fontSize - 1) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 60 }, children: [new TextRun({ text, bold: true, size: pt(size) })] });
  const pair = (left: JSONContent, right: JSONContent, o: { leftPct: number; rightPct: number; alignLeft: (typeof AlignmentType)[keyof typeof AlignmentType]; boldLeft: boolean; colon: boolean; pad?: boolean }) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: o.leftPct, type: WidthType.PERCENTAGE },
              borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
              children: [new Paragraph({ alignment: o.alignLeft, children: [...runs(left, { bold: o.boldLeft }), ...(o.colon ? [new TextRun(":")] : [])] })],
            }),
            new TableCell({
              width: { size: o.rightPct, type: WidthType.PERCENTAGE },
              borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
              children: [new Paragraph({ children: runs(right) })],
            }),
            ...(o.pad ? [new TableCell({ width: { size: 100 - o.leftPct - o.rightPct, type: WidthType.PERCENTAGE }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [new Paragraph("")] })] : []),
          ],
        }),
      ],
    });
  const blocks = d.content.content ?? [];
  for (const [i, n] of blocks.entries()) {
    const align = ALIGN[n.attrs?.textAlign as string];
    // novels and stories indent like the editor: not the first paragraph, not after a heading or
    // a break, and an empty line is a section break (it and the paragraph after it sit at the margin)
    const before = i > 0 ? blocks[i - 1] : undefined;
    const indentHere = prose && !!n.content?.length && before?.type === "paragraph" && !!before.content?.length;
    switch (n.type) {
      case "heading":
        body.push(new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][(n.attrs?.level ?? 1) - 1], children: runs(n), alignment: align }));
        break;
      case "styledBlock": {
        const v = n.attrs?.variant as string;
        const hasText = !!(n.content ?? []).length;
        if (v === "act") {
          dscene = 0;
          body.push(label(`${en ? "Act" : "അങ്കം"} ${++act}`, s.fontSize + 4));
          if (hasText) body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: runs(n, { bold: true, size: pt(s.fontSize + 2) }) }));
          break;
        }
        if (v === "scene") {
          body.push(label(`${en ? "Scene" : "രംഗം"} ${++dscene}`, s.fontSize + 2));
          if (hasText) body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs(n) }));
          break;
        }
        if (v === "stanza") {
          body.push(label(String(++stanza)));
          if (hasText) body.push(new Paragraph({ alignment: AlignmentType.CENTER, children: runs(n, { italics: true }) }));
          break;
        }
        if (v === "chapter") {
          chapter++;
          if (prose && s.chapterNumbers) body.push(label(`${en ? "Chapter" : "അദ്ധ്യായം"} ${chapter}`));
        }
        if (v === "infobox") {
          const line = { style: BorderStyle.SINGLE, size: 6, color: "B8B8C0" };
          body.push(new Paragraph({ border: { top: line, bottom: line, left: line, right: line }, spacing: { before: 200, after: 200 }, children: runs(n, { size: pt(s.fontSize - 0.5) }) }));
          break;
        }
        if (v === "refrain") {
          body.push(new Paragraph({ indent: { left: 400 }, children: [new TextRun({ text: "↻ " }), ...runs(n, { italics: true })] }));
          break;
        }
        const center = ["title", "subtitle", "author", "chapter", "pullquote", "caption"].includes(v);
        const big = v === "title" ? 20 : v === "chapter" ? 16 : v === "pullquote" ? 15 : v === "subhead" || v === "references" ? 13.5 : v === "credits" ? s.fontSize - 2 : v === "epigraph" ? s.fontSize - 1 : s.fontSize;
        body.push(
          new Paragraph({
            alignment: center ? AlignmentType.CENTER : v === "epigraph" ? AlignmentType.RIGHT : align,
            spacing: { before: v === "chapter" ? 480 : 120, after: v === "title" || v === "chapter" ? 360 : 120 },
            children: runs(n, { bold: ["title", "chapter", "subhead", "pullquote", "references"].includes(v), italics: ["stage", "epigraph"].includes(v), size: pt(big) }),
          })
        );
        break;
      }
      case "sceneHeading":
        body.push(new Paragraph({ spacing: { before: 360 }, children: [new TextRun({ text: `${sceneLabel}${++scene}`, bold: true, size: pt(s.fontSize + 3) })] }));
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
        body.push(pair(cue, speech, { leftPct: sp ? 46 : 20, rightPct: sp ? 44 : 80, alignLeft: sp ? AlignmentType.RIGHT : AlignmentType.LEFT, boldLeft: !sp, colon: true, pad: sp }));
        break;
      }
      case "castEntry": {
        const [name, role] = n.content ?? [];
        body.push(pair(name, role, { leftPct: 28, rightPct: 72, alignLeft: AlignmentType.LEFT, boldLeft: true, colon: false }));
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
            // ragged-right like the editor; justified only when the writer chose it
            alignment: align,
            indent: indentHere ? { firstLine: 400 } : undefined,
            spacing: { after: prose ? 40 : 140, line: Math.round(s.lineHeight * 240) },
            children: runs(n),
          })
        );
    }
  }
  const size = PAGE_SIZES[s.pageSize] ?? PAGE_SIZES.A4;
  const tw = (mm: number) => Math.round((mm / 25.4) * 1440);
  const footnotes = Object.fromEntries(notes.map((t, i) => [String(i + 1), { children: [new Paragraph({ children: [new TextRun({ text: t, size: pt(s.fontSize - 2) })] })] }]));
  const docx = new Document({
    creator: "Litma",
    title: d.title,
    footnotes,
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
  track("export", { format: "txt", kind: d.kind });
  download(`${safe(d.title)}.txt`, new Blob([toPlainText(d.content, { labels: d.settings.headingLabels, kind: d.kind })], { type: "text/plain;charset=utf-8" }));
}
export function exportMarkdown(d: LitmaDoc) {
  track("export", { format: "md", kind: d.kind });
  download(`${safe(d.title)}.md`, new Blob([toMarkdown(d.content, { labels: d.settings.headingLabels, kind: d.kind })], { type: "text/markdown;charset=utf-8" }));
}
export function exportHTML(d: LitmaDoc) {
  track("export", { format: "html", kind: d.kind });
  const html = renderDocHtml(d, d.content);
  const en = d.settings.headingLabels === "en";
  const sceneWord = d.kind === "screenplay" ? (d.settings.headingLabels === "ml" ? "രംഗം " : en ? "Scene " : "Scene: ") : en ? "Scene " : "രംഗം ";
  const page = `<!doctype html><html lang="ml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${d.title.replace(/</g, "&lt;")}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+Malayalam&family=Noto+Sans+Malayalam&family=Manjari&family=Gayathri&display=swap">
<style>body{max-width:42rem;margin:3rem auto;padding:0 1rem;font-family:'${d.settings.font}','Noto Serif Malayalam',sans-serif;line-height:${d.settings.lineHeight};font-size:${d.settings.fontSize}pt;counter-reset:scene chapter act dscene stanza footnote}
p{margin:0 0 .65em}.sb-title{font-size:2em;text-align:center;font-weight:700}.sb-subtitle,.sb-author{text-align:center}.sb-chapter{text-align:center;font-size:1.35em;font-weight:700;margin:2em 0 1em;counter-increment:chapter}
.sb-epigraph{font-style:italic;text-align:right;margin-left:35%}.sb-subhead,.sb-references{font-weight:700;font-size:1.1em}.sb-pullquote{font-size:1.3em;text-align:center;font-weight:600}.sb-kicker,.sb-byline,.sb-caption,.sb-credits{font-size:.85em;color:#55555f}
.sb-stage{font-style:italic;margin-left:2.5em}.sb-stage:before{content:"("}.sb-stage:after{content:")"}.sb-dateline{font-weight:600;border-bottom:1px solid #ddd}
.sb-act,.sb-scene,.sb-stanza{display:flex;flex-direction:column;align-items:center;text-align:center}.sb-act:after,.sb-scene:after,.sb-stanza:after{order:-1;font-weight:700}
.sb-act{counter-increment:act;counter-set:dscene 0;font-size:1.4em;font-weight:700}.sb-act:after{content:"${en ? "Act" : "അങ്കം"} " counter(act)}.sb-scene{counter-increment:dscene;margin-top:1.6em}.sb-scene:after{content:"${en ? "Scene" : "രംഗം"} " counter(dscene)}.sb-stanza{counter-increment:stanza}.sb-stanza:after{content:counter(stanza)}
.sb-refrain{font-style:italic;margin-left:1.5em}.sb-refrain:before{content:"↻ "}.sb-infobox{border:1px solid #ccc;border-radius:6px;padding:.8em 1em}
.chapter-numbers .sb-chapter:before{content:"${en ? "Chapter" : "അദ്ധ്യായം"} " counter(chapter);display:block;font-size:.55em}.verse-center p:not(.sb){text-align:center}
.sp-scene{counter-increment:scene;margin-top:1.8em}.sp-scene:before{content:"${sceneWord}" counter(scene);display:block}.sp-dialogue,.cast-entry{display:grid;grid-template-columns:40% 1fr;gap:1em}.sp-cue{text-align:right}.sp-cue:after{content:":"}.sp-cast,.sp-transition{text-align:right}.cast-name{font-weight:700}
.fn{counter-increment:footnote;font-size:.7em}.fn:after{content:counter(footnote)}.doc-endnotes{margin-top:2em;border-top:1px solid #ddd;font-size:.85em}.endnotes-h{font-weight:700}</style>
</head><body class="${docClasses(d.kind, d.settings)}">${html}</body></html>`;
  download(`${safe(d.title)}.html`, new Blob([page], { type: "text/html;charset=utf-8" }));
}
