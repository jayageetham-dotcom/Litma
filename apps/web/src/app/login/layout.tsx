import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Sign in", description: "Sign in to Litma, the writing desk for Malayalam literature, and pick up your writing where you left it.", path: "/login/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
