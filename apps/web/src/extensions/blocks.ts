import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { firstAksharaLength } from "@litma/shared/akshara";


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
  author: { label: "Author", ml: "രചന" },
  chapter: { label: "Chapter", ml: "അദ്ധ്യായം" },
  kicker: { label: "Kicker", ml: "കിക്കർ" },
  standfirst: { label: "Standfirst", ml: "ആമുഖം" },
  byline: { label: "Byline", ml: "ബൈലൈൻ" },
  subhead: { label: "Subhead", ml: "ഉപതലക്കെട്ട്" },
  pullquote: { label: "Pull quote", ml: "ഉദ്ധരണി" },
  part: { label: "Song part", ml: "ഭാഗം" },
  stage: { label: "Stage direction", ml: "രംഗനിർദ്ദേശം" },
  dateline: { label: "Date", ml: "തീയതി" },
  epigraph: { label: "Epigraph", ml: "മേൽക്കുറിപ്പ്" },
  caption: { label: "Caption", ml: "അടിക്കുറിപ്പ്" },
  stanza: { label: "Stanza", ml: "ഖണ്ഡം" },
  act: { label: "Act", ml: "അങ്കം" },
  scene: { label: "Scene", ml: "രംഗം" },
  refrain: { label: "Repeat line", ml: "ആവർത്തനം" },
  credits: { label: "Song details", ml: "ഗാനവിവരം" },
  infobox: { label: "Info box", ml: "വിവരപ്പെട്ടി" },
  references: { label: "References", ml: "അവലംബം" },
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
      // Enter at the end of a styled block moves on to the next empty line the template left
      // (title → author → chapter…); when there is none it continues with body text.
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.depth !== 1 || $from.parent.type.name !== this.name) return false;
        if ($from.parentOffset !== $from.parent.content.size) return false;
        if (moveToNextSlot(editor, $from.after(1))) return true;
        return editor.chain().insertContentAt($from.after(), { type: "paragraph" }).focus($from.after() + 1).run();
      },
    };
  },
});

/** The first empty text line inside a block (the block itself, or the first child of a dialogue/cast entry). */
function emptySlotOffset(node: import("@tiptap/pm/model").Node): number | null {
  if (node.isTextblock) return node.content.size === 0 ? 1 : null;
  if (node.type.name === "pageBreak" || node.isAtom) return null;
  if (node.textContent.length) return null;
  const first = node.firstChild;
  return first?.isTextblock ? 2 : null;
}

/**
 * Put the cursor in the block that starts at `pos` when it is an empty line waiting to be filled
 * (a template's author line, chapter heading, scene time…). Returns false when there is none.
 */
export function moveToNextSlot(editor: import("@tiptap/core").Editor, pos: number): boolean {
  const { state } = editor;
  if (pos > state.doc.content.size) return false;
  let next = state.doc.resolve(pos).nodeAfter;
  if (!next) return false;
  // a label the template filled in (പല്ലവി, കഥാപാത്രങ്ങൾ) is stepped over to the empty line under it
  if (next.type.name === "styledBlock" && ["part", "subhead"].includes(next.attrs.variant) && next.content.size > 0) {
    const after = pos + next.nodeSize;
    const under = after <= state.doc.content.size ? state.doc.resolve(after).nodeAfter : null;
    if (!under || emptySlotOffset(under) == null) return false;
    pos = after;
    next = under;
  }
  const off = emptySlotOffset(next);
  if (off == null) return false;
  editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos + off)).scrollIntoView());
  return true;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: { insertPageAt: (pos: number) => ReturnType };
    styledBlock: { setStyledBlock: (variant: string) => ReturnType };
  }
}

/**
 * Drop cap: the first akshara of the paragraph after a chapter heading is wrapped in a real
 * `<span class="drop-cap">` (styled only in novels and stories). It used to be CSS ::first-letter,
 * but Chrome then lost the cursor and the selection in that paragraph (a space typed after a
 * Manglish word landed after the first letter, selections painted only partly) and cut Malayalam
 * conjuncts apart. A whole akshara (`firstAksharaLength`) keeps the word shaped as one.
 * Paragraphs that start with the writer's own text colour also get `own-first-colour`, so the
 * accent never paints over that colour. `renderDocHtml` adds the same span for reading and print.
 */
export const FirstLetterColour = Extension.create({
  name: "firstLetterColour",
  addProseMirrorPlugins() {
    const build = (doc: import("@tiptap/pm/model").Node) => {
      const decos: Decoration[] = [];
      let prev: import("@tiptap/pm/model").Node | null = null;
      doc.forEach((node, offset) => {
        const before = prev;
        prev = node;
        if (node.type.name !== "paragraph") return;
        const first = node.firstChild;
        if (first?.isText && first.marks.some((m) => m.type.name === "textStyle" && m.attrs.color)) {
          decos.push(Decoration.node(offset, offset + node.nodeSize, { class: "own-first-colour" }));
        }
        if (before?.type.name === "styledBlock" && before.attrs.variant === "chapter" && first?.isText) {
          const len = firstAksharaLength(first.text ?? "");
          if (len) decos.push(Decoration.inline(offset + 1, offset + 1 + len, { class: "drop-cap" }));
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

/**
 * Turn the current line into a styled block when it is empty, otherwise add the block after the
 * current one (so a scene heading never swallows a line of speech). Optional starting text.
 */
export function insertStyledBlock(editor: import("@tiptap/core").Editor, variant: string, text?: string, where: "after" | "before" = "after") {
  const { state } = editor;
  const { $from } = state.selection;
  if ($from.depth < 1) return false;
  const top = $from.node(1);
  const pos = $from.before(1);
  const s = state.schema;
  const block = s.nodes.styledBlock.create({ variant }, text ? s.text(text) : undefined);
  let tr = state.tr;
  let at: number;
  if (top.isTextblock && top.content.size === 0) {
    tr = tr.replaceWith(pos, pos + top.nodeSize, block);
    at = pos;
  } else {
    at = where === "before" ? pos : pos + top.nodeSize;
    tr = tr.insert(at, block);
  }
  tr.setSelection(TextSelection.create(tr.doc, at + 1 + block.content.size));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

/** Songs: the first line of the പല്ലവി, to repeat it later ("പൂവിളി പൂവിളി…"). */
export function refrainText(doc: import("@tiptap/pm/model").Node): string {
  let afterPart = false;
  let line = "";
  doc.forEach((n) => {
    if (line) return;
    if (n.type.name === "styledBlock" && n.attrs.variant === "part") afterPart = true;
    else if (afterPart && n.type.name === "paragraph" && n.textContent.trim()) line = n.textContent.trim();
  });
  if (!line) return "";
  const words = line.split(/\s+/);
  return words.length > 4 ? `${words.slice(0, 4).join(" ")}…` : `${line}…`;
}

/**
 * Diaries: a new dated entry at the end, ready to write in. When the last entry is already today's,
 * the cursor just goes to the end.
 */
export function appendDiaryEntry(editor: import("@tiptap/core").Editor, today: string) {
  const { state } = editor;
  const s = state.schema;
  let lastDate = "";
  state.doc.forEach((n) => {
    if (n.type.name === "styledBlock" && n.attrs.variant === "dateline") lastDate = n.textContent.trim();
  });
  const end = state.doc.content.size;
  if (lastDate === today) {
    editor.chain().focus("end").scrollIntoView().run();
    return true;
  }
  const last = state.doc.lastChild;
  const lastEmpty = !!last && last.type.name === "paragraph" && last.content.size === 0;
  const nodes = [s.nodes.styledBlock.create({ variant: "dateline" }, s.text(today)), s.nodes.paragraph.create()];
  const from = lastEmpty ? end - last!.nodeSize : end;
  const tr = state.tr.replaceWith(from, end, nodes);
  tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size - 1));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}
