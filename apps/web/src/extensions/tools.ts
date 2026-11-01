import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as PMNode } from "@tiptap/pm/model";
import { aksharas } from "@litma/shared/manglish";

// ─── Metre (വൃത്തം) helper ────────────────────────────────────────────────
// Shows akshara count and the laghu/guru pattern beside every line of verse.

export const metreKey = new PluginKey<DecorationSet>("metre");

function metreDecos(doc: PMNode) {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph" || node.type.name === "styledBlock") {
      if (node.type.name === "styledBlock" && node.attrs.variant !== "part") {
        // titles etc. don't need a metre count
      } else if (node.textContent.trim()) {
        const a = aksharas(node.textContent);
        if (a.length) {
          decos.push(
            Decoration.node(pos, pos + node.nodeSize, {
              "data-aksharas": String(a.length),
              "data-metre": a.map((x) => (x.long ? "–" : "∪")).join(""),
            })
          );
        }
      }
      return false;
    }
    return true;
  });
  return DecorationSet.create(doc, decos);
}

export const Metre = Extension.create<object, { enabled: boolean }>({
  name: "metre",
  addStorage() {
    return { enabled: false };
  },
  addProseMirrorPlugins() {
    const ext = this;
    return [
      new Plugin<DecorationSet>({
        key: metreKey,
        state: {
          init: (_c, state) => (ext.storage.enabled ? metreDecos(state.doc) : DecorationSet.empty),
          apply(tr, prev, _o, state) {
            if (tr.getMeta(metreKey) !== undefined || tr.docChanged) {
              return ext.storage.enabled ? metreDecos(state.doc) : DecorationSet.empty;
            }
            return prev;
          },
        },
        props: { decorations: (state) => metreKey.getState(state) },
      }),
    ];
  },
});

// ─── Find & replace ──────────────────────────────────────────────────────

export interface SearchState {
  term: string;
  caseSensitive: boolean;
  results: { from: number; to: number }[];
  current: number;
  deco: DecorationSet;
}

export const searchKey = new PluginKey<SearchState>("search");

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findAll(doc: PMNode, term: string, cs: boolean) {
  const results: { from: number; to: number }[] = [];
  if (!term) return results;
  const re = new RegExp(escapeRe(term), cs ? "g" : "gi");
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text))) {
      results.push({ from: pos + m.index, to: pos + m.index + m[0].length });
      if (m[0].length === 0) re.lastIndex++;
    }
  });
  return results;
}

function build(doc: PMNode, term: string, cs: boolean, current: number): SearchState {
  const results = findAll(doc, term, cs);
  const cur = results.length ? Math.min(current, results.length - 1) : 0;
  const deco = DecorationSet.create(
    doc,
    results.map((r, i) => Decoration.inline(r.from, r.to, { class: i === cur ? "search-hit current" : "search-hit" }))
  );
  return { term, caseSensitive: cs, results, current: cur, deco };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    search: {
      setSearch: (term: string, caseSensitive?: boolean) => ReturnType;
      searchStep: (dir: 1 | -1) => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
    };
  }
}

export const Search = Extension.create({
  name: "search",
  addCommands() {
    return {
      setSearch:
        (term, caseSensitive = false) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(searchKey, { term, caseSensitive, current: 0 });
          return true;
        },
      searchStep:
        (dir) =>
        ({ state, tr, dispatch }) => {
          const st = searchKey.getState(state);
          if (!st || !st.results.length) return false;
          const current = (st.current + dir + st.results.length) % st.results.length;
          if (dispatch) {
            const r = st.results[current];
            tr.setMeta(searchKey, { term: st.term, caseSensitive: st.caseSensitive, current });
            tr.setSelection(TextSelection.create(tr.doc, r.from, r.to)).scrollIntoView();
          }
          return true;
        },
      replaceCurrent:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const st = searchKey.getState(state);
          if (!st || !st.results.length) return false;
          const r = st.results[st.current];
          if (dispatch) tr.insertText(replacement, r.from, r.to);
          return true;
        },
      replaceAll:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const st = searchKey.getState(state);
          if (!st || !st.results.length) return false;
          if (dispatch) [...st.results].reverse().forEach((r) => tr.insertText(replacement, r.from, r.to));
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ term: "", caseSensitive: false, results: [], current: 0, deco: DecorationSet.empty }),
          apply(tr, prev, _o, state) {
            const meta = tr.getMeta(searchKey);
            if (meta) return build(state.doc, meta.term, meta.caseSensitive, meta.current ?? 0);
            if (tr.docChanged && prev.term) return build(state.doc, prev.term, prev.caseSensitive, prev.current);
            return prev;
          },
        },
        props: { decorations: (state) => searchKey.getState(state)?.deco },
      }),
    ];
  },
});

// ─── Typewriter scrolling ────────────────────────────────────────────────
// Keeps the line being written at the vertical centre of the screen, but only while typing:
// clicking into the text, selecting words or moving with the mouse never scrolls the page.

export const Typewriter = Extension.create<object, { enabled: boolean; lastKey: number }>({
  name: "typewriter",
  addStorage() {
    return { enabled: false, lastKey: 0 };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: new PluginKey("typewriterKeys"),
        props: {
          handleKeyDown: (_view, e) => {
            // keys that write or move the line being written (not shortcuts like Ctrl+S)
            if (!e.metaKey && !e.ctrlKey && (e.key.length === 1 || ["Enter", "Backspace", "Delete", "ArrowUp", "ArrowDown"].includes(e.key))) storage.lastKey = Date.now();
            return false;
          },
          handleTextInput: () => {
            storage.lastKey = Date.now(); // IME / on-screen keyboards
            return false;
          },
        },
      }),
    ];
  },
  onTransaction({ transaction }) {
    if (!this.storage.enabled || Date.now() - this.storage.lastKey > 700) return;
    if (!transaction.docChanged && !transaction.selectionSet) return;
    const view = this.editor.view;
    requestAnimationFrame(() => {
      try {
        const coords = view.coordsAtPos(view.state.selection.head);
        const scroller = view.dom.closest(".desk-scroll") as HTMLElement | null;
        if (!scroller) return;
        const rect = scroller.getBoundingClientRect();
        const delta = coords.top - (rect.top + rect.height * 0.45);
        if (Math.abs(delta) > 24) scroller.scrollBy({ top: delta, behavior: "smooth" });
      } catch {
        /* ignore */
      }
    });
  },
});
