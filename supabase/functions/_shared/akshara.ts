/**
 * The first akshara of a text: the part a drop cap may set large without breaking a word.
 *
 * Browsers and Flutter split text into "letters" by grapheme cluster, which cuts Malayalam
 * conjuncts apart (സ്നേഹം would lose its ന്). Any split inside a syllable also breaks the
 * font's shaping, so the drop cap always takes a whole syllable: leading quotes or brackets,
 * then one consonant cluster (consonant + virama + consonant…, with ZWJ/ZWNJ) with its vowel
 * sign, or an independent vowel, chillu or digit, then any anusvara, visarga or candrabindu.
 * Text in other scripts takes one character with its combining marks.
 *
 * Plain data and code, no imports: the mobile app ports it in lib/core/akshara.dart.
 */

const LEAD = "[\"'“‘«(\\[]*";
const CONS = "[\\u0D15-\\u0D3A]";
const SYLLABLE =
  `(?:(?:${CONS}\\u0D4D[\\u200C\\u200D]?)*${CONS}[\\u0D3E-\\u0D4D\\u0D57\\u0D62\\u0D63]*` + // consonant cluster + signs
  "|[\\u0D04-\\u0D14\\u0D5F-\\u0D61][\\u0D57]?" + // independent vowels
  "|[\\u0D54-\\u0D56\\u0D7A-\\u0D7F]" + // chillu letters
  "|[\\u0D66-\\u0D78])" + // digits and signs
  "[\\u0D00-\\u0D03]*[\\u200C\\u200D]?"; // anusvara, visarga, candrabindu; trailing joiner
const MALAYALAM = new RegExp(`^${LEAD}${SYLLABLE}`);
const OTHER = new RegExp(`^${LEAD}(?:[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]|[^\\s])[\\u0300-\\u036F\\u0900-\\u0903\\u093A-\\u094F\\u200C\\u200D]*`);

/** How many UTF-16 code units of `text` the first akshara (with leading quotes) takes; 0 when it starts with a space or is empty. */
export function firstAksharaLength(text: string): number {
  const m = MALAYALAM.exec(text) ?? OTHER.exec(text);
  return m ? m[0].length : 0;
}
