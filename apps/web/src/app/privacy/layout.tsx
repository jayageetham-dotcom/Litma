import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "What Litma keeps, why, and your choices: your writing is yours, we keep only what the app needs, and we never sell your information.",
  path: "/privacy/",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
