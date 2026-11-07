import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Help and guides",
  description: "Step-by-step guides with pictures for Litma: typing Malayalam in Manglish, the editor, writing types, Story World, the dictionary, books and covers, PDFs, the desktop and phone apps and working offline.",
  path: "/help/",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
