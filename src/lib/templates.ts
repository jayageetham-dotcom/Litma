import type { JSONContent } from "@tiptap/core";
import type { DocKind, DocSettings } from "./types";
import type { BlockVariant } from "@/extensions/blocks";
import { FORM_NAMES, settingsFor as sharedSettingsFor, starterContent } from "@/shared/forms";

export { DEFAULT_SETTINGS } from "@/shared/forms";

export interface Template {
  kind: DocKind;
  ml: string;
  en: string;
  blurb: string;
  /** block variants offered in this template's toolbar */
  blocks: BlockVariant[];
  screenplay?: boolean;
  dialogue?: boolean;
  metre?: boolean;
  settings: DocSettings;
  content: () => JSONContent;
}

type TemplateMeta = Omit<Template, "settings" | "content">;

const META: TemplateMeta[] = [
  {
    kind: "novel",
    ml: "നോവൽ",
    en: "Novel",
    blurb: "Chapters, scene breaks and an indented, justified body — set like a printed book.",
    blocks: ["title", "author", "epigraph", "chapter"],
  },
  {
    kind: "story",
    ml: "ചെറുകഥ",
    en: "Short story",
    blurb: "A single sitting: title, byline and clean prose with section breaks.",
    blocks: ["title", "author", "epigraph", "subhead"],
  },
  {
    kind: "poem",
    ml: "കവിത",
    en: "Poem",
    blurb: "Line-by-line verse with an akshara counter and laghu–guru marks for വൃത്തം.",
    blocks: ["title", "author", "epigraph", "part"],
    metre: true,
  },
  {
    kind: "screenplay",
    ml: "തിരക്കഥ",
    en: "Screenplay",
    blurb: "Malayalam film format: numbered scenes, cast list, action on the left, dialogue in two columns.",
    blocks: ["title", "author"],
    screenplay: true,
  },
  {
    kind: "feature",
    ml: "ഫീച്ചർ",
    en: "Feature writing",
    blurb: "Magazine layout: kicker, headline, standfirst, byline, subheads and pull quotes.",
    blocks: ["kicker", "title", "standfirst", "byline", "subhead", "pullquote", "caption"],
  },
  {
    kind: "essay",
    ml: "ലേഖനം",
    en: "Essay / article",
    blurb: "Argument-first prose with headings, quotations and lists.",
    blocks: ["title", "subtitle", "author", "subhead", "pullquote"],
  },
  {
    kind: "drama",
    ml: "നാടകം",
    en: "Drama / play",
    blurb: "Stage play: cast list, രംഗം headings, stage directions and speaker lines.",
    blocks: ["title", "author", "chapter", "stage"],
    dialogue: true,
  },
  {
    kind: "lyrics",
    ml: "ഗാനം",
    en: "Song lyrics",
    blurb: "പല്ലവി, അനുപല്ലവി, ചരണം — labelled parts with metre counts for each line.",
    blocks: ["title", "subtitle", "part"],
    metre: true,
  },
  {
    kind: "diary",
    ml: "ഡയറി",
    en: "Diary / memoir",
    blurb: "Dated entries for journals, travelogues and memoir drafts.",
    blocks: ["title", "dateline", "subhead"],
  },
  {
    kind: "blank",
    ml: "ശൂന്യം",
    en: "Blank page",
    blurb: "An empty A4 page. Use any heading or block from the toolbar.",
    blocks: ["title", "subtitle", "author", "subhead", "pullquote"],
  },
];

export const TEMPLATES: Template[] = META.map((m) => ({
  ...m,
  ml: FORM_NAMES[m.kind].ml,
  en: FORM_NAMES[m.kind].en,
  settings: sharedSettingsFor(m.kind),
  content: () => starterContent(m.kind) as JSONContent,
}));

export const templateFor = (kind: DocKind) => TEMPLATES.find((t) => t.kind === kind) ?? TEMPLATES[TEMPLATES.length - 1];

export const settingsFor = sharedSettingsFor;

export const FONTS = [
  { name: "Noto Serif Malayalam", note: "Book serif" },
  { name: "Noto Sans Malayalam", note: "Clean sans" },
  { name: "Manjari", note: "Rounded, poetic" },
  { name: "Gayathri", note: "Light, modern" },
  { name: "Anek Malayalam", note: "Contemporary" },
  { name: "Baloo Chettan 2", note: "Display" },
  { name: "Chilanka", note: "Handwritten" },
];
