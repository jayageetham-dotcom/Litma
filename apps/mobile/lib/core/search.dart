// Search that understands Manglish: "puthiya" finds പുതിയ, "nammude" finds നമ്മുടെ, even
// part-way through a word. A port of packages/shared/src/search.ts (keep the two in step;
// test/search_test.dart checks the same cases).

const _vowels = {
  'അ': 'a', 'ആ': 'aa', 'ഇ': 'i', 'ഈ': 'ee', 'ഉ': 'u', 'ഊ': 'oo', 'ഋ': 'ru', 'എ': 'e', 'ഏ': 'e', 'ഐ': 'ai', 'ഒ': 'o', 'ഓ': 'o', 'ഔ': 'au',
};
const _signs = {
  'ാ': 'aa', 'ി': 'i', 'ീ': 'ee', 'ു': 'u', 'ൂ': 'oo', 'ൃ': 'ru', 'െ': 'e', 'േ': 'e', 'ൈ': 'ai', 'ൊ': 'o', 'ോ': 'o', 'ൌ': 'au', 'ൗ': 'au',
};
const _consonants = {
  'ക': 'k', 'ഖ': 'kh', 'ഗ': 'g', 'ഘ': 'gh', 'ങ': 'ng', 'ച': 'ch', 'ഛ': 'chh', 'ജ': 'j', 'ഝ': 'jh', 'ഞ': 'nj',
  'ട': 't', 'ഠ': 'th', 'ഡ': 'd', 'ഢ': 'dh', 'ണ': 'n', 'ത': 'th', 'ഥ': 'th', 'ദ': 'd', 'ധ': 'dh', 'ന': 'n',
  'പ': 'p', 'ഫ': 'ph', 'ബ': 'b', 'ഭ': 'bh', 'മ': 'm', 'യ': 'y', 'ര': 'r', 'റ': 'r', 'ല': 'l', 'ള': 'l',
  'ഴ': 'zh', 'വ': 'v', 'ശ': 'sh', 'ഷ': 'sh', 'സ': 's', 'ഹ': 'h',
};
const _other = {'ം': 'm', 'ഃ': 'h', 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'l', 'ൺ': 'n', 'ൿ': 'k'};
const _clusters = [
  ['ന്റ', 'nt'], ['റ്റ', 'tt'], ['ഞ്ഞ', 'nj'], ['ങ്ങ', 'ng'], ['ന്ത', 'nth'], ['ക്ഷ', 'ksh'],
];
const _virama = '്';
final _ml = RegExp(r'[ഀ-ൿ]');
final _mlWord = RegExp(r'[ഀ-ൿ‌‍]+');
final _latin = RegExp(r'[a-z]', caseSensitive: false);

/// Malayalam script → English letters, the way it is usually typed ("പുതിയ" → "puthiya").
String romanise(String text) {
  var s = text.replaceAll(RegExp('[‌‍]'), '');
  for (final c in _clusters) {
    s = s.replaceAll(c[0], '\u0001${c[1]}\u0002');
  }
  final out = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    final ch = s[i];
    if (ch == '\u0001') {
      final end = s.indexOf('\u0002', i);
      out.write(s.substring(i + 1, end));
      i = end;
      out.write(_vowelAfter(s, i));
      if (i + 1 < s.length && (s[i + 1] == _virama || _signs.containsKey(s[i + 1]))) i++;
      continue;
    }
    final cons = _consonants[ch];
    if (cons != null) {
      out.write(cons + _vowelAfter(s, i));
      if (i + 1 < s.length && (s[i + 1] == _virama || _signs.containsKey(s[i + 1]))) i++;
      continue;
    }
    out.write(_vowels[ch] ?? _other[ch] ?? (ch == _virama ? '' : ch));
  }
  return out.toString();
}

String _vowelAfter(String s, int i) {
  if (i + 1 >= s.length) return 'a';
  final next = s[i + 1];
  if (next == _virama) return '';
  return _signs[next] ?? 'a';
}

/// A rough sound key: aspirates and long vowels fold together, doubled letters become single.
String soundKey(String text) {
  return romanise(text.toLowerCase())
      .replaceAll(RegExp('chh|ch'), 'c')
      .replaceAll('sh', 's')
      .replaceAll('zh', 'z')
      .replaceAllMapped(RegExp('([kgjtdpb])h'), (m) => m[1]!)
      .replaceAll('th', 't')
      .replaceAll('f', 'p')
      .replaceAll('w', 'v')
      .replaceAll('q', 'k')
      .replaceAll('x', 'ks')
      .replaceAll('d', 't')
      .replaceAll('aa', 'a')
      .replaceAll(RegExp('ee|ii'), 'i')
      .replaceAll(RegExp('oo|uu'), 'u')
      .replaceAllMapped(RegExp(r'(.)\1+'), (m) => m[1]!)
      .replaceAll(RegExp(r'[^a-z0-9ഀ-ൿ]+'), ' ')
      .trim();
}

String _mlKey(String text) => _mlWord.allMatches(text).map((m) => soundKey(m[0]!)).join(' ');

/// Does [text] match [query]? Every query word must be found as typed, or (in English letters)
/// by sound in the Malayalam of the text.
bool matchesSearch(String? text, String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return true;
  if (text == null || text.isEmpty) return false;
  final plain = text.toLowerCase();
  if (plain.contains(q)) return true;
  if (!_latin.hasMatch(q) || !_ml.hasMatch(text)) return false;
  final key = _mlKey(text);
  return q.split(RegExp(r'\s+')).every((w) {
    if (plain.contains(w)) return true;
    if (!_latin.hasMatch(w)) return false;
    final k = soundKey(w);
    return k.isNotEmpty && key.contains(k);
  });
}

/// Malayalam words in [text] that sound like the English-letters [query], best first.
List<String> manglishMatches(String text, String query, {int max = 4}) {
  final q = query.trim();
  if (q.isEmpty || !_latin.hasMatch(q) || q.contains(RegExp(r'\s'))) return const [];
  final k = soundKey(q);
  if (k.isEmpty) return const [];
  final seen = <String, int>{};
  for (final m in _mlWord.allMatches(text)) {
    final w = m[0]!;
    if (seen.containsKey(w)) continue;
    final wk = soundKey(w);
    final at = wk.indexOf(k);
    if (at >= 0) seen[w] = at == 0 ? wk.length : 1000 + wk.length;
  }
  final list = seen.entries.toList()..sort((a, b) => a.value.compareTo(b.value));
  return list.take(max).map((e) => e.key).toList();
}
