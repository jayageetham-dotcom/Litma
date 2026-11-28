"use client";
import type { Editor } from "@tiptap/react";
import { closeHistory, redoDepth, undoDepth } from "@tiptap/pm/history";

/**
 * Undo and redo for the spelling and grammar tools (owner, 26 Nov: "undo only undoes the text
 * changes, not the grammar/spelling fixes one by one").
 *
 *  - A fix (spelling card, right-click menu, Check panel, grammar cards) is its own undo step:
 *    `applyFix` closes the history group before and after it, so it never merges with typing or
 *    with the next fix.
 *  - Ignore and Keep change no text, so ProseMirror's history can't hold them. They go on a small
 *    stack of their own, each tagged with the history depth at that moment; Ctrl/⌘+Z (and the
 *    toolbar) undoes whichever came last, the edit or the Ignore/Keep, and redo replays them in order.
 */
export interface SpellAct {
  undo: () => void;
  redo: () => void;
}

let editorRef: Editor | null = null;
let past: { act: SpellAct; depth: number }[] = [];
let future: { act: SpellAct; depth: number }[] = [];

/** The open editor (or null when it closes); a new work starts with empty stacks. */
export function bindSpellHistory(editor: Editor | null) {
  editorRef = editor;
  past = [];
  future = [];
}

/** Unbind only if [editor] is still the bound one (Tiptap destroys an old editor after the new one starts). */
export function unbindSpellHistory(editor: Editor) {
  if (editorRef === editor) bindSpellHistory(null);
}

/** A new edit (not an undo or redo) ends the redo chain, as in any editor. */
export function spellHistoryOnEdit() {
  future = [];
}

/** Record an Ignore or Keep the writer just did, so Ctrl/⌘+Z can take it back. */
export function recordSpellAct(act: SpellAct) {
  const e = editorRef;
  if (!e || e.isDestroyed) return;
  // the next typing starts a new history group, so the order stays exact
  e.view.dispatch(closeHistory(e.state.tr));
  past.push({ act, depth: undoDepth(e.state) });
  if (past.length > 200) past.shift();
  future = [];
}

/** Replace a misspelt or ungrammatical stretch as one undo step of its own. */
export function applyFix(editor: Editor, from: number, to: number, text: string) {
  editor.view.dispatch(closeHistory(editor.state.tr.insertText(text, from, to)));
  editor.view.dispatch(closeHistory(editor.state.tr));
}

/** Several fixes at once (Check panel "Fix all"): one transaction, one undo step. */
export function applyFixes(editor: Editor, fixes: { from: number; to: number; text: string }[]) {
  const tr = editor.state.tr;
  [...fixes].sort((a, b) => b.from - a.from).forEach((f) => tr.insertText(f.text, f.from, f.to));
  editor.view.dispatch(closeHistory(tr));
  editor.view.dispatch(closeHistory(editor.state.tr));
}

/**
 * ProseMirror keeps 100 steps and trims older ones, so depth tags can repeat after very long
 * sessions; acts tagged deeper than the history now reaches are stale and dropped (verifier, 28 Nov).
 */
function dropStale(editor: Editor) {
  const d = undoDepth(editor.state);
  while (past.length > 1 && past[past.length - 2].depth > d) past.splice(past.length - 2, 1);
}

export function canUndoAll(editor: Editor): boolean {
  const top = past[past.length - 1];
  return (!!top && top.depth === undoDepth(editor.state)) || editor.can().undo();
}

export function canRedoAll(editor: Editor): boolean {
  const top = future[future.length - 1];
  return (!!top && top.depth === undoDepth(editor.state)) || editor.can().redo();
}

/** Ctrl/⌘+Z and the toolbar's Undo: the last Ignore/Keep if it came after the last edit, else the edit. */
export function undoAll(editor: Editor): boolean {
  dropStale(editor);
  const top = past[past.length - 1];
  if (top && top.depth === undoDepth(editor.state)) {
    past.pop();
    top.act.undo();
    future.push(top);
    return true;
  }
  return editor.chain().focus().undo().run();
}

/** Ctrl/⌘+Shift+Z, Ctrl+Y and the toolbar's Redo, in the same order. */
export function redoAll(editor: Editor): boolean {
  const top = future[future.length - 1];
  if (top && top.depth === undoDepth(editor.state)) {
    future.pop();
    top.act.redo();
    past.push(top);
    return true;
  }
  if (!redoDepth(editor.state)) return false;
  return editor.chain().focus().redo().run();
}
