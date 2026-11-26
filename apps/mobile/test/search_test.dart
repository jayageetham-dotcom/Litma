import 'package:flutter_test/flutter_test.dart';
import 'package:litma/core/search.dart';

// Same cases as the web's matcher (packages/shared/src/search.ts).
void main() {
  test('Manglish finds Malayalam by sound', () {
    const cases = [
      ['പുതിയ നോവൽ', 'puthiya', true], ['പുതിയ നോവൽ', 'puth', true], ['പുതിയ നോവൽ', 'pudiya', true], ['പുതിയ നോവൽ', 'noval', true],
      ['നമ്മുടെ വീട്', 'nammude', true], ['നമ്മുടെ വീട്', 'veed', true], ['എന്റെ കഥ', 'ente', true], ['എന്റെ കഥ', 'kadha', true],
      ['കുട്ടി', 'kutti', true], ['മഴ', 'mazha', true], ['ഞാൻ നാളെ', 'njan', true], ['നിങ്ങൾ', 'ningal', true],
      ['ജഗത്ത് ജയകുമാർ', 'jayakumar', true], ['സന്ധ്യ', 'sandhya', true], ['കണ്ണാടി', 'kannadi', true], ['ശ്രീ', 'sree', true],
      ['പുതിയ നോവൽ', 'kadal', false], ['Hello world', 'wor', true], ['Hello world', 'xyz', false], ['കടൽ', '', true],
    ];
    for (final c in cases) {
      expect(matchesSearch(c[0] as String, c[1] as String), c[2], reason: '${c[0]} / ${c[1]}');
    }
  });

  test('romanise and matches for find', () {
    expect(romanise('എന്റെ കുട്ടി നമ്മുടെ'), 'ente kutti nammute');
    expect(manglishMatches('കടൽ കാണാത്ത വീട്, കടലിലെ തിര. കടവ്', 'kada'), ['കടൽ', 'കടവ്', 'കടലിലെ']);
  });

  test('forgiving: Malayalam spellings that sound the same, and typos, ranked after exact matches', () {
    const ranks = [
      ['എന്റെ കഥ', 'കത', 2], ['മലയാളം നോവൽ', 'മലയാലം', 2], ['മലയാളം നോവൽ', 'malayalm', 1], ['പുതിയ നോവൽ', 'puthya', 1],
      ['Hello world', 'wrold', 1], ['Litma diary', 'dairy', 1], ['കടൽ കാണാത്ത വീട്', 'kadal', 2], ['കടൽ', 'kala', 0],
      ['എന്റെ കഥ', 'കല', 0], ['അമ്മ', 'umma', 0], ['എന്റെ കഥ', 'കഥ', 3], ['Hello world', 'world', 3],
    ];
    for (final c in ranks) {
      expect(searchRank(c[0] as String, c[1] as String), c[2], reason: '${c[0]} / ${c[1]}');
    }
    expect(manglishMatches('എന്റെ കഥ, കതകും കഥകളും', 'കത'), ['കഥ', 'കതകും', 'കഥകളും']);
    expect(manglishMatches('മലയാളം മലയാളി', 'malayalm'), ['മലയാളി', 'മലയാളം']);
  });
}
