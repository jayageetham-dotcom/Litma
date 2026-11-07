import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:litma/core/manglish.dart';
import 'package:litma/data/forms.dart';
import 'package:litma/data/models.dart';
import 'package:litma/editor/document.dart';
import 'package:litma/editor/export.dart';
import 'package:litma/features/books/book_export.dart';
import 'package:litma/features/books/book_screen.dart';
import 'package:litma/features/books/cover.dart';
import 'package:litma/features/books/cover_designer.dart';
import 'package:pdf/pdf.dart';

import 'screenshots/screens_test.dart' show app, services, settle;

Map<String, dynamic> p(String text) => {
      'type': 'paragraph',
      if (text.isNotEmpty) 'content': [{'type': 'text', 'text': text}],
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('covers', () {
    test('ISBN-10 and ISBN-13 become the 13 digits of the barcode; a wrong check digit draws nothing', () {
      expect(isbn13('978-0-000-00000-2'), '9780000000002');
      expect(isbn13('0-306-40615-2'), '9780306406157');
      expect(isbn13('978-0-306-40615-8'), isNull);
      expect(isbn13(null), isNull);
    });

    test('sample values fill only what was never set; a cleared field stays empty', () {
      final patch = bookSamples({'id': 'b', 'title': 'പുസ്തകം', 'subtitle': '', 'cover': {'price': ''}})!;
      expect(patch.containsKey('subtitle'), isFalse);
      expect(patch['author'], 'എഴുത്തുകാരുടെ പേര്');
      expect((patch['settings'] as Map)['publisher'], defaultPublisher);
      expect((patch['settings'] as Map)['isbn'], sampleIsbn);
      expect((patch['cover'] as Map)['price'], '');
      expect((patch['cover'] as Map)['blurb'], isNotEmpty);
      final full = {'id': 'b', 'title': 'x', 'subtitle': 'y', 'author': 'z', 'settings': (patch['settings'] as Map).cast<String, dynamic>(), 'cover': (patch['cover'] as Map).cast<String, dynamic>()};
      expect(bookSamples(full), isNull);
    });

    test('a preset sets its look and clears dragged positions and sizes', () {
      final patch = presetPatch('epic');
      expect(patch['template'], 'art');
      expect(patch['offsets'], isEmpty);
      expect(patch['sizes'], isEmpty);
      expect(patch['titleScale'], 1);
      for (final id in coverPresets.keys) {
        expect(coverLayouts, contains(coverPresets[id]!['template']), reason: id);
      }
    });

    test('names typed in Manglish read as Malayalam (Name case reads small)', () {
      expect(toMalayalam('Aamina'), toMalayalam('aamina'));
      expect(toMalayalam('mazha'), manglishWord('mazha'));
    });
  });

  group('PDF HTML', () {
    test('an empty line is a section break; footnotes are numbered and listed at the end', () {
      final doc = EditorDocument.fromJson({
        'type': 'doc',
        'content': [
          p('ഒന്ന്'),
          p('രണ്ട്'),
          p(''),
          {
            'type': 'paragraph',
            'content': [
              {'type': 'text', 'text': 'മൂന്ന്'},
              {'type': 'footnote', 'attrs': {'text': 'ഒരു കുറിപ്പ്'}},
            ],
          },
        ],
      });
      final html = docBodyHtml(doc, kind: DocKind.novel);
      expect(html, contains('class="doc k-novel prose"'));
      expect(html, contains('<p class="paragraph gap">മൂന്ന്<sup class="fn">1</sup></p>'));
      expect(html, contains('<li>ഒരു കുറിപ്പ്</li>'));
      expect(html, isNot(contains('<p class="paragraph"></p>')));
    });

    test('a chapter in a book leaves out the work\'s own title lines', () {
      final doc = EditorDocument.fromJson({
        'type': 'doc',
        'content': [
          {'type': 'styledBlock', 'attrs': {'variant': 'title'}, 'content': [{'type': 'text', 'text': 'തലക്കെട്ട്'}]},
          p('കഥ'),
        ],
      });
      expect(docBodyHtml(doc, kind: DocKind.story, stripTitle: true), isNot(contains('തലക്കെട്ട്')));
      expect(docBodyHtml(doc, kind: DocKind.story), contains('തലക്കെട്ട്'));
    });

    test('a book: pages in order, numbered contents, the copyright notice, the app\'s own fonts', () async {
      final book = Book({
        'id': 'b',
        'title': 'പുഴ',
        'author': 'ആമിന',
        'structure': [
          {'id': '1', 'type': 'cover'},
          {'id': '2', 'type': 'title'},
          {'id': '3', 'type': 'copyright'},
          {'id': '4', 'type': 'toc'},
          {'id': '5', 'type': 'document', 'documentId': 'd1'},
          {'id': '6', 'type': 'document', 'documentId': 'd2', 'inToc': false},
          {'id': '7', 'type': 'back-cover'},
        ],
        'settings': {'pageSize': 'A5', 'isbn': '978-0-000-00000-2'},
      });
      LitmaDoc doc(String id, String title) => LitmaDoc(
            id: id,
            title: title,
            kind: DocKind.story,
            content: {'type': 'doc', 'content': [p('ഒരു കഥ')]},
            settings: const {},
            createdAt: DateTime(2026),
            updatedAt: DateTime(2026),
          );
      final html = await bookInteriorHtml(book, {'d1': doc('d1', 'ഒന്നാം കഥ'), 'd2': doc('d2', 'രണ്ടാം കഥ')});
      expect(html, contains('@page { size: A5;'));
      expect(html, contains("@font-face { font-family: 'Noto Serif Malayalam'"));
      expect(html, contains('ISBN 978-0-000-00000-2'));
      expect(RegExp('<section>').allMatches(html).length, 5);
      expect(html, contains('<span class="toc-no">1</span><span>ഒന്നാം കഥ</span>'));
      expect(html, isNot(contains('<span>രണ്ടാം കഥ</span>')));
      expect(html, contains('<span class="chapter-no">2</span>രണ്ടാം കഥ'));
    });

    test('the book\'s page size and margins go into the PDF format', () {
      final f = bookPageFormat({'pageSize': 'A5', 'margins': {'top': 30, 'bottom': 24, 'inner': 24, 'outer': 20}});
      expect(f.width, closeTo(PdfPageFormat.a5.width, 0.01));
      expect(f.marginTop, closeTo(30 * PdfPageFormat.mm, 0.01));
      expect(bookPageFormat(const {}, margins: false).marginLeft, 0);
    });
  });

  group('screens', () {
    testWidgets('the cover designer: a preset, the back cover tools', (t) async {
      final s = await t.runAsync(() => services()) as dynamic;
      final book = await t.runAsync(() => s.store.getBook('b-1')) as Book;
      final patches = <Map<String, dynamic>>[];
      t.view.physicalSize = const Size(390, 844) * 3;
      t.view.devicePixelRatio = 3;
      addTearDown(t.view.reset);
      await t.pumpWidget(app(s, home: CoverDesignerScreen(book: book, onCover: patches.add)));
      await settle(t);
      await t.tap(find.text('Epic'));
      await settle(t, 5);
      expect(patches.last['preset'], 'epic');
      expect(patches.last['template'], 'art');
      await t.tap(find.text('Back cover'));
      await settle(t, 5);
      expect(find.text('Blurb'), findsOneWidget);
      final price = find.widgetWithText(TextField, 'Price');
      await t.dragUntilVisible(price, find.byType(ListView).first, const Offset(0, -240));
      await settle(t, 3);
      await t.enterText(price, '₹ 300');
      await settle(t, 2);
      expect(patches.last, {'price': '₹ 300'});
    });

    testWidgets('a book opens with sample details, shows Book details and saves them', (t) async {
      final s = await t.runAsync(() => services()) as dynamic;
      t.view.physicalSize = const Size(390, 844) * 3;
      t.view.devicePixelRatio = 3;
      addTearDown(t.view.reset);
      await t.pumpWidget(app(s, home: const BookScreen(bookId: 'b-1')));
      await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
      await settle(t);
      expect(find.text('Design the cover'), findsOneWidget);
      await t.tap(find.text('Book details'));
      await settle(t, 5);
      expect(find.text('Publisher'), findsOneWidget);
      await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 900)));
      await settle(t, 10);
      final saved = await t.runAsync(() => s.store.getBook('b-1')) as Book;
      expect(saved.settings['publisher'], defaultPublisher);
      expect(saved.subtitle, 'ചെറുകഥകൾ');
    });
  });
}
