import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Community",
  description: "Litma Community: a friendly place for Malayalam writers to talk about writing, words and craft, ask for feedback, and help each other with Litma.",
  path: "/community/",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
