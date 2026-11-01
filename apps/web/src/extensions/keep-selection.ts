import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Keeps the writer's selection when the editor loses focus, like Google Docs.
 *
 * Phones collapse the text selection when the on-screen keyboard is dismissed or a panel opens,
 * so the dictionary and the AI companion lost the word or passage they were meant to work on.
 * This plugin remembers the last real selection, puts it back into the editor state on blur and
 * draws it as a soft highlight while the page isn't focused. Tapping into the text clears it.
 */
type Range = { from: number; to: number };
type KeepState = { last: Range | null; kept: Range | null };

export const keepSelectionKey = new PluginKey<KeepState>("keepSelection");

export const KeepSelection = Extension.create({
  name: "keepSelection",

  addProseMirrorPlugins() {
    let tappedAt = 0;
    return [
      new Plugin<KeepState>({
        key: keepSelectionKey,
        state: {
          init: () => ({ last: null, kept: null }),
          apply(tr, prev) {
            const meta = tr.getMeta(keepSelectionKey) as { keep?: boolean; clear?: boolean } | undefined;
            const map = (r: Range | null) => {
              if (!r || !tr.docChanged) return r;
              const from = tr.mapping.map(r.from, 1);
              const to = tr.mapping.map(r.to, -1);
              return to > from ? { from, to } : null;
            };
            let last = map(prev.last);
            let kept = map(prev.kept);
            if (meta?.clear) kept = null;
            if (meta?.keep) kept = last;
            const sel = tr.selection;
            if (!sel.empty && sel instanceof TextSelection) last = { from: sel.from, to: sel.to };
            else if (tr.selectionSet && Date.now() - tappedAt < 600) {
              // the writer tapped/clicked somewhere else on purpose: forget the old selection
              last = null;
              kept = null;
            }
            // typing moves on from the old selection
            if (tr.docChanged && sel.empty && !meta) last = null;
            return { last, kept };
          },
        },
        props: {
          decorations(state) {
            const st = keepSelectionKey.getState(state);
            if (!st?.kept) return null;
            return DecorationSet.create(state.doc, [Decoration.inline(st.kept.from, st.kept.to, { class: "kept-selection" })]);
          },
          handleDOMEvents: {
            pointerdown(view) {
              tappedAt = Date.now();
              const st = keepSelectionKey.getState(view.state);
              if (st?.kept) view.dispatch(view.state.tr.setMeta(keepSelectionKey, { clear: true }));
              return false;
            },
            blur(view) {
              // let the platform finish collapsing the DOM selection first, then put ours back
              setTimeout(() => {
                if (view.isDestroyed || view.hasFocus()) return;
                const st = keepSelectionKey.getState(view.state);
                if (!st?.last) return;
                const { from, to } = st.last;
                const max = view.state.doc.content.size;
                if (to > max) return;
                const tr = view.state.tr.setMeta(keepSelectionKey, { keep: true }).setMeta("addToHistory", false);
                if (view.state.selection.from !== from || view.state.selection.to !== to) tr.setSelection(TextSelection.create(view.state.doc, from, to));
                view.dispatch(tr);
              }, 0);
              return false;
            },
            focus(view) {
              const st = keepSelectionKey.getState(view.state);
              if (st?.kept) setTimeout(() => !view.isDestroyed && view.dispatch(view.state.tr.setMeta(keepSelectionKey, { clear: true })), 0);
              return false;
            },
          },
        },
      }),
    ];
  },
});

/** Remember the current selection right now (call before hiding the keyboard or opening a panel). */
export function keepSelectionNow(view: { state: import("@tiptap/pm/state").EditorState; dispatch: (tr: import("@tiptap/pm/state").Transaction) => void }) {
  view.dispatch(view.state.tr.setMeta(keepSelectionKey, { keep: true }).setMeta("addToHistory", false));
}
