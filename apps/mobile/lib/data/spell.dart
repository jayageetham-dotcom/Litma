/// Malayalam spelling check (first stage): a port of packages/shared/src/spell.ts (keep the two in
/// step; same cases in test/spell_test.dart). Broken letters ("unicode"), a short list of common
/// misspellings ("mistake"), and, when asked, words the dictionary doesn't have ("unknown": only a
/// question, never called wrong; dialect and community words are often missing from dictionaries).
/// Grammar goes to the AI companion (the "grammar" action).
library;

import 'dictionary.dart';

enum SpellKind { unicode, mistake, unknown }

class SpellIssue {
  const SpellIssue(this.from, this.to, this.text, this.kind, this.fix);

  /// offsets in the checked text
  final int from;
  final int to;
  final String text;
  final SpellKind kind;
  final List<String> fix;
}

const _zwj = '\u200D';
const _zwnj = '\u200C';
const _virama = '\u0D4D';

const _oldChillu = [
  ('ന$_virama$_zwj', 'ൻ'),
  ('ണ$_virama$_zwj', 'ൺ'),
  ('ര$_virama$_zwj', 'ർ'),
  ('ല$_virama$_zwj', 'ൽ'),
  ('ള$_virama$_zwj', 'ൾ'),
  ('ക$_virama$_zwj', 'ൿ'),
];
const _splitSigns = [
  ('\u0D46\u0D3E', '\u0D4A'),
  ('\u0D47\u0D3E', '\u0D4B'),
  ('\u0D46\u0D57', '\u0D4C'),
];

/// The word in Unicode as it should be typed, or null when it's already fine.
String? unicodeFix(String word) {
  var w = word;
  for (final (a, b) in _oldChillu) {
    w = w.replaceAll(a, b);
  }
  for (final (a, b) in _splitSigns) {
    w = w.replaceAll(a, b);
  }
  // a joiner only belongs right after a virama
  w = w.replaceAllMapped(RegExp('(^|[^$_virama])[$_zwj$_zwnj]+'), (m) => m.group(1)!);
  // the same vowel sign or virama twice
  w = w.replaceAllMapped(RegExp(r'([\u0D3E-\u0D4D\u0D57])\1+'), (m) => m.group(1)!);
  return w == word ? null : w;
}

/// Words commonly misspelt → the standard spelling (only ones the dictionary itself doesn't list).
const mistakes = <String, String>{
  'ഉൽഘാടനം': 'ഉദ്ഘാടനം',
  'അത്യന്താപേക്ഷികം': 'അത്യന്താപേക്ഷിതം',
  'കവയത്രി': 'കവയിത്രി',
  'സ്വാന്തനം': 'സാന്ത്വനം',
  'മാനസീകം': 'മാനസികം',
  'സാമ്പത്തീകം': 'സാമ്പത്തികം',
  'ശാരീരീകം': 'ശാരീരികം',
  'യഥാർഥ്യം': 'യാഥാർഥ്യം',
  'പ്രസ്ഥാവന': 'പ്രസ്താവന',
  'അനുഗ്രഹീത': 'അനുഗൃഹീത',
  'ആവിശ്യം': 'ആവശ്യം',
  'മുഖാന്തിരം': 'മുഖാന്തരം',
  'പ്രാരാബ്ദം': 'പ്രാരബ്ധം',
  'വിഢ്ഢി': 'വിഡ്ഢി',
  'അഥിതി': 'അതിഥി',
  'പ്രവർത്തിദിനം': 'പ്രവൃത്തിദിനം',
  'വ്യത്യസ്ഥം': 'വ്യത്യസ്തം',
  'അവസ്ത': 'അവസ്ഥ',
  'നിവർത്തിയില്ല': 'നിവൃത്തിയില്ല',
  'അദ്യക്ഷൻ': 'അധ്യക്ഷൻ',
  'പുനഃരാരംഭം': 'പുനരാരംഭം',
  'പുനഃരധിവാസം': 'പുനരധിവാസം',
};

const _endings = ['ത്തിന്റെ', 'ത്തിൻ്റെ', 'ങ്ങളുടെ', 'ങ്ങളിൽ', 'ങ്ങളെ', 'ങ്ങൾക്ക്', 'ങ്ങൾ', 'കളുടെ', 'കളിൽ', 'കളെ', 'കൾക്ക്', 'കൾ', 'ത്തിൽ', 'ത്തിന്', 'ത്തെ', 'ത്താൽ', 'ത്തോട്', 'ത്തിലേക്ക്', 'യുടെ', 'ിന്റെ', 'ിൻ്റെ', 'ന്റെ', 'ൻ്റെ', 'ുടെ', 'ിലേക്ക്', 'ിലൂടെ', 'ിൽനിന്ന്', 'ിൽ', 'ിന്', 'യ്ക്ക്', 'ക്ക്', 'ോട്', 'ാൽ', 'െ', 'ും', 'ോ', 'േ', 'ാണ്', 'ായി', 'മായി', 'മായ', 'മാണ്', 'യും', 'യോ', 'ുന്നു', 'ുന്ന', 'ുമ്പോൾ', 'ിച്ചു', 'ിച്ച', 'ിക്കുന്നു', 'ിക്കും', 'ിക്കുക', 'ിക്കാൻ', 'ുകയാണ്', 'ുകയും', 'ുക', 'ും', 'ാൻ', 'ി', 'ു'];

/// The forms a word may come from once an ending is taken off.
List<String> stems(String word) {
  final out = <String>{};
  for (final e in _endings) {
    if (!word.endsWith(e) || word.runes.length - e.runes.length < 2) continue;
    final base = word.substring(0, word.length - e.length);
    out.addAll([base, '$baseം', '$base്', '$baseു', '$baseക', '$baseുക', '$baseിക്കുക']);
    if (base.endsWith('ത്ത')) out.add('${base.substring(0, base.length - 3)}ം');
    if (base.endsWith('ട്ട')) out.add('${base.substring(0, base.length - 3)}ട്');
    if (base.endsWith('റ്റ')) out.add('${base.substring(0, base.length - 3)}റ്');
    if (base.endsWith('യ') || base.endsWith('വ')) out.add(base.substring(0, base.length - 1));
  }
  out.remove(word);
  return out.toList();
}

/// A known misspelling: the word itself (exact) or an inflected form starting with it.
({String fix, bool exact})? mistakeFix(String word) {
  final m = mistakes[word];
  if (m != null) return (fix: m, exact: true);
  for (final e in mistakes.entries) {
    final b = e.key.replaceAll(RegExp('[ം്]\$'), '');
    final g = e.value.replaceAll(RegExp('[ം്]\$'), '');
    if (b.runes.length >= 6 && word.startsWith(b) && !word.startsWith(g)) return (fix: '$g${word.substring(b.length)}', exact: false);
  }
  return null;
}

final _word = RegExp('[\u0D00-\u0D7F\u200C\u200D]+');
final _colon = RegExp('([\u0D00-\u0D7F\u200C\u200D]+):([\u0D00-\u0D7F\u200C\u200D]+)');

class Speller {
  Speller(this.dict);
  final Dictionary dict;
  final _shards = <String, Future<Set<String>>>{};
  final _known = <String, Future<bool>>{};

  Future<Set<String>> _shard(String w) async {
    final name = await dict.mlShardName(w);
    return _shards.putIfAbsent(name, () async {
      final t = await dict.text('words/$name');
      return (t ?? '').split('\n').where((x) => x.isNotEmpty).toSet();
    });
  }

  /// The dictionary has the word or the word it comes from. When the data can't load: true.
  Future<bool> isKnown(String w) => _known.putIfAbsent(w, () async {
        final s = await _shard(w);
        if (s.isEmpty || s.contains(w)) return true;
        for (final c in stems(w)) {
          if ((await _shard(c)).contains(c)) return true;
        }
        return false;
      });

  Future<List<SpellIssue>> check(String text, {bool unknown = false, Set<String> mine = const {}}) async {
    final out = <SpellIssue>[];
    final joined = <(int, int)>[];
    for (final m in _colon.allMatches(text)) {
      joined.add((m.start, m.end));
      out.add(SpellIssue(m.start, m.end, m.group(0)!, SpellKind.unicode, ['${m.group(1)}ഃ${m.group(2)}']));
    }
    for (final m in _word.allMatches(text)) {
      final word = m.group(0)!;
      if (joined.any((j) => m.start >= j.$1 && m.end <= j.$2)) continue;
      if (mine.contains(word)) continue;
      final u = unicodeFix(word);
      if (u != null) {
        out.add(SpellIssue(m.start, m.end, word, SpellKind.unicode, [u]));
        continue;
      }
      final mf = mistakeFix(word);
      if (mf != null && (mf.exact || !await isKnown(word))) {
        out.add(SpellIssue(m.start, m.end, word, SpellKind.mistake, [mf.fix]));
        continue;
      }
      if (unknown && word.runes.length > 2 && !await isKnown(word)) out.add(SpellIssue(m.start, m.end, word, SpellKind.unknown, const []));
    }
    out.sort((a, b) => a.from.compareTo(b.from));
    return out;
  }
}
