"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bookmark } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DictionaryView } from "@/components/DictionaryView";
import { HomeNav } from "@/components/HomeActions";
import { MobileNav } from "@/components/MobileNav";
import { SavedWords, useBookmarks } from "@/components/SavedWords";
import { NattarivuCategories, NattarivuCategoryView } from "@/components/Nattarivu";
import { nattarivuCategory } from "@litma/shared/nattarivu";
import { useT } from "@/i18n/react";

type View = "lookup" | "nattarivu" | "saved";

/**
 * State lives in the URL so the back button and shared links work (static export: query params only):
 *   /dictionary/?w=word[&from=category]   look a word up (from = the നാട്ടറിവ് category it came from)
 *   /dictionary/?view=nattarivu[&c=id]     നാട്ടറിവ് categories, or one category
 *   /dictionary/?view=saved                saved words (phones and tablets; wide screens show them beside)
 */
function Dictionary() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const items = useBookmarks();
  const view: View = params.get("view") === "nattarivu" ? "nattarivu" : params.get("view") === "saved" ? "saved" : "lookup";
  const word = params.get("w") ?? undefined;
  const from = nattarivuCategory(params.get("from"));
  const category = nattarivuCategory(params.get("c"));

  const go = (q: Record<string, string>, top = true) => {
    const s = new URLSearchParams(q).toString();
    router.push(`/dictionary/${s ? `?${s}` : ""}`, { scroll: false });
    if (top) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openWord = (w: string, fromId?: string) => go(fromId ? { w, from: fromId } : { w });
  const tabs: { v: View; label: string; wideToo: boolean }[] = [
    { v: "lookup", label: t("saved.lookupTab"), wideToo: true },
    { v: "nattarivu", label: t("nattarivu.title"), wideToo: true },
    { v: "saved", label: t("saved.tab", { n: items?.length ?? 0 }), wideToo: false },
  ];

  return (
    <div className="min-h-dvh">
      <header className="app-bar">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2.5">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <HomeNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-5 sm:pt-12">
        <h1 className="text-[1.9rem] font-bold leading-tight sm:text-[2.5rem]" style={{ fontFamily: "'Anek Malayalam'" }}>
          നിഘണ്ടു
        </h1>
        <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed text-muted">{t("nattarivu.pageIntro")}</p>

        <div className="mt-8 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-subtle p-1 text-sm" role="tablist">
          {tabs.map(({ v, label, wideToo }) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => go(v === "lookup" ? (word ? { w: word } : {}) : { view: v }, false)}
              className={`shrink-0 rounded-full px-4 py-1.5 transition-colors ${wideToo ? "" : "lg:hidden"} ${view === v ? "bg-switch font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink"}`}
              style={v === "nattarivu" ? { fontFamily: "'Anek Malayalam'", fontSize: "15px" } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-12 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-16">
          <section className={view === "saved" ? "max-lg:hidden" : ""}>
            {view === "nattarivu" ? (
              category ? (
                <NattarivuCategoryView key={category.id} category={category} onBack={() => go({ view: "nattarivu" })} onOpen={(id) => go({ view: "nattarivu", c: id })} onWord={(w) => openWord(w, category.id)} />
              ) : (
                <NattarivuCategories onOpen={(id) => go({ view: "nattarivu", c: id })} />
              )
            ) : (
              <>
                {from && (
                  <button type="button" onClick={() => go({ view: "nattarivu", c: from.id })} className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 text-sm hover:text-ink">
                    <ArrowLeft size={15} aria-hidden /> <span style={{ fontFamily: "'Anek Malayalam'" }}>{from.ml}</span>
                    <span className="text-muted">{from.en}</span>
                  </button>
                )}
                <DictionaryView query={word} />
              </>
            )}
          </section>
          <aside className={`${view === "saved" ? "" : "max-lg:hidden"} lg:sticky lg:top-24 lg:self-start lg:rounded-2xl lg:border lg:border-line lg:bg-surface lg:p-5`} aria-label={t("saved.title")}>
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold max-lg:hidden">
              <Bookmark size={16} className="text-tint-coral" aria-hidden /> {t("saved.title")}
              {items && items.length > 0 && <span className="rounded-full bg-subtle px-2 text-xs font-medium text-muted">{items.length}</span>}
            </h2>
            <div className="scrollbar-thin lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto lg:pr-1">
              <SavedWords onOpen={(w) => openWord(w)} />
            </div>
          </aside>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

export default function DictionaryPage() {
  return (
    <Suspense>
      <Dictionary />
    </Suspense>
  );
}
