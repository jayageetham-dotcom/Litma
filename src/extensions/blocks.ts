import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/** Hard page break — forces the next block onto a new A4 page (and a new printed page). */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "div[data-page-break]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-page-break": "", class: "page-break" })],
  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent([{ type: "pageBreak" }, { type: "paragraph" }]).run(),
      insertPageAt:
        (pos: number) =>
        ({ state, chain }) => {
          // a blank page at the boundary `pos` (the start of a page): …page N [break] new page [break] page N+1…
          const before = state.doc.resolve(pos).nodeBefore;
          const nodes = [...(before?.type.name === "pageBreak" ? [] : [{ type: "pageBreak" }]), { type: "paragraph" }, { type: "pageBreak" }];
          const firstPara = pos + (before?.type.name === "pageBreak" ? 0 : 1) + 1;
          return chain().insertContentAt(pos, nodes).setTextSelection(firstPara).scrollIntoView().run();
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => this.editor.commands.insertPageBreak(),
      // Like Google Docs: Backspace at the very start of a page removes the break before it.
      // On an empty inserted page (empty line between two breaks) it removes the whole page.
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const { $from } = selection;
        if ($from.depth !== 1 || $from.parentOffset !== 0) return false;
        const blockStart = $from.before(1);
        const before = state.doc.resolve(blockStart).nodeBefore;
        if (before?.type.name !== "pageBreak") return false;
        const block = $from.parent;
        const blockEnd = $from.after(1);
        const after = state.doc.resolve(blockEnd).nodeAfter;
        const tr = state.tr;
        if (block.content.size === 0 && after?.type.name === "pageBreak") {
          // empty page between two breaks: drop the empty line and the break after it
          tr.delete(blockStart, blockEnd + after.nodeSize);
        }
        tr.delete(blockStart - before.nodeSize, blockStart);
        // cursor to the end of the text before the removed break
        const pos = Math.max(0, blockStart - before.nodeSize);
        tr.setSelection(TextSelection.near(tr.doc.resolve(pos), -1));
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
      // Delete at the very end of a line removes a page break that follows it
      Delete: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.depth !== 1 || $from.parentOffset !== $from.parent.content.size) return false;
        const after = state.doc.resolve($from.after(1)).nodeAfter;
        if (after?.type.name !== "pageBreak") return false;
        editor.view.dispatch(state.tr.delete($from.after(1), $from.after(1) + after.nodeSize));
        return true;
      },
    };
  },
});

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
    pageBreak: { insertPageBreak: () => ReturnType; insertPageAt: (pos: number) => ReturnType };
    styledBlock: { setStyledBlock: (variant: string) => ReturnType };
  }
}
