import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Community Guidelines",
  description: "How Litma Community works: be kind, what is never allowed, how posts are reported and moderated, and who is responsible for what members post.",
  path: "/community/guidelines/",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
