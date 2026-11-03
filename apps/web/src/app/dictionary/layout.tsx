import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Malayalam dictionary and thesaurus · മലയാളം നിഘണ്ടു", description: "Look up Malayalam and English words, with Malayalam meanings, synonyms and opposites from Olam's open datasets, plus നാട്ടറിവ്: everyday Kerala words by topic.", path: "/dictionary/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
