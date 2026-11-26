/// Metre (വൃത്തം) of Malayalam verse: syllables with their laghu / guru weight, and the metre a
/// stanza is written in, with the syllables that don't fit it. A port of
/// packages/shared/src/metre.ts (same answers, checked by test/metre_test.dart against the web's
/// answers in test/metre_vectors.json). Keep the two in step.
library;

import 'dart:math' as math;

const _virama = '്';
const _zwj = '\u200D';
const _zwnj = '\u200C';

String? _at(String s, int i) => i >= 0 && i < s.length ? s[i] : null;
bool _between(String? c, String a, String b) => c != null && c.compareTo(a) >= 0 && c.compareTo(b) <= 0;
bool _isCons(String? c) => _between(c, 'ക', 'ഹ') || c == 'ഺ';
bool _isVowel(String? c) => _between(c, 'അ', 'ഔ') || c == 'ൠ' || c == 'ൡ';
const _longVowels = 'ആഈഊൠഏഐഓഔൡ';
bool _isSign(String? c) =>
    _between(c, 'ാ', '്') || c == 'ൗ' || c == 'ൢ' || c == 'ൣ' || _between(c, 'ഁ', 'ഃ');
const _longSigns = 'ാീൂൄേൈോൌൗൣ';
bool _isChillu(String? c) => _between(c, 'ൺ', 'ൿ') || _between(c, 'ൔ', 'ൖ') || c == 'ൎ';
bool _isLetter(String? c) => _isCons(c) || _isVowel(c) || _isSign(c) || _isChillu(c) || c == _zwj || c == _zwnj;

class Syllable {
  Syllable(this.text, this.start, this.end, this.optional);
  String text;
  int start;
  int end;

  /// 'L' or 'G' when the syllable is counted
  String w = 'L';

  /// a word-final ് that may also be left uncounted
  final bool optional;
}

/// The syllables (aksharas) of one line with their weight.
List<Syllable> scanLine(String line) {
  final out = <Syllable>[];
  final n = line.length;
  var i = 0;
  while (i < n) {
    final c = line[i];
    // a chillu (ൽ, or the old ല്\u200D) closes the syllable before it
    final oldChillu = _isCons(c) && _at(line, i + 1) == _virama && _at(line, i + 2) == _zwj;
    if (_isChillu(c) || oldChillu) {
      final len = oldChillu ? 3 : 1;
      final prev = out.isEmpty ? null : out.last;
      if (prev != null && prev.end == i) {
        prev.end = i + len;
        prev.text = line.substring(prev.start, prev.end);
      }
      i += len;
      // ൻ്റ is the conjunct ന്റ: its virama belongs to the chillu
      if (_at(line, i) == _virama) {
        if (prev != null && prev.end == i) {
          prev.end = i + 1;
          prev.text = line.substring(prev.start, prev.end);
        }
        i++;
      }
      continue;
    }
    if (!_isCons(c) && !_isVowel(c)) {
      i++;
      continue;
    }
    final start = i;
    var j = i;
    if (_isCons(c)) {
      while (_isCons(_at(line, j)) && _at(line, j + 1) == _virama && _isCons(_at(line, j + 2))) {
        j += 2;
      }
    }
    j++;
    while (j < n && (_isSign(line[j]) || line[j] == _zwj || line[j] == _zwnj)) {
      j++;
    }
    final text = line.substring(start, j);
    final after = _at(line, j);
    final wordEnd = !_isLetter(after) || after == _zwnj || text.endsWith(_zwnj);
    final bare = text.replaceAll(RegExp('[\u200C\u200D]'), '');
    out.add(Syllable(text, start, j, _isCons(c) && bare.endsWith(_virama) && wordEnd));
    i = j;
  }
  final oldChilluRe = RegExp('[ക-ഺ]്\u200D');
  for (var k = 0; k < out.length; k++) {
    final s = out[k];
    final t = s.text;
    var long = _longVowels.contains(t[0]) ||
        t.split('').any((ch) => _longSigns.contains(ch) || ch == 'ം' || ch == 'ഃ' || _isChillu(ch)) ||
        oldChilluRe.hasMatch(t);
    final next = k + 1 < out.length ? out[k + 1].text : null;
    // before a conjunct (also across a space)
    if (!long && !s.optional && next != null && _isCons(_at(next, 0)) && _at(next, 1) == _virama && _isCons(_at(next, 2))) {
      long = true;
    }
    s.w = long ? 'G' : 'L';
  }
  return out;
}

/// One way to read a line: the syllables counted (indexes into the scan) and their weights.
class Reading {
  Reading(this.idx, this.w);
  final List<int> idx;
  final String w;
}

int _bits(int m) {
  var c = 0;
  for (; m != 0; m >>= 1) {
    c += m & 1;
  }
  return c;
}

/// Every reading of a line: each word-final ് counted (short) or not (the syllable before turns guru).
List<Reading> readings(List<Syllable> syls) {
  final opt = <int>[];
  for (var k = 0; k < syls.length; k++) {
    if (syls[k].optional && k > 0 && opt.length < 8) opt.add(k);
  }
  final seen = <String>{};
  final out = <Reading>[];
  final masks = List<int>.generate(1 << opt.length, (m) => m)
    ..sort((a, b) {
      final d = _bits(a) - _bits(b);
      return d != 0 ? d : a - b;
    });
  for (final m in masks) {
    final drop = <int>{for (var b = 0; b < opt.length; b++) if (m & (1 << b) != 0) opt[b]};
    final idx = <int>[];
    final w = <String>[];
    for (var k = 0; k < syls.length; k++) {
      if (drop.contains(k)) {
        if (w.isNotEmpty) w[w.length - 1] = 'G';
        continue;
      }
      idx.add(k);
      w.add(syls[k].w);
    }
    final key = '${w.join()}:${idx.join(',')}';
    if (!seen.add(key)) continue;
    out.add(Reading(idx, w.join()));
  }
  return out;
}

// ─── Metres ──────────────────────────────────────────────────────────────

const _gana = {'Y': 'LGG', 'M': 'GGG', 'T': 'GGL', 'R': 'GLG', 'J': 'LGL', 'B': 'GLL', 'N': 'LLL', 'S': 'LLG', 'L': 'L', 'G': 'G'};

/// The gana a group of three is (for showing a line's ganas).
const ganaMl = {'LGG': 'യ', 'GGG': 'മ', 'GGL': 'ത', 'GLG': 'ര', 'LGL': 'ജ', 'GLL': 'ഭ', 'LLL': 'ന', 'LLG': 'സ', 'L': 'ല', 'G': 'ഗ'};
String _pattern(String ganas) => ganas.split('').map((g) => _gana[g]!).join();

class Metre {
  const Metre(this.id, this.ml, this.en, this.kind, {this.ganas, this.even, this.of, this.counts, this.groups});
  final String id;
  final String ml;
  final String en;

  /// sama, ardhasama, upajati, anushtup or bhasha
  final String kind;
  final String? ganas;
  final String? even;
  final List<String>? of;
  final List<List<int>>? counts;
  final List<int>? groups;
}

const sama = [
  Metre('vidyunmala', 'വിദ്യുന്മാല', 'Vidyunmala', 'sama', ganas: 'MMGG'),
  Metre('pramanika', 'പ്രമാണിക', 'Pramanika', 'sama', ganas: 'JRLG'),
  Metre('indravajra', 'ഇന്ദ്രവജ്ര', 'Indravajra', 'sama', ganas: 'TTJGG'),
  Metre('upendravajra', 'ഉപേന്ദ്രവജ്ര', 'Upendravajra', 'sama', ganas: 'JTJGG'),
  Metre('rathoddhata', 'രഥോദ്ധത', 'Rathoddhata', 'sama', ganas: 'RNRLG'),
  Metre('swagata', 'സ്വാഗത', 'Swagata', 'sama', ganas: 'RNBGG'),
  Metre('shalini', 'ശാലിനി', 'Shalini', 'sama', ganas: 'MTTGG'),
  Metre('dodhakam', 'ദോധകം', 'Dodhakam', 'sama', ganas: 'BBBGG'),
  Metre('kalyani', 'കല്യാണി', 'Kalyani', 'sama', ganas: 'TTTGG'),
  Metre('vamsastham', 'വംശസ്ഥം', 'Vamsastham', 'sama', ganas: 'JTJR'),
  Metre('indravamsa', 'ഇന്ദ്രവംശ', 'Indravamsa', 'sama', ganas: 'TTJR'),
  Metre('drutavilambitam', 'ദ്രുതവിളംബിതം', 'Drutavilambitam', 'sama', ganas: 'NBBR'),
  Metre('todakam', 'തോടകം', 'Todakam', 'sama', ganas: 'SSSS'),
  Metre('bhujangaprayatam', 'ഭുജംഗപ്രയാതം', 'Bhujangaprayatam', 'sama', ganas: 'YYYY'),
  Metre('sragvini', 'സ്രഗ്വിണി', 'Sragvini', 'sama', ganas: 'RRRR'),
  Metre('pramitakshara', 'പ്രമിതാക്ഷര', 'Pramitakshara', 'sama', ganas: 'SJSS'),
  Metre('manjubhashini', 'മഞ്ജുഭാഷിണി', 'Manjubhashini', 'sama', ganas: 'SJSJG'),
  Metre('praharshini', 'പ്രഹർഷിണി', 'Praharshini', 'sama', ganas: 'MNJRG'),
  Metre('ruchira', 'രുചിര', 'Ruchira', 'sama', ganas: 'JBSJG'),
  Metre('vasantatilakam', 'വസന്തതിലകം', 'Vasantatilakam', 'sama', ganas: 'TBJJGG'),
  Metre('malini', 'മാലിനി', 'Malini', 'sama', ganas: 'NNMYY'),
  Metre('panchachamaram', 'പഞ്ചചാമരം', 'Panchachamaram', 'sama', ganas: 'JRJRJG'),
  Metre('shikharini', 'ശിഖരിണി', 'Shikharini', 'sama', ganas: 'YMNSBLG'),
  Metre('prithvi', 'പൃഥ്വി', 'Prithvi', 'sama', ganas: 'JSJSYLG'),
  Metre('mandakranta', 'മന്ദാക്രാന്ത', 'Mandakranta', 'sama', ganas: 'MBNTTGG'),
  Metre('harini', 'ഹരിണി', 'Harini', 'sama', ganas: 'NSMRSLG'),
  Metre('shardulavikriditam', 'ശാർദ്ദൂലവിക്രീഡിതം', 'Shardulavikriditam', 'sama', ganas: 'MSJSTTG'),
  Metre('sragdhara', 'സ്രഗ്ദ്ധര', 'Sragdhara', 'sama', ganas: 'MRBNYYY'),
];

const ardhasama = [
  Metre('viyogini', 'വിയോഗിനി', 'Viyogini', 'ardhasama', ganas: 'SSJG', even: 'SBRLG'),
  Metre('pushpitagra', 'പുഷ്പിതാഗ്ര', 'Pushpitagra', 'ardhasama', ganas: 'NNRY', even: 'NJJRG'),
];

const upajati = [
  Metre('upajati', 'ഉപജാതി', 'Upajati', 'upajati', of: ['indravajra', 'upendravajra']),
  Metre('upajati-vamsa', 'ഉപജാതി', 'Upajati', 'upajati', of: ['vamsastham', 'indravamsa']),
];

const anushtupMetre = Metre('anushtup', 'അനുഷ്ടുപ്പ്', 'Anushtup (shloka)', 'anushtup');

const bhashaMetres = [
  Metre('manikanchi', 'മണികാഞ്ചി', 'Manikanchi', 'bhasha', counts: [[14], [14]], groups: [5, 3, 3, 3]),
  Metre('keka', 'കേക', 'Keka', 'bhasha', counts: [[14], [14]], groups: [3, 2, 2, 3, 2, 2]),
  Metre('annanada', 'അന്നനട', 'Annanada', 'bhasha', counts: [[12], [12]], groups: [2, 2, 2, 2, 2, 2]),
  Metre('kakali', 'കാകളി', 'Kakali', 'bhasha', counts: [[12], [12]], groups: [3, 3, 3, 3]),
  Metre('kalakanchi', 'കളകാഞ്ചി', 'Kalakanchi', 'bhasha', counts: [[16, 18], [12]], groups: [3, 3, 3, 3]),
  Metre('manjari', 'മഞ്ജരി', 'Manjari', 'bhasha', counts: [[12], [10]], groups: [3, 3, 3, 3]),
  Metre('unakakali', 'ഊനകാകളി', 'Unakakali', 'bhasha', counts: [[12], [11]], groups: [3, 3, 3, 3]),
  Metre('marakakali', 'മാരകാകളി', 'Marakakali', 'bhasha', counts: [[12], [8]], groups: [3, 3, 3, 3]),
  Metre('drutakakali', 'ദ്രുതകാകളി', 'Drutakakali (Pana)', 'bhasha', counts: [[11], [11]], groups: [3, 3, 3, 2]),
  Metre('nathonnatha', 'നതോന്നത', 'Nathonnatha', 'bhasha', counts: [[16], [13]], groups: [2, 2, 2, 2, 2, 2, 2, 2]),
  Metre('tharangini', 'തരംഗിണി', 'Tharangini', 'bhasha'),
];

final List<Metre> metres = [...sama, ...ardhasama, ...upajati, anushtupMetre, ...bhashaMetres];

/// The laghu–guru pattern a metre asks of a line (odd = first, third… line).
String patternOf(Metre m, {bool odd = true}) {
  if (m.kind == 'ardhasama') return _pattern(odd ? m.ganas! : m.even!);
  if (m.ganas != null) return _pattern(m.ganas!);
  return '';
}

/// "ത ഭ ജ ജ ഗ ഗ" for a metre's ganas.
String ganaNames(String ganas) => ganas.split('').map((g) => ganaMl[_gana[g]]!).join(' ');

// ─── Checking ────────────────────────────────────────────────────────────

class CheckedSyllable {
  CheckedSyllable(this.s, this.counted, this.weight, this.wrong, this.group);
  final Syllable s;
  String get text => s.text;
  int get start => s.start;
  int get end => s.end;

  /// counted in the reading that fits best
  final bool counted;

  /// 'L' or 'G' in that reading
  final String weight;

  /// laghu where the metre asks guru, or the reverse
  final bool wrong;

  /// which gana (group) it is in; -1 when not counted
  final int group;
}

class LineCheck {
  LineCheck(this.text, this.syllables, this.count, this.matras, this.expected, this.ok);
  final String text;
  final List<CheckedSyllable> syllables;
  final int count;
  final int matras;
  final int? expected;
  final bool ok;

  LineCheck withExpected(int? e, bool ok) => LineCheck(text, syllables, count, matras, e, ok);
}

class MetreCheck {
  MetreCheck(this.metre, this.fit, this.lines, [this.lineMetres]);
  final Metre? metre;

  /// exact, likely, close or none
  final String fit;
  final List<LineCheck> lines;
  final List<String>? lineMetres;
}

class _Fitted {
  _Fitted(this.reading, this.wrong, this.groups);
  final Reading reading;
  final List<int> wrong;
  final List<int> groups;
}

List<int> _mismatches(String w, String pat, List<int> padaEnds) => [
      for (var k = 0; k < pat.length; k++)
        if (w[k] != pat[k] && !padaEnds.contains(k)) k,
    ];

_Fitted? _fitPattern(List<Reading> rs, List<List<String>> pats) {
  _Fitted? best;
  for (final padas in pats) {
    final pat = padas.join();
    final ends = <int>[];
    var acc = 0;
    for (final p in padas) {
      acc += p.length;
      ends.add(acc - 1);
    }
    for (final r in rs) {
      if (r.w.length != pat.length) continue;
      final wrong = _mismatches(r.w, pat, ends);
      final cur = best;
      if (cur == null || wrong.length < cur.wrong.length) {
        final groups = <int>[];
        for (final p in padas) {
          for (var k = 0; k + 3 <= p.length; k += 3) {
            groups.add(3);
          }
          for (var k = p.length - (p.length % 3); k < p.length; k++) {
            groups.add(1);
          }
        }
        final fitted = _Fitted(r, wrong, groups);
        if (wrong.isEmpty) return fitted;
        best = fitted;
      }
    }
  }
  return best;
}

Reading _nearestCount(List<Reading> rs, List<int> counts) {
  var best = rs.first;
  var d = 1 << 30;
  for (final r in rs) {
    final dd = counts.map((c) => (r.w.length - c).abs()).reduce(math.min);
    if (dd < d) {
      d = dd;
      best = r;
    }
  }
  return best;
}

int _matras(String w) {
  var m = 0;
  for (var k = 0; k < w.length; k++) {
    m += w[k] == 'G' ? 2 : 1;
  }
  return m;
}

List<int> _anushtupWrong(String w, int start, bool odd) {
  final want = [
    (4, 'L'),
    (5, 'G'),
    (6, odd ? 'G' : 'L'),
  ];
  return [
    for (final (k, g) in want)
      if (w[start + k] != g) start + k,
  ];
}

LineCheck _lineResult(String text, List<Syllable> syls, Reading r, List<int> wrong, List<int> groups, int? expected) {
  final pos = <int, int>{};
  for (var p = 0; p < r.idx.length; p++) {
    pos[r.idx[p]] = p;
  }
  final groupOf = <int>[];
  for (var gi = 0; gi < groups.length; gi++) {
    for (var k = 0; k < groups[gi]; k++) {
      groupOf.add(gi);
    }
  }
  final out = <CheckedSyllable>[];
  for (var k = 0; k < syls.length; k++) {
    final p = pos[k];
    out.add(CheckedSyllable(
      syls[k],
      p != null,
      p != null ? r.w[p] : syls[k].w,
      p != null && wrong.contains(p),
      p != null ? (p < groupOf.length ? groupOf[p] : -1) : -1,
    ));
  }
  return LineCheck(text, out, r.w.length, _matras(r.w), expected, wrong.isEmpty && (expected == null || expected == r.w.length));
}

/// The plain scan of a line, without a metre.
LineCheck plainLine(String text) {
  final syls = scanLine(text);
  final rs = readings(syls);
  final r = rs.isEmpty ? Reading([], '') : rs.first;
  return _lineResult(text, syls, r, [], [], null);
}

class _Cand {
  _Cand(this.m, this.fits, [this.names]);
  final Metre m;
  final List<_Fitted?> fits;
  final List<String>? names;
}

/// The metre of a stanza (its non-empty lines).
MetreCheck checkStanza(List<String> raw) {
  final texts = [for (final l in raw.map((l) => l.trim())) if (scanLine(l).isNotEmpty) l];
  final scans = texts.map(scanLine).toList();
  final rs = scans.map(readings).toList();
  MetreCheck none() => MetreCheck(null, 'none', texts.map(plainLine).toList());
  if (texts.isEmpty) return none();

  final cands = <_Cand>[];
  for (final m in sama) {
    final p = patternOf(m);
    cands.add(_Cand(m, [
      for (final r in rs)
        _fitPattern(r, [
          [p],
          [p, p]
        ])
    ]));
  }
  for (final m in ardhasama) {
    final o = patternOf(m, odd: true);
    final e = patternOf(m, odd: false);
    cands.add(_Cand(m, [
      for (var k = 0; k < rs.length; k++)
        _fitPattern(rs[k], [
          [k.isOdd ? e : o],
          [o, e]
        ])
    ]));
  }
  bool exact(_Cand c) => c.fits.every((f) => f != null && f.wrong.isEmpty);
  for (final u in upajati) {
    final a = cands.firstWhere((c) => c.m.id == u.of![0]);
    final b = cands.firstWhere((c) => c.m.id == u.of![1]);
    if (exact(a) || exact(b)) continue;
    final names = <String>[];
    final fits = <_Fitted?>[];
    for (var k = 0; k < rs.length; k++) {
      final fa = a.fits[k];
      final fb = b.fits[k];
      if (fa != null && fa.wrong.isEmpty) {
        names.add(a.m.id);
        fits.add(fa);
      } else if (fb != null && fb.wrong.isEmpty) {
        names.add(b.m.id);
        fits.add(fb);
      } else {
        names.add('');
        fits.add(fa != null && fb != null ? (fa.wrong.length <= fb.wrong.length ? fa : fb) : fa ?? fb);
      }
    }
    if (names.contains(a.m.id) && names.contains(b.m.id)) cands.add(_Cand(u, fits, names));
  }
  MetreCheck done(_Cand c, String fit) => MetreCheck(
        c.m,
        fit,
        [
          for (var k = 0; k < texts.length; k++)
            if (c.fits[k] == null)
              _lineResult(texts[k], scans[k], _nearestCount(rs[k], [_expectedOf(c.m, k)]), [], [], null).withExpected(_expectedOf(c.m, k), false)
            else
              _lineResult(texts[k], scans[k], c.fits[k]!.reading, c.fits[k]!.wrong, c.fits[k]!.groups, c.fits[k]!.reading.w.length),
        ],
        c.names,
      );
  final exacts = cands.where(exact).toList();
  if (exacts.isNotEmpty) return done(exacts.first, 'exact');

  final anu = _anushtup(texts, scans, rs);
  if (anu != null) return anu;

  final bh = _bhasha(texts, scans, rs);
  if (bh != null) return bh;

  _Cand? best;
  var bestWrong = 0;
  for (final c in cands) {
    if (!c.fits.every((f) => f != null && f.wrong.length <= 2)) continue;
    final wrong = c.fits.fold<int>(0, (s, f) => s + f!.wrong.length);
    final fine = c.fits.where((f) => f!.wrong.isEmpty).length;
    if (texts.length > 1 && fine * 2 < texts.length) continue;
    if (texts.length == 1 && wrong > 1) continue;
    if (best == null || wrong < bestWrong) {
      best = c;
      bestWrong = wrong;
    }
  }
  if (best != null) return done(best, 'close');
  return none();
}

int _expectedOf(Metre m, int k) => m.kind == 'ardhasama' ? patternOf(m, odd: k.isEven).length : patternOf(m).length;

MetreCheck? _anushtup(List<String> texts, List<List<Syllable>> scans, List<List<Reading>> rs) {
  if (texts.length < 2) return null;
  final lines = <LineCheck>[];
  var pada = 0;
  for (var k = 0; k < texts.length; k++) {
    Reading? gotR;
    List<int>? gotWrong;
    var gotN = 0;
    for (final r in rs[k]) {
      if (r.w.length != 8 && r.w.length != 16) continue;
      final n = r.w.length ~/ 8;
      final wrong = <int>[];
      for (var p = 0; p < n; p++) {
        wrong.addAll(_anushtupWrong(r.w, p * 8, (pada + p).isEven));
      }
      if (gotWrong == null || wrong.length < gotWrong.length) {
        gotR = r;
        gotWrong = wrong;
        gotN = n;
      }
      if (wrong.isEmpty) break;
    }
    if (gotR == null || gotWrong!.isNotEmpty) return null;
    pada += gotN;
    lines.add(_lineResult(texts[k], scans[k], gotR, [], gotN == 2 ? [4, 4, 4, 4] : [4, 4], gotR.w.length));
  }
  return MetreCheck(anushtupMetre, 'exact', lines);
}

MetreCheck? _bhasha(List<String> texts, List<List<Syllable>> scans, List<List<Reading>> rs) {
  if (texts.length < 2) return null;
  MetreCheck? near;
  for (final m in bhashaMetres) {
    final lines = <LineCheck>[];
    var off = -1;
    var fail = false;
    for (var k = 0; k < texts.length && !fail; k++) {
      final second = k.isOdd;
      if (m.id == 'tharangini') {
        Reading? r;
        for (final x in rs[k]) {
          if (x.w.isNotEmpty && _matras(x.w.substring(0, x.w.length - 1)) + 2 == 16 && x.w.length >= 8 && x.w.length <= 13) {
            r = x;
            break;
          }
        }
        if (r != null) {
          lines.add(_lineResult(texts[k], scans[k], r, [], _twoMatraGroups(r.w), r.w.length));
        } else {
          fail = true;
        }
        continue;
      }
      final want = m.counts![second ? 1 : 0];
      Reading? r;
      for (final x in rs[k]) {
        if (want.contains(x.w.length) && _bhashaShape(m, x.w, second)) {
          r = x;
          break;
        }
      }
      if (r != null) {
        lines.add(_lineResult(texts[k], scans[k], r, [], _bhashaGroups(m, r.w.length, second), r.w.length));
        continue;
      }
      final n = _nearestCount(rs[k], want);
      final d = want.map((c) => (c - n.w.length).abs()).reduce(math.min);
      if (off >= 0 || d == 0 || d > 3 || texts.length < 3) {
        fail = true;
        continue;
      }
      off = k;
      final expected = want.reduce((a, c) => (c - n.w.length).abs() < (a - n.w.length).abs() ? c : a);
      lines.add(_lineResult(texts[k], scans[k], n, [], _bhashaGroups(m, n.w.length, second), null).withExpected(expected, false));
    }
    if (fail || lines.length != texts.length) continue;
    if (off < 0) return MetreCheck(m, 'likely', lines);
    near ??= MetreCheck(m, 'close', lines);
  }
  return near;
}

List<String> _cut(String w, List<int> sizes) {
  final out = <String>[];
  var p = 0;
  for (final s in sizes) {
    final a = math.min(p, w.length);
    final b = math.min(p + s, w.length);
    out.add(w.substring(a, b));
    p += s;
  }
  return out;
}

String _stretchLast(String w) => w.isEmpty ? w : '${w.substring(0, w.length - 1)}G';

bool _kakaliGanas(String w, {bool loose = false}) {
  final g = _cut(_stretchLast(w), List.filled(w.length ~/ 3, 3));
  final five = g.where((x) => _matras(x) == 5).length;
  return loose ? g.every((x) => _matras(x) >= 4) && five * 2 >= g.length : g.every((x) => _matras(x) >= 4) && five >= g.length - 1;
}

bool _bhashaShape(Metre m, String w, bool second) {
  switch (m.id) {
    case 'manikanchi':
      return w.startsWith('LLLLL') && _kakaliGanas(w.substring(5));
    case 'keka':
      return _cut(_stretchLast(w), [3, 2, 2, 3, 2, 2]).every((x) => x.contains('G'));
    case 'annanada':
      final g = _cut(_stretchLast(w), [2, 2, 2, 2, 2, 2]);
      return g[0] == 'LG' && g[3] == 'LG' && g.where((x) => x == 'LG').length >= 4;
    case 'kakali':
    case 'manjari':
    case 'unakakali':
    case 'marakakali':
    case 'drutakakali':
      final head = w.substring(0, (w.length ~/ 3) * 3);
      if (second && m.id != 'kakali' && m.id != 'drutakakali') return _kakaliGanas(head, loose: true);
      return _kakaliGanas(head, loose: m.id != 'kakali');
    case 'kalakanchi':
      if (second) return _kakaliGanas(w);
      return w.startsWith('L' * 10) && _kakaliGanas(w.substring(w.length == 18 ? 15 : 10));
    case 'nathonnatha':
      return true;
    default:
      return false;
  }
}

List<int> _bhashaGroups(Metre m, int n, bool second) {
  if (m.id == 'kalakanchi' && !second) return n == 18 ? [5, 5, 5, 3] : [5, 5, 3, 3];
  final out = <int>[];
  var left = n;
  for (final s in m.groups!) {
    if (left <= 0) break;
    out.add(math.min(s, left));
    left -= s;
  }
  if (left > 0) out.add(left);
  return out;
}

List<int> _twoMatraGroups(String w) {
  final out = <int>[];
  var k = 0;
  while (k < w.length) {
    if (w[k] == 'G' || k == w.length - 1) {
      out.add(1);
      k++;
    } else {
      out.add(2);
      k += 2;
    }
  }
  return out;
}

/// A text's stanzas: blank lines separate them.
List<List<String>> stanzas(String text) {
  final out = <List<String>>[];
  var cur = <String>[];
  for (final l in text.split(RegExp(r'\r?\n'))) {
    if (l.trim().isEmpty) {
      if (cur.isNotEmpty) out.add(cur);
      cur = [];
    } else {
      cur.add(l);
    }
  }
  if (cur.isNotEmpty) out.add(cur);
  return out;
}
