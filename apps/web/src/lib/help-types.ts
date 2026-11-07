/** Shapes of the help site's content (built from apps/web/content/help by lib/help.ts). */
export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  /** first paragraph as plain text, for cards and search results */
  lead: string;
  html: string;
  /** the article's ### headings */
  toc: { id: string; title: string }[];
  /** plain text for search */
  text: string;
}

export interface HelpCategory {
  id: string;
  order: number;
  title: string;
  /** Malayalam name shown beside the English one */
  ml: string;
  summary: string;
  /** lucide icon name, e.g. "rocket" */
  icon: string;
  /** violet · coral · sky · lime · tangerine */
  tint: string;
  intro: string;
  articles: HelpArticle[];
}

export interface HelpData {
  categories: HelpCategory[];
  updated: string;
}
