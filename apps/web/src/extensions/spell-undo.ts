import { Extension } from "@tiptap/core";
import { bindSpellHistory, redoAll, spellHistoryOnEdit, unbindSpellHistory, undoAll } from "@/lib/spell-history";

/**
 * Ctrl/⌘+Z and redo cover Ignore and Keep too, in the order the writer did them
 * (lib/spell-history.ts). Runs before the History extension's own keys.
 */
export const SpellUndo = Extension.create({
  name: "spellUndo",
  priority: 1000,
  onCreate() {
    bindSpellHistory(this.editor);
  },
  onDestroy() {
    unbindSpellHistory(this.editor);
  },
  onTransaction({ transaction }) {
    // an edit (not an undo or redo) ends the redo chain
    if (transaction.docChanged && !transaction.getMeta("history$")) spellHistoryOnEdit();
  },
  addKeyboardShortcuts() {
    return {
      "Mod-z": () => undoAll(this.editor),
      "Shift-Mod-z": () => redoAll(this.editor),
      "Mod-y": () => redoAll(this.editor),
    };
  },
});
