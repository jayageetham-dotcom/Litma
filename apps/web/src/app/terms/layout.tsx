import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of Use",
  description: "The terms for using Litma's website, desktop app and phone app, in plain words. Your writing stays yours.",
  path: "/terms/",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
