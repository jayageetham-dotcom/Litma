/// Litma Manglish engine: a port of packages/shared/src/manglish.ts (keep the two in step;
/// test/manglish_test.dart checks the same examples the web engine gives).
///
/// Converts a romanised Malayalam word ("ente", "kadha", "nammude") into Malayalam script,
/// offline. Case matters, Mozhi-style: t=ട T=ട th=ത d=ദ D=ഡ n=ന N=ണ l=ല L=ള r=ര R=റ s=സ S=ശ
/// sh=ഷ zh=ഴ aa/A=ആ ee/ii/I=ഈ oo/uu/U=ഊ E=ഏ O=ഓ. "~" forces a chandrakkala, "_" breaks a cluster.
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

/// Transliterate a single romanised word. Non-Latin characters pass through.
String manglishWord(String word) {
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
      final base = _consonants[ck]!;
      i += ck.length;
      if (i < word.length && word[i] == '~') {
        out.write(base + virama);
        i++;
        continue;
      }
      final vk = _match(word, i, _vowelKeys);
      if (vk != null) {
        out.write(base + _vowels[vk]![1]);
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
