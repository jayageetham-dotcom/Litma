import { Node, mergeAttributes } from "@tiptap/core";

import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { JSONContent } from "@tiptap/core";

/**
 * Legacy hard page break. Pages now flow naturally (like Google Docs), so writers never see
 * or insert breaks. The node stays in the schema only so older documents still load; any
 * break that reaches the editor (old content, paste, an assistant edit) is removed at once.
 */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: false,
  parseHTML: () => [{ tag: "div[data-page-break]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-page-break": "", class: "page-break" })],
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("stripPageBreaks"),
        appendTransaction(trs, _old, state) {
          if (!trs.some((t) => t.docChanged)) return null;
          const found: { pos: number; size: number }[] = [];
          state.doc.forEach((node, offset) => {
            if (node.type.name === "pageBreak") found.push({ pos: offset, size: node.nodeSize });
          });
          if (!found.length) return null;
          const tr = state.tr;
          for (const f of found.reverse()) tr.delete(f.pos, f.pos + f.size);
          return tr.setMeta("addToHistory", false);
        },
      }),
    ];
  },
});

/** Drop legacy page breaks from stored content before it reaches the editor. */
export function stripPageBreaks<T extends JSONContent | null | undefined>(doc: T): T {
  if (!doc || !Array.isArray(doc.content)) return doc;
  const content = doc.content.filter((n) => n.type !== "pageBreak");
  if (content.length === doc.content.length) return doc;
  return { ...doc, content: content.length ? content : [{ type: "paragraph" }] } as T;
}

/**
 * Literary block variants — one node, many roles. Each template exposes the
 * variants that make sense for it (chapter, kicker, stanza label, stage direction…).
 */
export const BLOCK_VARIANTS = {
  title: { label: "Title", ml: "ശീർഷകം" },
  subtitle: { label: "Subtitle", ml: "ഉപശീർഷകം" },
  author: { label: "Author", ml: "എഴുത്തുകാരൻ" },
  chapter: { label: "Chapter", ml: "അദ്ധ്യായം" },
  kicker: { label: "Kicker", ml: "കിക്കർ" },
  standfirst: { label: "Standfirst", ml: "ആമുഖം" },
  byline: { label: "Byline", ml: "ബൈലൈൻ" },
  subhead: { label: "Subhead", ml: "ഉപതലക്കെട്ട്" },
  pullquote: { label: "Pull quote", ml: "ഉദ്ധരണി" },
  part: { label: "Song part", ml: "ഭാഗം" },
  stage: { label: "Stage direction", ml: "രംഗനിർദ്ദേശം" },
  dateline: { label: "Date", ml: "തീയതി" },
  epigraph: { label: "Epigraph", ml: "ആമുഖവാക്യം" },
  caption: { label: "Caption", ml: "അടിക്കുറിപ്പ്" },
} as const;
export type BlockVariant = keyof typeof BLOCK_VARIANTS;

export const StyledBlock = Node.create({
  name: "styledBlock",
  group: "block",
  content: "inline*",
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: "title",
        parseHTML: (el) => el.getAttribute("data-variant"),
        renderHTML: (a) => ({ "data-variant": a.variant }),
      },
    };
  },
  parseHTML: () => [{ tag: "p[data-variant]" }],
  renderHTML: ({ HTMLAttributes }) => ["p", mergeAttributes(HTMLAttributes, { class: `sb sb-${HTMLAttributes["data-variant"]}` }), 0],
  addCommands() {
    return {
      setStyledBlock:
        (variant: string) =>
        ({ commands, editor }) => {
          if (editor.isActive("styledBlock", { variant })) return commands.setNode("paragraph");
          return commands.setNode(this.name, { variant });
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      // Enter at the end of a styled block continues with body text
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parent.type.name !== this.name) return false;
        if ($from.parentOffset !== $from.parent.content.size) return false;
        return editor.chain().insertContentAt($from.after(), { type: "paragraph" }).focus($from.after() + 1).run();
      },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    styledBlock: { setStyledBlock: (variant: string) => ReturnType };
  }
}
