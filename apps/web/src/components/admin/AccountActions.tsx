"use client";
import { useState } from "react";
import { Ban, ShieldOff, Trash2 } from "lucide-react";
import { useT } from "@/i18n/react";
import { BLOCK_FOREVER, admin, type AdminAction, type AdminUser } from "@/lib/admin";
import { Select } from "@/components/ui/Select";

const DAY_CHOICES = [1, 3, 7, 30, 90, 365];

/** Until when, in words: a date, or "for good" for the 100-year block. */
function untilText(t: ReturnType<typeof useT>, until: string) {
  const d = new Date(until);
  if (d.getTime() - Date.now() > 50 * 365 * 864e5) return t("admin.account.forGood");
  return t("admin.account.until", { date: d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) });
}

/**
 * /admin/ → Writers → one writer → Account: block sign-in for some days or for good, unblock, or
 * delete the account and everything in it. The litma-admin function does the work and logs it
 * (admin_actions); admins can't be blocked or deleted here.
 */
export function AccountActions({
  user: u,
  bannedUntil,
  actions,
  onChange,
}: {
  user: AdminUser;
  bannedUntil: string | null;
  actions: AdminAction[];
  onChange: (patch: Partial<AdminUser> | null) => void;
}) {
  const t = useT();
  const [days, setDays] = useState("7");
  const [custom, setCustom] = useState("14");
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState<string | null>(bannedUntil);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState(actions);
  const blocked = !!until && new Date(until) > new Date();
  const expect = u.email ?? u.id;

  if (u.is_admin) return <p className="text-sm text-muted">{t("admin.account.isAdmin")}</p>;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const block = () =>
    act(async () => {
      const n = days === "forever" ? BLOCK_FOREVER : days === "custom" ? Math.round(Number(custom)) : Number(days);
      if (!(n >= 1 && n <= BLOCK_FOREVER)) throw new Error(t("admin.account.badDays"));
      const end = await admin.block(u.id, n, reason);
      setUntil(end);
      onChange({ banned_until: end });
      setLog((l) => [{ created_at: new Date().toISOString(), action: "block", days: n, reason: reason || null }, ...l]);
      setReason("");
    });

  const unblock = () =>
    act(async () => {
      await admin.unblock(u.id);
      setUntil(null);
      onChange({ banned_until: null });
      setLog((l) => [{ created_at: new Date().toISOString(), action: "unblock", days: null, reason: null }, ...l]);
    });

  const remove = () =>
    act(async () => {
      await admin.remove(u.id, typed.trim(), reason);
      onChange(null);
    });

  return (
    <div className="space-y-4">
      <p className={`rounded-[10px] px-3 py-2 text-sm ${blocked ? "bg-danger-soft text-danger" : "bg-subtle text-muted"}`}>
        {blocked ? `${t("admin.account.blocked")} ${untilText(t, until!)}` : t("admin.account.active")}
      </p>

      <label className="block text-sm">
        <span className="text-xs text-muted">{t("admin.account.reason")}</span>
        <input className="field mt-1 w-full" value={reason} maxLength={500} placeholder={t("admin.account.reasonHint")} onChange={(e) => setReason(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <span className="mb-1 block text-xs text-muted">{t("admin.account.blockFor")}</span>
          <Select
            size="sm"
            aria-label={t("admin.account.blockFor")}
            value={days}
            onChange={setDays}
            options={[
              ...DAY_CHOICES.map((d) => ({ value: String(d), label: t("admin.account.days", { count: d }) })),
              { value: "custom", label: t("admin.account.custom") },
              { value: "forever", label: t("admin.account.forGood") },
            ]}
          />
        </div>
        {days === "custom" && (
          <input
            className="field w-24 !py-1.5"
            type="number"
            min={1}
            max={BLOCK_FOREVER}
            value={custom}
            aria-label={t("admin.account.daysLabel")}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}
        <button type="button" className="btn btn-outline !py-1.5 !text-sm" disabled={busy} onClick={block}>
          <Ban size={14} aria-hidden /> {blocked ? t("admin.account.changeBlock") : t("admin.account.block")}
        </button>
        {blocked && (
          <button type="button" className="btn btn-ghost !py-1.5 !text-sm" disabled={busy} onClick={unblock}>
            <ShieldOff size={14} aria-hidden /> {t("admin.account.unblock")}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">{t("admin.account.blockHint")}</p>

      <div className="border-t border-line pt-4">
        {!deleting ? (
          <button type="button" className="btn btn-danger !py-1.5 !text-sm" disabled={busy} onClick={() => setDeleting(true)}>
            <Trash2 size={14} aria-hidden /> {t("admin.account.delete")}
          </button>
        ) : (
          <div className="space-y-2.5 rounded-[12px] border border-line p-3">
            <p className="text-sm">{t("admin.account.deleteWarning")}</p>
            <label className="block text-sm">
              <span className="text-xs text-muted">{t("admin.account.typeToConfirm", { value: expect })}</span>
              <input className="field mt-1 w-full" value={typed} autoComplete="off" spellCheck={false} onChange={(e) => setTyped(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn btn-danger !py-1.5 !text-sm" disabled={busy || typed.trim().toLowerCase() !== expect.toLowerCase()} onClick={remove}>
                <Trash2 size={14} aria-hidden /> {t("admin.account.deleteForGood")}
              </button>
              <button type="button" className="btn btn-ghost !py-1.5 !text-sm" disabled={busy} onClick={() => setDeleting(false)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {log.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs text-muted">{t("admin.account.history")}</p>
          <ul className="space-y-1 text-xs">
            {log.map((a, i) => (
              <li key={i} className="flex gap-2">
                <time className="shrink-0 tabular-nums text-muted">{new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</time>
                <span>
                  {t(`admin.account.log.${a.action}`)}
                  {a.action === "block" && a.days && <> · {a.days >= BLOCK_FOREVER ? t("admin.account.forGood") : t("admin.account.days", { count: a.days })}</>}
                  {a.reason && <span className="text-muted"> · {a.reason}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
