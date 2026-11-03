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

/** How far the writer dragged a cover part from its design position, in millimetres. */
export interface CoverOffset {
  x: number;
  y: number;
}

export interface BookCover {
  template?: "kasavu" | "art" | "solid" | "photo" | "type" | "minimal";
  /** Last preset picked (COVER_PRESETS), for highlighting it in the designer. */
  preset?: string;
  /** Drawn illustration id from COVER_ART (components/art/CoverArt.tsx), or null for none. */
  art?: string | null;
  bg?: string;
  fg?: string;
  accent?: string;
  font?: string;
  image?: string | null;
  imageOpacity?: number;
  titleScale?: number;
  /** Soft drop shadow behind the title text. */
  titleShadow?: boolean;
  /** Colour box behind the title block; colour defaults to the cover background. */
  titleBox?: boolean;
  titleBoxColor?: string;
  titleBoxOpacity?: number;
  /** Divider under the title: a plain line (default), a flourish, or none. */
  ornament?: "line" | "flourish" | "none";
  /** Round badge on the front (e.g. "14-ാം പതിപ്പ്"); text defaults to the book's edition. */
  badge?: boolean;
  badgeText?: string;
  /** Publisher's name as a small boxed mark in the front's top corner. */
  publisherMark?: boolean;
  /** Back cover: repeat the title and author at the top, beside the author picture. Default on. */
  backTitle?: boolean;
  /** Back cover imprint strip on/off (default on). */
  imprintStrip?: boolean;
  /** Back cover imprint strip (shown when any of these, the publisher or the ISBN is set). */
  genreLine?: string;
  category?: string;
  coverCredit?: string;
  website?: string;
  publisherTagline?: string;
  /** Size of each cover part relative to its design (1 = as designed); the title uses `titleScale`. */
  sizes?: Record<string, number>;
  /** Dragged positions of cover parts (COVER_PARTS in components/book/Cover.tsx). */
  offsets?: Record<string, CoverOffset>;
  blurb?: string;
  authorBio?: string;
  /** Uploaded author photo (only while photo uploads are on; older books may still have one). */
  authorPhoto?: string | null;
  /** Author picture on the back cover: "letter", an avatar picture id from AVATAR_IMAGES (e.g. "f-1", "m-1"), or "none". Default "letter". */
  authorAvatar?: string | null;
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
