/// Malayalam aksharas and their laghu / guru weight, for the വൃത്തം (metre) marks on poems and
/// songs. A port of `aksharas` in packages/shared/src/manglish.ts: keep the two in step.
library;

final _cons = RegExp('[ക-ഹഺ]');
final _indVowel = RegExp('[അ-ഔൠൡ]');
final _longSigns = RegExp('[ാീൂൄേൈോൌൗ]');
final _longVowels = RegExp('[ആഈഊഏഐഓഔൡ]');
final _chillus = RegExp('[ൺ-ൿൎ]');
final _malayalam = RegExp('[ഀ-ൿ‌‍]');
final _anusvara = RegExp('[ംഃ]');
const _virama = '്';

class Akshara {
  Akshara(this.text);
  final String text;
  bool long = false;
}

/// Split a line into aksharas. Chillus and ം / ഃ attach to the akshara before them.
List<Akshara> aksharas(String line) {
  final res = <Akshara>[];
  var cur = '';
  var prevVirama = false;
  for (final rune in line.runes) {
    final ch = String.fromCharCode(rune);
    final isCons = _cons.hasMatch(ch);
    final isVowel = _indVowel.hasMatch(ch);
    if ((isCons && !prevVirama) || isVowel) {
      if (cur.isNotEmpty) res.add(Akshara(cur));
      cur = ch;
    } else if (_malayalam.hasMatch(ch)) {
      cur += ch;
    } else {
      if (cur.isNotEmpty) res.add(Akshara(cur));
      cur = '';
    }
    prevVirama = ch == _virama;
  }
  if (cur.isNotEmpty) res.add(Akshara(cur));
  final merged = [for (final a in res) if (_indVowel.hasMatch(a.text[0]) || _cons.hasMatch(a.text[0])) a];
  for (var k = 0; k < merged.length; k++) {
    final t = merged[k].text;
    var long = _longSigns.hasMatch(t) || _longVowels.hasMatch(t[0]) || _anusvara.hasMatch(t) || _chillus.hasMatch(t);
    final next = k + 1 < merged.length ? merged[k + 1].text : null;
    // a short akshara before a conjunct (C്C…) is guru
    if (!long && next != null && next.length > 2 && next[1] == _virama && _cons.hasMatch(next[2])) long = true;
    // an akshara whose own text ends in virama is guru
    if (!long && t.endsWith(_virama)) long = true;
    merged[k].long = long;
  }
  return merged;
}

/// "–∪––": – for guru, ∪ for laghu.
String metrePattern(String line) => aksharas(line).map((a) => a.long ? '–' : '∪').join();
