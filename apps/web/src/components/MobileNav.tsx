"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BookA, Library, PenLine, UserRound } from "lucide-react";
import { useUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useT } from "@/i18n/react";

/**
 * App-style bottom navigation for phones (hidden from md up, where the header carries these links).
 * Mirrors the tab structure planned for the native app: Desk · Books · Dictionary · Me.
 */
function Nav() {
  const path = usePathname();
  const view = useSearchParams().get("view");
  const user = useUser();
  const t = useT();
  if (isSupabaseConfigured && !user) return null;
  const tabs = [
    { href: "/desk/", label: t("nav.desk"), icon: PenLine, on: path.startsWith("/desk") && view !== "books" },
    { href: "/desk/?view=books", label: t("nav.books"), icon: Library, on: (path.startsWith("/desk") && view === "books") || path.startsWith("/book") },
    { href: "/dictionary/", label: t("nav.dictionary"), icon: BookA, on: path.startsWith("/dictionary") },
    { href: "/profile/", label: t("nav.me"), icon: UserRound, on: path.startsWith("/profile") || path.startsWith("/settings") },
  ];
  return (
    <>
      <div className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-paper/95 backdrop-blur md:hidden" aria-label="Main">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={tab.on ? "page" : undefined} className={`flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium transition-colors ${tab.on ? "text-accent" : "text-muted"}`}>
            <span className={`grid h-7 w-14 place-items-center rounded-full transition-[background-color,transform] duration-200 ${tab.on ? "scale-100 bg-accent-soft" : "scale-95"}`}>
              <tab.icon size={19} />
            </span>
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function MobileNav() {
  return (
    <Suspense fallback={null}>
      <Nav />
    </Suspense>
  );
}
