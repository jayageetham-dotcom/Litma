import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      /** Size of the selected text in points, e.g. 14. */
      setFontSize: (pt: number) => ReturnType;
      /** Back to the size the line has by its style. */
      unsetFontSize: () => ReturnType;
    };
  }
}

/** Sizes offered in the toolbar, in points (like a word processor). */
export const FONT_SIZES = [8, 9, 10, 10.5, 11, 11.5, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48];

/**
 * The size the selection shows at, in points: the writer's own size if there is one,
 * otherwise what the line's style gives it (a title is bigger than body text).
 */
export function currentFontSize(editor: Editor): number | null {
  const own = editor.getAttributes("textStyle").fontSize as string | undefined;
  if (own) {
    const n = parseFloat(own);
    if (n) return n;
  }
  try {
    const { node } = editor.view.domAtPos(editor.state.selection.from);
    const el = (node.nodeType === 1 ? node : node.parentElement) as HTMLElement | null;
    if (!el) return null;
    const px = parseFloat(getComputedStyle(el).fontSize);
    return px ? Math.round(px * 0.75 * 2) / 2 : null;
  } catch {
    return null;
  }
}

/** One size step up or down from `pt` in FONT_SIZES. */
export function stepFontSize(pt: number, dir: 1 | -1): number {
  if (dir > 0) return FONT_SIZES.find((s) => s > pt + 0.01) ?? FONT_SIZES[FONT_SIZES.length - 1];
  return [...FONT_SIZES].reverse().find((s) => s < pt - 0.01) ?? FONT_SIZES[0];
}

/** Adds a `fontSize` (in pt) to textStyle, so any writing type can size a word, a line or a passage. */
export const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
            renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (pt: number) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: `${pt}pt` }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});
