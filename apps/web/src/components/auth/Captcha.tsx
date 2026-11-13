"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useT } from "@/i18n/react";
import { BASE } from "@/lib/config";
import { desktop } from "@/lib/desktop";
import { SITE } from "@/lib/seo";

/**
 * The human check (Cloudflare Turnstile) for sign-up, sign-in and password reset.
 *
 * Writers only see it when Supabase asks for it: `run(fn)` first calls `fn()` without a token; if
 * Supabase answers that a captcha is needed (CAPTCHA switched on in Supabase Auth), the check opens
 * in a small dialog, and `fn(token)` runs again with the token. So nothing changes until the owner
 * turns CAPTCHA on, and the apps need no setting of their own. The check itself is the page
 * getlitma.in/captcha/ in an iframe (Turnstile only runs on the site's own address; the desktop
 * app lives at app://litma).
 */
export function isCaptchaError(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return !!err && (err.code === "captcha_failed" || /captcha/i.test(err.message ?? ""));
}

type Result = { error: unknown };

export function useCaptcha(): [React.ReactNode, <R extends Result>(fn: (token?: string) => Promise<R>) => Promise<R>] {
  const [open, setOpen] = useState(false);
  const waiting = useRef<((token: string | null) => void) | null>(null);

  const finish = useCallback((token: string | null) => {
    waiting.current?.(token);
    waiting.current = null;
    setOpen(false);
  }, []);

  const run = useCallback(async <R extends Result>(fn: (token?: string) => Promise<R>): Promise<R> => {
    const first = await fn();
    if (!isCaptchaError(first.error)) return first;
    const token = await new Promise<string | null>((res) => {
      waiting.current = res;
      setOpen(true);
    });
    if (!token) return first;
    return fn(token);
  }, []);

  return [open ? <CaptchaDialog onDone={finish} /> : null, run];
}

function captchaUrl(lang: string) {
  const base = desktop() ? SITE : BASE;
  return `${base}/captcha/?lang=${lang === "ml" ? "ml" : "en"}`;
}

function CaptchaDialog({ onDone }: { onDone: (token: string | null) => void }) {
  const t = useT();
  const [error, setError] = useState(false);
  const [src] = useState(() => captchaUrl(typeof document !== "undefined" ? document.documentElement.lang : "en"));
  useEffect(() => {
    const origin = new URL(src, location.href).origin;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== origin || e.data?.type !== "litma-captcha") return;
      if (e.data.token) onDone(e.data.token);
      else setError(true);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("message", onMsg);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone, src]);

  return (
    <div className="fade-in fixed inset-0 z-[80] flex items-end justify-center scrim sm:items-center sm:p-6" onClick={() => onDone(null)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="captcha-title"
        className="pop-in w-full rounded-t-2xl dialog p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="captcha-title" className="font-semibold">
              {t("auth.captchaTitle")}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{t("auth.captchaHint")}</p>
          </div>
          <button type="button" className="btn btn-ghost !p-1.5" aria-label={t("common.close")} onClick={() => onDone(null)}>
            <X size={16} />
          </button>
        </div>
        <iframe title={t("auth.captchaTitle")} src={src} className="mt-4 h-[90px] w-full rounded-lg border-0" />
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {t("auth.captchaFailed")}
          </p>
        )}
      </div>
    </div>
  );
}
