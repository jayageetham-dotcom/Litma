/// Ranked offline Manglish suggestions: a port of packages/shared/src/manglish-rank.ts (keep the two
/// in step; test/manglish_rank_test.dart checks this port against the web engine's answers).
///
/// The letter rules in manglish.dart spell "enthaanu" as എന്താനു. With a word list (most used first,
/// the website's /dict/manglish-words.txt), this finds the real words that sound like what was
/// typed: a loose sound skeleton (ന/ണ, ല/ള, ര/റ, ത/ട/ദ, vowel length, doubled letters, a final
/// u or ് fall together) indexed by its consonant outline, then scored by closeness, the plain
/// reading, the vowel lengths the writer typed and how common the word is.
///
/// Nothing is forced on writers: with no close real word the plain reading leads, and it always
/// stays in the first six. Capitals, ~ and _, Litma's fixed words, word pieces and anything with
/// digits or punctuation keep the letter readings.
library;

import 'dart:math' as math;

import 'manglish.dart';

const String _virama = '്';
const Map<String, String> _sign = {
  'ാ': 'a', 'ി': 'i', 'ീ': 'i', 'ു': 'u', 'ൂ': 'u', 'ൃ': 'ri', 'െ': 'e', 'േ': 'e',
  'ൈ': 'ai', 'ൊ': 'o', 'ോ': 'o', 'ൌ': 'au', 'ൗ': 'au',
};
const Map<String, String> _ind = {
  'അ': 'a', 'ആ': 'a', 'ഇ': 'i', 'ഈ': 'i', 'ഉ': 'u', 'ഊ': 'u', 'ഋ': 'ri', 'എ': 'e', 'ഏ': 'e',
  'ഐ': 'ai', 'ഒ': 'o', 'ഓ': 'o', 'ഔ': 'au',
};
const Map<String, String> _cons = {
  'ക': 'k', 'ഖ': 'k', 'ഗ': 'g', 'ഘ': 'g', 'ങ': 'n',
  'ച': 'c', 'ഛ': 'c', 'ജ': 'j', 'ഝ': 'j', 'ഞ': 'J',
  'ട': 't', 'ഠ': 't', 'ഡ': 't', 'ഢ': 't', 'ണ': 'n',
  'ത': 't', 'ഥ': 't', 'ദ': 't', 'ധ': 't', 'ന': 'n',
  'പ': 'p', 'ഫ': 'p', 'ബ': 'b', 'ഭ': 'b', 'മ': 'm',
  'യ': 'y', 'ര': 'r', 'റ': 'r', 'ല': 'l', 'ള': 'l', 'വ': 'v',
  'ശ': 's', 'ഷ': 's', 'സ': 's', 'ഹ': 'h', 'ഴ': 'z',
};
const Map<String, String> _chillu = {
  'ൻ': 'n', 'ൺ': 'n', 'ൽ': 'l', 'ൾ': 'l', 'ർ': 'r', 'ൿ': 'k', 'ൔ': 'm', 'ൕ': 'y', 'ൖ': 'z', 'ം': 'm', 'ഃ': 'h',
};

final RegExp _doubled = RegExp(r'(.)\1+');
final RegExp _nasal = RegExp(r'[nm](?=[^aeiouyJ])');
final RegExp _glide = RegExp(r'(?<=[ie])y(?=[aeiou])');
final RegExp _finalU = RegExp(r'(?<=[^aeiou])u$');

String _squeeze(String s) => s
    .replaceAllMapped(_doubled, (m) => m[1]!)
    .replaceAll(_nasal, 'n')
    .replaceAll(_glide, '')
    .replaceAll(_finalU, '');

/// Sound skeleton of a word in Malayalam script.
String scriptKey(String word) {
  final ch = word.replaceAll(RegExp('[‌‍]'), '').split('');
  final out = StringBuffer();
  String? at(int i) => i >= 0 && i < ch.length ? ch[i] : null;
  for (var i = 0; i < ch.length; i++) {
    final c = ch[i];
    final cons = _cons[c];
    if (cons != null) {
      var k = cons;
      final prev = at(i - 1), prev2 = at(i - 2);
      // ന്റ and റ്റ are typed nt and tt
      if (c == 'റ' && prev == _virama && (prev2 == 'ന' || prev2 == 'റ')) k = 't';
      if (c == 'റ' && at(i + 1) == _virama && at(i + 2) == 'റ') k = 't';
      // ങ്ങ is typed ng
      if (c == 'ങ' && at(i + 1) == _virama && at(i + 2) == 'ങ') {
        out.write('ng');
        i += 2;
        continue;
      }
      // ജ്ഞ is typed jn, ഞ്ച nch
      if (c == 'ഞ' && prev == _virama && prev2 == 'ജ') k = 'n';
      if (c == 'ഞ' && at(i + 1) == _virama && at(i + 2) == 'ച') k = 'n';
      out.write(k);
      final nx = at(i + 1);
      if (nx == _virama) {
        i++;
        continue;
      }
      if (nx != null && _sign.containsKey(nx)) {
        out.write(_sign[nx]);
        i++;
        continue;
      }
      out.write('a');
      continue;
    }
    final v = _ind[c] ?? _chillu[c] ?? _sign[c];
    if (v != null) out.write(v);
  }
  return _squeeze(out.toString());
}

/// Consonant outline of a skeleton: the index key.
String outline(String skel) => skel.replaceAll(RegExp('[aeiouy]'), '').replaceAll('g', 'k').replaceAll('b', 'p').replaceAll('z', 'r');

const List<(String, List<String>)> _lat = [
  ('chh', ['c']), ('ksh', ['ks']), ('nch', ['nc']), ('nth', ['nt']),
  ('ng', ['ng', 'n']), ('nk', ['nk']), ('nj', ['J', 'nc']), ('ny', ['J', 'ny']), ('cch', ['c']),
  ('th', ['t']), ('dh', ['t']), ('kh', ['k']), ('gh', ['g']), ('ch', ['c']), ('jh', ['j']),
  ('sh', ['s']), ('zh', ['z']), ('ph', ['p']), ('bh', ['b']),
  ('aa', ['a']), ('ee', ['i', 'e']), ('ii', ['i']), ('oo', ['u', 'o']), ('uu', ['u']),
  ('ae', ['e']), ('ai', ['ai']), ('ei', ['ai']), ('ou', ['au']), ('au', ['au', 'o']), ('oa', ['o']),
  ('x', ['ks']), ('q', ['k']), ('f', ['p']), ('w', ['v']), ('z', ['s', 'z']), ('d', ['t']),
  ('a', ['a']), ('e', ['e']), ('i', ['i']), ('o', ['o']), ('u', ['u']),
  ('k', ['k']), ('g', ['g']), ('c', ['c', 'k']), ('j', ['j']), ('t', ['t']), ('n', ['n']),
  ('p', ['p']), ('b', ['b']), ('m', ['m']), ('y', ['y']), ('r', ['r']), ('l', ['l']),
  ('v', ['v']), ('s', ['s']), ('h', ['h']),
];

/// The skeletons a Manglish word may stand for.
List<String> latinKeys(String word, {int limit = 16}) {
  final w = word
      .toLowerCase()
      .replaceAll(RegExp('[^a-z]'), '')
      .replaceAll(RegExp(r'c[ck](?!h)'), 'k')
      .replaceAll(RegExp(r'c(?=[eiy])'), 's')
      .replaceAll('tion', 'shan')
      .replaceAll(RegExp(r'(?<=[^aeiou][^aeiou]?)e$'), '')
      .replaceAll(RegExp(r'y(?![aeiou])'), 'i');
  var acc = <String>[''];
  var i = 0;
  while (i < w.length) {
    (String, List<String>)? hit;
    for (final e in _lat) {
      if (w.startsWith(e.$1, i)) {
        hit = e;
        break;
      }
    }
    if (hit == null) {
      i++;
      continue;
    }
    if (hit.$1 == 'h' && i > 0 && !'aeiou'.contains(w[i - 1])) {
      i++;
      continue;
    }
    final next = <String>[];
    for (final a in acc) {
      for (final v in hit.$2) {
        next.add(a + v);
      }
    }
    acc = next.take(limit).toList();
    i += hit.$1.length;
  }
  return acc.map(_squeeze).toSet().toList();
}

const Set<String> _long = {'ാ', 'ീ', 'ൂ', 'േ', 'ോ', 'ആ', 'ഈ', 'ഊ', 'ഏ', 'ഓ', 'ൈ', 'ൗ', 'ൌ', 'ഐ', 'ഔ'};
const Set<String> _short = {'ി', 'ു', 'െ', 'ൊ', 'ൃ', 'അ', 'ഇ', 'ഉ', 'എ', 'ഒ', 'ഋ'};
final RegExp _finalS = RegExp(r'S$');

/// Vowel lengths written in a word (S short, L long), a final short one left out.
String scriptLengths(String word) {
  final ch = word.split('');
  final out = StringBuffer();
  for (var i = 0; i < ch.length; i++) {
    final c = ch[i];
    if (_long.contains(c)) {
      out.write('L');
    } else if (_short.contains(c)) {
      out.write('S');
    } else if (_cons.containsKey(c)) {
      final nx = i + 1 < ch.length ? ch[i + 1] : null;
      if (nx == null || (!_long.contains(nx) && !_short.contains(nx) && nx != _virama)) out.write('S');
    }
  }
  return out.toString().replaceAll(_finalS, '');
}

final RegExp _diphthong = RegExp(r'^(ai|au|ou|ei|ia|io|iu|ua|ue|ui|eo|ea|oe)$');

/// Vowel lengths the writer typed (aa, ee, oo… are long).
String latinLengths(String word) {
  final groups = RegExp('[aeiou]+').allMatches(word.toLowerCase()).map((m) => m[0]!);
  final out = groups.map((g) => g.length > 1 && !_diphthong.hasMatch(g) ? 'L' : 'S').join();
  return out.replaceAll(_finalS, '');
}

const Set<String> _vow = {'a', 'e', 'i', 'o', 'u'};
const Set<String> _near = {'kg', 'gk', 'pb', 'bp', 'cj', 'jc', 'nJ', 'Jn'};
double _cost(String c) => _vow.contains(c) ? 0.5 : 1;

double _skelDist(String a, String b) {
  final n = b.length;
  var prev = List<double>.filled(n + 1, 0);
  for (var j = 1; j <= n; j++) {
    prev[j] = prev[j - 1] + _cost(b[j - 1]);
  }
  for (var i = 1; i <= a.length; i++) {
    final cur = List<double>.filled(n + 1, 0);
    cur[0] = prev[0] + _cost(a[i - 1]);
    for (var j = 1; j <= n; j++) {
      final x = a[i - 1], y = b[j - 1];
      final sub = x == y ? 0.0 : ((_vow.contains(x) && _vow.contains(y)) || _near.contains(x + y) ? 0.5 : 1.0);
      cur[j] = math.min(prev[j - 1] + sub, math.min(prev[j] + _cost(x), cur[j - 1] + _cost(y)));
    }
    prev = cur;
  }
  return prev[n];
}

int _lev(String a, String b) {
  final n = b.length;
  var prev = List<int>.generate(n + 1, (j) => j);
  for (var i = 1; i <= a.length; i++) {
    final cur = List<int>.filled(n + 1, 0);
    cur[0] = i;
    for (var j = 1; j <= n; j++) {
      cur[j] = math.min(prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1), math.min(prev[j] + 1, cur[j - 1] + 1));
    }
    prev = cur;
  }
  return prev[n];
}

/// Weights, the same as RANK_WEIGHTS on the web.
const double _wSkel = 2, _wLit = 0.6, _wFreq = 0.2, _maxSkel = 1.5, _wLen = 0.6;

class _Entry {
  _Entry(this.w, this.s, this.f);
  final String w;
  final String s;
  final double f;
}

/// One word per line, most used first.
List<String> parseWordList(String text) => text.split('\n').map((w) => w.trim()).where((w) => w.isNotEmpty).toList();

final RegExp _onlyLetters3 = RegExp(r'^[A-Za-z]{3,}$');
final RegExp _piece = RegExp(r'^(ng|nk|mp|nt|nd|nch|nth|rr|thh)');
final RegExp _capital = RegExp('[A-Z]');
final RegExp _yStart = RegExp(r'^y(?=[aeiou])');

class ManglishRanker {
  ManglishRanker._(this._idx, this.size);
  final Map<String, List<_Entry>> _idx;

  /// How many words the list holds.
  final int size;

  /// Build in one go (tests).
  factory ManglishRanker.of(List<String> words) {
    final idx = <String, List<_Entry>>{};
    _add(idx, words, 0, words.length);
    return ManglishRanker._(idx, words.length);
  }

  /// Build a slice at a time, yielding to the app between slices so typing never waits.
  static Future<ManglishRanker> build(List<String> words, {int slice = 4000}) async {
    final idx = <String, List<_Entry>>{};
    for (var i = 0; i < words.length; i += slice) {
      _add(idx, words, i, i + slice);
      await Future<void>.delayed(Duration.zero);
    }
    return ManglishRanker._(idx, words.length);
  }

  static void _add(Map<String, List<_Entry>> idx, List<String> words, int start, int end) {
    for (var i = start; i < end && i < words.length; i++) {
      final w = words[i];
      final s = scriptKey(w);
      if (s.isEmpty) continue;
      idx.putIfAbsent(outline(s), () => []).add(_Entry(w, s, -math.log(i + 1)));
    }
  }

  /// Known words that fit a Manglish word, best first.
  List<String> lookup(String word, {int max = 8}) {
    final keys = latinKeys(word);
    final literal = manglishWord(word);
    final literalHalf = literal.replaceAll(RegExp(r'ു$'), '്');
    final lens = latinLengths(word);
    final scores = <String, double>{};
    for (final o in keys.map(outline).toSet()) {
      for (final e in _idx[o] ?? const <_Entry>[]) {
        if (scores.containsKey(e.w)) continue;
        final es = e.s.replaceAll(_yStart, '');
        var d = double.infinity;
        final ev = es.isNotEmpty && _vow.contains(es[0]);
        for (final k in keys) {
          final kv = k.isNotEmpty && _vow.contains(k[0]);
          d = math.min(d, _skelDist(k, e.s) + (kv == ev ? 0 : 1));
        }
        if (d > _maxSkel) continue;
        scores[e.w] = -_wSkel * d - _wLit * math.min(_lev(literal, e.w), _lev(literalHalf, e.w)) + _wFreq * e.f - _wLen * _lev(lens, scriptLengths(e.w));
      }
    }
    // best first; equal scores keep list order (most used first), like the web's stable sort
    final list = scores.keys.toList();
    final order = {for (var i = 0; i < list.length; i++) list[i]: i};
    list.sort((a, b) {
      final c = scores[b]!.compareTo(scores[a]!);
      return c != 0 ? c : order[a]!.compareTo(order[b]!);
    });
    return list.take(max).toList();
  }

  /// Known words that sound like a Malayalam word (കര്യം → കാര്യം): spelling suggestions for a
  /// word the dictionary doesn't know. Same as the web's `similar`.
  List<String> similar(String word, {int max = 6}) {
    final w = word.replaceAll(RegExp('[\u200c\u200d]'), '');
    final s = scriptKey(w);
    if (s.isEmpty) return const [];
    final scores = <String, double>{};
    for (final e in _idx[outline(s)] ?? const <_Entry>[]) {
      if (e.w == w || scores.containsKey(e.w)) continue;
      final d = _skelDist(s, e.s);
      if (d > _maxSkel) continue;
      final l = _lev(w, e.w);
      if (l > 2) continue;
      scores[e.w] = -_wSkel * d - _wLit * l + _wFreq * e.f;
    }
    final list = scores.keys.toList();
    final order = {for (var i = 0; i < list.length; i++) list[i]: i};
    list.sort((a, b) {
      final c = scores[b]!.compareTo(scores[a]!);
      return c != 0 ? c : order[a]!.compareTo(order[b]!);
    });
    return list.take(max).toList();
  }

  /// The offline suggestion list: known words first, then the letter readings (never dropped).
  List<String> suggest(String word, {int max = 6}) {
    final out = <String>[];
    void add(String s) {
      if (s.isNotEmpty && !out.contains(s)) out.add(s);
    }

    final fixed = manglishCommon[word];
    if (fixed != null) add(fixed);
    if (!_onlyLetters3.hasMatch(word) || _piece.hasMatch(word)) {
      manglishCandidates(word, max: max).forEach(add);
      return out.take(max).toList();
    }
    if (_capital.hasMatch(word)) add(manglishWord(word));
    lookup(word, max: max).forEach(add);
    manglishCandidates(word, max: max).forEach(add);
    final lit = manglishWord(word);
    final keep = math.min(max, 6);
    if (!out.take(keep).contains(lit)) {
      out.remove(lit);
      out.insert(math.min(keep - 1, out.length), lit);
    }
    return out.take(max).toList();
  }
}
