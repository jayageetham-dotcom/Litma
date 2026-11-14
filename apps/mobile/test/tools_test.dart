import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:litma/core/metre.dart';
import 'package:litma/data/fake.dart';
import 'package:litma/data/forms.dart';
import 'package:litma/data/local_db.dart';
import 'package:litma/data/offline.dart';
import 'package:litma/data/store.dart';
import 'package:litma/editor/document.dart';
import 'package:litma/editor/session.dart';

Map<String, dynamic> p(String text, [String type = 'paragraph', Map<String, dynamic>? attrs]) => {
      'type': type,
      'attrs': ?attrs,
      if (text.isNotEmpty) 'content': [{'type': 'text', 'text': text}],
    };

/// A session on a work of [kind] whose text is [content] (Tiptap JSON blocks).
Future<(EditorSession, OfflineLayer)> open(WidgetTester t, DocKind kind, List<Map<String, dynamic>> content) async {
  final o = OfflineLayer(db: MemoryDb(), backend: FakeBackend(), uid: () => 'w');
  final store = Store(o);
  final doc = await t.runAsync(() => store.createDoc(kind));
  final s = EditorSession(doc: doc!, store: store);
  s.document = EditorDocument.fromJson({'type': 'doc', 'content': content});
  await t.pumpWidget(const MaterialApp(home: SizedBox()));
  return (s, o);
}

Future<void> close(WidgetTester t, EditorSession s, OfflineLayer o) async {
  s.saver.dispose();
  o.dispose();
  await t.pump(const Duration(seconds: 2));
}

void main() {
  testWidgets('format: colour, size and highlight go on the selection as the web stores them', (t) async {
    final (s, o) = await open(t, DocKind.story, [p('മഴ പെയ്തു')]);
    final line = s.lines.first;
    s.focusLine(line);
    s.controllerFor(line).select(0, 2);
    s.setStyle('color', '#d92d20');
    s.setStyle('fontSize', '16pt');
    s.setHighlight('#fde68a');
    final first = (s.document.toJson()['content'] as List).first['content'].first as Map;
    expect(first['text'], 'മഴ');
    expect(first['marks'], containsAll([
      {'type': 'textStyle', 'attrs': {'color': '#d92d20', 'fontSize': '16pt'}},
      {'type': 'highlight', 'attrs': {'color': '#fde68a'}},
    ]));
    s.setStyle('color', null);
    s.setStyle('fontSize', null);
    s.setHighlight(null);
    expect((s.document.toJson()['content'] as List).first['content'].first['marks'], isNull);
    await close(t, s, o);
  });

  testWidgets('lists: a line becomes a list item, the same button turns it back', (t) async {
    final (s, o) = await open(t, DocKind.essay, [p('ഒന്ന്'), p('രണ്ട്')]);
    s.focusLine(s.lines.first);
    s.toggleList('bulletList');
    s.focusLine(s.lines[1]);
    s.toggleList('bulletList');
    final json = s.document.toJson()['content'] as List;
    expect(json.length, 1, reason: 'the second line joins the list above');
    expect(json.first['type'], 'bulletList');
    expect((json.first['content'] as List).length, 2);
    s.toggleList('orderedList');
    expect((s.document.toJson()['content'] as List).first['type'], 'orderedList');
    s.toggleList('orderedList');
    expect((s.document.toJson()['content'] as List).map((b) => b['type']), ['paragraph', 'paragraph']);
    await close(t, s, o);
  });

  testWidgets('footnotes, diary entries and inserted pages', (t) async {
    final (s, o) = await open(t, DocKind.essay, [p('വാക്ക്')]);
    s.focusLine(s.lines.first, at: 6);
    s.insertFootnote('ഉറവിടം');
    final inline = (s.document.toJson()['content'] as List).first['content'] as List;
    expect(inline.last, {'type': 'footnote', 'attrs': {'text': 'ഉറവിടം'}});
    s.insertPage();
    expect((s.document.toJson()['content'] as List).map((b) => b['type']), ['paragraph', 'pageBreak', 'paragraph', 'pageBreak']);
    // the + in a page's gap adds another blank page after that break
    s.insertPageAfter(s.document.blocks[1] as OpaqueBlock);
    expect((s.document.toJson()['content'] as List).map((b) => b['type']), ['paragraph', 'pageBreak', 'paragraph', 'pageBreak', 'paragraph', 'pageBreak']);
    expect(identical(s.focused, s.document.blocks[2]), isTrue, reason: 'the new page gets the cursor');
    // the + between two pages where the text ran on: a blank page before that line
    s.insertPageAt(0);
    expect((s.document.toJson()['content'] as List).map((b) => b['type']).take(4), ['pageBreak', 'paragraph', 'pageBreak', 'paragraph']);
    expect(identical(s.focused, s.document.blocks[1]), isTrue);
    s.appendDiaryEntry('2026 നവംബർ 7, ശനി');
    s.appendDiaryEntry('2026 നവംബർ 7, ശനി');
    final dates = (s.document.toJson()['content'] as List).where((b) => b['attrs']?['variant'] == 'dateline');
    expect(dates.length, 1, reason: "today's entry is reused");
    await close(t, s, o);
  });

  testWidgets('Backspace on an empty page removes the whole page, as on the web', (t) async {
    final (s, o) = await open(t, DocKind.story, [p('ഒന്ന്'), {'type': 'pageBreak'}, p(''), {'type': 'pageBreak'}, p('രണ്ട്')]);
    final blank = s.document.blocks[2] as TextBlock;
    final c = s.controllerFor(blank)..placeCursor(0);
    // Backspace at the start: the hidden first character goes
    c.value = TextEditingValue(text: c.value.text.substring(1), selection: const TextSelection.collapsed(offset: 0));
    expect((s.document.toJson()['content'] as List).map((b) => b['type']), ['paragraph', 'paragraph']);
    expect(identical(s.focused, s.document.blocks[0]), isTrue, reason: 'the cursor goes to the end of the page before');
    // an empty last page goes too
    s.document = EditorDocument.fromJson({'type': 'doc', 'content': [p('ഒന്ന്'), {'type': 'pageBreak'}, p('')]});
    final last = s.document.blocks[2] as TextBlock;
    final c2 = s.controllerFor(last)..placeCursor(0);
    c2.value = TextEditingValue(text: c2.value.text.substring(1), selection: const TextSelection.collapsed(offset: 0));
    expect((s.document.toJson()['content'] as List).map((b) => b['type']), ['paragraph']);
    await close(t, s, o);
  });

  testWidgets('a selection over several lines and pages: copy text, bold, delete, type over it', (t) async {
    final (s, o) = await open(t, DocKind.story, [p('one two'), p('three'), {'type': 'pageBreak'}, p('four five'), p('six')]);
    TextBlock line(int i) => s.document.blocks[i] as TextBlock;
    s.setSpan(DocPoint(line(0), 4), DocPoint(line(3), 5));
    expect(s.hasSpan, isTrue);
    expect(s.spanMultiLine, isTrue);
    expect(s.spanText, 'two\nthree\nfour ');
    // bold for the whole range, and off again
    s.toggleMark('bold');
    expect(s.markActive('bold'), isTrue);
    expect(line(1).marks.every((m) => m.has('bold')), isTrue);
    expect(line(0).marks[0].has('bold'), isFalse, reason: 'outside the selection');
    s.toggleMark('bold');
    expect(line(1).marks.any((m) => m.has('bold')), isFalse);
    // Delete: the lines and the page between go, the two ends join
    s.deleteSpan();
    expect(s.hasSpan, isFalse);
    expect((s.document.toJson()['content'] as List).map((b) => b['type']), ['paragraph', 'paragraph']);
    expect(line(0).text, 'one five');
    expect(identical(s.focused, line(0)), isTrue);
    expect(s.controllerFor(line(0)).blockSelection.extentOffset, 4, reason: 'the cursor stays where the selection started');
    // typing over a selection replaces it; the handles can be dragged either way round
    s.setSpan(DocPoint(line(1), 2), DocPoint(line(0), 3));
    expect(s.spanText, ' five\nsi');
    s.replaceSpan('!');
    expect(line(0).text, 'one!x');
    expect(s.document.blocks.length, 1);
    // Select all
    s.selectAll();
    expect(s.spanText, 'one!x');
    s.replaceSpan('');
    expect(line(0).text, '');
    await close(t, s, o);
  });

  testWidgets('a long press, then a handle dragged over lines: the selection stays when the finger lifts', (t) async {
    final (s, o) = await open(t, DocKind.story, [p('one two'), p('three'), p('four five')]);
    TextBlock line(int i) => s.document.blocks[i] as TextBlock;
    final first = s.controllerFor(line(0));
    s.focused = line(0); // the long press puts the keyboard on this line
    // the long press: the field selects the word "two"
    first.value = first.value.copyWith(selection: const TextSelection(baseOffset: 5, extentOffset: 8));
    expect(s.spanText, 'two');
    // the end handle is dragged to "four|" and the finger lifts
    final r = s.spanRange!;
    s.setSpan(r.$1, DocPoint(line(2), 4), sync: false);
    s.syncSpan();
    expect(s.spanText, 'two\nthree\nfour');
    expect(first.blockSelection.isCollapsed, isTrue, reason: 'the first line let go of its word');
    // the first line repeats its old word (its field losing focus): the selection stays
    first.value = first.value.copyWith(selection: const TextSelection(baseOffset: 5, extentOffset: 8));
    expect(s.spanMultiLine, isTrue);
    expect(s.spanText, 'two\nthree\nfour');
    await close(t, s, o);
  });

  testWidgets('plays: Story World characters fill the cast list once', (t) async {
    final (s, o) = await open(t, DocKind.drama, [
      p('കഥാപാത്രങ്ങൾ', 'styledBlock', {'variant': 'subhead'}),
      {'type': 'castEntry', 'content': [p('', 'castName'), p('', 'castRole')]},
    ]);
    expect(s.fillCastList([(name: 'ആമിന', role: 'അമ്മ'), (name: 'ജോസഫ്', role: null)]), 2);
    expect(s.fillCastList([(name: 'ആമിന', role: 'അമ്മ')]), 0);
    final cast = (s.document.toJson()['content'] as List).where((b) => b['type'] == 'castEntry').toList();
    expect(cast.length, 2, reason: 'the empty entry is used first');
    expect(cast.first['content'].first['content'].first['text'], 'ആമിന');
    await close(t, s, o);
  });

  testWidgets('screenplays: place, time and the cast of the current scene', (t) async {
    final (s, o) = await open(t, DocKind.screenplay, [
      p('Int./വീട്', 'sceneHeading'),
      {'type': 'dialogue', 'content': [p('രാമു', 'dialogueCue'), p('വാ', 'dialogueSpeech')]},
      {'type': 'dialogue', 'content': [p('സൈനബ (ചിരിച്ച്)', 'dialogueCue'), p('ഇല്ല', 'dialogueSpeech')]},
    ]);
    s.focusLine(s.lines.first);
    s.setScenePlace('Ext./');
    expect(s.lines.first.text, 'Ext./വീട്');
    s.setSceneTime('രാത്രി');
    expect(s.fillSceneCast(), 2);
    expect(s.fillSceneCast(), 0);
    final types = (s.document.toJson()['content'] as List).map((b) => b['type']).toList();
    expect(types.take(3), ['sceneHeading', 'sceneTime', 'sceneCast']);
    expect(s.lines[2].plainText, 'രാമു\nസൈനബ');
    await close(t, s, o);
  });

  testWidgets('find, replace all and the contents list', (t) async {
    final (s, o) = await open(t, DocKind.novel, [
      p('ഒന്നാം അദ്ധ്യായം', 'styledBlock', {'variant': 'chapter'}),
      p('മഴ, പിന്നെയും മഴ.'),
    ]);
    expect(s.find('മഴ').length, 2);
    expect(s.replaceAll('മഴ', 'വെയിൽ'), 2);
    expect(s.document.plainText, contains('വെയിൽ, പിന്നെയും വെയിൽ.'));
    final toc = s.outline();
    expect(toc.single.label, 'ഒന്നാം അദ്ധ്യായം');
    await close(t, s, o);
  });

  test('metre: aksharas and laghu / guru as on the web', () {
    expect(aksharas('കമലം').length, 3);
    expect(metrePattern('കാല'), '–∪');
    expect(metrePattern('അമ്മ'), '–∪', reason: 'a short akshara before a conjunct is guru');
  });
}
