import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:litma/data/forms.dart';
import 'package:litma/data/models.dart';
import 'package:litma/editor/document.dart';
import 'package:litma/editor/docx.dart';
import 'package:litma/editor/journal_export.dart' show journalsWordFile, contentsEntry;

// The phone's Word files (a port of the web's docx writer in apps/web/src/lib/export.ts): a real
// .docx package with Malayalam text, footnotes, the book-like indent rule and, for journals, a
// contents page with each journal on a new page, oldest first.

/// The files of a stored (uncompressed) zip, as lib/core/zip.dart writes them.
Map<String, String> unzip(Uint8List bytes) {
  final out = <String, String>{};
  final d = ByteData.sublistView(bytes);
  var at = 0;
  while (at + 30 <= bytes.length && d.getUint32(at, Endian.little) == 0x04034b50) {
    expect(d.getUint16(at + 8, Endian.little), 0, reason: 'stored');
    final size = d.getUint32(at + 18, Endian.little);
    final nameLen = d.getUint16(at + 26, Endian.little);
    final extra = d.getUint16(at + 28, Endian.little);
    final name = utf8.decode(bytes.sublist(at + 30, at + 30 + nameLen));
    final start = at + 30 + nameLen + extra;
    out[name] = utf8.decode(bytes.sublist(start, start + size));
    at = start + size;
  }
  return out;
}

Json _t(String text, [List<Json> marks = const []]) => {'type': 'text', 'text': text, if (marks.isNotEmpty) 'marks': marks};
Json _p(List<Json> kids) => {'type': 'paragraph', 'content': kids};
Json _sb(String v, String text) => {
      'type': 'styledBlock',
      'attrs': {'variant': v},
      'content': [_t(text)]
    };

void main() {
  test('a work: package parts, Malayalam text, marks, sizes, footnotes, indents', () {
    final content = {
      'type': 'doc',
      'content': [
        _sb('title', 'പുഴ പറഞ്ഞ കഥ'),
        _p([_t('ഉമ്മ പാട്ടു മൂളി. '), _t('അമ്മച്ചി', [{'type': 'bold'}]), {'type': 'footnote', 'attrs': {'text': 'ഒരു കുറിപ്പ് & മറ്റൊന്ന്'}}]),
        _p([_t('വലുത്', [{'type': 'textStyle', 'attrs': {'fontSize': '14pt'}}])]),
        {'type': 'paragraph'},
        _p([_t('പുതിയ ഭാഗം')]),
      ],
    };
    final files = unzip(workDocx(title: 'പുഴ & കഥ', kind: DocKind.story, settings: const {}, content: content));
    expect(files.keys, containsAll(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/footnotes.xml', 'word/settings.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml']));
    expect(files['[Content_Types].xml'], contains('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'));
    expect(files['[Content_Types].xml'], contains('/word/footnotes.xml'));
    final doc = files['word/document.xml']!;
    expect(doc, contains('പുഴ പറഞ്ഞ കഥ'));
    expect(doc, contains('<w:b/><w:bCs/>'), reason: 'bold run');
    expect(doc, contains('<w:sz w:val="28"/>'), reason: "the writer's 14 pt");
    expect(doc, contains('<w:footnoteReference w:id="1"/>'));
    expect(files['word/footnotes.xml'], contains('ഒരു കുറിപ്പ് &amp; മറ്റൊന്ന്'));
    expect(files['docProps/core.xml'], contains('<dc:title>പുഴ &amp; കഥ</dc:title>'));
    // the second paragraph follows a paragraph with text: indented; after the empty line: not
    expect('w:firstLine="400"'.allMatches(doc).length, 1);
    expect(doc, isNot(contains('<w:jc w:val="both"/>')), reason: 'ragged-right unless the writer chose justify');
    expect(files['word/styles.xml'], contains('w:cs="Noto Serif Malayalam"'));
    expect(doc, contains('<w:pgSz w:w="11906" w:h="16838"/>'), reason: 'A4');
  });

  test('journals: contents page, oldest first, a page break before each journal', () {
    LitmaDoc j(String id, DateTime created, String? title) => LitmaDoc(
          id: id,
          title: title ?? journalTitle(created),
          kind: DocKind.diary,
          content: const {'type': 'doc'},
          settings: settingsFor(DocKind.diary),
          createdAt: created.toUtc(),
          updatedAt: created.toUtc(),
        );
    final a = DateTime(2026, 11, 2, 21), b = DateTime(2026, 11, 26, 18);
    EditorDocument body(DateTime d, String text) => EditorDocument.fromJson({
          'type': 'doc',
          'content': [
            {'type': 'styledBlock', 'attrs': {'variant': 'title'}},
            _sb('dateline', todayLine(d)),
            _p([_t(text)]),
          ],
        });
    final ja = j('a', a, null), jb = j('b', b, 'മഴ പെയ്ത വൈകുന്നേരം');
    final files = unzip(journalsWordFile([(ja, body(a, 'അച്ഛൻ പാടത്തേക്കു പോയി.')), (jb, body(b, 'ഫാത്തിമ ടീച്ചറും ജോസഫ് ചേട്ടനും.'))]));
    final doc = files['word/document.xml']!;
    expect(contentsEntry(ja), todayLine(a));
    expect(contentsEntry(jb), '${todayLine(b)} · മഴ പെയ്ത വൈകുന്നേരം');
    expect(doc, contains('ജേണലുകൾ'));
    expect(doc, contains('ഉള്ളടക്കം'));
    expect(doc, contains('1.  ${todayLine(a)}'));
    expect(doc, contains('2.  ${todayLine(b)} · മഴ പെയ്ത വൈകുന്നേരം'));
    expect('<w:br w:type="page"/>'.allMatches(doc).length, 2);
    final first = doc.indexOf('അച്ഛൻ പാടത്തേക്കു പോയി.'), second = doc.indexOf('ഫാത്തിമ ടീച്ചറും ജോസഫ് ചേട്ടനും.');
    expect(first > doc.indexOf('<w:br w:type="page"/>') && first < second, isTrue, reason: 'oldest first, after the contents');
    // the named journal's empty title block gets its title on its page
    expect(doc.lastIndexOf('മഴ പെയ്ത വൈകുന്നേരം') > doc.lastIndexOf('<w:br w:type="page"/>'), isTrue);
    expect(docxMime, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
}
