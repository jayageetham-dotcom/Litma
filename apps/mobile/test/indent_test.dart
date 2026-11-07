import 'package:flutter_test/flutter_test.dart';
import 'package:litma/core/tokens.g.dart';
import 'package:litma/data/forms.dart';
import 'package:litma/editor/block_style.dart';
import 'package:litma/editor/document.dart';
import 'package:litma/editor/page_view.dart';

Map<String, dynamic> p(String text) => {
      'type': 'paragraph',
      if (text.isNotEmpty) 'content': [{'type': 'text', 'text': text}],
    };

/// Indent of each top-level paragraph, in ems, for a novel made of [lines] ('' is an empty line).
List<double> indents(List<String> lines) {
  final doc = EditorDocument.fromJson({'type': 'doc', 'content': lines.map(p).toList()});
  final page = PageLook(kind: DocKind.novel, settings: const {}, t: LitmaTokens.light);
  final looks = computeLooks(doc, page);
  return [for (final b in doc.blocks.whereType<TextBlock>()) looks[b]!.indent / page.fontSize];
}

void main() {
  test('novel paragraphs indent like a printed book, except the first', () {
    expect(indents(['ഒന്ന്', 'രണ്ട്', 'മൂന്ന്']), [0, 1.6, 1.6]);
  });

  test('an empty line is a section break: it and the next paragraph sit at the margin', () {
    expect(indents(['ഒന്ന്', '', 'രണ്ട്', 'മൂന്ന്']), [0, 0, 0, 1.6]);
  });

  test('pressing Enter several times never indents the empty lines', () {
    expect(indents(['ഒന്ന്', '', '', '']), [0, 0, 0, 0]);
  });
}
