import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";
import { manglish, manglishWord, MANGLISH_WORD_RE } from "@litma/shared/manglish";
import { LAYOUTS, keyToText, readLayout, storeLayout, type MalayalamLayout } from "@litma/keyboards";

export type InputMode = "manglish" | "malayalam" | "english";

export interface ComposeState {
  active: boolean;
  dismissed: boolean;
  from: number;
  to: number;
  word: string;
  candidates: string[];
  index: number;
  /** true once smarter (Google) candidates have arrived for this word */
  fetched: boolean;
  /** the word was typed just now (not old text the cursor happens to sit after) */
  typed?: boolean;
}

export interface CommitInfo {
  from: number;
  text: string;
  word: string;
  fetched: boolean;
}

export const manglishKey = new PluginKey<ComposeState>("manglish");

/**
 * Spellings offered for a Manglish word. Desktop and Electron show them a page at a time
 * (PAGE_SIZE rows, ↑↓ and Page Up/Down or the pager to see more, like Google Input Tools);
 * phones show all of them in a strip on top of the keyboard that scrolls sideways.
 */
export const PAGE_SIZE = 6;
/** How many spellings are fetched: three pages. */
export const MAX_CANDIDATES = 18;

/** Best first, no repeats, at most `max`. */
export function topCandidates(list: string[], max = MAX_CANDIDATES): string[] {
  const out: string[] = [];
  for (const c of list) {
    const w = c?.trim();
    if (w && !out.includes(w)) out.push(w);
    if (out.length === max) break;
  }
  return out;
}

/** The page (0-based) that shows candidate `index`, for a page of `size`. */
export const pageOf = (index: number, size = PAGE_SIZE) => Math.floor(index / size);

const EMPTY: ComposeState = { active: false, dismissed: false, from: 0, to: 0, word: "", candidates: [], index: 0, fetched: false };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    manglish: {
      setInputMode: (mode: InputMode) => ReturnType;
      commitManglish: (index?: number) => ReturnType;
      convertSelectionToMalayalam: () => ReturnType;
      setMalayalamLayout: (layout: MalayalamLayout) => ReturnType;
      typeMalayalamKey: (text: string) => ReturnType;
    };
  }
}

const COMMIT_KEYS = new Set([" ", "Enter", "Tab", ".", ",", "!", "?", ";", ":", "'", '"', ")", "(", "-", "/"]);

function computeCompose(state: EditorState, prev: ComposeState, mode: InputMode): ComposeState {
  if (mode !== "manglish") return EMPTY;
  const { selection } = state;
  if (!selection.empty) return EMPTY;
  const $from = selection.$from;
  if (!$from.parent.isTextblock) return EMPTY;
  const start = Math.max(0, $from.parentOffset - 64);
  const before = $from.parent.textBetween(start, $from.parentOffset, undefined, "￼");
  const after = $from.parent.textBetween($from.parentOffset, Math.min($from.parent.content.size, $from.parentOffset + 1), undefined, "￼");
  const m = before.match(MANGLISH_WORD_RE);
  if (!m || /[A-Za-z]/.test(after)) return EMPTY;
  // Don't treat code/links-like tokens (preceded by digit or @) as Manglish
  const word = m[0];
  const from = $from.pos - word.length;
  const sameWord = prev.active && prev.from === from;
  const continuing = sameWord && word.startsWith(prev.word);
  return {
    active: true,
    dismissed: continuing ? prev.dismissed : false,
    from,
    to: $from.pos,
    word,
    candidates: sameWord && prev.word === word ? prev.candidates : [manglishWord(word)],
    index: sameWord && prev.word === word ? prev.index : 0,
    fetched: sameWord && prev.word === word ? prev.fetched : false,
  };
}

function commit(view: EditorView, index?: number): boolean {
  const st = manglishKey.getState(view.state);
  if (!st || !st.active) return false;
  const list = st.candidates.length ? st.candidates : [manglishWord(st.word)];
  const choice = list[Math.min(index ?? st.index, list.length - 1)] ?? manglishWord(st.word);
  const tr = view.state.tr.insertText(choice, st.from, st.to);
  const committed: CommitInfo = { from: st.from, text: choice, word: st.word, fetched: st.fetched || index !== undefined || st.index > 0 };
  tr.setMeta(manglishKey, { reset: true, committed });
  view.dispatch(tr);
  return true;
}

/** Insert text from a Malayalam layout; "]" (ZWJ) after consonant + ് becomes the atomic chillu. */
function typeLayoutText(view: EditorView, text: string): boolean {
  const { state } = view;
  const { from, to, empty } = state.selection;
  if (text === "\u200d" && empty && from >= 2) {
    const before = state.doc.textBetween(from - 2, from, undefined, "￼");
    const chillu = LAYOUTS.inscript.chillu[before];
    if (chillu) {
      view.dispatch(state.tr.insertText(chillu, from - 2, from).scrollIntoView());
      return true;
    }
  }
  view.dispatch(state.tr.insertText(text, from, to).scrollIntoView());
  return true;
}

export const Manglish = Extension.create<{ defaultMode: InputMode }, { mode: InputMode; layout: MalayalamLayout }>({
  name: "manglish",
  priority: 1000,

  addOptions() {
    return { defaultMode: "manglish" };
  },

  addStorage() {
    return { mode: this.options.defaultMode, layout: typeof window === "undefined" ? "inscript" : readLayout() };
  },

  addCommands() {
    return {
      setInputMode:
        (mode) =>
        ({ tr, dispatch }) => {
          this.storage.mode = mode;
          if (dispatch) tr.setMeta(manglishKey, { reset: true });
          return true;
        },
      setMalayalamLayout:
        (layout) =>
        () => {
          this.storage.layout = layout;
          storeLayout(layout);
          return true;
        },
      typeMalayalamKey:
        (text) =>
        ({ view }) =>
          typeLayoutText(view, text),
      commitManglish:
        (index) =>
        ({ view }) =>
          commit(view, index),
      convertSelectionToMalayalam:
        () =>
        ({ state, tr, dispatch }) => {
          const { from, to, empty } = state.selection;
          if (empty) return false;
          if (dispatch) {
            // convert each text node separately so marks survive
            const edits: { from: number; to: number; text: string }[] = [];
            state.doc.nodesBetween(from, to, (node, pos) => {
              if (!node.isText || !node.text) return;
              const s = Math.max(from, pos);
              const e = Math.min(to, pos + node.text.length);
              const slice = node.text.slice(s - pos, e - pos);
              const conv = manglish(slice);
              if (conv !== slice) edits.push({ from: s, to: e, text: conv });
            });
            for (const ed of edits.reverse()) tr.insertText(ed.text, ed.from, ed.to);
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    const cycle = () => {
      const order: InputMode[] = ["manglish", "malayalam", "english"];
      const next = order[(order.indexOf(this.storage.mode) + 1) % order.length];
      return this.editor.commands.setInputMode(next);
    };
    return {
      "Mod-m": cycle,
      "Ctrl-Space": cycle,
      "Mod-Shift-m": () => this.editor.commands.convertSelectionToMalayalam(),
    };
  },

  addProseMirrorPlugins() {
    const ext = this;
    return [
      // Built-in Malayalam keyboard (InScript): maps physical keys when the system layout types English
      new Plugin({
        key: new PluginKey("malayalamKeyboard"),
        props: {
          handleKeyDown(view, event) {
            if (ext.storage.mode !== "malayalam" || ext.storage.layout === "system" || event.isComposing) return false;
            const layout = LAYOUTS[ext.storage.layout];
            const text = layout && keyToText(layout, event);
            if (text == null) return false;
            event.preventDefault();
            return typeLayoutText(view, text);
          },
        },
      }),
      new Plugin<ComposeState>({
        key: manglishKey,
        state: {
          init: () => EMPTY,
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(manglishKey);
            if (meta?.reset) return computeCompose(newState, EMPTY, ext.storage.mode);
            if (meta?.candidates && prev.active && meta.word === prev.word) {
              return { ...prev, candidates: topCandidates(meta.candidates), index: 0, fetched: true };
            }
            if (typeof meta?.index === "number") return { ...prev, index: meta.index };
            if (meta?.dismiss) return { ...prev, dismissed: true };
            if (!tr.docChanged && !tr.selectionSet) return prev;
            const next = computeCompose(newState, prev, ext.storage.mode);
            next.typed = next.active && (tr.docChanged || (prev.active && prev.from === next.from && !!prev.typed));
            return next;
          },
        },
        // The cursor left a Manglish word that was just typed (a tap elsewhere, arrow keys): finish
        // it as a space would. In the middle of a line the space after the word is already there,
        // so without this the word stayed in English letters.
        appendTransaction(trs, oldState, newState) {
          if (trs.some((t) => t.docChanged || t.getMeta(manglishKey)) || !trs.some((t) => t.selectionSet)) return null;
          const was = manglishKey.getState(oldState);
          if (!was?.active || !was.typed || was.dismissed) return null;
          const now = manglishKey.getState(newState);
          if (now?.active && now.from === was.from) return null;
          if (newState.doc.textBetween(was.from, was.to, undefined, "￼") !== was.word) return null;
          const list = was.candidates.length ? was.candidates : [manglishWord(was.word)];
          const choice = list[Math.min(was.index, list.length - 1)] ?? manglishWord(was.word);
          const committed: CommitInfo = { from: was.from, text: choice, word: was.word, fetched: was.fetched || was.index > 0 };
          return newState.tr.insertText(choice, was.from, was.to).setMeta(manglishKey, { reset: true, committed });
        },
        props: {
          handleDOMEvents: {
            // leaving the editor (keyboard hidden, another field) finishes the word too
            blur(view) {
              const st = manglishKey.getState(view.state);
              if (st?.active && st.typed && !st.dismissed) commit(view);
              return false;
            },
          },
          decorations(state) {
            const st = manglishKey.getState(state);
            if (!st?.active || st.dismissed) return null;
            return DecorationSet.create(state.doc, [Decoration.inline(st.from, st.to, { class: "manglish-composing" })]);
          },
          handleKeyDown(view, event) {
            const st = manglishKey.getState(view.state);
            if (!st || !st.active || st.dismissed || event.isComposing) return false;
            if (event.metaKey || event.ctrlKey || event.altKey) return false;
            const list = st.candidates.length ? st.candidates : [manglishWord(st.word)];
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              if (list.length < 2) return false;
              const d = event.key === "ArrowDown" ? 1 : -1;
              view.dispatch(view.state.tr.setMeta(manglishKey, { index: (st.index + d + list.length) % list.length }));
              return true;
            }
            if ((event.key === "PageDown" || event.key === "PageUp") && list.length > PAGE_SIZE) {
              // whole pages, like Google Input Tools: the first spelling of the next/previous page
              const pages = Math.ceil(list.length / PAGE_SIZE);
              const page = (pageOf(st.index) + (event.key === "PageDown" ? 1 : -1) + pages) % pages;
              view.dispatch(view.state.tr.setMeta(manglishKey, { index: page * PAGE_SIZE }));
              return true;
            }
            if (/^[1-9]$/.test(event.key)) {
              // numbers pick on the page that is showing
              const n = Number(event.key) - 1;
              const i = pageOf(st.index) * PAGE_SIZE + n;
              if (n < PAGE_SIZE && i < list.length) {
                commit(view, i);
                return true;
              }
              return false;
            }
            if (event.key === "Escape") {
              view.dispatch(view.state.tr.setMeta(manglishKey, { dismiss: true }));
              return true;
            }
            if (COMMIT_KEYS.has(event.key)) {
              commit(view);
              return false; // let the key do its normal job after committing
            }
            return false;
          },
        },
      }),
    ];
  },
});
