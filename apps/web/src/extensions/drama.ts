import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { moveToNextSlot } from "./blocks";

/**
 * A play's cast list (കഥാപാത്രങ്ങൾ): one entry per character, the name on the left and a
 * short description beside it.
 *
 *   റഹീം      ചായക്കടക്കാരൻ, അറുപതുകാരൻ
 *   ലീല       റഹീമിന്റെ അയൽക്കാരി
 *
 * Enter in the name moves to the description; Enter at the end of a description starts the next
 * entry; Enter on an empty entry ends the list.
 */
export const CastName = Node.create({
  name: "castName",
  content: "inline*",
  defining: true,
  parseHTML: () => [{ tag: "div.cast-name" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { class: "cast-name" }), 0],
});

export const CastRole = Node.create({
  name: "castRole",
  content: "inline*",
  defining: true,
  parseHTML: () => [{ tag: "div.cast-role" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { class: "cast-role" }), 0],
});

function entryAt(editor: Editor) {
  const { $from } = editor.state.selection;
  if ($from.depth < 2 || $from.node(1).type.name !== "castEntry") return null;
  return { node: $from.node(1), pos: $from.before(1), $from };
}

function emptyEntry(editor: Editor, name?: string, role?: string) {
  const s = editor.schema;
  return s.nodes.castEntry.create(null, [s.nodes.castName.create(null, name ? s.text(name) : undefined), s.nodes.castRole.create(null, role ? s.text(role) : undefined)]);
}

export const CastEntry = Node.create({
  name: "castEntry",
  group: "block",
  content: "castName castRole",
  defining: true,
  parseHTML: () => [{ tag: "div.cast-entry" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { class: "cast-entry" }), 0],
  addKeyboardShortcuts() {
    const toRole = (editor: Editor, atEnd: boolean) => {
      const e = entryAt(editor);
      if (!e) return false;
      const roleStart = e.pos + 1 + e.node.child(0).nodeSize + 1;
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, roleStart + (atEnd ? e.node.child(1).content.size : 0))));
      return true;
    };
    return {
      Enter: ({ editor }) => {
        const e = entryAt(editor);
        if (!e || !editor.state.selection.empty) return false;
        const part = e.$from.parent.type.name;
        const after = e.pos + e.node.nodeSize;
        if (e.node.textContent.length === 0) {
          // an empty entry ends the list: drop it and go on to the next empty line, or body text
          const tr = editor.state.tr.delete(e.pos, after);
          editor.view.dispatch(tr);
          if (moveToNextSlot(editor, e.pos)) return true;
          return editor.chain().insertContentAt(e.pos, { type: "paragraph" }).focus(e.pos + 1).run();
        }
        if (part === "castName") return toRole(editor, true);
        if (e.$from.parentOffset < e.$from.parent.content.size) return editor.commands.setHardBreak();
        const tr = editor.state.tr.insert(after, emptyEntry(editor));
        tr.setSelection(TextSelection.create(tr.doc, after + 2));
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
      Tab: ({ editor }) => {
        const e = entryAt(editor);
        if (!e) return false;
        if (e.$from.parent.type.name === "castName") return toRole(editor, false);
        return false;
      },
      Backspace: ({ editor }) => {
        const e = entryAt(editor);
        if (!e || !editor.state.selection.empty || e.$from.parentOffset !== 0) return false;
        if (e.$from.parent.type.name === "castRole") {
          const nameEnd = e.pos + 2 + e.node.child(0).content.size;
          editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, nameEnd)));
          return true;
        }
        if (e.node.textContent.length === 0) {
          const tr = editor.state.tr.delete(e.pos, e.pos + e.node.nodeSize);
          tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(0, e.pos - 1)), -1));
          editor.view.dispatch(tr);
          return true;
        }
        return false;
      },
    };
  },
});

export const DramaNodes = [CastName, CastRole, CastEntry];

/**
 * Add characters to the cast list, skipping names already there. Fills an empty entry first,
 * then adds the rest after the last entry (or after the "കഥാപാത്രങ്ങൾ" heading, or at the cursor).
 * Returns how many were added.
 */
export function fillCastList(editor: Editor, people: { name: string; role?: string }[]): number {
  const { doc } = editor.state;
  const have = new Set<string>();
  let lastEnd = -1;
  let emptyAt = -1;
  let headingEnd = -1;
  doc.forEach((n: PMNode, pos) => {
    if (n.type.name === "castEntry") {
      const name = n.child(0).textContent.trim();
      if (name) have.add(name);
      else if (!n.textContent.trim() && emptyAt < 0) emptyAt = pos;
      lastEnd = pos + n.nodeSize;
    } else if (n.type.name === "styledBlock" && n.attrs.variant === "subhead" && /കഥാപാത്ര|cast/i.test(n.textContent) && headingEnd < 0) {
      headingEnd = pos + n.nodeSize;
    }
  });
  const fresh = people.filter((p) => p.name.trim() && !have.has(p.name.trim()));
  if (!fresh.length) return 0;
  const nodes = fresh.map((p) => emptyEntry(editor, p.name.trim(), p.role?.trim() || undefined));
  let tr = editor.state.tr;
  if (emptyAt >= 0) {
    const old = doc.nodeAt(emptyAt)!;
    tr = tr.replaceWith(emptyAt, emptyAt + old.nodeSize, nodes);
  } else {
    const at = lastEnd >= 0 ? lastEnd : headingEnd >= 0 ? headingEnd : editor.state.selection.$from.after(1);
    tr = tr.insert(at, nodes);
  }
  editor.view.dispatch(tr.scrollIntoView());
  return nodes.length;
}
