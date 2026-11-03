import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Create your account", description: "Start writing in Malayalam with Litma: novels, stories, poems, screenplays and features on real A4 pages, in Manglish or Malayalam.", path: "/signup/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
