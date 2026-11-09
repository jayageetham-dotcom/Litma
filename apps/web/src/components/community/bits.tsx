"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { useI18n, useT } from "@/i18n/react";
import { AvatarArt, AVATAR_TINTS, isAvatarImage, tintFor, type AvatarTint } from "@/components/art/Avatars";
import { toMalayalam } from "@/components/ScriptField";
import type { Author, Category, CommunityProblem, Tint } from "@/lib/community";
import { CommunityError, categoryTint } from "@/lib/community";

/** Static class names per tint (Tailwind only sees whole strings). */
export const DOT: Record<Tint, string> = { violet: "bg-violet", coral: "bg-coral", sky: "bg-sky", lime: "bg-lime", tangerine: "bg-tangerine" };
export const SOFT: Record<Tint, string> = {
  violet: "bg-violet/15",
  coral: "bg-coral/15",
  sky: "bg-sky/25",
  lime: "bg-lime/35",
  tangerine: "bg-tangerine/20",
};

export const display = { fontFamily: "var(--font-display)" };

export function CategoryChip({ category, className = "" }: { category: Category; className?: string }) {
  const t = useT();
  const tint = categoryTint(category);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-ink ${SOFT[tint]} ${className}`}>
      <span aria-hidden className={`size-2 rounded-full ${DOT[tint]}`} />
      {t(`community.cat.${category}`)}
    </span>
  );
}

export function AuthorAvatar({ author, size = 36 }: { author: Pick<Author, "author_name" | "author_avatar" | "author_tint">; size?: number }) {
  const tint = AVATAR_TINTS.includes(author.author_tint as AvatarTint) ? (author.author_tint as AvatarTint) : tintFor(author.author_name);
  return <AvatarArt id={isAvatarImage(author.author_avatar) ? author.author_avatar : null} name={author.author_name} tint={tint} size={size} />;
}

/** "3 hours ago" in the interface language. */
export function useAgo() {
  const { locale } = useI18n();
  return (iso: string) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (s < 60) return rtf.format(0, "second");
    if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
    if (s < 86400) return rtf.format(-Math.floor(s / 3600), "hour");
    if (s < 86400 * 30) return rtf.format(-Math.floor(s / 86400), "day");
    return new Date(iso).toLocaleDateString(locale === "ml" ? "ml-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
}

/** A post's text: paragraphs kept, web links clickable (marked as user content, never followed by search engines). */
export function PostBody({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/g);
  return (
    <div className={`whitespace-pre-wrap break-words text-[15.5px] leading-relaxed text-ink ${className}`} data-private>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="nofollow ugc noopener noreferrer" className="font-semibold text-violet-text underline underline-offset-2 [overflow-wrap:anywhere]">
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </div>
  );
}

export function problemText(t: ReturnType<typeof useT>, e: unknown) {
  const p: CommunityProblem = e instanceof CommunityError ? e.problem : "failed";
  return t(`community.error.${p}`);
}

type Mode = "manglish" | "plain";
const MODE_KEY = "litma:fieldMode:community";
const ENDS_WORD = /[\s.,;:!?)"'\]-]/;

/**
 * A text box for posts that takes Malayalam, Manglish or English. In മലയാളം mode each Manglish word turns
 * into Malayalam when it is finished (space, punctuation, Enter); "As typed" leaves everything alone.
 * Shares its choice across the community's boxes on this device.
 */
export function PostField({
  value,
  onChange,
  label,
  placeholder,
  max,
  rows = 6,
  multiline = true,
  id,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  max: number;
  rows?: number;
  multiline?: boolean;
  id: string;
  autoFocus?: boolean;
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("plain");
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === "manglish" || m === "plain") setMode(m);
    } catch {}
    const sync = () => {
      try {
        const m = localStorage.getItem(MODE_KEY);
        if (m === "manglish" || m === "plain") setMode(m);
      } catch {}
    };
    window.addEventListener("litma:community-mode", sync);
    return () => window.removeEventListener("litma:community-mode", sync);
  }, []);
  useEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });
  const pick = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
    window.dispatchEvent(new Event("litma:community-mode"));
  };
  const change = (next: string, pos: number | null) => {
    if (mode === "manglish" && pos !== null && pos > 0 && next.length > value.length && ENDS_WORD.test(next[pos - 1])) {
      const before = next.slice(0, pos - 1);
      const m = before.match(/[A-Za-z~_^]+$/);
      if (m) {
        const word = toMalayalam(m[0]);
        const head = before.slice(0, before.length - m[0].length) + word;
        next = head + next.slice(pos - 1);
        caret.current = head.length + 1;
      }
    }
    onChange(next.slice(0, max));
  };
  const common = {
    id,
    ref,
    value,
    placeholder,
    autoFocus,
    "data-private": true,
    className: "field w-full !text-[16px]",
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => change(e.target.value, e.target.selectionStart),
    onBlur: () => {
      if (mode === "manglish" && /[A-Za-z]+$/.test(value)) {
        const m = value.match(/[A-Za-z~_^]+$/)!;
        onChange(value.slice(0, value.length - m[0].length) + toMalayalam(m[0]));
      }
    },
  };
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={id} className="text-sm font-bold">
          {label}
        </label>
        <div role="radiogroup" aria-label={t("community.script.hint")} title={t("community.script.hint")} className="inline-flex rounded-full border border-line-strong p-0.5 text-xs font-semibold">
          {(["manglish", "plain"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => pick(m)} className={`rounded-full px-2.5 py-1 transition ${mode === m ? "bg-ink text-canvas" : "text-muted hover:text-ink"}`} style={m === "manglish" ? display : undefined}>
              {t(`community.script.${m}`)}
            </button>
          ))}
        </div>
      </div>
      {multiline ? <textarea {...common} rows={rows} /> : <input {...common} type="text" />}
      <p className="mt-1 text-right text-xs tabular-nums text-muted">{t("community.new.count", { n: value.length, max })}</p>
    </div>
  );
}

/** A centred dialog on larger screens, a bottom sheet on phones (same look as useConfirm). */
export function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      html.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fade-in fixed inset-0 z-[70] flex items-end justify-center scrim sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`sheet-up dialog max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:rounded-[1.75rem] ${wide ? "sm:max-w-xl" : "sm:max-w-md"}`}>
        <h2 className="text-xl font-extrabold" style={{ fontFamily: "var(--font-landing)" }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
