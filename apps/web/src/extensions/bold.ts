import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    smartBold: {
      /** Bold on/off that also works inside blocks that are bold by style (titles, headings, chapters). */
      toggleSmartBold: () => ReturnType;
    };
  }
}

/** Is the block around the cursor bold because of its style (not because of a bold mark)? */
export function blockIsBold(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  if ($from.depth < 1) return false;
  try {
    const dom = editor.view.nodeDOM($from.before($from.depth)) as HTMLElement | null;
    if (!dom || dom.nodeType !== 1) return false;
    return parseInt(getComputedStyle(dom).fontWeight, 10) >= 600;
  } catch {
    return false;
  }
}

/** What the Bold button should show for the current selection. */
export function boldIsOn(editor: Editor): boolean {
  if (editor.isActive("bold")) return true;
  if (!blockIsBold(editor)) return false;
  return editor.getAttributes("textStyle").fontWeight !== "400";
}

/**
 * Adds a `fontWeight` attribute to textStyle, so text in a naturally bold block
 * (a title, a chapter heading) can be set back to normal weight with the Bold button or Ctrl/⌘+B.
 */
export const SmartBold = Extension.create({
  name: "smartBold",
  priority: 120,

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontWeight || null,
            renderHTML: (attrs) => (attrs.fontWeight ? { style: `font-weight: ${attrs.fontWeight}` } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      toggleSmartBold:
        () =>
        ({ editor, chain }) => {
          if (editor.isActive("bold")) return chain().unsetBold().run();
          if (blockIsBold(editor)) {
            const normal = editor.getAttributes("textStyle").fontWeight === "400";
            return normal
              ? chain().setMark("textStyle", { fontWeight: null }).removeEmptyTextStyle().run()
              : chain().setMark("textStyle", { fontWeight: "400" }).run();
          }
          return chain().setMark("textStyle", { fontWeight: null }).removeEmptyTextStyle().setBold().run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-b": () => this.editor.commands.toggleSmartBold(),
      "Mod-B": () => this.editor.commands.toggleSmartBold(),
    };
  },
});
