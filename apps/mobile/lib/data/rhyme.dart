/// Rhyme finder (പ്രാസം): a port of packages/shared/src/rhyme.ts (keep the two in step).
///
/// - second: ദ്വിതീയാക്ഷര പ്രാസം, the consonant of the second akshara is the same (കാലം, നീലം).
/// - end: അന്ത്യപ്രാസം, the last akshara is the same.
/// - first: ആദിപ്രാസം, the first letter is the same.
/// The words come from the website's /dict/rhyme files (scripts/build-rhymes.mjs), kept on the phone.
library;

import '../core/metre.dart';
import 'dictionary.dart';

enum RhymeKind { second, end, first }

final _cluster = RegExp('^(?:[ക-ഺ]്[‌‍]?)*[ക-ഺ]');

/// The consonant (or conjunct) that starts an akshara; an independent vowel stands for itself.
String consonantOf(String akshara) {
  final m = _cluster.firstMatch(akshara);
  if (m != null) return m.group(0)!;
  return akshara.isEmpty ? '' : String.fromCharCode(akshara.runes.first);
}

/// The vowel part of an akshara (its sign, or '' for the inherent a).
String vowelOf(String akshara) => akshara.substring(consonantOf(akshara).length).replaceAll(RegExp('[ംഃ‌‍ൺ-ൿ]'), '');

String? rhymeKey(String word, RhymeKind kind) {
  final a = aksharas(word.trim());
  switch (kind) {
    case RhymeKind.first:
      return a.isEmpty ? null : consonantOf(a[0].text);
    case RhymeKind.second:
      return a.length < 2 ? null : consonantOf(a[1].text);
    case RhymeKind.end:
      return a.length < 2 ? null : a.last.text;
  }
}

String _hex(String s) => s.runes.map((c) => c.toRadixString(16)).join('-');
String rhymePath(RhymeKind kind, String key) => 'rhyme/${kind.name[0]}-${_hex(key)}';

class Rhyme {
  const Rhyme(this.word, this.metre, this.sameMetre);
  final String word;
  final String metre;
  final bool sameMetre;
}

String _pattern(List<Akshara> a) => a.map((x) => x.long ? '–' : '∪').join();

/// Order the candidates for one word, as rankRhymes in rhyme.ts.
List<Rhyme> rankRhymes(String word, RhymeKind kind, List<String> candidates, {int max = 60, bool sameLength = false, bool sameMetre = false}) {
  final q = aksharas(word.trim());
  if (q.isEmpty) return [];
  final qMetre = _pattern(q);
  final n = candidates.isEmpty ? 1 : candidates.length;
  final out = <(Rhyme, double)>[];
  for (var i = 0; i < candidates.length; i++) {
    final w = candidates[i];
    if (w == word) continue;
    final a = aksharas(w);
    if (a.isEmpty) continue;
    final metre = _pattern(a);
    final same = metre == qMetre;
    if (sameLength && a.length != q.length) continue;
    if (sameMetre && !same) continue;
    var s = 1 - i / n;
    if (a.length == q.length) s += 0.3;
    if (same) s += 0.5;
    switch (kind) {
      case RhymeKind.second:
        if (a[0].long == q[0].long) s += 0.6;
        if (a.length > 1 && q.length > 1 && vowelOf(a[1].text) == vowelOf(q[1].text)) s += 0.3;
      case RhymeKind.end:
        if (a.length > 1 && q.length > 1) {
          final pa = a[a.length - 2].text, pq = q[q.length - 2].text;
          if (vowelOf(pa) == vowelOf(pq)) s += 0.4;
          if (pa == pq) s += 0.6;
        }
      case RhymeKind.first:
        if (a[0].text == q[0].text) s += 0.3;
    }
    out.add((Rhyme(w, metre, same), s));
  }
  out.sort((x, y) => y.$2.compareTo(x.$2));
  return [for (final r in out.take(max)) r.$1];
}

/// For a line of verse: the word whose rhyme matters for each kind (as rhymeSource in rhyme.ts).
String rhymeSource(String line, RhymeKind kind) {
  final clean = RegExp('[^ഀ-ൿ‌‍]');
  final words = line.trim().split(RegExp(r'\s+')).where((w) => RegExp('[ഀ-ൿ]').hasMatch(w)).toList();
  if (words.isEmpty) return '';
  if (kind == RhymeKind.end) return words.last.replaceAll(clean, '');
  final first = words.first.replaceAll(clean, '');
  if (kind == RhymeKind.first || aksharas(first).length >= 2) return first;
  return '$first${words.length > 1 ? words[1] : ''}'.replaceAll(clean, '');
}

class RhymeFinder {
  RhymeFinder(this.dict);
  final Dictionary dict;

  Future<List<Rhyme>> find(String word, RhymeKind kind, {int max = 80, bool sameLength = false, bool sameMetre = false}) async {
    final key = rhymeKey(word, kind);
    if (key == null) return [];
    final j = await dict.file(rhymePath(kind, key));
    final list = j is List ? j.cast<String>() : <String>[];
    return rankRhymes(word, kind, list, max: max, sameLength: sameLength, sameMetre: sameMetre);
  }
}
