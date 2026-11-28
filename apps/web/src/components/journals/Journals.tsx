"use client";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { journalDay, journalPreview, monthLine, sameDay, shortDate } from "@litma/shared/forms";
import type { LitmaDoc } from "@/lib/types";
import { useT } from "@/i18n/react";

/** Journals in the order the Journals tab lists them: newest started first (ties by id). */
export function byStartedNewest(a: LitmaDoc, b: LitmaDoc) {
  return b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
}

/** The started date as a small calendar: short month on an accent band, the day, the short weekday. */
export function CalendarBlock({ date, dashed = false }: { date: Date | string; dashed?: boolean }) {
  const d = journalDay(date);
  return (
    <div
      aria-hidden
      className={`flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-[10px] border bg-surface ${dashed ? "border-dashed border-line-strong" : "border-line"}`}
    >
      <span className="w-full bg-accent-soft py-[3px] text-center text-[11px] font-semibold leading-tight text-accent">{d.month}</span>
      <span className="pt-0.5 text-[22px] font-bold leading-none text-ink" style={{ fontFamily: "Inter, var(--font-sans)" }}>
        {d.day}
      </span>
      <span className="pb-1 pt-0.5 text-[10.5px] leading-tight text-muted">{d.weekday}</span>
    </div>
  );
}

/** One journal on the desk. Untitled journals show their first line of writing as the title. */
export function JournalCard({ doc, onTrash }: { doc: LitmaDoc; onTrash?: () => void }) {
  const t = useT();
  const { heading, body } = journalPreview(doc.title, doc.created_at, doc.lines ?? (doc.excerpt ? [doc.excerpt] : []));
  const edited = !sameDay(doc.created_at, doc.updated_at);
  const words = t("common.words", { count: doc.word_count });
  const editedLine = edited ? <span className="ml-auto shrink-0">{t("journals.edited", { date: shortDate(doc.updated_at) })}</span> : null;
  return (
    <li className="group">
      <Link
        href={`/write/?id=${doc.id}`}
        data-private
        className="flex flex-col rounded-2xl border border-line bg-surface p-4 transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:border-transparent hover:shadow-[var(--pop-shadow)] sm:h-[208px]"
      >
        <div className="flex gap-3">
          <CalendarBlock date={doc.created_at} />
          <div className="min-w-0 flex-1 pt-0.5">
            {heading ? (
              <div className="line-clamp-2 text-base font-bold leading-snug">{heading}</div>
            ) : (
              <div className="text-base text-muted">{t("journals.nothingYet")}</div>
            )}
          </div>
        </div>
        {body && (
          <p className="mt-3 line-clamp-3 text-[13.5px] leading-relaxed text-muted" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
            {body}
          </p>
        )}
        {/* phones: words bottom left; edited date bottom right on every size */}
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted">
          <span className="sm:hidden">{words}</span>
          {editedLine}
        </div>
      </Link>
      <div className="mt-1.5 flex min-h-7 items-center justify-between px-1 text-xs text-muted">
        <span className="max-sm:invisible">{words}</span>
        {onTrash && (
          <button
            className="rounded p-1.5 transition-opacity max-sm:-my-2 max-sm:grid max-sm:size-11 max-sm:place-items-center hover:bg-subtle hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
            title={t("desk.moveToTrash")}
            aria-label={`${t("desk.moveToTrash")}: ${shortDate(doc.created_at)}`}
            onClick={onTrash}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </li>
  );
}

/** Journals grouped under month lines ("2026 നവംബർ"), newest first. */
export function JournalList({ docs, onTrash }: { docs: LitmaDoc[]; onTrash: (d: LitmaDoc) => void }) {
  const groups: { month: string; docs: LitmaDoc[] }[] = [];
  for (const d of docs) {
    const m = monthLine(d.created_at);
    if (groups[groups.length - 1]?.month !== m) groups.push({ month: m, docs: [] });
    groups[groups.length - 1].docs.push(d);
  }
  return (
    <div className="mt-8 sm:mt-10">
      {groups.map((g, i) => (
        <section key={g.month} aria-label={g.month} className={i ? "mt-10" : ""}>
          <h2 className="flex items-center gap-3 text-[15px] font-semibold text-muted" style={{ fontFamily: "var(--font-display)" }}>
            {g.month}
            <span aria-hidden className="h-px flex-1 bg-line" />
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:gap-x-6 sm:gap-y-6">
            {g.docs.map((d) => (
              <JournalCard key={d.id} doc={d} onTrash={() => onTrash(d)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
