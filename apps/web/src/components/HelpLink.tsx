"use client";
import { useEffect, useState } from "react";
import { ExternalLink, LifeBuoy } from "lucide-react";
import { useT } from "@/i18n/react";
import { BASE } from "@/lib/config";
import { desktop } from "@/lib/desktop";
import { SITE } from "@/lib/seo";

/**
 * Where the help guides live. The website opens its own /help/ in a new tab; the desktop app sends the
 * getlitma.in address to the browser (main.ts opens /help links outside the app).
 */
export function useHelpHref(path = "") {
  const [href, setHref] = useState(`${BASE}/help/${path}`);
  useEffect(() => {
    if (desktop()) setHref(`${SITE}/help/${path}`);
  }, [path]);
  return href;
}

/** Settings → Help and guide: a card that opens the help site in the browser. */
export function HelpCard() {
  const t = useT();
  const href = useHelpHref();
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-track="Help and guide"
      className="group flex items-center gap-4 rounded-xl bg-paper p-4 transition hover:-translate-y-0.5"
      style={{ boxShadow: "var(--sheet-shadow)" }}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-subtle text-tint-lime">
        <LifeBuoy size={20} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t("settings.help")}</span>
        <span className="block text-sm text-muted">{t("settings.helpHint")}</span>
      </span>
      <ExternalLink size={16} className="shrink-0 text-muted group-hover:text-accent" aria-hidden />
    </a>
  );
}
