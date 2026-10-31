"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DictionaryView } from "@/components/DictionaryView";

export default function DictionaryPage() {
  return (
    <div className="min-h-dvh">
      <div className="kasavu-rule" />
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/desk/" className="btn btn-ghost">
            Your desk
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-6">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Anek Malayalam'" }}>
          നിഘണ്ടു
        </h1>
        <p className="mb-8 mt-1 text-muted">Malayalam–Malayalam, English–Malayalam and Malayalam–English, with synonyms and opposites.</p>
        <DictionaryView />
      </main>
    </div>
  );
}
