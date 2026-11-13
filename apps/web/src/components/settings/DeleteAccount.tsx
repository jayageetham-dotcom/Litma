"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useT } from "@/i18n/react";
import { FUNCTIONS_URL, anonHeaders, appUrl } from "@/lib/config";
import { forgetAccount } from "@/lib/offline";
import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Settings → Delete account. Asks the litma-account function to delete the account and everything
 * in it, then forgets this device's copy and signs out. Hidden in local mode (nothing on a server).
 */
export function DeleteAccount() {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!isSupabaseConfigured) return null;
  return (
    <section id="delete-account" className="scroll-mt-24">
      <h2 className="text-xl font-semibold">{t("settings.deleteTitle")}</h2>
      <p className="mt-1 max-w-prose text-sm text-muted">{t("settings.deleteHint")}</p>
      <button className="btn btn-danger mt-3" data-track="Delete my account" onClick={() => setOpen(true)}>
        <Trash2 size={15} aria-hidden /> {t("settings.deleteButton")}
      </button>
      {open && <DeleteDialog onClose={() => setOpen(false)} />}
    </section>
  );
}

function DeleteDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  const remove = async () => {
    setError("");
    if (typeof navigator !== "undefined" && navigator.onLine === false) return setError(t("settings.deleteOffline"));
    const sb = getSupabase();
    if (!sb || !FUNCTIONS_URL) return setError(t("settings.deleteFailed"));
    setBusy(true);
    try {
      const { data } = await sb.auth.getSession();
      const session = data.session;
      if (!session) throw new Error("no session");
      const r = await fetch(`${FUNCTIONS_URL}/litma-account`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}`, ...anonHeaders() },
        body: JSON.stringify({ op: "delete", confirm: "DELETE" }),
      });
      if (!r.ok) throw new Error(String(r.status));
      await forgetAccount(session.user.id);
      await sb.auth.signOut({ scope: "local" }).catch(() => {});
      // a full load, so the signed-out page guard can't send the writer to sign in with ?next=
      window.location.replace(appUrl("/login/?deleted=1"));
    } catch {
      setError(t("settings.deleteFailed"));
      setBusy(false);
    }
  };

  return (
    <div className="fade-in fixed inset-0 z-[70] flex items-end justify-center scrim sm:items-center sm:p-6" onClick={() => !busy && onClose()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="pop-in w-full rounded-t-2xl dialog p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="delete-title" className="text-lg font-semibold">
              {t("settings.deleteConfirmTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted">{t("settings.deleteConfirmBody")}</p>
          </div>
        </div>
        <label className="mt-5 block text-sm font-medium">
          {t("settings.deleteTypeLabel")}
          <input
            ref={input}
            className="field mt-1.5 w-full"
            value={typed}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            data-private
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && typed.trim() === "DELETE" && !busy && remove()}
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-outline" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-danger" disabled={busy || typed.trim() !== "DELETE"} onClick={remove}>
            {busy ? <span className="ink-spinner" aria-hidden /> : <Trash2 size={15} aria-hidden />} {busy ? t("settings.deleteBusy") : t("settings.deleteConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
