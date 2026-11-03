import { pageMetadata } from "@/lib/seo";

// owner only, so kept out of search results
export const metadata = pageMetadata({ title: "Admin", path: "/admin/", noindex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
