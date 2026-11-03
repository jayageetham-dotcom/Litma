import { pageMetadata } from "@/lib/seo";

// behind sign-in or opened by link only, so kept out of search results
export const metadata = pageMetadata({ title: "Settings", path: "/settings/", noindex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
