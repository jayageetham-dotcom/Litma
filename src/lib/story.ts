import type { DocKind } from "./types";

export type StoryKind = "character" | "location" | "item" | "beat" | "event" | "note";

export interface StoryItem {
  id: string;
  document_id: string;
  kind: StoryKind;
  name: string;
  summary: string;
  data: Record<string, string>;
  image_url: string | null;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
}

const CHARACTER: FieldDef[] = [
  { key: "role", label: "Role", type: "select", options: ["Protagonist", "Antagonist", "Supporting", "Minor", "Narrator"] },
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "occupation", label: "Occupation" },
  { key: "appearance", label: "Appearance", type: "textarea", placeholder: "How they look, dress, move" },
  { key: "personality", label: "Personality", type: "textarea" },
  { key: "backstory", label: "Backstory", type: "textarea" },
  { key: "goal", label: "Wants / goal", type: "textarea" },
  { key: "conflict", label: "Conflict / fear", type: "textarea" },
  { key: "arc", label: "Arc — how they change", type: "textarea" },
  { key: "relationships", label: "Relationships", type: "textarea", placeholder: "ഡെന്നി — കോളേജ് സുഹൃത്ത്…" },
  { key: "voice", label: "Voice & dialect", type: "textarea", placeholder: "Thrissur slang, short sentences…" },
];

const LOCATION: FieldDef[] = [
  { key: "setting", label: "Interior / exterior", type: "select", options: ["Int.", "Ext.", "Int./Ext."] },
  { key: "period", label: "Time / period" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "senses", label: "Sights, sounds, smells", type: "textarea" },
  { key: "significance", label: "Why it matters", type: "textarea" },
];

const ITEM: FieldDef[] = [
  { key: "owner", label: "Belongs to" },
  { key: "first", label: "First appears" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "significance", label: "Why it matters", type: "textarea" },
];

const BEAT: FieldDef[] = [
  { key: "group", label: "Act / chapter" },
  { key: "status", label: "Status", type: "select", options: ["Idea", "Drafting", "Written", "Revise"] },
  { key: "color", label: "Colour", type: "select", options: ["kayal", "kasavu", "rose", "sky", "grey"] },
];

const EVENT: FieldDef[] = [
  { key: "when", label: "When", placeholder: "1987 ഓണം / Day 3, night" },
  { key: "who", label: "Who is involved" },
  { key: "where", label: "Where" },
];

const NOTE: FieldDef[] = [{ key: "link", label: "Link / source" }];

export const FIELDS: Record<StoryKind, FieldDef[]> = {
  character: CHARACTER,
  location: LOCATION,
  item: ITEM,
  beat: BEAT,
  event: EVENT,
  note: NOTE,
};

export interface StoryTab {
  kind: StoryKind | "report";
  label: string;
  ml: string;
  /** label for the "summary" field */
  summary?: string;
}

/** Which Story World sections each writing type gets (modelled on Final Draft, Scrivener, Celtx…). */
export function tabsFor(kind: DocKind): StoryTab[] {
  const report: StoryTab = { kind: "report", label: "Reports", ml: "റിപ്പോർട്ട്" };
  switch (kind) {
    case "screenplay":
    case "drama":
      return [
        { kind: "character", label: "Characters", ml: "കഥാപാത്രങ്ങൾ", summary: "One-line description" },
        { kind: "location", label: "Locations", ml: "ലൊക്കേഷനുകൾ", summary: "One-line description" },
        { kind: "item", label: "Props", ml: "സാമഗ്രികൾ", summary: "One-line description" },
        { kind: "beat", label: "Beat board", ml: "ബീറ്റുകൾ", summary: "What happens" },
        { kind: "event", label: "Timeline", ml: "കാലക്രമം", summary: "What happened" },
        { kind: "note", label: "Notes", ml: "കുറിപ്പുകൾ", summary: "Note" },
        report,
      ];
    case "novel":
    case "story":
      return [
        { kind: "character", label: "Characters", ml: "കഥാപാത്രങ്ങൾ", summary: "One-line description" },
        { kind: "location", label: "Places", ml: "സ്ഥലങ്ങൾ", summary: "One-line description" },
        { kind: "item", label: "Objects", ml: "വസ്തുക്കൾ", summary: "One-line description" },
        { kind: "beat", label: "Plot board", ml: "കഥാഘടന", summary: "What happens" },
        { kind: "event", label: "Timeline", ml: "കാലക്രമം", summary: "What happened" },
        { kind: "note", label: "Research", ml: "ഗവേഷണം", summary: "Note" },
        report,
      ];
    case "poem":
    case "lyrics":
      return [
        { kind: "note", label: "Images & ideas", ml: "ബിംബങ്ങൾ", summary: "Image, line or idea" },
        { kind: "beat", label: "Structure", ml: "ഘടന", summary: "What this stanza/part does" },
        { kind: "character", label: "Voices", ml: "ശബ്ദങ്ങൾ", summary: "Who speaks" },
        report,
      ];
    case "feature":
    case "essay":
      return [
        { kind: "character", label: "People", ml: "വ്യക്തികൾ", summary: "Who they are" },
        { kind: "location", label: "Places", ml: "സ്ഥലങ്ങൾ", summary: "One-line description" },
        { kind: "note", label: "Sources", ml: "സ്രോതസ്സുകൾ", summary: "Quote, fact or source" },
        { kind: "beat", label: "Outline", ml: "രൂപരേഖ", summary: "Point to make" },
        report,
      ];
    case "diary":
      return [
        { kind: "character", label: "People", ml: "വ്യക്തികൾ", summary: "Who they are" },
        { kind: "location", label: "Places", ml: "സ്ഥലങ്ങൾ", summary: "One-line description" },
        { kind: "event", label: "Timeline", ml: "കാലക്രമം", summary: "What happened" },
        { kind: "note", label: "Notes", ml: "കുറിപ്പുകൾ", summary: "Note" },
        report,
      ];
    default:
      return [
        { kind: "character", label: "Characters", ml: "കഥാപാത്രങ്ങൾ", summary: "One-line description" },
        { kind: "location", label: "Places", ml: "സ്ഥലങ്ങൾ", summary: "One-line description" },
        { kind: "beat", label: "Outline", ml: "രൂപരേഖ", summary: "What happens" },
        { kind: "note", label: "Notes", ml: "കുറിപ്പുകൾ", summary: "Note" },
        report,
      ];
  }
}

export const BEAT_COLORS: Record<string, string> = {
  kayal: "var(--accent)",
  kasavu: "var(--highlight)",
  rose: "#b0566b",
  sky: "#3f72af",
  grey: "#7d8986",
};

export function defaultGroups(kind: DocKind): string[] {
  if (kind === "screenplay" || kind === "drama") return ["Act 1 · ആരംഭം", "Act 2 · സംഘർഷം", "Act 3 · പരിഹാരം"];
  if (kind === "novel" || kind === "story") return ["ആരംഭം", "മധ്യം", "അന്ത്യം"];
  if (kind === "poem" || kind === "lyrics") return ["പല്ലവി", "അനുപല്ലവി", "ചരണം"];
  return ["ആമുഖം", "പ്രധാന ഭാഗം", "ഉപസംഹാരം"];
}
