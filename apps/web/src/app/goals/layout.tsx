import { pageMetadata } from "@/lib/seo";

// behind sign-in, so kept out of search results
export const metadata = pageMetadata({ title: "Goals and statistics", path: "/goals/", noindex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
