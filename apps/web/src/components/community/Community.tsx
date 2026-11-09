"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpenCheck, Flag, Heart, Lock, MessageCircle, Pin, Plus, Scale, Search, ShieldAlert, UsersRound } from "lucide-react";
import { matchesSearch } from "@litma/shared/search";
import { useT } from "@/i18n/react";
import { useUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Skeleton, SkeletonLines } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Select";
import { ColourField, LandingFooter, LandingNav } from "@/components/landing/LandingChrome";
import { CATEGORIES, LIMITS, PAGE, community, isCategory, isLocalCommunity, type Category, type Me, type QueueItem, type Thread } from "@/lib/community";
import { AuthorAvatar, CategoryChip, DOT, PostField, display, problemText, useAgo } from "./bits";
import { AgreeDialog } from "./Dialogs";
import { BannedNote, ThreadView } from "./ThreadView";

/**
 * /community/: the forum in the public pages' colourful style.
 *   ?c=<category>   one category      ?t=<id>   a conversation
 *   ?new=1          start one          ?view=reports   the moderators' queue
 * Visitors who aren't signed in see what the community is and a way in; the conversations
 * themselves are for signed-in writers only.
 */
export function Community() {
  const t = useT();
  const params = useSearchParams();
  const user = useUser();
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState("");
  const signedIn = !isSupabaseConfigured || !!user;

  const loadMe = useCallback(() => {
    community
      .me()
      .then((m) => (setMe(m), setMeError("")))
      .catch((e) => setMeError(problemText(t, e)));
  }, [t]);
  useEffect(() => {
    if (signedIn) loadMe();
  }, [signedIn, loadMe]);

  const threadId = params.get("t");
  const isNew = params.get("new") === "1";
  const view = params.get("view");
  const c = params.get("c");
  const category = isCategory(c) ? c : null;
  const inner = !!threadId || isNew || view === "reports";

  let body: React.ReactNode;
  if (user === undefined) body = <ListSkeleton />;
  else if (!signedIn) body = <SignInCard />;
  else if (meError) body = <p className="py-16 text-center font-semibold">{meError}</p>;
  else if (!me) body = <ListSkeleton />;
  else if (threadId) body = <ThreadView key={threadId} id={threadId} me={me} onMe={loadMe} />;
  else if (isNew) body = <NewThread me={me} onMe={loadMe} initial={category} />;
  else if (view === "reports" && me.is_admin) body = <ReportsQueue />;
  else body = <ThreadList me={me} category={category} />;

  return (
    <div className="landing min-h-dvh overflow-x-clip bg-mist">
      <LandingNav />
      <main>
        {inner ? (
          <section className="relative px-5 pb-24 pt-28 md:px-10 md:pt-36">{body}</section>
        ) : (
          <>
            <Hero signedIn={signedIn} me={me} />
            <section className="relative mx-auto max-w-7xl px-5 pb-24 pt-6 md:px-10 md:pt-8">{body}</section>
          </>
        )}
        <LegalStrip />
      </main>
      <LandingFooter />
    </div>
  );
}

function Hero({ signedIn, me }: { signedIn: boolean; me: Me | null }) {
  const t = useT();
  return (
    <section className="relative overflow-hidden pb-12 pt-32 md:pb-16 md:pt-44">
      <ColourField fade />
      <div className="relative mx-auto max-w-7xl px-5 md:px-10">
        <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-surface/90 py-1.5 pl-1.5 pr-4 text-xs font-bold text-muted">
          <span className="rounded-full bg-lime px-2.5 py-1 text-on-pop" style={display}>
            {t("community.badge")}
          </span>
          {t("community.eyebrow")}
        </p>
        <h1 className="text-5xl font-extrabold leading-[1.15] tracking-tight text-ink sm:text-6xl md:text-7xl" style={display}>
          {t("community.titleA")}{" "}
          <span className="relative isolate inline-block text-violet-text">
            <span aria-hidden className="absolute inset-x-[-0.08em] bottom-[0.12em] -z-10 h-[0.32em] -rotate-1 rounded-[0.12em] bg-lime" />
            {t("community.titleB")}
          </span>
          <span aria-hidden className="ml-[0.16em] inline-block size-[0.17em] rounded-full bg-coral align-baseline" />
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">{t("community.intro")}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {signedIn && (
            <Link href="/community/?new=1" className="btn btn-primary !px-5 !py-3 text-base">
              <Plus size={18} /> {t("community.start")}
            </Link>
          )}
          <Link href="/community/guidelines/" className="btn btn-outline !px-5 !py-3 text-base">
            <BookOpenCheck size={18} /> {t("community.guidelines")}
          </Link>
          {me?.is_admin && (
            <Link href="/community/?view=reports" className="btn btn-ghost !px-4 !py-3 text-base">
              <ShieldAlert size={18} /> {t("community.mod.reports")}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function SignInCard() {
  const t = useT();
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="on-night relative overflow-hidden rounded-[2rem] bg-night p-8 text-night-ink md:p-10">
        <div aria-hidden className="glow -right-24 -top-24 size-80 [--glow:color-mix(in_srgb,var(--violet)_55%,transparent)]" />
        <UsersRound size={32} className="relative text-lime" />
        <h2 className="relative mt-5 text-3xl font-extrabold" style={{ fontFamily: "var(--font-landing)" }}>
          {t("community.signInTitle")}
        </h2>
        <p className="relative mt-3 max-w-md text-[16px] leading-relaxed text-night-ink/75">{t("community.signInBody")}</p>
        <div className="relative mt-7 flex flex-wrap gap-3">
          <Link href={`/signup/?next=${encodeURIComponent("/community/")}`} className="btn bg-lime !px-5 !py-3 font-bold text-on-pop hover:bg-lime/90">
            {t("community.signUp")} <ArrowRight size={16} />
          </Link>
          <Link href={`/login/?next=${encodeURIComponent("/community/")}`} className="btn btn-outline !border-night-ink/30 !px-5 !py-3 !text-night-ink">
            {t("community.signIn")}
          </Link>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <li key={c.id} className="rounded-[1.5rem] border border-line bg-surface p-5">
            <span aria-hidden className={`block size-3 rounded-full ${DOT[c.tint]}`} />
            <p className="mt-4 text-xl font-extrabold" style={display}>
              {t(`community.catMl.${c.id}`)}
            </p>
            <p className="mt-1 font-bold">{t(`community.cat.${c.id}`)}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t(`community.catHint.${c.id}`)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-[1.5rem] border border-line bg-surface p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-6 w-2/3" />
          <SkeletonLines lines={2} className="mt-3" />
        </div>
      ))}
    </div>
  );
}

function ThreadList({ me, category }: { me: Me; category: Category | null }) {
  const t = useT();
  const ago = useAgo();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    setThreads(null);
    setPage(0);
    community
      .threads(category, 0)
      .then((rows) => {
        if (!live) return;
        setThreads(rows);
        setMore(rows.length === PAGE);
      })
      .catch((e) => live && (setError(problemText(t, e)), setThreads([])));
    return () => {
      live = false;
    };
  }, [category, t]);

  const loadMore = async () => {
    try {
      const rows = await community.threads(category, page + 1);
      setThreads((x) => [...(x ?? []), ...rows.filter((r) => !x?.some((y) => y.id === r.id))]);
      setPage(page + 1);
      setMore(rows.length === PAGE);
    } catch (e) {
      setError(problemText(t, e));
    }
  };

  const shown = useMemo(() => (threads ?? []).filter((th) => !q.trim() || matchesSearch(`${th.title}\n${th.body}\n${th.author_name}`, q)), [threads, q]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-coral-text max-lg:hidden">{t("community.categories")}</p>
        <nav aria-label={t("community.categories")} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:px-0">
          <CatLink href="/community/" on={!category} dot="bg-ink" label={t("community.all")} />
          {CATEGORIES.map((c) => (
            <CatLink key={c.id} href={`/community/?c=${c.id}`} on={category === c.id} dot={DOT[c.tint]} label={t(`community.cat.${c.id}`)} />
          ))}
        </nav>
        {category && <p className="mt-4 text-sm leading-relaxed text-muted max-lg:hidden">{t(`community.catHint.${category}`)}</p>}
        {me.banned_until && (
          <div className="mt-5">
            <BannedNote me={me} />
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t("community.searchLabel")}</span>
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" data-private className="field w-full !rounded-full !pl-11 !text-[16px]" placeholder={t("community.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <Link href={category && category !== "news" ? `/community/?new=1&c=${category}` : "/community/?new=1"} className="btn btn-primary max-lg:!hidden">
            <Plus size={16} /> {t("community.start")}
          </Link>
        </div>

        {error && <p className="mt-4 text-sm font-semibold text-danger">{error}</p>}

        {threads === null ? (
          <div className="mt-5">
            <ListSkeleton />
          </div>
        ) : shown.length === 0 ? (
          <div className="mt-5 rounded-[1.75rem] border border-dashed border-line-strong bg-surface/70 px-6 py-14 text-center">
            <MessageCircle size={30} className="mx-auto text-violet-text" />
            <p className="mt-3 font-semibold">{q.trim() ? t("community.emptySearch", { q }) : t("community.empty")}</p>
            {!q.trim() && (
              <Link href="/community/?new=1" className="btn btn-primary mt-5">
                <Plus size={16} /> {t("community.start")}
              </Link>
            )}
          </div>
        ) : (
          <ul className="mt-5 grid gap-3">
            {shown.map((th) => (
              <li key={th.id}>
                <Link href={`/community/?t=${th.id}`} className="group block rounded-[1.5rem] border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-violet/40 hover:shadow-[var(--pop-chip-shadow)] md:p-6" data-track="Open conversation">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryChip category={th.category} />
                    {th.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet px-2.5 py-1 text-xs font-bold text-night-ink">
                        <Pin size={11} /> {t("community.pinned")}
                      </span>
                    )}
                    {th.status === "closed" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-1 text-xs font-bold">
                        <Lock size={11} /> {t("community.closed")}
                      </span>
                    )}
                    {th.status === "removed" && <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger">{t("community.removed")}</span>}
                  </div>
                  <h3 className="mt-3 break-words text-xl font-extrabold leading-snug group-hover:text-violet-text" style={display} data-private>
                    {th.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 break-words text-[15px] leading-relaxed text-muted" data-private>
                    {th.body}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                      <AuthorAvatar author={th} size={24} />
                      <span className="truncate" data-private>
                        {th.author_name}
                      </span>
                    </span>
                    <time dateTime={th.last_activity_at}>{ago(th.last_activity_at)}</time>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={14} /> {t("community.replies", { count: th.reply_count })}
                    </span>
                    {th.like_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Heart size={14} /> {th.like_count}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {more && threads && (
          <div className="mt-6 text-center">
            <button className="btn btn-outline" onClick={loadMore}>
              {t("community.loadMore")}
            </button>
          </div>
        )}
      </div>

      {/* phones: a floating button, like New work on the desk */}
      <Link href="/community/?new=1" aria-label={t("community.start")} className="btn btn-primary fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-5 z-30 !size-14 !p-0 shadow-[var(--cta-shadow)] lg:!hidden">
        <Plus size={24} />
      </Link>
    </div>
  );
}

function CatLink({ href, on, dot, label }: { href: string; on: boolean; dot: string; label: string }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined} className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition lg:rounded-xl lg:border-transparent lg:px-3 ${on ? "border-ink bg-ink text-canvas lg:bg-ink" : "border-line bg-surface text-muted hover:text-ink lg:bg-transparent lg:hover:bg-surface"}`}>
      <span aria-hidden className={`size-2.5 rounded-full ${dot} ${on ? "ring-2 ring-canvas" : ""}`} />
      {label}
    </Link>
  );
}

function NewThread({ me, onMe, initial }: { me: Me; onMe: () => void; initial: Category | null }) {
  const t = useT();
  const router = useRouter();
  const [category, setCategory] = useState<Category>(initial && (initial !== "news" || me.is_admin) ? initial : "general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreeing, setAgreeing] = useState(false);

  const post = async () => {
    if (title.trim().length < 3 || !body.trim()) return setError(t("community.new.short"));
    setBusy(true);
    setError("");
    try {
      const th = await community.createThread({ category, title, body });
      router.push(`/community/?t=${th.id}`);
    } catch (e) {
      setError(problemText(t, e));
      setBusy(false);
    }
  };
  const submit = () => (me.agreed ? post() : setAgreeing(true));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={initial ? `/community/?c=${initial}` : "/community/"} className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink">
        <ArrowLeft size={16} /> {t("community.back")}
      </Link>
      <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl" style={{ fontFamily: "var(--font-landing)" }}>
        {t("community.new.title")}
      </h1>
      {me.banned_until ? (
        <div className="mt-8">
          <BannedNote me={me} />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 rounded-[1.75rem] border border-line bg-surface p-5 shadow-[var(--pop-chip-shadow)] md:p-8">
          <Select
            label={t("community.new.category")}
            labelClassName="text-sm font-bold"
            value={category}
            onChange={(v) => setCategory(v as Category)}
            options={CATEGORIES.filter((c) => c.id !== "news" || me.is_admin).map((c) => ({ value: c.id, label: t(`community.cat.${c.id}`), hint: t(`community.catHint.${c.id}`) }))}
          />
          <PostField id="new-title" label={t("community.new.subject")} placeholder={t("community.new.subjectPlaceholder")} value={title} onChange={setTitle} max={LIMITS.title} multiline={false} autoFocus />
          <PostField id="new-body" label={t("community.new.body")} placeholder={t("community.new.bodyPlaceholder")} value={body} onChange={setBody} max={LIMITS.thread} rows={10} />
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
            <p className="max-w-md text-sm text-muted">
              {t("community.new.responsible")}{" "}
              <Link href="/community/guidelines/" target="_blank" className="font-semibold text-violet-text underline underline-offset-2">
                {t("community.guidelines")}
              </Link>
            </p>
            <button className="btn btn-primary !px-6" disabled={busy || title.trim().length < 3 || !body.trim()} onClick={submit}>
              {busy ? t("community.posting") : t("community.post")}
            </button>
          </div>
        </div>
      )}
      {agreeing && (
        <AgreeDialog
          onClose={() => setAgreeing(false)}
          onDone={() => {
            setAgreeing(false);
            onMe();
            post();
          }}
        />
      )}
    </div>
  );
}

function ReportsQueue() {
  const t = useT();
  const ago = useAgo();
  const [all, setAll] = useState(false);
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    community
      .queue(all ? "all" : "open")
      .then(setItems)
      .catch((e) => (setError(problemText(t, e)), setItems([])));
  }, [all, t]);
  useEffect(() => {
    load();
  }, [load]);
  const resolve = async (id: string, status: "resolved" | "dismissed" | "open") => {
    try {
      await community.resolve(id, status);
      load();
    } catch (e) {
      setError(problemText(t, e));
    }
  };
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/community/" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink">
        <ArrowLeft size={16} /> {t("community.back")}
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl" style={{ fontFamily: "var(--font-landing)" }}>
          {t("community.mod.queue")}
        </h1>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-[var(--violet)]" />
          {t("community.mod.showAll")}
        </label>
      </div>
      {isLocalCommunity() && <p className="mt-3 text-sm text-muted">{t("community.mod.local")}</p>}
      {error && <p className="mt-4 text-sm font-semibold text-danger">{error}</p>}
      {items === null ? (
        <div className="mt-6">
          <ListSkeleton />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-10 rounded-[1.75rem] border border-dashed border-line-strong bg-surface/70 px-6 py-14 text-center font-semibold">{t("community.mod.queueEmpty")}</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {items.map((r) => (
            <li key={r.id} className={`rounded-[1.5rem] border bg-surface p-5 ${r.status === "open" ? "border-coral/50" : "border-line opacity-80"}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-coral/15 px-2.5 py-1 font-bold text-coral-text">
                  <Flag size={12} /> {t(`community.reason.${r.reason}`)}
                </span>
                <span className="text-muted">{ago(r.created_at)}</span>
                <span className="text-muted">· {t("community.mod.reportsOnPost", { count: Number(r.reports_on_post) })}</span>
                {r.status !== "open" && <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-bold">{r.status}</span>}
              </div>
              <p className="mt-3 text-sm font-bold" data-private>
                {r.author_name} <span className="font-normal text-muted">{t("community.mod.on", { title: r.thread_title })}</span>
              </p>
              <blockquote className="mt-2 border-l-4 border-line-strong pl-3 text-[15px] text-ink" data-private>
                {r.excerpt}
              </blockquote>
              {r.note && (
                <p className="mt-2 text-sm text-muted" data-private>
                  “{r.note}”
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/community/?t=${r.thread_id}${r.reply_id ? `#r-${r.reply_id}` : ""}`} className="btn btn-primary !py-1.5 text-sm">
                  {t("community.mod.open")}
                </Link>
                {r.status === "open" ? (
                  <>
                    <button className="btn btn-outline !py-1.5 text-sm" onClick={() => resolve(r.id, "resolved")}>
                      {t("community.mod.resolve")}
                    </button>
                    <button className="btn btn-ghost !py-1.5 text-sm" onClick={() => resolve(r.id, "dismissed")}>
                      {t("community.mod.dismiss")}
                    </button>
                  </>
                ) : (
                  <button className="btn btn-ghost !py-1.5 text-sm" onClick={() => resolve(r.id, "open")}>
                    {t("community.mod.reopen")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The user-content notice on every community screen (the full wording is in the guidelines and Terms). */
function LegalStrip() {
  const t = useT();
  return (
    <div className="mx-auto max-w-7xl px-5 pb-14 md:px-10">
      <p className="flex items-start gap-3 rounded-2xl border border-line bg-surface/80 p-4 text-sm leading-relaxed text-muted">
        <Scale size={16} className="mt-0.5 shrink-0 text-violet-text" />
        <span>
          {t("community.legal")}{" "}
          <Link href="/community/guidelines/#responsibility" className="font-semibold text-violet-text underline underline-offset-2">
            {t("community.legalMore")}
          </Link>
        </span>
      </p>
    </div>
  );
}
