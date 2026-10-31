import Link from "next/link";

export function Logo({ size = "md", href = "/" }: { size?: "sm" | "md" | "lg"; href?: string }) {
  const s = { sm: "text-lg", md: "text-2xl", lg: "text-4xl" }[size];
  return (
    <Link href={href} className={`inline-flex items-baseline gap-2 font-bold tracking-tight text-ink ${s}`} aria-label="Litma home">
      <span style={{ fontFamily: "'Anek Malayalam'", fontWeight: 800 }}>ലിറ്റ്മ</span>
      <span className="text-[0.55em] font-semibold text-kasavu" style={{ fontFamily: "'Anek Malayalam'" }}>
        Litma
      </span>
    </Link>
  );
}
