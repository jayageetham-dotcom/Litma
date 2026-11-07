/// The first akshara of a text: the part a drop cap may set large without breaking a word.
/// Port of `packages/shared/src/akshara.ts` (keep the two in step).
///
/// Grapheme clusters cut Malayalam conjuncts apart (സ്നേഹം would lose its ന്), and a style
/// change inside a syllable breaks the font's shaping, so the drop cap takes a whole syllable:
/// leading quotes or brackets, then one consonant cluster with its vowel sign, or an independent
/// vowel, chillu or digit, then any anusvara, visarga or candrabindu. Other scripts take one
/// character with its combining marks.
library;

const _lead = '["\'“‘«(\\[]*';
const _cons = '[\\u0D15-\\u0D3A]';
const _syllable = '(?:(?:$_cons\\u0D4D[\\u200C\\u200D]?)*$_cons[\\u0D3E-\\u0D4D\\u0D57\\u0D62\\u0D63]*'
    '|[\\u0D04-\\u0D14\\u0D5F-\\u0D61][\\u0D57]?'
    '|[\\u0D54-\\u0D56\\u0D7A-\\u0D7F]'
    '|[\\u0D66-\\u0D78])'
    '[\\u0D00-\\u0D03]*[\\u200C\\u200D]?';
final _malayalam = RegExp('^$_lead$_syllable');
final _other = RegExp('^$_lead(?:[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]|[^\\s])[\\u0300-\\u036F\\u0900-\\u0903\\u093A-\\u094F\\u200C\\u200D]*');

/// How many UTF-16 code units of [text] the first akshara (with leading quotes) takes; 0 when it
/// starts with a space or is empty.
int firstAksharaLength(String text) {
  final m = _malayalam.firstMatch(text) ?? _other.firstMatch(text);
  return m == null ? 0 : m.end;
}
