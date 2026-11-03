import type { Book, BookCover } from "@/lib/types";
import { AvatarArt } from "@/components/art/Avatars";
import { CoverArtSvg } from "@/components/art/CoverArt";

export const COVER_TEMPLATES: { id: NonNullable<BookCover["template"]>; label: string; defaults: Partial<BookCover> }[] = [
  { id: "kasavu", label: "Kasavu frame", defaults: { bg: "#f7f3e8", fg: "#1a2220", accent: "#a17a28" } },
  { id: "art", label: "Artwork", defaults: { bg: "#0b2f3a", fg: "#fdf6e3", accent: "#e9c46a", art: "fantasy" } },
  { id: "solid", label: "Solid colour", defaults: { bg: "#1d5a52", fg: "#ffffff", accent: "#d2ad5c" } },
  // Needs an uploaded picture; hidden from the picker while PHOTO_UPLOADS is off (older books still render).
  { id: "photo", label: "Photograph", defaults: { bg: "#111916", fg: "#ffffff", accent: "#d2ad5c", imageOpacity: 0.9 } },
  { id: "type", label: "Big type", defaults: { bg: "#e9e1cf", fg: "#3b1f1a", accent: "#a3372b" } },
  { id: "minimal", label: "Minimal", defaults: { bg: "#ffffff", fg: "#1a2220", accent: "#1d5a52" } },
];

export const COVER_FONTS = ["Anek Malayalam", "Noto Serif Malayalam", "Manjari", "Baloo Chettan 2", "Gayathri", "Chilanka"];

function resolve(book: Pick<Book, "cover">) {
  const c = book.cover ?? {};
  const t = COVER_TEMPLATES.find((x) => x.id === c.template) ?? COVER_TEMPLATES[0];
  return { ...t.defaults, ...c, template: t.id } as BookCover & { template: NonNullable<BookCover["template"]> };
}

type CoverProps = { book: Pick<Book, "title" | "subtitle" | "author" | "cover" | "settings">; w: number; h: number; className?: string };

/** Front cover, drawn at w×h millimetres (full bleed). */
export function CoverFront({ book, w, h, className = "" }: CoverProps) {
  const c = resolve(book);
  const scale = c.titleScale ?? 1;
  const font = `'${c.font ?? "Anek Malayalam"}'`;
  const base = { width: `${w}mm`, height: `${h}mm`, background: c.bg, color: c.fg, fontFamily: font } as React.CSSProperties;
  const title = book.title || "പുസ്തകം";
  const publisher = book.settings?.publisher;
  /** The cover background artwork, when there is no uploaded picture in this slot. */
  const art = (cls: string, st?: React.CSSProperties) => (!c.image && c.art ? <CoverArtSvg id={c.art} className={cls} style={st} /> : null);

  if (c.template === "art")
    // Title in the calm top 30% of the artwork, author in the clear bottom 15%.
    return (
      <div className={`relative overflow-hidden ${className}`} style={base}>
        {art("absolute inset-0 h-full w-full")}
        <div className="absolute inset-x-[11%] top-[9%] text-center" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.18)" }}>
          <h1 style={{ fontSize: `${48 * scale}pt`, lineHeight: 1.12, fontWeight: 800 }}>{title}</h1>
          {book.subtitle && <p style={{ fontSize: "15pt", marginTop: "4mm", opacity: 0.92 }}>{book.subtitle}</p>}
          <div style={{ height: "1mm", width: "20mm", background: c.accent, margin: "7mm auto 0" }} />
        </div>
        <div className="absolute inset-x-[11%] bottom-[6%] text-center" style={{ textShadow: "0 1px 10px rgba(0,0,0,0.2)" }}>
          <p style={{ fontSize: "18pt", fontWeight: 600, letterSpacing: "0.02em" }}>{book.author}</p>
          {publisher && <p style={{ fontSize: "9.5pt", marginTop: "2mm", opacity: 0.8 }}>{publisher}</p>}
        </div>
      </div>
    );

  if (c.template === "photo")
    return (
      <div className={`relative overflow-hidden ${className}`} style={base}>
        {c.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: c.imageOpacity ?? 0.9 }} />
        )}
        {art("absolute inset-0 h-full w-full")}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${c.bg} 8%, transparent 60%)` }} />
        <div className="absolute inset-x-[12%] bottom-[10%]">
          <h1 style={{ fontSize: `${46 * scale}pt`, lineHeight: 1.15, fontWeight: 800 }}>{title}</h1>
          {book.subtitle && <p style={{ fontSize: "15pt", marginTop: "4mm", opacity: 0.9 }}>{book.subtitle}</p>}
          <div style={{ height: "1.2mm", width: "22mm", background: c.accent, margin: "9mm 0 5mm" }} />
          <p style={{ fontSize: "17pt", fontWeight: 600 }}>{book.author}</p>
        </div>
      </div>
    );

  if (c.template === "solid")
    return (
      <div className={`relative overflow-hidden ${className}`} style={base}>
        <div className="absolute inset-x-[12%] top-[14%]">
          <div style={{ height: "1.4mm", width: "30mm", background: c.accent, marginBottom: "10mm" }} />
          <h1 style={{ fontSize: `${50 * scale}pt`, lineHeight: 1.12, fontWeight: 800 }}>{title}</h1>
          {book.subtitle && <p style={{ fontSize: "16pt", marginTop: "6mm", opacity: 0.85 }}>{book.subtitle}</p>}
        </div>
        {c.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image} alt="" className="absolute bottom-[22%] right-[12%] w-[40%] rounded-sm object-cover" style={{ opacity: c.imageOpacity ?? 1 }} />
        )}
        {art("absolute bottom-[22%] right-[12%] h-[34%] w-[40%] rounded-sm")}
        <div className="absolute inset-x-[12%] bottom-[9%] flex items-end justify-between">
          <p style={{ fontSize: "18pt", fontWeight: 600 }}>{book.author}</p>
          {publisher && <p style={{ fontSize: "10pt", opacity: 0.75 }}>{publisher}</p>}
        </div>
      </div>
    );

  if (c.template === "type")
    return (
      <div className={`relative flex flex-col justify-between overflow-hidden px-[10%] py-[10%] ${className}`} style={base}>
        {art("absolute inset-0 h-full w-full", { opacity: 0.35 })}
        <p className="relative" style={{ fontSize: "14pt", fontWeight: 600, color: c.accent }}>{book.author}</p>
        <h1 className="relative" style={{ fontSize: `${92 * scale}pt`, lineHeight: 1.02, fontWeight: 800, wordBreak: "break-word" }}>{title}</h1>
        <div className="relative flex items-end justify-between" style={{ fontSize: "12pt" }}>
          <span>{book.subtitle}</span>
          <span style={{ opacity: 0.7 }}>{publisher}</span>
        </div>
      </div>
    );

  if (c.template === "minimal")
    return (
      <div className={`relative flex flex-col items-center justify-center overflow-hidden text-center ${className}`} style={base}>
        {art("mb-[10mm] h-[26%] w-[46%] rounded-sm")}
        <h1 style={{ fontSize: `${30 * scale}pt`, fontWeight: 700, lineHeight: 1.25 }}>{title}</h1>
        <div style={{ height: "0.4mm", width: "16mm", background: c.accent, margin: "8mm 0" }} />
        <p style={{ fontSize: "13pt" }}>{book.author}</p>
        {book.subtitle && <p style={{ fontSize: "11pt", marginTop: "3mm", opacity: 0.7 }}>{book.subtitle}</p>}
        {publisher && <p style={{ position: "absolute", bottom: "10%", fontSize: "9pt", opacity: 0.6 }}>{publisher}</p>}
      </div>
    );

  // kasavu
  return (
    <div className={`relative overflow-hidden ${className}`} style={base}>
      <div className="absolute" style={{ inset: "9mm", border: `1.6mm solid ${c.accent}` }} />
      <div className="absolute" style={{ inset: "13mm", border: `0.4mm solid ${c.accent}` }} />
      <div className="absolute inset-x-[16%] top-[24%] text-center">
        <h1 style={{ fontSize: `${44 * scale}pt`, lineHeight: 1.2, fontWeight: 800 }}>{title}</h1>
        {book.subtitle && <p style={{ fontSize: "14pt", marginTop: "6mm", opacity: 0.8 }}>{book.subtitle}</p>}
      </div>
      {c.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.image} alt="" className="absolute left-1/2 top-[48%] w-[44%] -translate-x-1/2 rounded-sm object-cover" style={{ opacity: c.imageOpacity ?? 1, maxHeight: "28%" }} />
      )}
      {art("absolute left-1/2 top-[48%] h-[26%] w-[44%] -translate-x-1/2 rounded-sm")}
      <div className="absolute inset-x-[16%] bottom-[14%] text-center">
        <p style={{ fontSize: "17pt", fontWeight: 600 }}>{book.author}</p>
        {publisher && <p style={{ fontSize: "10pt", marginTop: "3mm", color: c.accent }}>{publisher}</p>}
      </div>
    </div>
  );
}

/** Back cover: blurb, author note and photo, publisher, ISBN and price. */
export function CoverBack({ book, w, h, className = "" }: CoverProps) {
  const c = resolve(book);
  const dark = c.template === "solid" || c.template === "photo";
  const font = `'${c.font ?? "Anek Malayalam"}'`;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width: `${w}mm`, height: `${h}mm`, background: c.bg, color: c.fg }}>
      {c.art && !c.image && (
        <>
          <CoverArtSvg id={c.art} mirror className="absolute inset-0 h-full w-full" style={{ opacity: c.template === "art" || c.template === "photo" ? 1 : 0.18 }} />
          {(c.template === "art" || c.template === "photo") && <div className="absolute inset-0" style={{ background: c.bg, opacity: 0.62 }} />}
        </>
      )}
      {c.template === "kasavu" && <div className="absolute" style={{ inset: "9mm", border: `1.6mm solid ${c.accent}` }} />}
      <div className="absolute inset-x-[14%] top-[14%]" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
        {c.blurb && <p style={{ fontSize: "13pt", lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{c.blurb}</p>}
        {(c.authorBio || c.authorPhoto) && (
          <div className="flex items-start gap-[5mm]" style={{ marginTop: "14mm" }}>
            {c.authorPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.authorPhoto} alt="" style={{ width: "26mm", height: "26mm", objectFit: "cover", borderRadius: "50%", flexShrink: 0 }} />
            ) : c.authorAvatar !== "none" ? (
              <AvatarArt id={c.authorAvatar ?? "letter"} name={book.author} size="26mm" paint={{ fg: c.accent!, bg: `color-mix(in srgb, ${c.accent} 18%, ${c.bg})` }} />
            ) : null}
            <div>
              <p style={{ fontFamily: font, fontWeight: 700, fontSize: "12pt", color: dark ? c.accent : c.accent }}>{book.author}</p>
              <p style={{ fontSize: "10.5pt", lineHeight: 1.7, marginTop: "2mm", whiteSpace: "pre-wrap", opacity: 0.9 }}>{c.authorBio}</p>
            </div>
          </div>
        )}
      </div>
      <div className="absolute inset-x-[14%] bottom-[10%] flex items-end justify-between" style={{ fontFamily: font, fontSize: "10pt" }}>
        <div>
          {book.settings?.publisher && <p style={{ fontWeight: 600 }}>{book.settings.publisher}</p>}
          {c.price && <p style={{ opacity: 0.8 }}>{c.price}</p>}
        </div>
        {book.settings?.isbn && (
          <div style={{ background: "#fff", color: "#000", padding: "2.5mm 4mm", fontFamily: "monospace", fontSize: "9pt", textAlign: "center" }}>
            <div style={{ letterSpacing: "0.6mm", fontSize: "7pt" }}>ISBN</div>
            {book.settings.isbn}
          </div>
        )}
      </div>
    </div>
  );
}
