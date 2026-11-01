import { Node, Extension, mergeAttributes, Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Node as PMNode } from "@tiptap/pm/model";

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

/** Keyboard flow modelled on pro screenplay tools: Enter/Tab move between elements. */
export const ScreenplayKeys = Extension.create<{ enabled: () => boolean }>({
  name: "screenplayKeys",
  priority: 200,
  addOptions() {
    return { enabled: () => true };
  },
  addKeyboardShortcuts() {
    const s = () => this.editor.schema;
    const enter = () => {
      const editor = this.editor;
      const { $from, empty } = editor.state.selection;
      if (!empty) return false;
      const parent = $from.parent.type.name;
      const tb = topBlock(editor);
      if (!tb) return false;
      const after = tb.pos + tb.node.nodeSize;
      switch (parent) {
        case "sceneHeading":
          return insertAfter(editor, after, s().nodes.sceneTime.create(), 1);
        case "sceneTime":
          return insertAfter(editor, after, s().nodes.sceneCast.create(), 1);
        case "sceneCast":
          if ($from.parent.content.size === 0) {
            return setScreenplayElement(editor, "action");
          }
          // another cast name on its own line
          return editor.commands.setHardBreak();
        case "action":
          if ($from.parent.content.size === 0) return setScreenplayElement(editor, "dialogue");
          if ($from.parentOffset < $from.parent.content.size) return false;
          return insertAfter(editor, after, s().nodes.action.create(), 1);
        case "transition":
          return insertAfter(editor, after, s().nodes.sceneHeading.create(), 1);
        case "dialogueCue": {
          if ($from.parent.content.size === 0 && tb.node.child(1).content.size === 0) return setScreenplayElement(editor, "action");
          return jumpToSpeech(editor, tb.pos, tb.node, true);
        }
        case "dialogueSpeech":
          if ($from.parentOffset < $from.parent.content.size) return editor.commands.setHardBreak();
          return insertAfter(editor, after, emptyDialogue(editor), 2);
        default:
          return false;
      }
    };
    const tab = () => {
      const editor = this.editor;
      const parent = editor.state.selection.$from.parent.type.name;
      const tb = topBlock(editor);
      if (!tb) return false;
      if (parent === "action") return setScreenplayElement(editor, "dialogue");
      if (parent === "dialogueCue") return jumpToSpeech(editor, tb.pos, tb.node, false);
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
      if (parent === "dialogueCue" && tb.node.textContent.length === 0) return setScreenplayElement(editor, "action");
      return false;
    };
    const guard = (fn: () => boolean) => () => (this.options.enabled() ? fn() : false);
    const shortcuts: Record<string, () => boolean> = {
      Enter: guard(enter),
      Tab: guard(tab),
      Backspace: guard(backspace),
    };
    SCREENPLAY_ELEMENTS.forEach((el) => {
      shortcuts[`Mod-Alt-${el.key}`] = guard(() => setScreenplayElement(this.editor, el.type));
    });
    return shortcuts;
  },
});

export const ScreenplayNodes = [SceneHeading, SceneTime, SceneCast, Action, Transition, DialogueCue, DialogueSpeech, Dialogue];

/** All cue names used in the document — for autocomplete and the character bank. */
export function collectCharacters(doc: PMNode): string[] {
  const names = new Map<string, number>();
  doc.descendants((n) => {
    if (n.type.name === "dialogueCue") {
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
