import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import Focus from "@tiptap/extension-focus";
import { Manglish, type InputMode } from "@/extensions/manglish";
import { Pagination, geometryFor } from "@/extensions/pagination";
import { PageBreak, StyledBlock } from "@/extensions/blocks";
import { ScreenplayKeys, ScreenplayNodes } from "@/extensions/screenplay";
import { Metre, Search, Typewriter } from "@/extensions/tools";
import { SmartBold } from "@/extensions/bold";
import { KeepSelection } from "@/extensions/keep-selection";
import type { DocKind, DocSettings } from "@/lib/types";

const VARIANT_PLACEHOLDER: Record<string, string> = {
  title: "ശീർഷകം",
  subtitle: "ഉപശീർഷകം",
  author: "എഴുത്തുകാരന്റെ പേര്",
  chapter: "അദ്ധ്യായത്തിന്റെ പേര്",
  kicker: "വിഭാഗം (ഉദാ: യാത്ര)",
  standfirst: "ലേഖനത്തിന്റെ ചുരുക്കം രണ്ടു വരിയിൽ…",
  byline: "എഴുതിയത്: …",
  subhead: "ഉപതലക്കെട്ട്",
  pullquote: "ശ്രദ്ധേയമായ ഒരു വരി…",
  part: "പല്ലവി / അനുപല്ലവി / ചരണം",
  stage: "രംഗനിർദ്ദേശം",
  dateline: "തീയതി",
  epigraph: "ആമുഖവാക്യം",
  caption: "അടിക്കുറിപ്പ്",
};

const NODE_PLACEHOLDER: Record<string, string> = {
  sceneHeading: "Int./Ext. സ്ഥലം",
  sceneTime: "പകൽ / രാത്രി",
  sceneCast: "കഥാപാത്രങ്ങൾ",
  action: "രംഗവിവരണം…   Tab → സംഭാഷണം",
  dialogueCue: "കഥാപാത്രം",
  dialogueSpeech: "സംഭാഷണം…",
  transition: "കട്ട് ടു",
  heading: "തലക്കെട്ട്",
};

export function buildExtensions(kind: DocKind, settings: DocSettings, inputMode: InputMode) {
  const usesDialogueKeys = kind === "screenplay" || kind === "drama";
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Underline,
    TextStyle,
    SmartBold,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph", "styledBlock", "action", "transition"] }),
    Link.configure({ openOnClick: false, autolink: true }),
    Subscript,
    Superscript,
    CharacterCount,
    Focus.configure({ className: "has-focus", mode: "shallowest" }),
    Placeholder.configure({
      includeChildren: true,
      showOnlyCurrent: false,
      placeholder: ({ node, hasAnchor, editor }) => {
        if (node.type.name === "styledBlock") return VARIANT_PLACEHOLDER[node.attrs.variant] ?? "";
        if (NODE_PLACEHOLDER[node.type.name]) return NODE_PLACEHOLDER[node.type.name];
        if (node.type.name === "paragraph") {
          if (editor.isEmpty) return "എഴുതിത്തുടങ്ങൂ…  (Manglish: ezhuthu → എഴുത്)";
          if (!hasAnchor) return "";
          return kind === "poem" || kind === "lyrics" ? "വരി…" : "എഴുതൂ…";
        }
        return "";
      },
    }),
    Manglish.configure({ defaultMode: inputMode }),
    KeepSelection,
    Pagination.configure({ geometry: geometryFor(settings.pageSize, settings.margins) }),
    PageBreak,
    StyledBlock,
    ...ScreenplayNodes,
    ScreenplayKeys.configure({ enabled: () => usesDialogueKeys }),
    Metre,
    Search,
    Typewriter,
  ];
}
