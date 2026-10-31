"use client";
import { useUser } from "@/lib/auth";
import Link from "next/link";

export function Logo({ size = "md", href }: { size?: "sm" | "md" | "lg"; href?: string }) {
  const user = useUser();
  // Signed-in writers go back to their desk, never to the sign-in landing.
  const to = href ?? (user ? "/desk/" : "/");
  const s = { sm: "text-lg", md: "text-2xl", lg: "text-4xl" }[size];
  return (
    <Link href={to} className={`inline-flex items-baseline gap-2 font-bold tracking-tight ${s}`} aria-label="Litma home">
      <span className="brand-text" style={{ fontFamily: "'Anek Malayalam'", fontWeight: 800 }}>
        ലിറ്റ്മ<span className="text-[var(--brand-mark)]">.</span>
      </span>
      <span className="text-[0.5em] font-semibold tracking-wide text-muted" style={{ fontFamily: "'Anek Malayalam'" }}>
        Litma
      </span>
    </Link>
  );
}
