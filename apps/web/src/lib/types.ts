import type { JSONContent } from "@tiptap/core";
export type { DocKind, DocSettings, CharacterNote, PageSizeKey, InputMode } from "@litma/shared/forms";
import type { DocKind, DocSettings } from "@litma/shared/forms";

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

// ── Books ──
export type BookItemType =
  | "cover"
  | "half-title"
  | "title"
  | "copyright"
  | "dedication"
  | "epigraph"
  | "toc"
  | "text"
  | "part"
  | "document"
  | "back-cover";

export interface BookItem {
  id: string;
  type: BookItemType;
  /** for "document" */
  documentId?: string;
  /** heading shown for this item (chapter title, page title, part name) */
  title?: string;
  /** for "document": print the document title as a chapter heading */
  showTitle?: boolean;
  /** rich text for text / dedication / epigraph / copyright pages (Tiptap JSON) */
  content?: JSONContent;
  /** include in the table of contents */
  inToc?: boolean;
}

export interface BookSettings {
  pageSize?: "A4" | "A5" | "Letter";
  font?: string;
  fontSize?: number;
  lineHeight?: number;
  margins?: { top: number; bottom: number; inner: number; outer: number };
  chaptersOnRight?: boolean;
  runningHead?: boolean;
  publisher?: string;
  isbn?: string;
  edition?: string;
  year?: string;
}

export interface BookCover {
  template?: "kasavu" | "solid" | "photo" | "type" | "minimal";
  bg?: string;
  fg?: string;
  accent?: string;
  font?: string;
  image?: string | null;
  imageOpacity?: number;
  titleScale?: number;
  blurb?: string;
  authorBio?: string;
  authorPhoto?: string | null;
  price?: string;
}

export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  author: string | null;
  structure: BookItem[];
  settings: BookSettings;
  cover: BookCover;
  created_at: string;
  updated_at: string;
}

/** A word saved from the dictionary for later. */
export interface WordBookmark {
  id: string;
  word: string;
  lang: "en" | "ml";
  meaning: string | null;
  synonyms: string[];
  note?: string | null;
  created_at: string;
}
