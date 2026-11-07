import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Privacy Policy", path: "/privacy/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}