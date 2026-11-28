import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:litma/core/i18n.dart';
import 'package:litma/core/theme.dart';
import 'package:litma/data/forms.dart';
import 'package:litma/data/models.dart';
import 'package:litma/editor/editor_screen.dart' show JournalArrow;
import 'package:litma/features/desk/journals_view.dart';

// The journal widgets on their own: ‹ › at the ends and while loading, and the card's face.

Map<String, dynamic> strings(String code) => jsonDecode(File('assets/i18n/$code.json').readAsStringSync()) as Map<String, dynamic>;

Future<void> pump(WidgetTester t, Widget child, {double width = 390}) async {
  await t.pumpWidget(MaterialApp(
    theme: litmaTheme(Brightness.light),
    home: I18n(
      strings: Strings('en', strings('en'), strings('en')),
      child: Scaffold(body: Align(alignment: Alignment.topLeft, child: SizedBox(width: width, child: child))),
    ),
  ));
  for (var k = 0; k < 4; k++) {
    await t.pump(const Duration(milliseconds: 200));
  }
}

LitmaDoc journal(String id, DateTime created, {String? title, DateTime? updated, String text = ''}) => LitmaDoc(
      id: id,
      title: title ?? journalTitle(created),
      kind: DocKind.diary,
      content: const {'type': 'doc'},
      settings: const {},
      plainText: text,
      wordCount: 42,
      createdAt: created.toUtc(),
      updatedAt: (updated ?? created).toUtc(),
    );

void main() {
  final a = journal('a', DateTime(2026, 11, 24, 8));
  final b = journal('b', DateTime(2026, 11, 26, 18), title: 'മഴ പെയ്ത വൈകുന്നേരം');
  final c = journal('c', DateTime(2026, 11, 28, 7));

  Widget arrows(LitmaDoc current, List<LitmaDoc>? list, List<String> opened) => Row(children: [
        JournalArrow(prev: true, current: current, journals: list, onOpen: (d) => opened.add(d.id)),
        JournalArrow(prev: false, current: current, journals: list, onOpen: (d) => opened.add(d.id)),
      ]);

  testWidgets('‹ › open the journals started before and after', (t) async {
    final opened = <String>[];
    await pump(t, arrows(b, [a, b, c], opened));
    expect(find.byTooltip('Previous journal, 24 നവം'), findsOneWidget);
    expect(find.byTooltip('Next journal, 28 നവം'), findsOneWidget);
    await t.tap(find.byType(JournalArrow).first);
    await t.tap(find.byType(JournalArrow).last);
    expect(opened, ['a', 'c']);
  });

  testWidgets('at the latest journal › stays in place, disabled', (t) async {
    final opened = <String>[];
    await pump(t, arrows(c, [a, b, c], opened));
    expect(find.byTooltip('This is your latest journal'), findsOneWidget);
    await t.tap(find.byType(JournalArrow).last);
    expect(opened, isEmpty);
    final buttons = t.widgetList<IconButton>(find.byType(IconButton)).toList();
    expect(buttons.first.onPressed, isNotNull);
    expect(buttons.last.onPressed, isNull);
  });

  testWidgets('while the journals load both are disabled', (t) async {
    final opened = <String>[];
    await pump(t, arrows(b, null, opened));
    final buttons = t.widgetList<IconButton>(find.byType(IconButton)).toList();
    expect(buttons.every((x) => x.onPressed == null), isTrue);
  });

  testWidgets('card: an untitled journal shows its first line; edited date only on another day', (t) async {
    final now = DateTime(2026, 11, 28, 20);
    final untitled = journal('u', DateTime(2026, 11, 28, 7), text: '${todayLine(DateTime(2026, 11, 28))}\nരാവിലെ ഉമ്മ പത്തിരി ചുട്ടു.\nഅയൽപക്കത്തെ കുട്ടികൾ വന്നു.');
    await pump(t, JournalCard(doc: untitled, now: now), width: 320);
    expect(find.text('രാവിലെ ഉമ്മ പത്തിരി ചുട്ടു.'), findsOneWidget);
    expect(find.text('അയൽപക്കത്തെ കുട്ടികൾ വന്നു.'), findsOneWidget);
    expect(find.textContaining('Edited'), findsNothing);
    expect(t.takeException(), isNull);

    final edited = journal('e', DateTime(2026, 11, 26, 18), title: 'മഴ പെയ്ത വൈകുന്നേരം', updated: DateTime(2026, 11, 27, 9), text: 'ബസ് സ്റ്റോപ്പിൽ ഒരു മണിക്കൂർ.');
    await pump(t, JournalCard(doc: edited, now: now), width: 320);
    expect(find.text('Edited 27 നവം'), findsOneWidget);
    expect(find.text('മഴ പെയ്ത വൈകുന്നേരം'), findsOneWidget);

    await pump(t, JournalCard(doc: journal('n', DateTime(2026, 11, 28, 7)), now: now), width: 320);
    expect(find.text('Nothing written yet'), findsOneWidget);
  });
}
