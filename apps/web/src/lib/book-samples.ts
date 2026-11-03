import type { Book } from "./types";

/**
 * Sample text for a book's details and covers, filled into fields the writer has never set (undefined or
 * null), so every field starts with something real to edit instead of a grey hint. A field the writer
 * clears stays empty. The ISBN is an obvious placeholder (all zeros) with a valid check digit, so the
 * barcode draws; it must be replaced before printing.
 */
export const SAMPLE_ISBN = "978-0-000-00000-2";

export function withSamples(b: Book): Book | null {
  const s = b.settings ?? {};
  const c = b.cover ?? {};
  const unset = (v: unknown) => v === undefined || v === null;
  const settings = {
    ...s,
    publisher: unset(s.publisher) ? "Litma Publishing House" : s.publisher,
    year: unset(s.year) ? String(new Date().getFullYear()) : s.year,
    edition: unset(s.edition) ? "ഒന്നാം പതിപ്പ്" : s.edition,
    isbn: unset(s.isbn) ? SAMPLE_ISBN : s.isbn,
  };
  const cover = {
    ...c,
    blurb: unset(c.blurb)
      ? "ഇവിടെ നിങ്ങളുടെ പുസ്തകത്തെക്കുറിച്ച് മൂന്നോ നാലോ വാചകങ്ങൾ എഴുതുക. കഥ എവിടെ തുടങ്ങുന്നു, ആരുടെ യാത്രയാണ്, വായനക്കാരെ എന്താണ് കാത്തിരിക്കുന്നത് എന്ന് ചുരുക്കി പറയാം. ഈ എഴുത്ത് മാറ്റി നിങ്ങളുടേതാക്കുക."
      : c.blurb,
    authorBio: unset(c.authorBio) ? "എഴുത്തുകാരെക്കുറിച്ച് ഒരു ചെറുകുറിപ്പ്: നാട്, ഇതുവരെ എഴുതിയ പുസ്തകങ്ങൾ, ലഭിച്ച അംഗീകാരങ്ങൾ." : c.authorBio,
    price: unset(c.price) ? "₹ 250" : c.price,
    genreLine: unset(c.genreLine) ? "മലയാളം നോവൽ" : c.genreLine,
    category: unset(c.category) ? "Fiction" : c.category,
    coverCredit: unset(c.coverCredit) ? "Cover design: Litma" : c.coverCredit,
    publisherTagline: unset(c.publisherTagline) ? "Malayalam books" : c.publisherTagline,
    website: unset(c.website) ? "www.jayageetham.com/litma" : c.website,
  };
  const next: Book = { ...b, subtitle: unset(b.subtitle) ? "നോവൽ" : b.subtitle, author: unset(b.author) ? "എഴുത്തുകാരുടെ പേര്" : b.author, settings, cover };
  return JSON.stringify(next) === JSON.stringify(b) ? null : next;
}
