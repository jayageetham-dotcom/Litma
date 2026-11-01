"use client";
import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DictionaryView } from "@/components/DictionaryView";
import { HomeNav } from "@/components/HomeActions";
import { MobileNav } from "@/components/MobileNav";
import { SavedWords, useBookmarks } from "@/components/SavedWords";
import { useT } from "@/i18n/react";

export default function DictionaryPage() {
  const t = useT();
  const [query, setQuery] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<"lookup" | "saved">("lookup");
  const items = useBookmarks();
  const open = (w: string) => {
    setQuery(w);
    setTab("lookup");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
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
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-5 sm:pt-6">
        <h1 className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: "'Anek Malayalam'" }}>
          നിഘണ്ടു
        </h1>
        <p className="mt-1 text-muted">Malayalam–Malayalam, English–Malayalam and Malayalam–English, with synonyms and opposites. Save words to keep them at hand while you write.</p>

        {/* phones and tablets: two tabs; wide screens show saved words beside the dictionary */}
        <div className="mt-5 flex gap-1 text-sm lg:hidden" role="tablist">
          {(["lookup", "saved"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={`rounded-full px-3.5 py-1.5 ${tab === v ? "bg-primary font-semibold text-primary-ink" : "text-muted hover:bg-subtle hover:text-ink"}`}
            >
              {v === "lookup" ? t("saved.lookupTab") : t("saved.tab", { n: items?.length ?? 0 })}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-10 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className={tab === "lookup" ? "" : "max-lg:hidden"}>
            <DictionaryView query={query} />
          </section>
          <aside className={`${tab === "saved" ? "" : "max-lg:hidden"} lg:sticky lg:top-20 lg:self-start`} aria-label={t("saved.title")}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold max-lg:hidden">
              <Bookmark size={15} className="text-accent" aria-hidden /> {t("saved.title")}
              {items && items.length > 0 && <span className="rounded-full bg-subtle px-2 text-xs font-medium text-muted">{items.length}</span>}
            </h2>
            <div className="scrollbar-thin lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-1">
              <SavedWords onOpen={open} />
            </div>
          </aside>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
