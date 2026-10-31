import type { BookItem } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

/** Standard book skeleton: covers, title pages, copyright and contents. */
export const DEFAULT_STRUCTURE = (): BookItem[] => [
  { id: uid(), type: "cover" },
  { id: uid(), type: "half-title" },
  { id: uid(), type: "title" },
  { id: uid(), type: "copyright" },
  { id: uid(), type: "toc", title: "ഉള്ളടക്കം" },
  { id: uid(), type: "back-cover" },
];
