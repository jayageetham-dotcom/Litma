import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/editor.scss";

export const metadata: Metadata = {
  title: "Litma — മലയാളം എഴുത്തുമേശ",
  description: "A Malayalam writing studio for novels, stories, poems, screenplays and features. Type in Manglish or Malayalam on A4 pages.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // the on-screen keyboard shrinks the visual viewport only, so the keyboard accessory can sit on top of it
  interactiveWidget: "resizes-visual",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141417" },
  ],
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Anek+Malayalam:wght@300..800&family=Noto+Serif+Malayalam:wght@400;500;600;700&family=Noto+Sans+Malayalam:wght@400;500;600;700&family=Manjari:wght@400;700&family=Gayathri:wght@400;700&family=Chilanka&family=Baloo+Chettan+2:wght@400;600;700&display=swap";

const themeScript = `try{var t=localStorage.getItem('litma:theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ml" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
        <link rel="icon" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`} type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
