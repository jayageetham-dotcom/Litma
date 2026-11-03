import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import BaseColor from "@tiptap/extension-color";
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
import { FirstLetterColour, PageBreak, StyledBlock } from "@/extensions/blocks";
import { ScreenplayKeys, ScreenplayNodes } from "@/extensions/screenplay";
import { DramaNodes } from "@/extensions/drama";
import { Endnotes, Footnote } from "@/extensions/footnote";
import { Metre, Search, Typewriter } from "@/extensions/tools";
import { SmartBold } from "@/extensions/bold";
import { KeepSelection } from "@/extensions/keep-selection";
import type { DocKind, DocSettings } from "@/lib/types";

const VARIANT_PLACEHOLDER: Record<string, string> = {
  title: "ശീർഷകം",
  subtitle: "ഉപശീർഷകം",
  author: "എഴുതിയ ആളുടെ പേര്",
  chapter: "അദ്ധ്യായത്തിന്റെ പേര്",
  kicker: "വിഭാഗം (ഉദാ: യാത്ര)",
  standfirst: "ലേഖനത്തിന്റെ ചുരുക്കം രണ്ടു വരിയിൽ…",
  byline: "എഴുതിയത്: …",
  subhead: "ഉപതലക്കെട്ട്",
  pullquote: "ശ്രദ്ധേയമായ ഒരു വരി…",
  part: "പല്ലവി / അനുപല്ലവി / ചരണം",
  stage: "രംഗനിർദ്ദേശം",
  dateline: "തീയതി",
  epigraph: "മേൽക്കുറിപ്പ്",
  caption: "അടിക്കുറിപ്പ്",
  stanza: "ഖണ്ഡത്തിന് പേര് (വേണമെങ്കിൽ)",
  act: "അങ്കത്തിന് പേര് (വേണമെങ്കിൽ)",
  scene: "സ്ഥലം, സമയം (വേണമെങ്കിൽ)",
  refrain: "ആവർത്തിക്കുന്ന വരി",
  credits: "ചിത്രം / ആൽബം · സംഗീതം · ആലാപനം",
  infobox: "വിവരപ്പെട്ടി: ചെറിയ വസ്തുതകൾ, കണക്കുകൾ…",
  references: "അവലംബം",
};

const NODE_PLACEHOLDER: Record<string, string> = {
  sceneHeading: "Int./Ext. സ്ഥലം",
  castName: "കഥാപാത്രം",
  castRole: "ആരാണ് (ഒറ്റവരിയിൽ)",
  sceneTime: "പകൽ / രാത്രി",
  sceneCast: "കഥാപാത്രങ്ങൾ",
  action: "രംഗവിവരണം…   Tab → സംഭാഷണം",
  dialogueCue: "കഥാപാത്രം",
  dialogueSpeech: "സംഭാഷണം…",
  transition: "കട്ട് ടു",
  heading: "തലക്കെട്ട്",
};

/**
 * Text colour that stays readable in dark mode: besides `color`, each coloured span carries the
 * writer's colour as `--tc`, and editor.scss lightens it on the dark page (.dark .tc). The stored
 * colour, print and PDF are unchanged.
 */
const Color = BaseColor.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.getPropertyValue("--tc").trim() || el.style.color?.replace(/['"]+/g, "") || null,
            renderHTML: (attrs: { color?: string | null }) => (attrs.color ? { class: "tc", style: `--tc: ${attrs.color}; color: ${attrs.color}` } : {}),
          },
        },
      },
    ];
  },
});

export function buildExtensions(kind: DocKind, settings: DocSettings, inputMode: InputMode) {
  const usesDialogueKeys = kind === "screenplay" || kind === "drama";
  const verse = kind === "poem" || kind === "lyrics";
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
      placeholder: ({ node, hasAnchor, editor, pos }) => {
        if (node.type.name === "styledBlock") return VARIANT_PLACEHOLDER[node.attrs.variant] ?? "";
        if (NODE_PLACEHOLDER[node.type.name]) return NODE_PLACEHOLDER[node.type.name];
        if (node.type.name === "paragraph") {
          if (editor.isEmpty) return "എഴുതിത്തുടങ്ങൂ…  (Manglish: ezhuthu → എഴുത്)";
          // the first line under a song part or stanza always says what goes there
          if (verse) {
            const before = pos > 0 ? editor.state.doc.resolve(pos).nodeBefore : null;
            if (before?.type.name === "styledBlock" && ["part", "stanza"].includes(before.attrs.variant)) return "വരി…";
          }
          if (!hasAnchor) return "";
          return verse ? "വരി…" : "എഴുതൂ…";
        }
        return "";
      },
    }),
    Manglish.configure({ defaultMode: inputMode }),
    KeepSelection,
    Pagination.configure({ geometry: geometryFor(settings.pageSize, settings.margins) }),
    PageBreak,
    FirstLetterColour,
    StyledBlock,
    ...ScreenplayNodes,
    ...DramaNodes,
    Footnote,
    Endnotes,
    ScreenplayKeys.configure({ enabled: () => usesDialogueKeys, drama: () => kind === "drama" }),
    Metre,
    Search,
    Typewriter,
  ];
}
