// Search that understands Manglish: "puthiya" finds പുതിയ, "nammude" finds നമ്മുടെ, even
// part-way through a word, and forgives (കത finds കഥ, "malayalm" finds മലയാളം). A port of packages/shared/src/search.ts (keep the two in step;
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
final _mlWord = RegExp(r'[ഀ-ൿ‌‍]+');

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

/// Typos a word may have and still match, by the length of its sound key (as the web's `slips`).
int _slips(int n) => n < 5 ? 0 : (n < 12 ? 1 : 2);

/// Edit distance of [a] and [b] (a swap of neighbours counts as one), or max + 1 when above [max].
int _distance(String a, String b, int max) {
  if ((a.length - b.length).abs() > max) return max + 1;
  var before = <int>[];
  var prev = List<int>.generate(b.length + 1, (j) => j);
  for (var i = 1; i <= a.length; i++) {
    final cur = List<int>.filled(b.length + 1, 0);
    cur[0] = i;
    var best = i;
    for (var j = 1; j <= b.length; j++) {
      var v = [prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1), prev[j] + 1, cur[j - 1] + 1].reduce((x, y) => x < y ? x : y);
      if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] && before[j - 2] + 1 < v) v = before[j - 2] + 1;
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    before = prev;
    prev = cur;
  }
  return prev[b.length] < max + 1 ? prev[b.length] : max + 1;
}

/// How many typos away the start of word key [wk] is from [k], or -1 when too far.
int _nearStart(String wk, String k) {
  final s = _slips(k.length);
  if (s == 0) return -1;
  var best = s + 1;
  final from = k.length - s < 1 ? 1 : k.length - s;
  final to = wk.length < k.length + s ? wk.length : k.length + s;
  for (var len = from; len <= to; len++) {
    final d = _distance(wk.substring(0, len), k, s);
    if (d < best) best = d;
  }
  return best <= s ? best : -1;
}

/// Sound keys of the words of a text: Malayalam by sound, other words as typed.
List<String> _wordKeys(String text) {
  final ml = _mlWord.allMatches(text).map((m) => soundKey(m[0]!));
  final other = text.replaceAll(_mlWord, ' ').toLowerCase().split(RegExp('[^a-z0-9]+')).where((w) => w.isNotEmpty).map(soundKey);
  return [...ml, ...other];
}

/// How well [text] matches [query]: 3 as typed, 2 by sound (Manglish, or a Malayalam spelling that
/// sounds the same: കത finds കഥ), 1 with a typo ("malayalm"), 0 not at all. Same as the web's searchRank.
int searchRank(String? text, String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return 3;
  if (text == null || text.isEmpty) return 0;
  final plain = text.toLowerCase();
  if (plain.contains(q)) return 3;
  List<String>? keys;
  var joined = '';
  var rank = 3;
  for (final w in q.split(RegExp(r'\s+'))) {
    if (plain.contains(w)) continue;
    keys ??= _wordKeys(text);
    if (joined.isEmpty) joined = keys.join(' ');
    final k = soundKey(w).replaceAll(RegExp(r'\s+'), '');
    if (k.isEmpty) return 0;
    if (joined.contains(k)) {
      if (rank > 2) rank = 2;
    } else if (keys.any((wk) => _nearStart(wk, k) >= 0)) {
      rank = 1;
    } else {
      return 0;
    }
  }
  return rank;
}

/// Does [text] match [query]? As typed, by sound (Manglish or Malayalam), or with a typo.
bool matchesSearch(String? text, String query) => searchRank(text, query) > 0;

/// Malayalam words in [text] that sound like [query], best first (Manglish → Malayalam; Malayalam →
/// other spellings of the same sound and near misses, never the query itself). As the web's.
List<String> manglishMatches(String text, String query, {int max = 4}) {
  final q = query.trim();
  if (q.isEmpty || q.contains(RegExp(r'\s'))) return const [];
  final k = soundKey(q);
  if (k.isEmpty) return const [];
  final seen = <String, int>{};
  for (final m in _mlWord.allMatches(text)) {
    final w = m[0]!;
    if (seen.containsKey(w) || w == q) continue;
    final wk = soundKey(w);
    final at = wk.indexOf(k);
    if (at >= 0) {
      seen[w] = at == 0 ? wk.length : 1000 + wk.length;
    } else {
      final d = _nearStart(wk, k);
      if (d >= 0) seen[w] = 2000 + d * 100 + (wk.length - k.length).abs();
    }
  }
  final list = seen.entries.toList();
  final order = {for (var i = 0; i < list.length; i++) list[i].key: i};
  list.sort((a, b) {
    final c = a.value.compareTo(b.value);
    return c != 0 ? c : order[a.key]!.compareTo(order[b.key]!);
  });
  return list.take(max).map((e) => e.key).toList();
}
