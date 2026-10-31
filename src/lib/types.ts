import type { JSONContent } from "@tiptap/core";
export type { DocKind, DocSettings, CharacterNote, PageSizeKey, InputMode } from "@/shared/forms";
import type { DocKind, DocSettings } from "@/shared/forms";

export interface LitmaDoc {
  id: string;
  title: string;
  kind: DocKind;
  content: JSONContent;
  settings: DocSettings;
  word_count: number;
  is_public?: boolean;
  share_id?: string | null;
  archived?: boolean;
  excerpt?: string;
  created_at: string;
  updated_at: string;
}

export interface DocVersion {
  id: string;
  document_id: string;
  label: string | null;
  content: JSONContent;
  word_count: number;
  created_at: string;
}

export interface Suggestion {
  id: string;
  document_id: string;
  source: string;
  kind: string;
  content: string;
  target_text: string | null;
  note: string | null;
  status: "pending" | "accepted" | "dismissed";
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  pen_name: string | null;
  username: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatar_url: string | null;
  daily_goal: number;
  preferences: { inputMode?: string; [k: string]: unknown };
}
