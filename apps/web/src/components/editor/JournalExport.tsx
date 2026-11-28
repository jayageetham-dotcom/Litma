"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarDays, Download, Lock, X } from "lucide-react";
import { shortDate } from "@litma/shared/forms";
import { Sheet } from "@/components/ui/Sheet";
import { useModalFocus } from "@/lib/useModalFocus";
import { useScreen } from "@/lib/useLayout";
import { useT } from "@/i18n/react";
import { store } from "@/lib/store";
import { isOfflineNow } from "@/lib/offline";
import { BASE } from "@/lib/config";
import { track } from "@/lib/analytics";
import { download, exportDocx, journalsDocxBlob, safe } from "@/lib/export";
import { contentsEntry, dayKey, journalForExport, listJournals, startedBetween } from "@/lib/journals";
import type { LitmaDoc } from "@/lib/types";

type Format = "pdf" | "word";
const PREF = "litma:journal-export";

/**
 * Export journals: this journal or all journals started between two dates, as PDF (the print view)
 * or one Word file. All journals = one file, oldest first, with a contents page.
 * Opened from a journal's Export button (`current`) and from the desk's Journals tab (no `current`).
 */
export function JournalExport({ current, onClose, beforeExport }: { current?: LitmaDoc; onClose: () => void; beforeExport?: () => Promise<void> }) {
  const t = useT();
  const phone = useScreen() === "phone";
  const narrow = typeof window !== "undefined" && window.innerWidth < 360;
  const [which, setWhich] = useState<"this" | "all">("all");
  const [format, setFormat] = useState<Format>(() => {
    try {
      return localStorage.getItem(PREF) === "word" ? "word" : "pdf";
    } catch {
      return "pdf";
    }
  });
  const [all, setAll] = useState<LitmaDoc[] | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(() => dayKey(new Date()));
  const [missing, setMissing] = useState(0);
  const [busy, setBusy] = useState<{ n: number; total: number } | null>(null);
  const [error, setError] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    listJournals()
      .then((list) => {
        setAll(list);
        if (list[0]) setFrom(dayKey(list[0].created_at));
      })
      .catch(() => setAll([]));
    return () => {
      cancelled.current = true;
    };
  }, []);

  const chosen = useMemo(() => (all ? startedBetween(all, from, to) : []), [all, from, to]);
  const isAll = !current || which === "all";

  // offline: say how many journals in the range aren't on this device yet
  useEffect(() => {
    if (!isAll || !chosen.length || !isOfflineNow()) return setMissing(0);
    let live = true;
    store.keptWithText(chosen.map((d) => d.id)).then((kept) => live && setMissing(chosen.length - kept.size));
    return () => {
      live = false;
    };
  }, [isAll, chosen]);

  const pickFormat = (f: Format) => {
    setFormat(f);
    try {
      localStorage.setItem(PREF, f);
    } catch {}
  };

  const close = () => {
    cancelled.current = true;
    onClose();
  };

  async function run() {
    setError(false);
    try {
      await beforeExport?.();
      if (!isAll && current) {
        if (format === "pdf") window.open(`${BASE}/print/?doc=${current.id}&auto=1`, "_blank");
        else await exportDocx(journalForExport(current));
        onClose();
        return;
      }
      if (format === "pdf") {
        track("export", { format: "pdf", kind: "diary", scope: "all" });
        window.open(`${BASE}/print/?journals=1&from=${from}&to=${to}&auto=1`, "_blank");
        onClose();
        return;
      }
      cancelled.current = false;
      const entries: { doc: LitmaDoc; entry: string }[] = [];
      setBusy({ n: 0, total: chosen.length });
      for (const [i, j] of chosen.entries()) {
        if (cancelled.current) return;
        const d = j.id === current?.id ? current : await store.getDoc(j.id).catch((e) => (isOfflineNow() ? null : Promise.reject(e)));
        if (d) entries.push({ doc: journalForExport(d), entry: contentsEntry(d) });
        setBusy({ n: i + 1, total: chosen.length });
      }
      if (cancelled.current) return;
      if (!entries.length) throw new Error("nothing on this device");
      track("export", { format: "docx", kind: "diary", scope: "all" });
      const blob = await journalsDocxBlob(entries, { title: "ജേണലുകൾ", contents: "ഉള്ളടക്കം" });
      if (cancelled.current) return;
      download(`${safe(`${t("journals.title")} ${from} ${to}`)}.docx`, blob);
      onClose();
    } catch {
      if (!cancelled.current) setError(true);
    } finally {
      setBusy(null);
    }
  }

  const none = isAll && all !== null && chosen.length === 0;
  const disabled = !!busy || all === null || none;

  const dot = (c: string) => <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${c}`} />;
  const heading = (c: string, label: string, extra?: React.ReactNode) => (
    <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
      {dot(c)}
      {label}
      {extra}
    </h3>
  );

  /** Two choices: radio cards on wider screens, a segmented switcher on phones. */
  const choice = <V extends string>(name: string, value: V, set: (v: V) => void, opts: { v: V; label: string; hint: string; short?: string }[], cols = false) =>
    phone ? (
      <>
        <div role="radiogroup" aria-label={name} className="mt-3 flex rounded-xl bg-dialog-well p-1">
          {opts.map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={value === o.v}
              onClick={() => set(o.v)}
              className={`min-h-11 flex-1 rounded-[10px] px-2 text-[15px] ${value === o.v ? "bg-surface font-semibold text-ink shadow-sm" : "text-muted"}`}
            >
              {o.short ?? o.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{opts.find((o) => o.v === value)?.hint}</p>
      </>
    ) : (
      <div role="radiogroup" aria-label={name} className={`mt-3 grid gap-3 ${cols ? "grid-cols-2" : ""}`}>
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => set(o.v)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left ${value === o.v ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-subtle"}`}
          >
            <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${value === o.v ? "border-accent" : "border-line-strong"}`}>
              {value === o.v && <span className="size-2 rounded-full bg-accent" />}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{o.label}</span>
              <span className="mt-0.5 block text-sm text-muted" data-private>
                {o.hint}
              </span>
            </span>
          </button>
        ))}
      </div>
    );

  const field = (label: string, value: string, set: (v: string) => void, min?: string, max?: string) => (
    <label className={narrow ? "flex items-center gap-3" : "block"}>
      <span className={`text-sm text-muted ${narrow ? "w-12 shrink-0" : "mb-1.5 block"}`}>{label}</span>
      <span className="relative block flex-1">
        {!phone && <CalendarDays size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />}
        <input type="date" className={`field w-full ${phone ? "!text-base" : "!pl-9"}`} value={value} min={min} max={max} onChange={(e) => set(e.target.value)} />
      </span>
    </label>
  );

  const body = (
    <div className="space-y-6">
      {current && (
        <section>
          {heading("bg-tint-violet", t("journals.exportDialog.which"))}
          {choice(t("journals.exportDialog.which"), which, setWhich, [
            { v: "this", label: t("journals.exportDialog.this"), hint: `${shortDate(current.created_at)} · ${current.title}` },
            { v: "all", label: t("journals.exportDialog.all"), hint: t("journals.exportDialog.allHint") },
          ])}
        </section>
      )}
      {isAll && (
        <section>
          {heading("bg-tint-sky", t("journals.exportDialog.dates"), !current && <span className="ml-1 font-normal text-muted">· {t("journals.exportDialog.allHint")}</span>)}
          <div className={`mt-3 grid gap-3 ${narrow ? "" : "grid-cols-2"}`}>
            {field(t("journals.exportDialog.from"), from, setFrom, undefined, to || undefined)}
            {field(t("journals.exportDialog.to"), to, setTo, from || undefined)}
          </div>
          {/* fixed height, so nothing jumps when the count changes */}
          <p className={`mt-2 min-h-5 text-sm ${none ? "font-semibold text-danger" : "text-muted"}`} aria-live="polite">
            {all === null ? "" : none ? t("journals.exportDialog.none") : t("journals.exportDialog.inRange", { count: chosen.length })}
          </p>
          {missing > 0 && <p className="mt-2 rounded-lg bg-highlight-soft px-3 py-2 text-sm text-highlight">{t("journals.exportDialog.notOnDevice", { count: missing })}</p>}
        </section>
      )}
      <section>
        {heading("bg-tint-coral", t("journals.exportDialog.format"))}
        {choice(t("journals.exportDialog.format"), format, pickFormat, [
          { v: "pdf", label: t("journals.exportDialog.pdf"), hint: t("journals.exportDialog.pdfHint") },
          { v: "word", label: t("journals.exportDialog.word"), short: "Word", hint: t("journals.exportDialog.wordHint") },
        ], true)}
      </section>
      <p className="flex items-start gap-2 text-sm text-muted">
        <Lock size={15} aria-hidden className="mt-0.5 shrink-0" />
        {t("journals.exportDialog.private")}
      </p>
      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
          <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
          {t("journals.exportDialog.error")}
        </p>
      )}
      <div aria-live="polite" className={busy ? "" : "sr-only"}>
        {busy && (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${busy.total ? (busy.n / busy.total) * 100 : 0}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">{t("journals.exportDialog.working", { n: busy.n, total: busy.total })}</p>
          </>
        )}
      </div>
    </div>
  );

  const button = (
    <button className={`btn btn-primary ${phone ? "min-h-[50px] w-full justify-center" : ""}`} disabled={disabled} onClick={run}>
      {busy ? <span className="ink-spinner" aria-hidden /> : <Download size={16} aria-hidden />}
      {error ? t("common.retry") : t("journals.exportDialog.button")}
    </button>
  );

  if (phone)
    return (
      <Sheet mode="sheet" title={t("journals.exportDialog.title")} onClose={close}>
        {body}
        {/* the Export button stays reachable at the bottom of the sheet */}
        <div className="sticky -bottom-6 -mx-5 mt-6 border-t border-line px-5 pb-1 pt-4 dialog !border-x-0 !border-b-0 !shadow-none">{button}</div>
      </Sheet>
    );
  return <ExportDialog title={t("journals.exportDialog.title")} onClose={close} footer={
    <div className="mt-6 flex justify-end gap-2">
      <button className="btn btn-ghost" onClick={close}>
        {t("common.cancel")}
      </button>
      {button}
    </div>
  }>{body}</ExportDialog>;
}

function ExportDialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  useModalFocus(true, box, onClose);
  return (
    <div className="fade-in no-print fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto scrim p-4 pt-[8vh]" onClick={onClose}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className="pop-in w-full max-w-[480px] rounded-xl dialog p-6" onClick={(e) => e.stopPropagation()}>
        <div className="-mx-1 mb-5 flex items-center justify-between border-b border-line pb-3.5">
          <h2 className="flex items-center gap-2 px-1 text-[15px] font-semibold">
            <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-mark)]" />
            {title}
          </h2>
          <button className="btn btn-ghost !p-2.5" onClick={onClose} aria-label={`${t("common.close")}: ${title}`}>
            <X size={18} />
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}
