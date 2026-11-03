import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Footnotes (അടിക്കുറിപ്പുകൾ) for essays and features. The note text lives on a small inline marker
 * that shows its number (CSS counter `footnote`); all notes are listed, numbered, at the end of the
 * work in the editor (a widget after the last block), the reader, the PDF and Word.
 *
 * Clicking a marker sends `litma:footnote` with its position so the editor can open the note.
 */
export const FOOTNOTE_EVENT = "litma:footnote";
export const ENDNOTES_HEADING = "കുറിപ്പുകൾ";

export interface FootnoteEventDetail {
  /** position of an existing marker, or undefined to add a new one at the cursor */
  pos?: number;
  text?: string;
}

export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-note") ?? "",
        renderHTML: (a) => ({ "data-note": a.text }),
      },
    };
  },
  parseHTML: () => [{ tag: "sup[data-note]" }],
  renderHTML: ({ HTMLAttributes, node }) => ["sup", mergeAttributes(HTMLAttributes, { class: "fn", title: node.attrs.text, contenteditable: "false" })],
  renderText: () => "",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("footnoteClick"),
        props: {
          handleClickOn(view, _pos, node, nodePos) {
            if (node.type.name !== "footnote" || !view.editable) return false;
            window.dispatchEvent(new CustomEvent<FootnoteEventDetail>(FOOTNOTE_EVENT, { detail: { pos: nodePos, text: node.attrs.text } }));
            return true;
          },
        },
      }),
    ];
  },
});

/** Every footnote's text, in order. */
export function collectFootnotes(doc: PMNode): string[] {
  const out: string[] = [];
  doc.descendants((n) => {
    if (n.type.name === "footnote") out.push(String(n.attrs.text ?? ""));
    return true;
  });
  return out;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The numbered list of notes shown at the end of a work. */
export function endnotesHtml(notes: string[]): string {
  if (!notes.length) return "";
  return `<div class="doc-endnotes"><p class="endnotes-h">${ENDNOTES_HEADING}</p><ol>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ol></div>`;
}

const endKey = new PluginKey<DecorationSet>("endnotes");

/** Shows the list of footnotes after the last block in the editor. */
export const Endnotes = Extension.create({
  name: "endnotes",
  addProseMirrorPlugins() {
    const build = (doc: PMNode) => {
      const notes = collectFootnotes(doc);
      if (!notes.length) return DecorationSet.empty;
      const key = `endnotes-${notes.join("\u0001").length}-${notes.length}-${notes.join("|").slice(0, 200)}`;
      return DecorationSet.create(doc, [
        Decoration.widget(
          doc.content.size,
          () => {
            const wrap = document.createElement("div");
            wrap.innerHTML = endnotesHtml(notes);
            const el = wrap.firstElementChild as HTMLElement;
            el.contentEditable = "false";
            return el;
          },
          { side: 1, key, ignoreSelection: true }
        ),
      ]);
    };
    return [
      new Plugin({
        key: endKey,
        state: {
          init: (_c, state) => build(state.doc),
          apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return endKey.getState(state);
          },
        },
      }),
    ];
  },
});
