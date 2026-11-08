import 'package:flutter_test/flutter_test.dart';
import 'package:litma/data/rhyme.dart';
import 'package:litma/data/spell.dart';

// Same cases as packages/shared/src/spell.ts and rhyme.ts.
void main() {
  test('old chillu becomes the atomic letter', () {
    expect(unicodeFix('അവന്‍'), 'അവൻ');
    expect(unicodeFix('അവൻ'), isNull);
  });
  test('vowel signs typed in two parts join', () {
    expect(unicodeFix('കൊ'), 'കൊ');
  });
  test('a stray joiner goes', () {
    expect(unicodeFix('ക‍ല'), 'കല');
  });
  test('common misspellings, also inflected', () {
    expect(mistakeFix('ഉൽഘാടനം')!.fix, 'ഉദ്ഘാടനം');
    final m = mistakeFix('ഉൽഘാടനത്തിന്')!;
    expect(m.fix, 'ഉദ്ഘാടനത്തിന്');
    expect(m.exact, false);
    expect(mistakeFix('ഉദ്ഘാടനം'), isNull);
  });
  test('endings come off', () {
    expect(stems('മരത്തിൽ'), contains('മരം'));
    expect(stems('വീട്ടിൽ'), contains('വീട്'));
  });
  test('rhyme keys', () {
    expect(rhymeKey('കാലം', RhymeKind.second), 'ല');
    expect(rhymeKey('സ്നേഹം', RhymeKind.first), 'സ്ന');
    expect(rhymeKey('മഴയിൽ', RhymeKind.end), 'യിൽ');
    expect(rhymeKey('ക', RhymeKind.second), isNull);
    expect(rhymePath(RhymeKind.second, 'ല'), 'rhyme/s-d32');
  });
  test('the line a rhyme comes from', () {
    expect(rhymeSource('മഴ പെയ്യുന്ന കാലം', RhymeKind.end), 'കാലം');
    expect(rhymeSource('മഴ പെയ്യുന്ന കാലം', RhymeKind.second), 'മഴ');
  });
}
