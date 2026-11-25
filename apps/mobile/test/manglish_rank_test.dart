import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:litma/core/manglish.dart';
import 'package:litma/core/manglish_rank.dart';

/// The Dart port of ranked offline Manglish suggestions must give the web engine's lists
/// (test/manglish_rank_vectors.json, written by `npm run mobile:assets` from
/// packages/shared/src/manglish-rank.ts with the small word list test/manglish_rank_words.txt).
void main() {
  final vectors = jsonDecode(File('test/manglish_rank_vectors.json').readAsStringSync()) as Map<String, dynamic>;
  final ranker = ManglishRanker.of(parseWordList(File('test/manglish_rank_words.txt').readAsStringSync()));

  test('script skeletons match the web', () {
    final scripts = (vectors['__script__'] as Map).cast<String, dynamic>();
    for (final e in scripts.entries) {
      expect(scriptKey(e.key), e.value['key'], reason: e.key);
      expect(scriptLengths(e.key), e.value['lengths'], reason: e.key);
    }
  });

  test('spelling suggestions for unknown words match the web', () {
    final similar = (vectors['__similar__'] as Map).cast<String, dynamic>();
    for (final e in similar.entries) {
      expect(ranker.similar(e.key), (e.value as List).cast<String>(), reason: e.key);
    }
  });

  test('Manglish skeletons and suggestions match the web', () {
    for (final e in vectors.entries) {
      if (e.key.startsWith('__')) continue;
      final want = e.value as Map<String, dynamic>;
      expect(latinKeys(e.key), (want['keys'] as List).cast<String>(), reason: 'keys for ${e.key}');
      expect(ranker.suggest(e.key, max: 8), (want['suggest'] as List).cast<String>(), reason: e.key);
    }
  });

  test('writers are never forced: invented words keep their plain reading first', () {
    for (final w in ['chakkappazhakkuzhi', 'kunjikkuruvikkoottam', 'blogezhuthukaari']) {
      final list = ranker.suggest(w, max: 8);
      expect(list, contains(manglishWord(w)), reason: w);
    }
    expect(ranker.suggest('chakkappazhakkuzhi', max: 8).first, manglishWord('chakkappazhakkuzhi'));
  });

  test('the plain reading always stays within the first six', () {
    for (final e in vectors.entries) {
      if (e.key.startsWith('__')) continue;
      expect(ranker.suggest(e.key, max: 8).take(6), contains(manglishCandidates(e.key).first), reason: e.key);
    }
  });

  test("Litma's fixed words and exact spellings keep today's first choice", () {
    expect(ranker.suggest('sheri').first, 'ശരി');
    expect(ranker.suggest('nanni').first, 'നന്ദി');
    expect(ranker.suggest('kozhikkOD').first, manglishWord('kozhikkOD'));
    expect(ranker.suggest('hello123'), manglishCandidates('hello123'));
  });

  test("the writer's own words (Story World names) come first when they fit, as on the web", () {
    final own = (vectors['__own__'] as Map).cast<String, dynamic>();
    final names = (own['names'] as List).cast<String>();
    expect(ownWordsFrom(names), (own['words'] as List).cast<String>());
    final r = ManglishRanker.of(parseWordList(File('test/manglish_rank_words.txt').readAsStringSync()))..setOwnWords(ownWordsFrom(names));
    for (final e in (own['suggest'] as Map).cast<String, dynamic>().entries) {
      expect(r.suggest(e.key, max: 8), (e.value as List).cast<String>(), reason: e.key);
    }
    expect(r.similar('ഹന'), (own['similar'] as List).cast<String>());
    expect(r.suggest('kunjaatta').first, 'കുഞ്ഞാറ്റ');
  });

  test('spelling help (ranked fixes, close common words, word ranks) matches the web', () {
    final sp = (vectors['__spell__'] as Map).cast<String, dynamic>();
    for (final e in (sp['rank'] as Map).cast<String, dynamic>().entries) {
      final v = (e.value as Map).cast<String, dynamic>();
      expect(ranker.rankFixes(e.key, (v['fixes'] as List).cast<String>()), (v['ranked'] as List).cast<String>(), reason: e.key);
    }
    for (final e in (sp['close'] as Map).cast<String, dynamic>().entries) {
      expect(ranker.closeWords(e.key), (e.value as List).cast<String>(), reason: e.key);
    }
    for (final e in (sp['rankOf'] as Map).cast<String, dynamic>().entries) {
      expect(ranker.rankOf(e.key), e.value, reason: e.key);
    }
  });

  test('enthaanu gives എന്താണ് first, like Google', () {
    expect(ranker.suggest('enthaanu').first, 'എന്താണ്');
  });
}
