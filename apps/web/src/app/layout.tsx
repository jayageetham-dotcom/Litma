import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/editor.scss";
import { I18nProvider } from "@/i18n/react";
import { UpdateNotice } from "@/components/UpdateNotice";
import { Analytics } from "@/components/Analytics";
import { OfflineStatus } from "@/components/OfflineStatus";
import { ServiceWorker } from "@/components/ServiceWorker";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, KEYWORDS, SHARE_IMAGE, SITE, SITE_NAME } from "@/lib/seo";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE}/`),
  title: { default: DEFAULT_TITLE, template: `%s · ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "writing",
  generator: null,
  referrer: "strict-origin-when-cross-origin",
  formatDetection: { telephone: false, email: false, address: false },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ml_IN",
    alternateLocale: ["en_IN"],
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, images: [SHARE_IMAGE.url] },
  icons: {
    icon: [
      { url: `${BASE}/favicon.ico`, sizes: "48x48" },
      { url: `${BASE}/icons/icon-32.png`, type: "image/png", sizes: "32x32" },
      { url: `${BASE}/icons/icon-192.png`, type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: `${BASE}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // stops iPhone Safari zooming the whole app in when a small-text field or the page gets focus
  // (pinch-zoom still works: iOS ignores this for user gestures)
  maximumScale: 1,
  viewportFit: "cover",
  // the on-screen keyboard shrinks the visual viewport only, so the keyboard accessory can sit on top of it
  interactiveWidget: "resizes-visual",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141417" },
  ],
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@400..800&family=Anek+Malayalam:wdth,wght@75..125,300..800&family=Noto+Serif+Malayalam:wght@400;500;600;700&family=Noto+Sans+Malayalam:wght@400;500;600;700&family=Manjari:wght@400;700&family=Gayathri:wght@400;700&family=Chilanka&family=Baloo+Chettan+2:wght@400;600;700&display=swap";

/** The desktop app loads Google Fonts through app://litma/gfonts/, which keeps them on disk for offline use (apps/desktop/src/main.ts). */
const DESKTOP = process.env.NEXT_PUBLIC_DESKTOP === "1";
const FONTS_HREF = DESKTOP ? FONTS.replace("https://fonts.googleapis.com/", "/gfonts/") : FONTS;

/** SMC Malayalam fonts bundled for cover titles (public/fonts/smc, SIL OFL). */
const fontBase = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/smc`;
const SMC_FONTS = (
  [
    ["Karumbi", "Karumbi", 400],
    ["Dyuthi", "Dyuthi", 400],
    ["Uroob", "Uroob", 700],
    ["Meera", "Meera", 400],
    ["Rachana", "Rachana-Regular", 400],
    ["Rachana", "Rachana-Bold", 700],
  ] as const
)
  .map(([family, file, weight]) => `@font-face{font-family:'${family}';src:url('${fontBase}/${file}.woff2') format('woff2');font-weight:${weight === 700 && family === "Uroob" ? "100 900" : weight};font-display:swap}`)
  .join("");

const themeScript = `try{var t=localStorage.getItem('litma:theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ml" suppressHydrationWarning>
      <head>
        {!DESKTOP && <link rel="preconnect" href="https://fonts.googleapis.com" />}
        {!DESKTOP && <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />}
        <link rel="stylesheet" href={FONTS_HREF} />
        <style dangerouslySetInnerHTML={{ __html: SMC_FONTS }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <I18nProvider>
          {children}
          <UpdateNotice />
          <OfflineStatus />
          <ServiceWorker />
          <Analytics />
        </I18nProvider>
      </body>
    </html>
  );
}
