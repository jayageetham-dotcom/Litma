/** Minimal ProseMirror JSON node type (kept dependency-free so Edge Functions can import this file). */
export interface JSONContent {
  type?: string;
  attrs?: Record<string, any>;
  content?: JSONContent[];
  marks?: { type: string; attrs?: Record<string, any> }[];
  text?: string;
  [key: string]: any;
}

export function inlineText(n: JSONContent): string {
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hardBreak") return "\n";
  if (n.type === "footnote") return "";
  return (n.content ?? []).map(inlineText).join("");
}

/** How a work numbers its headings: kind decides the defaults, labels is the writer's choice (DocSettings.headingLabels). */
export interface SerializeOptions {
  kind?: string;
  labels?: "ml" | "en";
}

/** "Scene: 3" / "രംഗം 3" / "Scene 3" for screenplays, "അങ്കം 1" / "Act 1" and "രംഗം 2" / "Scene 2" for plays. */
function numberWords(o: SerializeOptions = {}) {
  const en = o.labels === "en";
  return {
    scene: o.kind === "screenplay" ? (o.labels === "ml" ? "രംഗം " : en ? "Scene " : "Scene: ") : en ? "Scene " : "രംഗം ",
    act: en ? "Act " : "അങ്കം ",
    playScene: en ? "Scene " : "രംഗം ",
  };
}

function footnoteTexts(doc: JSONContent): string[] {
  const out: string[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === "footnote") out.push(String(n.attrs?.text ?? ""));
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return out;
}

/** Inline text with footnotes as [1], [2]… (numbers continue across the document). */
function inlineWithNotes(n: JSONContent, counter: { n: number }): string {
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hardBreak") return "\n";
  if (n.type === "footnote") return `[${++counter.n}]`;
  return (n.content ?? []).map((c) => inlineWithNotes(c, counter)).join("");
}

// ── Plain text & Markdown ──
export function toPlainText(doc: JSONContent, opts: SerializeOptions = {}): string {
  let scene = 0;
  let act = 0;
  let pscene = 0;
  let stanza = 0;
  const w = numberWords(opts);
  const fn = { n: 0 };
  const out: string[] = [];
  for (const n of doc.content ?? []) {
    const t = inlineWithNotes(n, fn);
    switch (n.type) {
      case "sceneHeading":
        out.push(`\n${w.scene}${++scene}\n${t}`);
        break;
      case "styledBlock": {
        const v = n.attrs?.variant;
        if (v === "act") {
          pscene = 0;
          out.push(`\n${w.act}${++act}${t ? `\n${t}` : ""}`);
        } else if (v === "scene") out.push(`\n${w.playScene}${++pscene}${t ? `\n${t}` : ""}`);
        else if (v === "stanza") out.push(`\n${++stanza}${t ? `. ${t}` : ""}`);
        else if (v === "stage") out.push(`(${t})`);
        else out.push(t);
        break;
      }
      case "castEntry":
        out.push(`${inlineText(n.content![0])}: ${inlineText(n.content![1])}`);
        break;
      case "sceneCast":
        out.push(t.split("\n").map((x) => `\t\t\t${x}`).join("\n"));
        break;
      case "dialogue":
        out.push(`${inlineText(n.content![0])}:\t${inlineText(n.content![1])}`);
        break;
      case "pageBreak":
        out.push("\f");
        break;
      case "horizontalRule":
        out.push("⁂");
        break;
      case "bulletList":
      case "orderedList":
        (n.content ?? []).forEach((li, i) => out.push(`${n.type === "orderedList" ? `${i + 1}.` : "•"} ${inlineText(li)}`));
        break;
      default:
        out.push(t);
    }
  }
  const notes = footnoteTexts(doc);
  if (notes.length) out.push("", "കുറിപ്പുകൾ", ...notes.map((x, i) => `${i + 1}. ${x}`));
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

function mdInline(n: JSONContent): string {
  if (n.type === "hardBreak") return "  \n";
  if (n.type === "footnote") return `^[${String(n.attrs?.text ?? "").replace(/\]/g, ")")}]`;
  if (n.type !== "text") return (n.content ?? []).map(mdInline).join("");
  let t = n.text ?? "";
  for (const m of n.marks ?? []) {
    if (m.type === "bold") t = `**${t}**`;
    if (m.type === "italic") t = `*${t}*`;
    if (m.type === "strike") t = `~~${t}~~`;
    if (m.type === "link") t = `[${t}](${m.attrs?.href})`;
  }
  return t;
}

export function toMarkdown(doc: JSONContent, opts: SerializeOptions = {}): string {
  let scene = 0;
  let act = 0;
  let pscene = 0;
  let stanza = 0;
  const w = numberWords(opts);
  const out: string[] = [];
  for (const n of doc.content ?? []) {
    const t = (n.content ?? []).map(mdInline).join("");
    switch (n.type) {
      case "heading":
        out.push(`${"#".repeat(n.attrs?.level ?? 1)} ${t}`);
        break;
      case "styledBlock": {
        const v = n.attrs?.variant;
        if (v === "act") {
          pscene = 0;
          out.push(`## ${w.act}${++act}${t ? `: ${t}` : ""}`);
        } else if (v === "scene") out.push(`### ${w.playScene}${++pscene}${t ? `: ${t}` : ""}`);
        else if (v === "stanza") out.push(`### ${++stanza}${t ? `. ${t}` : ""}`);
        else if (v === "references") out.push(`## ${t}`);
        else if (v === "refrain") out.push(`*↻ ${t}*`);
        else if (v === "infobox") out.push(`> **${t}**`);
        else if (v === "title") out.push(`# ${t}`);
        else if (v === "chapter") out.push(`## ${t}`);
        else if (v === "subhead" || v === "part") out.push(`### ${t}`);
        else if (v === "pullquote" || v === "epigraph") out.push(`> ${t}`);
        else if (v === "stage") out.push(`*(${t})*`);
        else out.push(`*${t}*`);
        break;
      }
      case "sceneHeading":
        out.push(`### ${w.scene}${++scene}\n**${t}**`);
        break;
      case "castEntry":
        out.push(`**${mdInline(n.content![0])}**: ${mdInline(n.content![1])}`);
        break;
      case "sceneCast":
        out.push(`_${inlineText(n).split("\n").join(", ")}_`);
        break;
      case "dialogue":
        out.push(`**${mdInline(n.content![0])}:** ${mdInline(n.content![1])}`);
        break;
      case "transition":
        out.push(`**${t}**`);
        break;
      case "blockquote":
        out.push((n.content ?? []).map((c) => `> ${(c.content ?? []).map(mdInline).join("")}`).join("\n"));
        break;
      case "bulletList":
      case "orderedList":
        out.push((n.content ?? []).map((li, i) => `${n.type === "orderedList" ? `${i + 1}.` : "-"} ${(li.content ?? []).map((c) => (c.content ?? []).map(mdInline).join("")).join(" ")}`).join("\n"));
        break;
      case "horizontalRule":
        out.push("* * *");
        break;
      case "pageBreak":
        out.push("\n---\n");
        break;
      default:
        out.push(t);
    }
  }
  return out.join("\n\n");
}


// ── Text → Litma document (used by MCP tools) ──

/** Text with inline footnotes ("…^[note]") as text and footnote nodes. */
const t = (text: string): JSONContent[] | undefined => {
  if (!text) return undefined;
  const out: JSONContent[] = [];
  let rest = text;
  let m: RegExpMatchArray | null;
  while ((m = rest.match(/\^\[([^\]]+)\]/))) {
    const i = m.index ?? 0;
    if (i) out.push({ type: "text", text: rest.slice(0, i) });
    out.push({ type: "footnote", attrs: { text: m[1].trim() } });
    rest = rest.slice(i + m[0].length);
  }
  if (rest) out.push({ type: "text", text: rest });
  return out.length ? out : undefined;
};

/** Drop a spelled-out heading number ("രംഗം ഒന്ന്", "Scene 2:", "അങ്കം 1 -") that Litma adds itself. */
const stripNumber = (s: string, words: RegExp) => s.replace(new RegExp(`^(?:${words.source})\\s*[^\\s:–.-]*\\s*[:–.-]?\\s*`, "i"), "").trim();

/**
 * Turn plain text / light Markdown into Litma nodes.
 * - "# Title"  → title, "## Chapter" → chapter, "### Sub" → subhead
 * - blank line separated paragraphs; single newlines kept as line breaks for poems
 * - screenplay/drama: "Scene: …" / "INT." / "EXT." → scene heading, "Name: speech" → dialogue,
 *   "(direction)" → action/stage direction
 * - plays: "## അങ്കം 1" / "## Act 1" → act, any other "## …" → scene (numbered automatically, so a
 *   leading "രംഗം ഒന്ന്" / "Scene 2" is dropped and only the place or time is kept)
 * - poems: "### …" → stanza; songs: "### …" → part (പല്ലവി…)
 * - footnotes anywhere in a line: "text^[the note]"
 */
export function textToNodes(text: string, kind: string): JSONContent[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: JSONContent[] = [];
  const verse = kind === "poem" || kind === "lyrics";
  const script = kind === "screenplay" || kind === "drama";
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    if (verse) para.forEach((l) => out.push({ type: "paragraph", content: t(l) }));
    else out.push({ type: "paragraph", content: t(para.join(" ")) });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      if (verse) out.push({ type: "paragraph" });
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flush();
      if (kind === "drama" && m[1].length >= 2) {
        const isAct = /^(അങ്കം|act)\b/i.test(m[2]);
        const rest = stripNumber(m[2], isAct ? /അങ്കം|act/ : /രംഗം|scene/);
        out.push({ type: "styledBlock", attrs: { variant: isAct ? "act" : /^(രംഗം|scene)\b/i.test(m[2]) || m[1].length === 2 ? "scene" : "subhead" }, content: t(isAct || /^(രംഗം|scene)\b/i.test(m[2]) ? rest : m[2]) });
        continue;
      }
      const variant = m[1].length === 1 ? "title" : m[1].length === 2 ? "chapter" : kind === "poem" ? "stanza" : verse ? "part" : "subhead";
      out.push({ type: "styledBlock", attrs: { variant }, content: t(variant === "stanza" ? m[2].replace(/^\d+[.)]?\s*/, "") : m[2]) });
      continue;
    }
    if (line === "***" || line === "* * *" || line === "⁂") {
      flush();
      out.push({ type: "horizontalRule" });
      continue;
    }
    if (script) {
      if (kind === "screenplay" && (m = line.match(/^(?:scene\s*:?\s*\d*\s*[-–:.]?\s*|രംഗം\s*\d*\s*[-–:.]?\s*)(.*)$/i)) && /^(scene|രംഗം)/i.test(line)) {
        flush();
        out.push({ type: "sceneHeading", content: t(m[1]) });
        continue;
      }
      if (kind === "screenplay" && /^(int|ext)[./]/i.test(line)) {
        flush();
        out.push({ type: "sceneHeading", content: t(line) });
        continue;
      }
      if ((m = line.match(/^([^:：]{1,60})[:：]\s*(.+)$/))) {
        flush();
        out.push({ type: "dialogue", content: [{ type: "dialogueCue", content: t(m[1].trim()) }, { type: "dialogueSpeech", content: t(m[2].trim()) }] });
        continue;
      }
      if (kind === "drama" && /^\(.*\)$/.test(line)) {
        flush();
        out.push({ type: "styledBlock", attrs: { variant: "stage" }, content: t(line.slice(1, -1)) });
        continue;
      }
      if (kind === "screenplay") {
        flush();
        out.push({ type: "action", content: t(line) });
        continue;
      }
    }
    para.push(line);
  }
  flush();
  return out.length ? out : [{ type: "paragraph" }];
}
