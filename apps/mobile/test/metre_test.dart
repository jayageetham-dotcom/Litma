import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:litma/core/metre_check.dart';

/// The Dart port of the metre checker must give the web's answers (test/metre_vectors.json,
/// written by `npm run mobile:assets` from packages/shared/src/metre.ts for the stanzas in
/// test/metre_inputs.txt): the metre, how well it fits, and every syllable with its weight.
void main() {
  final vectors = (jsonDecode(File('test/metre_vectors.json').readAsStringSync()) as List).cast<Map<String, dynamic>>();

  test('stanzas split like the web', () {
    final st = stanzas(File('test/metre_inputs.txt').readAsStringSync());
    expect(st.length, vectors.length);
    for (var k = 0; k < st.length; k++) {
      expect(st[k], (vectors[k]['lines'] as List).cast<String>());
    }
  });

  test('every stanza gets the web’s metre and the same syllables', () {
    for (final v in vectors) {
      final lines = (v['lines'] as List).cast<String>();
      final r = checkStanza(lines);
      final label = lines.first;
      expect(r.metre?.id, v['metre'], reason: label);
      expect(r.fit, v['fit'], reason: label);
      expect(r.lineMetres, v['lineMetres'] == null ? null : (v['lineMetres'] as List).cast<String>(), reason: label);
      final checked = (v['checked'] as List).cast<Map<String, dynamic>>();
      expect(r.lines.length, checked.length, reason: label);
      for (var k = 0; k < checked.length; k++) {
        final want = checked[k];
        final got = r.lines[k];
        expect(got.count, want['count'], reason: '$label / line $k count');
        expect(got.matras, want['matras'], reason: '$label / line $k matras');
        expect(got.expected, want['expected'], reason: '$label / line $k expected');
        expect(got.ok, want['ok'], reason: '$label / line $k ok');
        final syl = (want['syl'] as List).cast<List>();
        expect(got.syllables.length, syl.length, reason: '$label / line $k syllables');
        for (var j = 0; j < syl.length; j++) {
          final s = got.syllables[j];
          expect([s.text, s.start, s.end, s.s.w, s.s.optional, s.counted, s.weight, s.wrong, s.group], syl[j], reason: '$label / line $k / ${syl[j][0]}');
        }
      }
    }
  });

  test('a laghu where guru is needed is marked', () {
    final r = checkStanza(['ഹാ! പുഷ്പമേ, അധിക തുംഗപദത്തിലെത്ര', 'ശോഭിച്ചിരുന്നിതൊരു രാജ്ഞികണക്കയെ നീ']);
    expect(r.metre?.id, 'vasantatilakam');
    expect(r.fit, 'close');
    expect(r.lines[1].syllables.where((s) => s.wrong).map((s) => s.text), ['യെ']);
  });

  test('prose has no metre', () {
    expect(checkStanza(['ഇന്നലെ ഞാൻ കടയിൽ പോയി കുറച്ച് പച്ചക്കറി വാങ്ങി വന്നു', 'പിന്നെ അമ്മ ചായ ഉണ്ടാക്കി']).metre, isNull);
  });
}
