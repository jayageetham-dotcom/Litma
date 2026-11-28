"use client";
import type { JSONContent } from "@tiptap/core";
import { isUntitledJournal, todayLine } from "@litma/shared/forms";
import { store } from "./store";
import { settingsFor } from "./templates";
import type { LitmaDoc } from "./types";

/** The writer's journals (not in the trash), oldest started first; ties by id. Same order as the phone app. */
export async function listJournals(): Promise<LitmaDoc[]> {
  const docs = await store.listDocs();
  return docs.filter((d) => d.kind === "diary").sort(byStarted);
}

export function byStarted(a: LitmaDoc, b: LitmaDoc) {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

/** A local day as "YYYY-MM-DD" (the value of a date field). */
export function dayKey(d: Date | string): string {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Journals whose started day lies between `from` and `to` (both "YYYY-MM-DD", inclusive). */
export function startedBetween(docs: LitmaDoc[], from: string, to: string): LitmaDoc[] {
  return docs.filter((d) => {
    const k = dayKey(d.created_at);
    return (!from || k >= from) && (!to || k <= to);
  });
}

/** One line for a contents page: the started date, then the title when the writer named it. */
export function contentsEntry(d: LitmaDoc): string {
  const date = todayLine(d.created_at);
  return isUntitledJournal(d.title, d.created_at) ? date : `${date} · ${d.title.trim()}`;
}

/**
 * A journal ready for a PDF or Word file: when its title block on the page is empty and the writer
 * named the journal, the title goes there, so every exported journal starts with its own name.
 */
export function journalForExport(d: LitmaDoc): LitmaDoc {
  const settings = { ...settingsFor(d.kind), ...d.settings };
  const blocks = d.content?.content ?? [];
  if (isUntitledJournal(d.title, d.created_at)) return { ...d, settings };
  const at = blocks.findIndex((b) => b.type === "styledBlock" && b.attrs?.variant === "title");
  if (at < 0 || blocks[at].content?.length) return { ...d, settings };
  const filled: JSONContent = { ...blocks[at], content: [{ type: "text", text: d.title.trim() }] };
  return { ...d, settings, content: { ...d.content, content: [...blocks.slice(0, at), filled, ...blocks.slice(at + 1)] } };
}
