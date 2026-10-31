import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";
import { manglish, manglishWord, MANGLISH_WORD_RE } from "@/shared/manglish";

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
}

export interface CommitInfo {
  from: number;
  text: string;
  word: string;
  fetched: boolean;
}

export const manglishKey = new PluginKey<ComposeState>("manglish");

const EMPTY: ComposeState = { active: false, dismissed: false, from: 0, to: 0, word: "", candidates: [], index: 0, fetched: false };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    manglish: {
      setInputMode: (mode: InputMode) => ReturnType;
      commitManglish: (index?: number) => ReturnType;
      convertSelectionToMalayalam: () => ReturnType;
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

export const Manglish = Extension.create<{ defaultMode: InputMode }, { mode: InputMode }>({
  name: "manglish",
  priority: 1000,

  addOptions() {
    return { defaultMode: "manglish" };
  },

  addStorage() {
    return { mode: this.options.defaultMode };
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
      new Plugin<ComposeState>({
        key: manglishKey,
        state: {
          init: () => EMPTY,
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(manglishKey);
            if (meta?.reset) return computeCompose(newState, EMPTY, ext.storage.mode);
            if (meta?.candidates && prev.active && meta.word === prev.word) {
              return { ...prev, candidates: meta.candidates, index: 0, fetched: true };
            }
            if (typeof meta?.index === "number") return { ...prev, index: meta.index };
            if (meta?.dismiss) return { ...prev, dismissed: true };
            if (!tr.docChanged && !tr.selectionSet) return prev;
            return computeCompose(newState, prev, ext.storage.mode);
          },
        },
        props: {
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
            if (/^[1-9]$/.test(event.key)) {
              const n = Number(event.key) - 1;
              if (n < list.length) {
                commit(view, n);
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
