import 'package:flutter_test/flutter_test.dart';
import 'package:litma/data/forms.dart';

// The keep rule (`keepOnClose` in packages/shared/src/forms.ts): a new work is kept when the writer
// changed its title or wrote any body text, for every writing type.
void main() {
  Json withText(Json doc, String text) => {
        ...doc,
        'content': [
          ...(doc['content'] as List),
          {
            'type': 'paragraph',
            'content': [
              {'type': 'text', 'text': text}
            ]
          },
        ],
      };

  for (final k in DocKind.values) {
    test('keep rule: ${k.name}', () {
      final fresh = withAuthor(starterContent(k), 'ആശ');
      expect(keepOnClose(title: defaultTitle(k), kind: k, content: fresh), isFalse, reason: 'untouched');
      expect(keepOnClose(title: '', kind: k, content: fresh), isFalse, reason: 'empty title');
      expect(keepOnClose(title: 'മഴക്കാലം', kind: k, content: fresh), isTrue, reason: 'own title, no text');
      expect(keepOnClose(title: defaultTitle(k), kind: k, content: withText(fresh, 'ഇന്ന്')), isTrue, reason: 'body text');
    });
  }

  test('old default titles still count as not named', () {
    expect(isDefaultTitle('പുതിയ ശൂന്യം', DocKind.blank), isTrue);
    expect(isDefaultTitle('പുതിയ ഡയറി', DocKind.diary), isTrue);
    expect(currentTitle('പുതിയ ശൂന്യം', DocKind.blank), 'പുതിയ കുറിപ്പ്');
    expect(currentTitle('എന്റെ കുറിപ്പ്', DocKind.blank), 'എന്റെ കുറിപ്പ്');
  });

  test('names and picker order', () {
    expect(kindNames[DocKind.blank], (ml: 'കുറിപ്പ്', en: 'Note'));
    expect(kindNames[DocKind.diary], (ml: 'ജേണൽ', en: 'Journal'));
    expect(defaultTitle(DocKind.blank), 'പുതിയ കുറിപ്പ്');
    expect(pickerKinds.first, DocKind.blank);
    expect(pickerKinds.toSet(), DocKind.values.toSet());
  });
}
