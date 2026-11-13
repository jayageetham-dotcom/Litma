"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The human check before sign-in, sign-up and password reset (Cloudflare Turnstile, which Supabase
 * Auth verifies). It lives on getlitma.in because Turnstile only runs on the site's own address:
 * the website and the desktop app show it in an iframe (components/auth/Captcha.tsx), the phone app
 * in a web view (lib/features/auth/captcha.dart). The token goes back by postMessage, or through the
 * phone's `LitmaCaptcha` channel. Only Litma's own pages may frame it (frame-ancestors in .htaccess).
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type Turnstile = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
    onLitmaTurnstile?: () => void;
    LitmaCaptcha?: { postMessage: (s: string) => void };
  }
}

function send(msg: { type: "litma-captcha"; token?: string; error?: string }) {
  if (window.LitmaCaptcha) window.LitmaCaptcha.postMessage(JSON.stringify(msg));
  if (window.parent !== window) window.parent.postMessage(msg, "*");
}

export default function CaptchaPage() {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!SITE_KEY) {
      send({ type: "litma-captcha", error: "not-configured" });
      return;
    }
    const lang = new URLSearchParams(location.search).get("lang") === "ml" ? "ml" : "en";
    const render = () => {
      if (!box.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        language: lang,
        theme: "light",
        callback: (token: string) => send({ type: "litma-captcha", token }),
        "error-callback": () => {
          setFailed(true);
          send({ type: "litma-captcha", error: "failed" });
        },
        "expired-callback": () => window.turnstile?.reset(widget.current ?? undefined),
      });
    };
    window.onLitmaTurnstile = render;
    if (window.turnstile) render();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onLitmaTurnstile";
      s.async = true;
      s.onerror = () => {
        setFailed(true);
        send({ type: "litma-captcha", error: "unreachable" });
      };
      document.head.appendChild(s);
    }
    // the app asks for a fresh token after using one (each token works once)
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "litma-captcha-reset") {
        setFailed(false);
        window.turnstile?.reset(widget.current ?? undefined);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <main className="landing grid min-h-[90px] place-items-center bg-transparent p-1" style={{ background: "transparent" }}>
      <div ref={box} />
      {failed && <p className="mt-2 text-center text-xs text-muted">The check couldn&apos;t finish. Check your connection and try again.</p>}
    </main>
  );
}
