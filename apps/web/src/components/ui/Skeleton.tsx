"use client";
import { useT } from "@/i18n/react";
import type { MessageKey } from "@litma/i18n";

/**
 * Loading vocabulary for Litma.
 *  - <Skeleton>: a paper-toned block with a slow shimmer, shaped like the content that is coming.
 *  - <InkLoader>: the full-screen brand loader; a nib writes a line under ലിറ്റ്മ (used while a page or work opens).
 *  - <InkDots>: three dots that fill like ink, for "the assistant is thinking" and other inline waits.
 *  - .ink-spinner (CSS): a tiny ring for buttons.
 * All of them respect prefers-reduced-motion (the global rule stills the animation).
 */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden className={`skeleton block rounded-md ${className}`} style={style} />;
}

/** Screen-reader announcement shared by all skeleton layouts. */
function Busy({ label, children, className = "" }: { label: MessageKey; children: React.ReactNode; className?: string }) {
  const t = useT();
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{t(label)}</span>
      {children}
    </div>
  );
}

/** Lines of text of varying length, like a paragraph being set. */
export function SkeletonLines({ lines = 4, className = "" }: { lines?: number; className?: string }) {
  const widths = ["100%", "94%", "97%", "88%", "92%", "70%"];
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: i === lines - 1 ? "58%" : widths[i % widths.length], animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

export function DeskSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Busy label="loading.desk">
      <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:mt-8 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:gap-x-6 sm:gap-y-8">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface p-3.5 sm:p-5" style={{ aspectRatio: "210 / 200" }}>
              <Skeleton className="h-3 w-14" />
              <Skeleton className="mt-3 h-5 w-4/5" />
              <Skeleton className="mt-2 h-5 w-1/2" />
              <SkeletonLines lines={4} className="mt-5" />
            </div>
            <Skeleton className="mx-1 mt-3 h-3 w-28" />
          </li>
        ))}
      </ul>
    </Busy>
  );
}

export function BooksSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Busy label="loading.book">
      <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-7 sm:mt-8 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-x-6">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="fade-in" style={{ animationDelay: `${i * 70}ms` }}>
            <Skeleton className="rounded-sm" style={{ width: 150, height: 150 * (297 / 210) }} />
            <Skeleton className="mt-3 h-4 w-28" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </li>
        ))}
      </ul>
    </Busy>
  );
}

/** The editor while a work opens: top bar, toolbar and an A4 sheet with lines being set. */
export function EditorSkeleton() {
  return (
    <Busy label="loading.work" className="flex h-dvh flex-col bg-canvas">
      <div className="flex items-center gap-3 border-b border-line bg-header px-3 py-2.5">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="flex gap-1.5 overflow-hidden border-b border-line bg-paper px-3 py-2 max-md:hidden">
        {Array.from({ length: 16 }, (_, i) => (
          <Skeleton key={i} className="h-7 rounded-md" style={{ width: i === 3 ? 140 : i === 5 ? 150 : 28 }} />
        ))}
      </div>
      <div className="flex-1 overflow-hidden px-3 pt-6 md:pt-10">
        <div className="sheet-skeleton mx-auto w-full max-w-[210mm] rounded-sm bg-paper px-[8%] py-[9%] shadow-[var(--sheet-shadow)]" style={{ aspectRatio: "210 / 297" }}>
          <InkLine />
          <Skeleton className="mx-auto mt-8 h-7 w-3/5" />
          <Skeleton className="mx-auto mt-3 h-4 w-1/3" />
          <SkeletonLines lines={6} className="mt-12" />
          <SkeletonLines lines={5} className="mt-7" />
        </div>
      </div>
    </Busy>
  );
}

/** Rows for panels and lists (versions, inbox, Story World). */
export function ListSkeleton({ rows = 4, label = "loading.page" as MessageKey }: { rows?: number; label?: MessageKey }) {
  return (
    <Busy label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" style={{ animationDelay: `${i * 70}ms` }} />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5" style={{ width: `${70 - i * 8}%`, animationDelay: `${i * 70}ms` }} />
            <Skeleton className="h-3 w-1/3" style={{ animationDelay: `${i * 70 + 40}ms` }} />
          </div>
        </div>
      ))}
    </Busy>
  );
}

/** Settings and profile: stacked cards with a heading, a field and a button. */
export function FormSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <Busy label="loading.page" className="space-y-5">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="fade-in rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: `${i * 80}ms` }}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-2/3" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </Busy>
  );
}

/** Print/PDF view: page sheets appearing one after another. */
export function PagesSkeleton({ pages = 2 }: { pages?: number }) {
  return (
    <Busy label="loading.book" className="flex flex-col items-center gap-6 py-8">
      {Array.from({ length: pages }, (_, i) => (
        <div key={i} className="fade-in w-[min(210mm,92vw)] bg-paper p-[8%] shadow-[var(--sheet-shadow)]" style={{ aspectRatio: "210 / 297", animationDelay: `${i * 120}ms` }}>
          <Skeleton className="mx-auto h-6 w-1/2" />
          <SkeletonLines lines={6} className="mt-10" />
          <SkeletonLines lines={6} className="mt-6" />
        </div>
      ))}
    </Busy>
  );
}

/** A nib drawing a hairline: the brand gesture of "writing in progress". */
export function InkLine({ className = "" }: { className?: string }) {
  return (
    <svg className={`ink-line mx-auto block h-3 w-24 text-accent ${className}`} viewBox="0 0 96 12" aria-hidden>
      <path d="M2 8 C 18 2, 30 11, 48 6 S 80 3, 94 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" pathLength={1} />
    </svg>
  );
}

/** Full-screen loader: the wordmark with a line being written under it. */
export function InkLoader({ label = "loading.page" }: { label?: MessageKey }) {
  const t = useT();
  return (
    <div className="grid h-dvh place-items-center bg-canvas" role="status" aria-live="polite" aria-busy="true">
      <div className="fade-in flex flex-col items-center">
        <span className="text-3xl font-semibold tracking-tight brand-text" style={{ fontFamily: "var(--font-display)" }}>
          ലിറ്റ്മ<span className="ink-dot text-accent">.</span>
        </span>
        <InkLine className="mt-1.5" />
        <span className="mt-4 text-sm text-muted">{t(label)}</span>
      </div>
    </div>
  );
}

/** Three dots filling like ink, for inline "working on it" moments. */
export function InkDots({ className = "" }: { className?: string }) {
  return (
    <span className={`ink-dots inline-flex items-center gap-1 ${className}`} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
