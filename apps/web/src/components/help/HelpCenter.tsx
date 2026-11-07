"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookA,
  ChevronRight,
  Keyboard,
  LifeBuoy,
  Mail,
  MonitorSmartphone,
  PenLine,
  Rocket,
  Search,
  Settings,
  Share2,
  Sparkles,
  LayoutTemplate,
  Map as MapIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import { ColourField, LandingFooter, LandingNav } from "@/components/landing/LandingChrome";
import type { HelpArticle, HelpCategory, HelpData } from "@/lib/help-types";

const ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  keyboard: Keyboard,
  "pen-line": PenLine,
  "layout-template": LayoutTemplate,
  map: MapIcon,
  "book-a": BookA,
  "book-open": BookOpen,
  "share-2": Share2,
  sparkles: Sparkles,
  "monitor-smartphone": MonitorSmartphone,
  settings: Settings,
};

/** Fill and text colours for each tint, from the home page's palette. */
const FILL: Record<string, string> = {
  violet: "bg-violet text-night-ink",
  coral: "bg-coral text-on-pop",
  sky: "bg-sky text-on-pop",
  lime: "bg-lime text-on-pop",
  tangerine: "bg-tangerine text-on-pop",
};
/** A faint wash of the tint for large areas behind dark text. */
const WASH: Record<string, string> = {
  violet: "[--wash:var(--violet)]",
  coral: "[--wash:var(--coral)]",
  sky: "[--wash:var(--sky)]",
  lime: "[--wash:var(--lime)]",
  tangerine: "[--wash:var(--tangerine)]",
};

/** Articles offered as quick starts under the search box. */
const POPULAR = ["first-work", "manglish", "cover-designer", "offline", "desktop-app"];

const SUPPORT = "support@getlitma.in";
const ml = { fontFamily: "var(--font-display)" };

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const I = ICONS[name] ?? BookOpen;
  return <I size={size} aria-hidden />;
}

function Tile({ c, size = "md" }: { c: HelpCategory; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "size-16 rounded-[1.25rem]" : size === "sm" ? "size-8 rounded-[10px]" : "size-12 rounded-2xl";
  return (
    <span className={`relative grid shrink-0 place-items-center ${box} ${FILL[c.tint] ?? FILL.violet}`}>
      <Icon name={c.icon} size={size === "lg" ? 28 : size === "sm" ? 16 : 22} />
    </span>
  );
}

/** Words of the query, lower-cased; Malayalam is kept as typed. */
const words = (q: string) =>
  q
    .toLowerCase()
    .split(/[\s,.;:!?()“”"']+/)
    .filter((w) => w.length > 1);

function search(data: HelpData, q: string): HelpArticle[] {
  const ws = words(q);
  if (!ws.length) return [];
  const scored: { a: HelpArticle; s: number }[] = [];
  for (const c of data.categories)
    for (const a of c.articles) {
      const title = a.title.toLowerCase();
      const lead = a.lead.toLowerCase();
      const text = a.text.toLowerCase();
      let s = 0;
      for (const w of ws) {
        const t = (title.includes(w) ? 6 : 0) + (lead.includes(w) ? 3 : 0) + (text.includes(w) ? 1 : 0) + (c.title.toLowerCase().includes(w) ? 1 : 0);
        if (!t) {
          s = 0;
          break;
        }
        s += t;
      }
      if (s) scored.push({ a, s });
    }
  return scored.sort((x, y) => y.s - x.s).map((x) => x.a);
}

export function HelpCenter({ data }: { data: HelpData }) {
  const params = useSearchParams();
  const router = useRouter();
  const aId = params.get("a");
  const cId = params.get("c");
  const all = useMemo(() => data.categories.flatMap((c) => c.articles), [data]);
  const article = aId ? all.find((a) => a.id === aId) ?? null : null;
  const category = data.categories.find((c) => c.id === (article?.category ?? cId)) ?? null;

  // a new view starts at the top; "On this page" links jump inside the article
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) document.getElementById(hash)?.scrollIntoView();
    else window.scrollTo({ top: 0 });
  }, [aId, cId]);
  useEffect(() => {
    document.title = article ? `${article.title} · Litma Help` : category ? `${category.title} · Litma Help` : "Help and guides · Litma";
  }, [article, category]);

  const go = (href: string) => router.push(href, { scroll: false });

  return (
    <div className="landing min-h-dvh overflow-x-clip bg-mist">
      <LandingNav />
      <main>
        {article && category ? (
          <ArticleView data={data} category={category} article={article} go={go} />
        ) : category ? (
          <CategoryView data={data} category={category} go={go} />
        ) : (
          <HomeView data={data} go={go} />
        )}
        <StillStuck />
      </main>
      <LandingFooter />
    </div>
  );
}

/** Search box with live results; `big` on the help home page. */
function SearchBox({ data, go, big = false }: { data: HelpData; go: (href: string) => void; big?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const results = useMemo(() => search(data, q).slice(0, 8), [data, q]);
  const cat = (a: HelpArticle) => data.categories.find((c) => c.id === a.category)!;

  useEffect(() => {
    // "/" jumps to the search box, like most help sites
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    const out = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", k);
    document.addEventListener("mousedown", out);
    return () => {
      window.removeEventListener("keydown", k);
      document.removeEventListener("mousedown", out);
    };
  }, []);

  const pick = (a: HelpArticle) => {
    setOpen(false);
    setQ("");
    go(`/help/?a=${a.id}`);
  };

  return (
    <div ref={box} className={`relative w-full ${big ? "max-w-2xl" : "max-w-md"}`} role="search">
      <label className={`flex items-center gap-3 rounded-full border border-line-strong bg-surface shadow-[var(--pop-chip-shadow)] focus-within:border-violet focus-within:ring-4 focus-within:ring-violet/20 ${big ? "px-6 py-4" : "px-4 py-2.5"}`}>
        <Search size={big ? 22 : 18} className="shrink-0 text-muted" aria-hidden />
        <span className="sr-only">Search the help</span>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setSel(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && results[sel]) pick(results[sel]);
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={big ? "Search: Manglish, cover, PDF, offline…" : "Search the help"}
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted ${big ? "!text-lg" : "!text-[15px]"}`}
          role="combobox"
          aria-expanded={open && q.length > 1}
          aria-controls="help-results"
          aria-autocomplete="list"
          data-private
        />
        {q ? (
          <button type="button" onClick={() => setQ("")} className="grid size-7 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink" aria-label="Clear search">
            <X size={16} />
          </button>
        ) : (
          <kbd className="hidden rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted sm:inline">/</kbd>
        )}
      </label>
      {open && q.trim().length > 1 && (
        <div id="help-results" role="listbox" className="pop-in absolute inset-x-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-3xl border border-line bg-surface p-1.5 text-left shadow-[var(--pop-lift-shadow)]">
          {results.length ? (
            results.map((a, i) => (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={i === sel}
                onMouseEnter={() => setSel(i)}
                onClick={() => pick(a)}
                className={`mt-0.5 flex w-full items-start gap-3 rounded-[14px] px-3 py-2.5 text-left ${i === sel ? "bg-subtle" : ""}`}
              >
                <Tile c={cat(a)} size="sm" />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{a.title}</span>
                  <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{a.lead}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-muted">
              Nothing matches “{q}”. Try another word, or write to{" "}
              <a className="font-semibold text-violet-text underline" href={`mailto:${SUPPORT}`}>
                {SUPPORT}
              </a>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function HomeView({ data, go }: { data: HelpData; go: (href: string) => void }) {
  const all = data.categories.flatMap((c) => c.articles);
  const count = all.length;
  const popular = POPULAR.map((id) => all.find((a) => a.id === id)).filter(Boolean) as HelpArticle[];
  return (
    <>
      <section className="relative pb-20 pt-32 text-center md:pb-24 md:pt-44">
        <ColourField />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-5 md:px-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/90 py-1.5 pl-1.5 pr-4 text-xs font-bold uppercase tracking-[0.16em] text-muted">
            <span className="grid size-6 place-items-center rounded-full bg-lime text-on-pop">
              <LifeBuoy size={13} aria-hidden />
            </span>
            Litma Help · സഹായം
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl text-[2.6rem] font-extrabold leading-[1.1] tracking-tight md:text-7xl" style={ml}>
            എന്തു സഹായമാണ് വേണ്ടത്?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted md:text-xl">
            Step-by-step guides with pictures for Litma on the web, on your computer and on your phone.
          </p>
          <div className="mt-9 flex w-full justify-center">
            <SearchBox data={data} go={go} big />
          </div>
          {popular.length > 0 && (
            <div className="mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-sm">
              <span className="font-semibold text-muted">Popular:</span>
              {popular.map((a) => (
                <Link key={a.id} href={`/help/?a=${a.id}`} scroll={false} className="rounded-full border border-line bg-surface/90 px-3.5 py-1.5 font-semibold transition hover:-translate-y-0.5 hover:border-violet hover:text-violet-text">
                  {a.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-surface py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-violet-text">Browse by topic</p>
              <h2 className="text-3xl font-extrabold leading-tight md:text-5xl" style={ml}>
                വിഷയങ്ങൾ. <span className="text-ink/40">{count} guides in {data.categories.length} topics.</span>
              </h2>
            </div>
          </div>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.categories.map((c) => (
              <CategoryCard key={c.id} c={c} />
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function CategoryCard({ c }: { c: HelpCategory }) {
  const first = c.articles.slice(0, 3);
  return (
    <li className={`group relative flex flex-col overflow-hidden rounded-[2rem] border border-line bg-surface p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--pop-lift-shadow)] ${WASH[c.tint] ?? WASH.violet}`}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color-mix(in_srgb,var(--wash)_22%,transparent)] blur-2xl transition group-hover:scale-125" />
      <Link href={`/help/?c=${c.id}`} scroll={false} className="relative flex items-start gap-4 after:absolute after:inset-0 after:content-['']">
        <Tile c={c} />
        <span className="min-w-0 pt-0.5">
          <span className="block text-xl font-extrabold leading-tight">{c.title}</span>
          <span className="mt-0.5 block text-sm font-semibold text-muted" style={ml}>
            {c.ml}
          </span>
        </span>
      </Link>
      <p className="relative mt-4 text-[15px] leading-relaxed text-muted">{c.summary}</p>
      <ul className="relative z-10 mt-4 space-y-1">
        {first.map((a) => (
          <li key={a.id}>
            <Link href={`/help/?a=${a.id}`} scroll={false} className="-mx-2 flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[15px] font-medium hover:bg-subtle">
              <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden />
              <span className="truncate">{a.title}</span>
            </Link>
          </li>
        ))}
      </ul>
      <span className="relative mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-bold text-violet-text">
        {c.articles.length === 1 ? "1 guide" : `All ${c.articles.length} guides`} <ArrowRight size={15} className="transition group-hover:translate-x-1" aria-hidden />
      </span>
    </li>
  );
}

/** Topics down the side on wide screens; a row of chips on phones. */
function TopicNav({ data, current }: { data: HelpData; current: string }) {
  return (
    <>
      <nav aria-label="Help topics" className="hidden lg:block">
        <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.16em] text-muted">Topics</p>
        <ul className="space-y-0.5">
          {data.categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/help/?c=${c.id}`}
                scroll={false}
                aria-current={c.id === current ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-sm font-semibold transition ${c.id === current ? "bg-surface text-ink shadow-sm" : "text-muted hover:bg-surface/70 hover:text-ink"}`}
              >
                <Tile c={c} size="sm" />
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Help topics" className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1 lg:hidden">
        {data.categories.map((c) => (
          <Link
            key={c.id}
            href={`/help/?c=${c.id}`}
            scroll={false}
            aria-current={c.id === current ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${c.id === current ? "border-night bg-night text-night-ink" : "border-line bg-surface"}`}
          >
            {c.title}
          </Link>
        ))}
      </nav>
    </>
  );
}

function PageTop({ data, go, children }: { data: HelpData; go: (href: string) => void; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden pb-10 pt-28 md:pt-36">
      <ColourField />
      <div className="relative mx-auto max-w-7xl px-5 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">{children}</div>
          <SearchBox data={data} go={go} />
        </div>
      </div>
    </section>
  );
}

function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-muted">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={14} aria-hidden />}
          {it.href ? (
            <Link href={it.href} scroll={false} className="hover:text-violet-text">
              {it.label}
            </Link>
          ) : (
            <span className="text-ink" aria-current="page">
              {it.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

function CategoryView({ data, category: c, go }: { data: HelpData; category: HelpCategory; go: (href: string) => void }) {
  return (
    <>
      <PageTop data={data} go={go}>
        <Crumbs items={[{ href: "/help/", label: "Help" }, { label: c.title }]} />
      </PageTop>
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-10 px-5 pb-20 md:px-10 lg:grid-cols-[250px_minmax(0,1fr)]">
        <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <TopicNav data={data} current={c.id} />
        </div>
        <div className="min-w-0">
          <div className="flex items-start gap-5">
            <Tile c={c} size="lg" />
            <div className="min-w-0">
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{c.title}</h1>
              <p className="mt-1 text-lg font-semibold text-muted" style={ml}>
                {c.ml}
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{c.intro || c.summary}</p>
          <ol className="mt-10 grid gap-3">
            {c.articles.map((a, i) => (
              <li key={a.id}>
                <Link
                  href={`/help/?a=${a.id}`}
                  scroll={false}
                  className="group flex items-start gap-4 rounded-[1.5rem] border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-violet/40 hover:shadow-[var(--pop-chip-shadow)] md:p-6"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mist font-mono text-sm font-bold text-muted group-hover:bg-lime group-hover:text-on-pop">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold leading-snug">{a.title}</span>
                    <span className="mt-1 block leading-relaxed text-muted">{a.lead}</span>
                  </span>
                  <ArrowRight size={18} className="mt-1.5 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-violet-text" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}

function ArticleView({ data, category: c, article: a, go }: { data: HelpData; category: HelpCategory; article: HelpArticle; go: (href: string) => void }) {
  const i = c.articles.findIndex((x) => x.id === a.id);
  const flat = data.categories.flatMap((x) => x.articles);
  const at = flat.findIndex((x) => x.id === a.id);
  const prev = flat[at - 1];
  const next = flat[at + 1];
  const catOf = (x: HelpArticle) => data.categories.find((k) => k.id === x.category)!;
  const body = useRef<HTMLDivElement>(null);

  // links to other guides inside the text stay on this page (no reload)
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const click = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      const href = link?.getAttribute("href");
      if (!href || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (href.startsWith("/help/")) {
        e.preventDefault();
        go(href);
      }
    };
    el.addEventListener("click", click);
    return () => el.removeEventListener("click", click);
  }, [go]);

  return (
    <>
      <PageTop data={data} go={go}>
        <Crumbs items={[{ href: "/help/", label: "Help" }, { href: `/help/?c=${c.id}`, label: c.title }, { label: a.title }]} />
      </PageTop>
      <div className={`mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-10 px-5 pb-20 md:px-10 lg:grid-cols-[250px_minmax(0,1fr)] ${a.toc.length > 1 ? "xl:grid-cols-[250px_minmax(0,1fr)_210px]" : ""}`}>
        <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <TopicNav data={data} current={c.id} />
          <div className="hidden lg:block">
            <p className="mb-2 mt-8 px-3 text-xs font-bold uppercase tracking-[0.16em] text-muted">In {c.title}</p>
            <ul className="space-y-0.5 border-l-2 border-line pl-2">
              {c.articles.map((x) => (
                <li key={x.id}>
                  <Link
                    href={`/help/?a=${x.id}`}
                    scroll={false}
                    aria-current={x.id === a.id ? "page" : undefined}
                    className={`block rounded-[10px] px-3 py-1.5 text-sm leading-snug ${x.id === a.id ? "bg-surface font-bold text-violet-text shadow-sm" : "text-muted hover:text-ink"}`}
                  >
                    {x.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <article className="min-w-0 max-w-4xl">
          <div className="flex items-center gap-3 text-sm font-semibold text-muted">
            <Tile c={c} size="sm" />
            {c.title} · {i + 1} of {c.articles.length}
          </div>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">{a.title}</h1>
          <div ref={body} className="help-prose mt-8 rounded-[2rem] border border-line bg-surface p-5 md:p-10" dangerouslySetInnerHTML={{ __html: a.html }} />

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {prev ? (
              <Link href={`/help/?a=${prev.id}`} scroll={false} className="group rounded-[1.5rem] border border-line bg-surface p-5 transition hover:border-violet/40 hover:shadow-[var(--pop-chip-shadow)]">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  <ArrowLeft size={14} className="transition group-hover:-translate-x-1" aria-hidden /> Previous · {catOf(prev).title}
                </span>
                <span className="mt-1.5 block font-bold">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={`/help/?a=${next.id}`} scroll={false} className="group rounded-[1.5rem] border border-line bg-surface p-5 text-right transition hover:border-violet/40 hover:shadow-[var(--pop-chip-shadow)]">
                <span className="flex items-center justify-end gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  Next · {catOf(next).title} <ArrowRight size={14} className="transition group-hover:translate-x-1" aria-hidden />
                </span>
                <span className="mt-1.5 block font-bold">{next.title}</span>
              </Link>
            )}
          </div>

          {/* phones: the rest of this topic after the text */}
          <div className="mt-10 lg:hidden">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">More in {c.title}</p>
            <ul className="divide-y divide-line rounded-[1.5rem] border border-line bg-surface">
              {c.articles
                .filter((x) => x.id !== a.id)
                .map((x) => (
                  <li key={x.id}>
                    <Link href={`/help/?a=${x.id}`} scroll={false} className="flex items-center justify-between gap-3 px-5 py-3.5 font-semibold">
                      {x.title} <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </article>

        {a.toc.length > 1 && (
          <nav aria-label="On this page" className="hidden xl:sticky xl:top-28 xl:block xl:self-start">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">On this page</p>
            <ul className="space-y-1 text-sm">
              {a.toc.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} onClick={(e) => (e.preventDefault(), document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" }))} className="block py-0.5 leading-snug text-muted hover:text-violet-text">
                    {h.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </>
  );
}

function StillStuck() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 md:px-10">
      <div className="on-night relative flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-[2rem] bg-night px-6 py-8 sm:px-10">
        <div aria-hidden className="dot-grid absolute inset-0 text-night-ink/[0.06]" />
        <div className="relative flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-on-pop">
            <Mail size={22} aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-extrabold">Still need help?</h2>
            <p className="text-sm text-muted">Write to us in Malayalam or English. Tell us what you tried and which device you use.</p>
          </div>
        </div>
        <a href={`mailto:${SUPPORT}?subject=Litma%20help`} className="btn relative bg-night-ink !px-5 !py-3 text-on-pop hover:bg-lime">
          {SUPPORT} <ArrowRight size={16} aria-hidden />
        </a>
      </div>
    </section>
  );
}
