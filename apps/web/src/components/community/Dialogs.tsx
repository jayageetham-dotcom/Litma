"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { useT } from "@/i18n/react";
import { Select } from "@/components/ui/Select";
import { LIMITS, MOD_REASONS, REPORT_REASONS, community, type ModAction, type ModReason, type ReportReason } from "@/lib/community";
import { Dialog, problemText } from "./bits";

/** Shown before a writer's first post (and again when the guidelines change). Records the version they agreed to. */
export function AgreeDialog({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const t = useT();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const agree = async () => {
    setBusy(true);
    setError("");
    try {
      await community.agree();
      onDone();
    } catch (e) {
      setError(problemText(t, e));
      setBusy(false);
    }
  };
  return (
    <Dialog title={t("community.agree.title")} onClose={onClose} wide>
      <p className="mt-2 text-[15px] text-muted">{t("community.agree.intro")}</p>
      <ul className="mt-4 grid gap-2.5">
        {(["p1", "p2", "p3", "p4", "p5", "p6"] as const).map((k, i) => (
          <li key={k} className="flex gap-3 text-[15px] leading-snug">
            <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold text-on-pop ${["bg-lime", "bg-sky", "bg-coral", "bg-tangerine", "bg-lime", "bg-sky"][i]}`}>
              {i + 1}
            </span>
            {t(`community.agree.${k}`)}
          </li>
        ))}
      </ul>
      <Link href="/community/guidelines/" target="_blank" className="mt-4 inline-block text-sm font-bold text-violet-text underline underline-offset-2">
        {t("community.agree.read")}
      </Link>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-line-strong p-3.5 text-[15px] has-[:checked]:border-violet has-[:checked]:bg-violet/5">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 size-4 accent-[var(--violet)]" />
        <span>
          {t("community.agree.check")}{" "}
          <Link href="/terms/" target="_blank" className="font-semibold text-violet-text underline underline-offset-2">
            {t("legal.terms")}
          </Link>
        </span>
      </label>
      {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>
          {t("community.cancel")}
        </button>
        <button className="btn btn-primary" disabled={!checked || busy} onClick={agree}>
          <ShieldCheck size={16} /> {t("community.agree.button")}
        </button>
      </div>
    </Dialog>
  );
}

export function ReportDialog({ threadId, replyId, onClose }: { threadId: string; replyId: string | null; onClose: () => void }) {
  const t = useT();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");
  const send = async () => {
    if (!reason) return;
    setState("busy");
    setError("");
    try {
      await community.report(threadId, replyId, reason, note);
      setState("sent");
    } catch (e) {
      setError(problemText(t, e));
      setState("idle");
    }
  };
  return (
    <Dialog title={t("community.reportDialog.title")} onClose={onClose}>
      {state === "sent" ? (
        <>
          <p className="mt-4 flex items-center gap-2 text-[15px]">
            <span className="grid size-7 place-items-center rounded-full bg-lime text-on-pop">
              <Check size={15} />
            </span>
            {t("community.reportDialog.sent")}
          </p>
          <div className="mt-6 flex justify-end">
            <button className="btn btn-primary" onClick={onClose} autoFocus>
              OK
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] text-muted">{t("community.reportDialog.intro")}</p>
          <fieldset className="mt-4 grid gap-1.5">
            <legend className="sr-only">{t("community.mod.reason")}</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[15px] hover:bg-subtle has-[:checked]:bg-violet/10 has-[:checked]:font-semibold">
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--violet)]" />
                {t(`community.reason.${r}`)}
              </label>
            ))}
          </fieldset>
          <label htmlFor="report-note" className="mt-4 block text-sm font-bold">
            {t("community.reportDialog.note")}
          </label>
          <textarea id="report-note" data-private className="field mt-1.5 w-full !text-[16px]" rows={3} maxLength={LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={onClose}>
              {t("community.cancel")}
            </button>
            <button className="btn btn-primary" disabled={!reason || state === "busy"} onClick={send}>
              {t("community.reportDialog.send")}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

/** Admins: close/remove a thread or remove a reply, with the guideline it breaks and an optional note. */
export function ModerateDialog({ action, threadId, replyId, onDone, onClose }: { action: Extract<ModAction, "close" | "remove" | "remove_reply">; threadId: string; replyId: string | null; onDone: () => void; onClose: () => void }) {
  const t = useT();
  const [reason, setReason] = useState<ModReason>("other");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = action === "close" ? t("community.mod.close") : action === "remove" ? t("community.mod.remove") : t("community.mod.removeReply");
  const apply = async () => {
    setBusy(true);
    setError("");
    try {
      await community.moderate(action, threadId, replyId, reason, note);
      onDone();
    } catch (e) {
      setError(problemText(t, e));
      setBusy(false);
    }
  };
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="mt-4">
        <Select label={t("community.mod.reason")} labelClassName="text-sm font-bold" value={reason} onChange={(v) => setReason(v as ModReason)} options={MOD_REASONS.map((r) => ({ value: r, label: t(`community.reason.${r}`) }))} />
      </div>
      {action !== "remove_reply" && (
        <>
          <label htmlFor="mod-note" className="mt-4 block text-sm font-bold">
            {t("community.mod.note")}
          </label>
          <textarea id="mod-note" className="field mt-1.5 w-full !text-[16px]" rows={3} maxLength={LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} />
        </>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>
          {t("community.cancel")}
        </button>
        <button className={`btn ${action === "close" ? "btn-primary" : "btn-danger"}`} disabled={busy} onClick={apply}>
          {t("community.mod.apply")}
        </button>
      </div>
    </Dialog>
  );
}

/** Admins: stop a writer posting for a while (reading stays open), or let them post again. */
export function BanDialog({ userId, name, lift, onDone, onClose }: { userId: string; name: string; lift: boolean; onDone: () => void; onClose: () => void }) {
  const t = useT();
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const apply = async () => {
    setBusy(true);
    setError("");
    try {
      await community.ban(userId, lift ? 0 : days === "forever" ? null : Number(days), reason);
      onDone();
    } catch (e) {
      setError(problemText(t, e));
      setBusy(false);
    }
  };
  return (
    <Dialog title={lift ? t("community.mod.unban") : t("community.mod.ban")} onClose={onClose}>
      <p className="mt-2 text-[15px] font-semibold" data-private>
        {name}
      </p>
      {!lift && (
        <>
          <div className="mt-4">
            <Select
              label={t("community.mod.days")}
              labelClassName="text-sm font-bold"
              value={days}
              onChange={setDays}
              options={[
                { value: "1", label: t("community.mod.day1") },
                { value: "7", label: t("community.mod.day7") },
                { value: "30", label: t("community.mod.day30") },
                { value: "forever", label: t("community.mod.forever") },
              ]}
            />
          </div>
          <label htmlFor="ban-reason" className="mt-4 block text-sm font-bold">
            {t("community.mod.banReason")}
          </label>
          <input id="ban-reason" className="field mt-1.5 w-full !text-[16px]" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>
          {t("community.cancel")}
        </button>
        <button className={`btn ${lift ? "btn-primary" : "btn-danger"}`} disabled={busy} onClick={apply}>
          {t("community.mod.apply")}
        </button>
      </div>
    </Dialog>
  );
}
