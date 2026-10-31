"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BookA, Library, PenLine, UserRound } from "lucide-react";
import { useUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * App-style bottom navigation for phones (hidden from md up, where the header carries these links).
 * Mirrors the tab structure planned for the native app: Desk · Books · Dictionary · Me.
 */
function Nav() {
  const path = usePathname();
  const view = useSearchParams().get("view");
  const user = useUser();
  if (isSupabaseConfigured && !user) return null;
  const tabs = [
    { href: "/desk/", label: "Desk", icon: PenLine, on: path.startsWith("/desk") && view !== "books" },
    { href: "/desk/?view=books", label: "Books", icon: Library, on: (path.startsWith("/desk") && view === "books") || path.startsWith("/book") },
    { href: "/dictionary/", label: "Dictionary", icon: BookA, on: path.startsWith("/dictionary") },
    { href: "/profile/", label: "Me", icon: UserRound, on: path.startsWith("/profile") || path.startsWith("/settings") },
  ];
  return (
    <>
      <div className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-paper/95 backdrop-blur md:hidden" aria-label="Main">
        {tabs.map((t) => (
          <Link key={t.label} href={t.href} aria-current={t.on ? "page" : undefined} className={`flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium ${t.on ? "text-kayal" : "text-muted"}`}>
            <span className={`grid h-7 w-14 place-items-center rounded-full ${t.on ? "bg-kayal-soft" : ""}`}>
              <t.icon size={19} />
            </span>
            {t.label}
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
