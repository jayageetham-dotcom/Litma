"use client";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DictionaryView } from "@/components/DictionaryView";
import { HomeNav } from "@/components/HomeActions";
import { MobileNav } from "@/components/MobileNav";

export default function DictionaryPage() {
  return (
    <div className="min-h-dvh">
      <header className="app-bar">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-2.5">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <HomeNav />
        </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-4 sm:px-5 sm:pt-6">
        <h1 className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: "'Anek Malayalam'" }}>
          നിഘണ്ടു
        </h1>
        <p className="mb-8 mt-1 text-muted">Malayalam–Malayalam, English–Malayalam and Malayalam–English, with synonyms and opposites.</p>
        <DictionaryView />
      </main>
      <MobileNav />
    </div>
  );
}
