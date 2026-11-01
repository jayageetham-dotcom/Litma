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
  return (n.content ?? []).map(inlineText).join("");
}

// ── Plain text & Markdown ──
export function toPlainText(doc: JSONContent): string {
  let scene = 0;
  const out: string[] = [];
  for (const n of doc.content ?? []) {
    const t = inlineText(n);
    switch (n.type) {
      case "sceneHeading":
        out.push(`\nScene: ${++scene}\n${t}`);
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
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

function mdInline(n: JSONContent): string {
  if (n.type === "hardBreak") return "  \n";
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

export function toMarkdown(doc: JSONContent): string {
  let scene = 0;
  const out: string[] = [];
  for (const n of doc.content ?? []) {
    const t = (n.content ?? []).map(mdInline).join("");
    switch (n.type) {
      case "heading":
        out.push(`${"#".repeat(n.attrs?.level ?? 1)} ${t}`);
        break;
      case "styledBlock": {
        const v = n.attrs?.variant;
        if (v === "title") out.push(`# ${t}`);
        else if (v === "chapter") out.push(`## ${t}`);
        else if (v === "subhead" || v === "part") out.push(`### ${t}`);
        else if (v === "pullquote" || v === "epigraph") out.push(`> ${t}`);
        else if (v === "stage") out.push(`*(${t})*`);
        else out.push(`*${t}*`);
        break;
      }
      case "sceneHeading":
        out.push(`### Scene: ${++scene}\n**${t}**`);
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

const t = (text: string) => (text ? [{ type: "text", text }] : undefined);

/**
 * Turn plain text / light Markdown into Litma nodes.
 * - "# Title"  → title, "## Chapter" → chapter, "### Sub" → subhead
 * - blank line separated paragraphs; single newlines kept as line breaks for poems
 * - screenplay/drama: "Scene: …" / "INT." / "EXT." → scene heading, "Name: speech" → dialogue,
 *   "(direction)" → action/stage direction
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
      const variant = m[1].length === 1 ? "title" : m[1].length === 2 ? "chapter" : verse ? "part" : "subhead";
      out.push({ type: "styledBlock", attrs: { variant }, content: t(m[2]) });
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
