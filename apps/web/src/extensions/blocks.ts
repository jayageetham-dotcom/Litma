import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";


import { TextSelection } from "@tiptap/pm/state";

/**
 * Page break, used only by "Insert page" (the button in the gap between two pages).
 * It is invisible: no line, no label, nothing to click or select. A page made with it is removed
 * the way Google Docs does it: Backspace at the start of that page (on an empty inserted page,
 * Backspace removes the whole page). Delete at the end of the line before a break removes it too.
 */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: false,
  draggable: false,
  parseHTML: () => [{ tag: "div[data-page-break]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-page-break": "", class: "page-break", contenteditable: "false", "aria-hidden": "true" })],
  addCommands() {
    return {
      insertPageAt:
        (pos: number) =>
        ({ state, chain }) => {
          // a blank page at the boundary `pos` (the first block of the next page): …page N [break] new page [break] page N+1…
          const before = state.doc.resolve(pos).nodeBefore;
          const lead = before?.type.name === "pageBreak" ? [] : [{ type: "pageBreak" }];
          const firstPara = pos + lead.length + 1;
          return chain()
            .insertContentAt(pos, [...lead, { type: "paragraph" }, { type: "pageBreak" }])
            .setTextSelection(firstPara)
            .scrollIntoView()
            .run();
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      // Backspace at the very start of a page removes the break before it;
      // on an empty inserted page (an empty line between two breaks) it removes the whole page.
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const { $from } = selection;
        if ($from.depth !== 1 || $from.parentOffset !== 0) return false;
        const blockStart = $from.before(1);
        const before = state.doc.resolve(blockStart).nodeBefore;
        if (before?.type.name !== "pageBreak") return false;
        const blockEnd = $from.after(1);
        const after = state.doc.resolve(blockEnd).nodeAfter;
        const tr = state.tr;
        if ($from.parent.content.size === 0 && after?.type.name === "pageBreak") tr.delete(blockStart, blockEnd + after.nodeSize);
        tr.delete(blockStart - before.nodeSize, blockStart);
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
    pageBreak: { insertPageAt: (pos: number) => ReturnType };
    styledBlock: { setStyledBlock: (variant: string) => ReturnType };
  }
}

/**
 * Paragraphs whose first letter has the writer's own text colour get the class `own-first-colour`,
 * so decorative drop caps (novel/story chapters) don't paint over that colour.
 */
export const FirstLetterColour = Extension.create({
  name: "firstLetterColour",
  addProseMirrorPlugins() {
    const build = (doc: import("@tiptap/pm/model").Node) => {
      const decos: Decoration[] = [];
      doc.forEach((node, offset) => {
        if (node.type.name !== "paragraph") return;
        const first = node.firstChild;
        if (first?.isText && first.marks.some((m) => m.type.name === "textStyle" && m.attrs.color)) {
          decos.push(Decoration.node(offset, offset + node.nodeSize, { class: "own-first-colour" }));
        }
      });
      return DecorationSet.create(doc, decos);
    };
    return [
      new Plugin({
        key: new PluginKey("firstLetterColour"),
        state: {
          init: (_c, state) => build(state.doc),
          apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
