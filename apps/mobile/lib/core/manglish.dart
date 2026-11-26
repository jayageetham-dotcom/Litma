/// Litma Manglish engine: a port of packages/shared/src/manglish.ts (keep the two in step;
/// test/manglish_test.dart checks the same examples the web engine gives).
///
/// Converts a romanised Malayalam word ("ente", "kadha", "nammude") into Malayalam script,
/// offline. Case matters, Mozhi-style: t=ട T=ട th=ത d=ദ D=ഡ n=ന N=ണ l=ല L=ള r=ര R=റ s=സ S=ശ
/// sh=ഷ zh=ഴ aa/A=ആ ee/ii/I=ഈ oo/uu/U=ഊ E=ഏ O=ഓ. "~" forces a chandrakkala, "_" breaks a cluster.
///
/// Lowercase words follow the way writers usually type (same rules as the web): d between vowels
/// is ട (naadu → നാട്; "_d" forces ദ), nd before r is ന്ദ, a final u after ട, ണ്ട or സ്സ is ്,
/// and very common words have fixed spellings ([manglishCommon]). [manglishCandidates] lists the other
/// likely spellings for offline suggestions.
library;

const Map<String, List<String>> _vowels = {
  'aa': ['ആ', 'ാ'],
  'A': ['ആ', 'ാ'],
  'a': ['അ', ''],
  'ii': ['ഈ', 'ീ'],
  'ee': ['ഈ', 'ീ'],
  'I': ['ഈ', 'ീ'],
  'i': ['ഇ', 'ി'],
  'uu': ['ഊ', 'ൂ'],
  'oo': ['ഊ', 'ൂ'],
  'U': ['ഊ', 'ൂ'],
  'u': ['ഉ', 'ു'],
  'ai': ['ഐ', 'ൈ'],
  'ei': ['ഐ', 'ൈ'],
  'au': ['ഔ', 'ൗ'],
  'ou': ['ഔ', 'ൗ'],
  'ae': ['ഏ', 'േ'],
  'E': ['ഏ', 'േ'],
  'e': ['എ', 'െ'],
  'oa': ['ഓ', 'ോ'],
  'O': ['ഓ', 'ോ'],
  'o': ['ഒ', 'ൊ'],
  'R^': ['ഋ', 'ൃ'],
  'rh': ['ഋ', 'ൃ'],
};

const Map<String, String> _consonants = {
  'ksh': 'ക്ഷ',
  'x': 'ക്സ',
  'nch': 'ഞ്ച',
  'nth': 'ന്ത',
  'nt': 'ന്റ',
  'nd': 'ണ്ട',
  'nk': 'ങ്ക',
  'ng': 'ങ്ങ',
  'nj': 'ഞ',
  'mp': 'മ്പ',
  'tth': 'ത്ത',
  'thth': 'ത്ത',
  'tt': 'ട്ട',
  'TT': 'ട്ട',
  'dd': 'ദ്ദ',
  'rr': 'റ',
  'kh': 'ഖ',
  'k': 'ക',
  'q': 'ക',
  'c': 'ച',
  'gh': 'ഘ',
  'g': 'ഗ',
  'chh': 'ഛ',
  'Ch': 'ഛ',
  'ch': 'ച',
  'jh': 'ഝ',
  'j': 'ജ',
  'z': 'ശ',
  'Th': 'ഠ',
  'T': 'ട',
  't': 'ട',
  'Dh': 'ഢ',
  'D': 'ഡ',
  'N': 'ണ',
  'thh': 'ഥ',
  'th': 'ത',
  'dh': 'ധ',
  'd': 'ദ',
  'n': 'ന',
  'ph': 'ഫ',
  'f': 'ഫ',
  'p': 'പ',
  'bh': 'ഭ',
  'b': 'ബ',
  'm': 'മ',
  'y': 'യ',
  'r': 'ര',
  'R': 'റ',
  'L': 'ള',
  'l': 'ല',
  'w': 'വ',
  'v': 'വ',
  'zh': 'ഴ',
  'sh': 'ഷ',
  'S': 'ശ',
  's': 'സ',
  'h': 'ഹ',
};

/// Final consonants that become chillu letters at the end of a word.
const Map<String, String> _chillu = {'n': 'ൻ', 'N': 'ൺ', 'l': 'ൽ', 'L': 'ൾ', 'r': 'ർ', 'R': 'ർ', 'm': 'ം'};

const String virama = '്';
const Map<String, String> _special = {'M': 'ം', 'H': 'ഃ', '~': virama};

// longest keys first; ties keep the source order (as JavaScript's stable sort does)
final List<String> _vowelKeys = _byLength(_vowels.keys);
final List<String> _consKeys = _byLength(_consonants.keys);

List<String> _byLength(Iterable<String> keys) {
  final list = keys.toList();
  final indexed = [for (var i = 0; i < list.length; i++) (i, list[i])];
  indexed.sort((a, b) {
    final d = b.$2.length - a.$2.length;
    return d != 0 ? d : a.$1 - b.$1;
  });
  return [for (final e in indexed) e.$2];
}

String? _match(String word, int i, List<String> keys) {
  for (final k in keys) {
    if (word.startsWith(k, i)) return k;
  }
  return null;
}

final RegExp _latin = RegExp(r'[A-Za-z]');
final RegExp _yr = RegExp(r'^[yr]');
final RegExp _vowelLatin1 = RegExp(r'[aeiouAEIOU]');
final RegExp _afterD = RegExp(r'^([aeiouAEIOU~]|[^A-Za-z]|$)');

/// Everyday words whose spelling no letter rule gets right (ṇ, ḷ, ṟ, long e/o, half-u).
/// Keep in step with COMMON in packages/shared/src/manglish.ts.
const Map<String, String> manglishCommon = {
  'aanu': 'ആണ്',
  'athu': 'അത്',
  'ithu': 'ഇത്',
  'enthu': 'എന്ത്',
  'onnu': 'ഒന്ന്',
  'ennu': 'എന്ന്',
  'njan': 'ഞാൻ',
  'njaan': 'ഞാൻ',
  'aval': 'അവൾ',
  'avalude': 'അവളുടെ',
  'ival': 'ഇവൾ',
  'ivalude': 'ഇവളുടെ',
  'ningal': 'നിങ്ങൾ',
  'ningalude': 'നിങ്ങളുടെ',
  'njangal': 'ഞങ്ങൾ',
  'njangalude': 'ഞങ്ങളുടെ',
  'avar': 'അവർ',
  'venam': 'വേണം',
  'venda': 'വേണ്ട',
  'pole': 'പോലെ',
  'mele': 'മേലെ',
  'keralam': 'കേരളം',
  'malayalam': 'മലയാളം',
  'kadha': 'കഥ',
  'katha': 'കഥ',
  'kadhakal': 'കഥകൾ',
  'kathakal': 'കഥകൾ',
  'kaattu': 'കാറ്റ്',
  'paranju': 'പറഞ്ഞു',
  'parayaam': 'പറയാം',
  'parayam': 'പറയാം',
  'parayu': 'പറയൂ',
  'parayunnu': 'പറയുന്നു',
  'parayuka': 'പറയുക',
  'kure': 'കുറെ',
  'kurachu': 'കുറച്ച്',
  'maram': 'മരം',
  'puram': 'പുറം',
  'ponnu': 'പൊന്ന്',
  'manassu': 'മനസ്സ്',
  'sheri': 'ശരി',
  'shari': 'ശരി',
  'nanni': 'നന്ദി',
  'nandi': 'നന്ദി',
};

/// Transliterate a single romanised word. Non-Latin characters pass through.
/// [natural] false spells strictly letter by letter; [halfU] false keeps a final u as ു.
String manglishWord(String word, {bool natural = true, bool halfU = true}) {
  final half0 = natural && halfU;
  if (half0 && manglishCommon.containsKey(word)) return manglishCommon[word]!;
  final out = StringBuffer();
  var i = 0;
  while (i < word.length) {
    final ch = word[i];
    if (ch == '_') {
      i++;
      continue;
    }
    final special = _special[ch];
    if (special != null) {
      out.write(special);
      i++;
      continue;
    }
    final ck = _match(word, i, _consKeys);
    if (ck != null) {
      final start = i;
      var base = _consonants[ck]!;
      i += ck.length;
      // d between vowels (or after a vowel at the end) is ട: naadu, nammude, kadal
      if (natural && ck == 'd' && start > 0 && _vowelLatin1.hasMatch(word[start - 1]) && _afterD.hasMatch(word.substring(i))) base = 'ട';
      // nd before r is ന്ദ്ര: chandran, indran
      if (natural && ck == 'nd' && i < word.length && word[i] == 'r') base = 'ന്ദ';
      if (i < word.length && word[i] == '~') {
        out.write(base + virama);
        i++;
        continue;
      }
      final vk = _match(word, i, _vowelKeys);
      if (vk != null) {
        final last = i + vk.length >= word.length || !_latin.hasMatch(word[i + vk.length]);
        final half = half0 && vk == 'u' && last && ((base == 'ട' && ck == 'd') || ck == 'nd' || (ck == 's' && start > 0 && word[start - 1] == 's'));
        out.write(base + (half ? virama : _vowels[vk]![1]));
        i += vk.length;
        continue;
      }
      final atEnd = i >= word.length || !_latin.hasMatch(word[i]);
      if (atEnd) {
        // single-letter keys can become chillu (avan → അവൻ, maram → മരം)
        if (ck.length == 1 && _chillu.containsKey(ck) && out.isNotEmpty) {
          out.write(_chillu[ck]);
        } else if (ck == 'rr') {
          out.write(_chillu['R']);
        } else {
          out.write(base + virama);
        }
      } else if (word[i] == 'M' || word[i] == 'H') {
        out.write(base);
      } else if (ck == 'r' && out.isNotEmpty && !_yr.hasMatch(word.substring(i))) {
        // modern spelling: ർ before a consonant (ചേർത്ത്, കാർത്തിക)
        out.write(_chillu['r']);
      } else {
        out.write(base + virama);
      }
      continue;
    }
    final vk = _match(word, i, _vowelKeys);
    if (vk != null) {
      out.write(_vowels[vk]![0]);
      i += vk.length;
      continue;
    }
    out.write(ch);
    i++;
  }
  return out.toString();
}

final RegExp _wordRe = RegExp(r'[A-Za-z~_^]+');

/// Transliterate a whole phrase, word by word (punctuation and spaces kept).
String manglish(String text) => text.replaceAllMapped(_wordRe, (m) => manglishWord(m[0]!));

const _v = '[aeiou]';
final List<(RegExp, String, bool)> _swaps = [
  (RegExp('(?<=$_v)r(?=$_v)'), 'R', true), // പറയുക, കുറെ
  (RegExp('(?<=$_v)l(?=$_v|\$)'), 'L', true), // അവൾ
  (RegExp('(?<=$_v)ll(?=$_v)'), 'LL', true),
  (RegExp('(?<=$_v)n(?=$_v|\$)'), 'N', true), // ആണ്, വേണം
  (RegExp('(?<![aeiou])e(?![eia])'), 'E', false), // long vowels, first one only
  (RegExp('(?<![aeiou])o(?![oa])'), 'O', false),
  (RegExp('(?<=$_v)d(?=$_v|\$)'), '_d', true), // വേദന
  (RegExp('dh'), 'thh', true), // കഥ
];

/// Likely spellings of [word], best first (same order as the web's manglishCandidates):
/// the usual reading, then റ, ള, ണ, long ഏ/ഓ, ദ, ു and the strict letter-by-letter reading.
List<String> manglishCandidates(String word, {int max = 6}) {
  final out = <String>[];
  void add(String s) {
    if (s.isNotEmpty && !out.contains(s)) out.add(s);
  }

  add(manglishWord(word));
  if (!RegExp('[a-z]').hasMatch(word)) return out;
  for (final (re, to, all) in _swaps) {
    final v = all ? word.replaceAll(re, to) : word.replaceFirst(re, to);
    if (v != word) add(manglishWord(v));
  }
  add(manglishWord(word, halfU: false));
  add(manglishWord(word, natural: false));
  return out.take(max).toList();
}

/// A Manglish word being typed at the end of [text], or null.
final RegExp manglishTailRe = RegExp(r'[A-Za-z~_^]+$');

/// Words in [text] (same rule as the web's countWords).
int countWords(String text) {
  final t = text.trim();
  if (t.isEmpty) return 0;
  return RegExp(r'[^\s​]+').allMatches(t).length;
}

/// Reading time in minutes (Malayalam prose reads at about 150 words a minute).
int readingMinutes(int words) => (words / 150).round().clamp(1, 1 << 30);

// ── names and titles typed in Manglish (the web's ScriptField toMalayalam) ──

final _meaningfulCaps = {for (final c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')) if (!RegExp('[A-Za-z]').hasMatch(manglishWord(c))) c};
const _vowelLatin = {'അ': 'a', 'ആ': 'aa', 'ഇ': 'i', 'ഈ': 'ee', 'ഉ': 'u', 'ഊ': 'oo', 'എ': 'e', 'ഏ': 'E', 'ഐ': 'ai', 'ഒ': 'o', 'ഓ': 'O', 'ഔ': 'au'};

/// Manglish → Malayalam for names: a Name-cased word reads all small, and capitals with no meaning
/// in the scheme are lowered.
String toMalayalam(String text) {
  text = text.replaceAllMapped(RegExp('([A-Za-z])([അആഇഈഉഊഎഏഐഒഓഔ])'), (m) => '${m[1]}${_vowelLatin[m[2]]}');
  return text.replaceAllMapped(RegExp(r'[A-Za-z~_^]+'), (m) {
    final w = m[0]!;
    final word = RegExp(r'^[A-Z][a-z~_^]+$').hasMatch(w) ? w.toLowerCase() : w.replaceAllMapped(RegExp('[A-Z]'), (c) => _meaningfulCaps.contains(c[0]) ? c[0]! : c[0]!.toLowerCase());
    return manglishWord(word);
  });
}

/// A Manglish word with only the capitals that mean a letter: a name-style capital (Kerala, Ammu),
/// a word in capitals (TV), a brand-style word (YouTube, iOS) and capitals with no meaning in the
/// scheme (iPhone) are lowered, so no reading mixes Latin letters in. Same as the web's `foldCaps`
/// (packages/shared/src/manglish.ts).
String foldCaps(String word) {
  if (!RegExp('[A-Z]').hasMatch(word)) return word;
  final name = RegExp(r'^[A-Z][a-z~_^]*$').hasMatch(word);
  final allCaps = word.length > 1 && word == word.toUpperCase();
  final brand = (RegExp('^[A-Z]').hasMatch(word) && RegExp('[A-Z]').hasMatch(word.substring(1))) || RegExp(r'[a-z][A-Z]{2,}$').hasMatch(word);
  if (name || allCaps || brand) return word.toLowerCase();
  return word.replaceAllMapped(RegExp('[A-Z]'), (c) => _meaningfulCaps.contains(c[0]) ? c[0]! : c[0]!.toLowerCase());
}

/// The letter-by-letter reading when the writer is spelling exactly with capitals inside a word
/// (paNi → പണി, kaLam → കളം), else null. Same as the web's `exactReading`.
String? exactReading(String word) {
  final w = foldCaps(word);
  return RegExp('[A-Z]').hasMatch(w) ? manglishWord(w) : null;
}
