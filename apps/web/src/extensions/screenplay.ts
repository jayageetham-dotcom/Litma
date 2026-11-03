import { Node, Extension, mergeAttributes, Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Node as PMNode, Fragment } from "@tiptap/pm/model";
import { moveToNextSlot } from "./blocks";

/**
 * Malayalam screenplay format (തിരക്കഥ), modelled on the common Kerala layout:
 *
 *   Scene: 1                                  ← auto-numbered heading
 *   Int./Resort                               ← sceneHeading (location)
 *   പകൽ                                       ← sceneTime
 *                                  പ്രിയലാൽ   ← sceneCast (right aligned)
 *                                  ഡെന്നി
 *   Action text in the left half             ← action
 *   of the page…
 *          (കടലിലേക്ക് നോക്കി) പ്രിയലാൽ:  │ dialogue text in the     ← dialogue
 *                                         │ right column…
 *                                     കട്ട് ← transition
 */

const block = (name: string, tag: string, cls: string) =>
  Node.create({
    name,
    group: "block",
    content: "inline*",
    defining: true,
    parseHTML: () => [{ tag: `${tag}.${cls}` }],
    renderHTML: ({ HTMLAttributes }) => [tag, mergeAttributes(HTMLAttributes, { class: cls }), 0],
  });

export const SceneHeading = block("sceneHeading", "h3", "sp-scene");
export const SceneTime = block("sceneTime", "p", "sp-time");
export const SceneCast = Node.create({
  name: "sceneCast",
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML: () => [{ tag: "p.sp-cast" }],
  renderHTML: ({ HTMLAttributes }) => ["p", mergeAttributes(HTMLAttributes, { class: "sp-cast" }), 0],
});
export const Action = block("action", "p", "sp-action");
export const Transition = block("transition", "p", "sp-transition");

export const DialogueCue = Node.create({
  name: "dialogueCue",
  content: "inline*",
  defining: true,
  parseHTML: () => [{ tag: "div.sp-cue" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { class: "sp-cue" }), 0],
});
export const DialogueSpeech = Node.create({
  name: "dialogueSpeech",
  content: "inline*",
  defining: true,
  parseHTML: () => [{ tag: "div.sp-speech" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { class: "sp-speech" }), 0],
});
export const Dialogue = Node.create({
  name: "dialogue",
  group: "block",
  content: "dialogueCue dialogueSpeech",
  defining: true,
  isolating: false,
  parseHTML: () => [{ tag: "div.sp-dialogue" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { class: "sp-dialogue" }), 0],
});

export type ScreenplayElement = "sceneHeading" | "sceneTime" | "sceneCast" | "action" | "dialogue" | "transition";

export const SCREENPLAY_ELEMENTS: { type: ScreenplayElement; label: string; ml: string; key: string }[] = [
  { type: "sceneHeading", label: "Scene", ml: "രംഗം", key: "1" },
  { type: "sceneTime", label: "Time", ml: "സമയം", key: "2" },
  { type: "sceneCast", label: "Cast", ml: "കഥാപാത്രങ്ങൾ", key: "3" },
  { type: "action", label: "Action", ml: "വിവരണം", key: "4" },
  { type: "dialogue", label: "Dialogue", ml: "സംഭാഷണം", key: "5" },
  { type: "transition", label: "Transition", ml: "ട്രാൻസിഷൻ", key: "6" },
];

/** Find the top-level block containing the cursor. */
function topBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  if ($from.depth < 1) return null;
  const node = $from.node(1);
  const pos = $from.before(1);
  return { node, pos, $from };
}

function emptyDialogue(editor: Editor, cueText?: PMNode["content"]) {
  const s = editor.schema;
  return s.nodes.dialogue.create(null, [s.nodes.dialogueCue.create(null, cueText), s.nodes.dialogueSpeech.create()]);
}

/** Convert the current top-level block into the given screenplay element. */
export function setScreenplayElement(editor: Editor, type: ScreenplayElement) {
  const tb = topBlock(editor);
  if (!tb) return false;
  const { node, pos } = tb;
  const s = editor.schema;
  let inline: PMNode["content"];
  if (node.type.name === "dialogue") {
    // merge cue + speech text when leaving dialogue
    const cue = node.child(0).content;
    const speech = node.child(1).content;
    inline = cue.size && speech.size ? cue.addToEnd(s.text(" ")).append(speech) : cue.size ? cue : speech;
  } else {
    inline = node.content;
  }
  const replacement =
    type === "dialogue" ? emptyDialogue(editor, inline) : s.nodes[type].create(null, node.isTextblock || node.type.name === "dialogue" ? inline : undefined);
  const tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, replacement);
  const inner = type === "dialogue" ? pos + 2 + replacement.child(0).content.size : pos + 1 + replacement.content.size;
  tr.setSelection(TextSelection.create(tr.doc, inner));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

function insertAfter(editor: Editor, afterPos: number, node: PMNode, cursorOffset: number) {
  const tr = editor.state.tr.insert(afterPos, node);
  tr.setSelection(TextSelection.create(tr.doc, afterPos + cursorOffset));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Move from the cue into the speech column, trimming stray spaces after the name. */
function jumpToSpeech(editor: Editor, pos: number, node: PMNode, toEnd: boolean) {
  const tr = editor.state.tr;
  const cue = node.child(0);
  const trailing = cue.textContent.match(/\s+$/)?.[0].length ?? 0;
  const cueEnd = pos + 2 + cue.content.size;
  if (trailing) tr.delete(cueEnd - trailing, cueEnd);
  const speechStart = pos + 1 + (cue.nodeSize - trailing) + 1;
  tr.setSelection(TextSelection.create(tr.doc, speechStart + (toEnd ? node.child(1).content.size : 0)));
  editor.view.dispatch(tr);
  return true;
}

/** Plays: turn the current block into a stage direction (രംഗനിർദ്ദേശം), keeping its text. */
export function setStageDirection(editor: Editor) {
  const tb = topBlock(editor);
  if (!tb) return false;
  const { node, pos } = tb;
  const s = editor.schema;
  let inline: PMNode["content"];
  if (node.type.name === "dialogue") {
    const cue = node.child(0).content;
    const speech = node.child(1).content;
    inline = cue.size && speech.size ? cue.addToEnd(s.text(" ")).append(speech) : cue.size ? cue : speech;
  } else inline = node.isTextblock ? node.content : Fragment.empty;
  const repl = s.nodes.styledBlock.create({ variant: "stage" }, inline);
  const tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, repl);
  tr.setSelection(TextSelection.create(tr.doc, pos + 1 + repl.content.size));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

/** Keyboard flow modelled on pro screenplay tools: Enter/Tab move between elements. */
export const ScreenplayKeys = Extension.create<{ enabled: () => boolean; drama: () => boolean }>({
  name: "screenplayKeys",
  priority: 200,
  addOptions() {
    return { enabled: () => true, drama: () => false };
  },
  addKeyboardShortcuts() {
    const s = () => this.editor.schema;
    const drama = () => this.options.drama();
    /** Go to the next empty line the template left, or add `make()` after the current block. */
    const nextOr = (after: number, make: () => PMNode, offset: number) => moveToNextSlot(this.editor, after) || insertAfter(this.editor, after, make(), offset);
    const enter = () => {
      const editor = this.editor;
      const { $from, empty } = editor.state.selection;
      if (!empty) return false;
      const parent = $from.parent.type.name;
      const tb = topBlock(editor);
      if (!tb) return false;
      const after = tb.pos + tb.node.nodeSize;
      const atEnd = $from.parentOffset === $from.parent.content.size;
      switch (parent) {
        case "sceneHeading":
          return nextOr(after, () => s().nodes.sceneTime.create(), 1);
        case "sceneTime":
          return nextOr(after, () => s().nodes.sceneCast.create(), 1);
        case "sceneCast": {
          if ($from.parent.content.size === 0) {
            return moveToNextSlot(editor, after) || setScreenplayElement(editor, "action");
          }
          // Enter on the empty line after the last name ends the cast list
          const last = $from.parent.lastChild;
          if (atEnd && last?.type.name === "hardBreak") {
            const tr = editor.state.tr.delete($from.pos - last.nodeSize, $from.pos);
            editor.view.dispatch(tr);
            const newAfter = tb.pos + editor.state.doc.nodeAt(tb.pos)!.nodeSize;
            return nextOr(newAfter, () => s().nodes.action.create(), 1);
          }
          // another cast name on its own line
          return editor.commands.setHardBreak();
        }
        case "action":
          if ($from.parent.content.size === 0) return setScreenplayElement(editor, "dialogue");
          if (!atEnd) return false;
          return insertAfter(editor, after, s().nodes.action.create(), 1);
        case "transition":
          return insertAfter(editor, after, s().nodes.sceneHeading.create(), 1);
        case "dialogueCue": {
          if ($from.parent.content.size === 0 && tb.node.child(1).content.size === 0) return drama() ? setStageDirection(editor) : setScreenplayElement(editor, "action");
          return jumpToSpeech(editor, tb.pos, tb.node, true);
        }
        case "dialogueSpeech":
          if (!atEnd) return editor.commands.setHardBreak();
          return insertAfter(editor, after, emptyDialogue(editor), 2);
        case "styledBlock": {
          if (!drama() || !atEnd) return false;
          const v = $from.parent.attrs.variant;
          // a play: a stage direction is followed by speech, a scene or act heading by a stage direction
          if (v === "stage" && $from.parent.content.size > 0) return nextOr(after, () => emptyDialogue(editor), 2);
          if (v === "scene" || v === "act") return nextOr(after, () => s().nodes.styledBlock.create({ variant: "stage" }), 1);
          return false;
        }
        default:
          return false;
      }
    };
    const tab = () => {
      const editor = this.editor;
      const parent = editor.state.selection.$from.parent.type.name;
      const tb = topBlock(editor);
      if (!tb) return false;
      if (parent === "dialogueCue") return jumpToSpeech(editor, tb.pos, tb.node, false);
      if (drama()) {
        if (parent === "dialogueSpeech") return insertAfter(editor, tb.pos + tb.node.nodeSize, s().nodes.styledBlock.create({ variant: "stage" }), 1);
        return false;
      }
      if (parent === "action") return setScreenplayElement(editor, "dialogue");
      if (parent === "dialogueSpeech") return setScreenplayElement(editor, "transition");
      if (parent === "transition") return setScreenplayElement(editor, "action");
      return false;
    };
    const backspace = () => {
      const editor = this.editor;
      const { $from, empty } = editor.state.selection;
      if (!empty || $from.parentOffset !== 0) return false;
      const parent = $from.parent.type.name;
      const tb = topBlock(editor);
      if (!tb) return false;
      if (parent === "dialogueSpeech") {
        const cueEnd = tb.pos + 1 + 1 + tb.node.child(0).content.size;
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, cueEnd)));
        return true;
      }
      if (parent === "dialogueCue" && tb.node.textContent.length === 0) return drama() ? setStageDirection(editor) : setScreenplayElement(editor, "action");
      return false;
    };
    const guard = (fn: () => boolean) => () => (this.options.enabled() ? fn() : false);
    const shortcuts: Record<string, () => boolean> = {
      Enter: guard(enter),
      Tab: guard(tab),
      Backspace: guard(backspace),
    };
    SCREENPLAY_ELEMENTS.forEach((el) => {
      shortcuts[`Mod-Alt-${el.key}`] = guard(() => (drama() && el.type !== "dialogue" ? false : setScreenplayElement(this.editor, el.type)));
    });
    return shortcuts;
  },
});

// ── Scene tools (screenplay toolbar) ──

/** The scene the cursor is in: its heading, and where the scene ends. */
function currentScene(editor: Editor) {
  const { doc, selection } = editor.state;
  const cursor = selection.$from.depth >= 1 ? selection.$from.before(1) : 0;
  const headings: number[] = [];
  doc.forEach((n, pos) => {
    if (n.type.name === "sceneHeading") headings.push(pos);
  });
  if (!headings.length) return null;
  // the last heading at or before the cursor (or the first one, when the cursor is above every scene)
  const i = Math.max(0, headings.filter((h) => h <= cursor).length - 1);
  return { heading: headings[i], end: headings[i + 1] ?? doc.content.size };
}

export const SCENE_PLACES = ["Int./", "Ext./", "Int./Ext./"] as const;
export const SCENE_TIMES = ["പകൽ", "രാത്രി", "രാവിലെ", "ഉച്ച", "വൈകുന്നേരം", "സന്ധ്യ", "പുലർച്ചെ"] as const;

/** Set Int./Ext. at the start of the current scene heading, keeping the place name. */
export function setScenePlace(editor: Editor, prefix: string) {
  const sc = currentScene(editor);
  if (!sc) return false;
  const node = editor.state.doc.nodeAt(sc.heading)!;
  const text = node.textContent;
  const rest = text.replace(/^\s*(int\.?\s*\/\s*ext\.?|int\.?|ext\.?)\s*\/?\s*/i, "");
  const next = `${prefix}${rest}`;
  const s = editor.schema;
  const tr = editor.state.tr.replaceWith(sc.heading + 1, sc.heading + 1 + node.content.size, next ? s.text(next) : Fragment.empty);
  tr.setSelection(TextSelection.create(tr.doc, sc.heading + 1 + next.length));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

/** Set the time (പകൽ, രാത്രി…) of the current scene, adding the line if it is missing. */
export function setSceneTime(editor: Editor, time: string) {
  const sc = currentScene(editor);
  if (!sc) return false;
  const { doc } = editor.state;
  const s = editor.schema;
  let timeAt = -1;
  doc.forEach((n, pos) => {
    if (timeAt < 0 && pos > sc.heading && pos < sc.end && n.type.name === "sceneTime") timeAt = pos;
  });
  let tr = editor.state.tr;
  if (timeAt >= 0) {
    const n = doc.nodeAt(timeAt)!;
    tr = tr.replaceWith(timeAt + 1, timeAt + 1 + n.content.size, s.text(time));
  } else {
    timeAt = sc.heading + doc.nodeAt(sc.heading)!.nodeSize;
    tr = tr.insert(timeAt, s.nodes.sceneTime.create(null, s.text(time)));
  }
  tr.setSelection(TextSelection.create(tr.doc, timeAt + 1 + time.length));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

/** Fill the current scene's cast list with everyone who speaks in it (keeps names already there). */
export function fillSceneCast(editor: Editor) {
  const sc = currentScene(editor);
  if (!sc) return 0;
  const { doc } = editor.state;
  const s = editor.schema;
  const speakers: string[] = [];
  let castAt = -1;
  let timeAt = -1;
  doc.forEach((n, pos) => {
    if (pos < sc.heading || pos >= sc.end) return;
    if (n.type.name === "sceneCast" && castAt < 0) castAt = pos;
    if (n.type.name === "sceneTime" && timeAt < 0) timeAt = pos;
    if (n.type.name === "dialogue") {
      const name = n.child(0).textContent.replace(/\(.*?\)/g, "").replace(/[:：]\s*$/, "").trim();
      if (name && !speakers.includes(name)) speakers.push(name);
    }
  });
  const existing = castAt >= 0 ? doc.nodeAt(castAt)!.textBetween(0, doc.nodeAt(castAt)!.content.size, "\n", "\n").split(/[,\n]/).map((x) => x.trim()).filter(Boolean) : [];
  const fresh = speakers.filter((x) => !existing.includes(x));
  if (!fresh.length) return 0;
  const names = [...existing, ...fresh];
  const inline: PMNode[] = [];
  names.forEach((nm, i) => {
    if (i) inline.push(s.nodes.hardBreak.create());
    inline.push(s.text(nm));
  });
  let tr = editor.state.tr;
  if (castAt >= 0) {
    const n = doc.nodeAt(castAt)!;
    tr = tr.replaceWith(castAt, castAt + n.nodeSize, s.nodes.sceneCast.create(null, inline));
  } else {
    const at = timeAt >= 0 ? timeAt + doc.nodeAt(timeAt)!.nodeSize : sc.heading + doc.nodeAt(sc.heading)!.nodeSize;
    tr = tr.insert(at, s.nodes.sceneCast.create(null, inline));
  }
  editor.view.dispatch(tr.scrollIntoView());
  return fresh.length;
}

export const ScreenplayNodes = [SceneHeading, SceneTime, SceneCast, Action, Transition, DialogueCue, DialogueSpeech, Dialogue];

/** All cue names used in the document — for autocomplete and the character bank. */
export function collectCharacters(doc: PMNode): string[] {
  const names = new Map<string, number>();
  doc.descendants((n) => {
    if (n.type.name === "dialogueCue" || n.type.name === "castName") {
      const name = n.textContent.replace(/\(.*?\)/g, "").replace(/[:：]\s*$/, "").trim();
      if (name) names.set(name, (names.get(name) ?? 0) + 1);
      return false;
    }
    if (n.type.name === "sceneCast") {
      n.textBetween(0, n.content.size, "\n", "\n")
        .split(/[,\n،]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((x) => names.set(x, names.get(x) ?? 0));
    }
    return true;
  });
  return [...names.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}
