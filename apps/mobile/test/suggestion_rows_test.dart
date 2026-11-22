import 'dart:convert';
import 'dart:io';
// LocaleStringAttribute comes from dart:ui; newer Flutter also re-exports it from material
// ignore: unnecessary_import
import 'dart:ui' show LocaleStringAttribute;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:litma/core/i18n.dart';
import 'package:litma/core/theme.dart';
import 'package:litma/data/spell.dart';
import 'package:litma/editor/suggestion_rows.dart';

/// What screen readers (TalkBack, VoiceOver) get from the rows above the keyboard: one button per
/// spelling with a Malayalam label, Ignore and Keep by name with their hint, and the spelling row
/// announced when it appears.

Map<String, dynamic> strings(String code) => jsonDecode(File('assets/i18n/$code.json').readAsStringSync()) as Map<String, dynamic>;

String check(String key, [String code = 'en']) => (strings(code)['check'] as Map<String, dynamic>)[key] as String;

Future<void> pump(WidgetTester t, Widget row, {String locale = 'en'}) async {
  await t.pumpWidget(MaterialApp(
    theme: litmaTheme(Brightness.light),
    home: I18n(
      strings: Strings(locale, strings(locale), strings('en')),
      child: Scaffold(body: Align(alignment: Alignment.topLeft, child: SizedBox(width: 420, height: 46, child: row))),
    ),
  ));
  await t.pump(const Duration(seconds: 1)); // the chips' fade-in
}

const broken = SpellIssue(4, 9, 'ദു:ഖം', SpellKind.unicode, ['ദുഃഖം', 'ദുഖം']);
const suspect = SpellIssue(0, 5, 'പോയീ', SpellKind.suspect, ['പോയി']);

bool malayalam(SemanticsNode node) =>
    node.getSemanticsData().attributedLabel.attributes.any((a) => a is LocaleStringAttribute && a.locale.languageCode == 'ml');

void main() {
  testWidgets('spelling row: each spelling is one button read in Malayalam, and a tap uses it', (t) async {
    final h = t.ensureSemantics();
    String? fixed;
    await pump(t, SpellRow(issue: broken, onFix: (f) => fixed = f, onIgnore: () {}));
    final first = t.getSemantics(find.byKey(const ValueKey('spell-fix-0')));
    expect(first, containsSemantics(label: 'ദുഃഖം', isButton: true, hasTapAction: true));
    expect(malayalam(first), isTrue);
    expect(t.getSemantics(find.byKey(const ValueKey('spell-fix-1'))), containsSemantics(label: 'ദുഖം', isButton: true));
    await t.tap(find.byKey(const ValueKey('spell-fix-1')));
    expect(fixed, 'ദുഖം');
    h.dispose();
  });

  testWidgets('spelling row: Ignore and Keep are named by their word, with the longer hint', (t) async {
    final h = t.ensureSemantics();
    var ignored = false;
    var kept = false;
    await pump(t, SpellRow(issue: suspect, onFix: (_) {}, onIgnore: () => ignored = true, onKeep: () => kept = true));
    expect(
      t.getSemantics(find.byKey(const ValueKey('spell-ignore'))),
      containsSemantics(label: check('ignore'), hint: check('ignoreHint'), isButton: true, hasTapAction: true),
    );
    expect(
      t.getSemantics(find.byKey(const ValueKey('spell-keep'))),
      containsSemantics(label: check('keep'), hint: check('keepHint'), isButton: true, hasTapAction: true),
    );
    await t.tap(find.byKey(const ValueKey('spell-ignore')));
    await t.tap(find.byKey(const ValueKey('spell-keep')));
    expect(ignored, isTrue);
    expect(kept, isTrue);
    h.dispose();
  });

  testWidgets('spelling row: announced when it appears; no Keep for a broken letter', (t) async {
    final h = t.ensureSemantics();
    await pump(t, SpellRow(issue: broken, onFix: (_) {}, onIgnore: () {}));
    final kind = (strings('en')['check'] as Map<String, dynamic>)['kind']['unicode'] as String;
    expect(
      t.getSemantics(find.byKey(const ValueKey('spell-row'))),
      containsSemantics(isLiveRegion: true, label: check('announceTouch').replaceAll('{kind}', kind).replaceAll('{word}', 'ദു:ഖം')),
    );
    expect(find.byKey(const ValueKey('spell-keep')), findsNothing);
    h.dispose();
  });

  testWidgets('spelling row: Malayalam interface strings when the app is in Malayalam', (t) async {
    final h = t.ensureSemantics();
    await pump(t, SpellRow(issue: suspect, onFix: (_) {}, onIgnore: () {}, onKeep: () {}), locale: 'ml');
    expect(t.getSemantics(find.byKey(const ValueKey('spell-ignore'))), containsSemantics(label: check('ignore', 'ml'), hint: check('ignoreHint', 'ml')));
    h.dispose();
  });

  testWidgets('Manglish row: spellings read in Malayalam, the one a space takes is selected', (t) async {
    final h = t.ensureSemantics();
    String? picked;
    var english = false;
    await pump(t, ManglishRow(word: 'avan', candidates: const ['അവൻ', 'അവന'], onKeepEnglish: () => english = true, onPick: (c) => picked = c));
    final best = t.getSemantics(find.byKey(const ValueKey('manglish-0')));
    expect(best, containsSemantics(label: 'അവൻ', isButton: true, isSelected: true, hasTapAction: true));
    expect(malayalam(best), isTrue);
    final keepAria = (strings('en')['manglish'] as Map<String, dynamic>)['keepEnglishAria'] as String;
    expect(t.getSemantics(find.byKey(const ValueKey('manglish-keep'))), containsSemantics(label: keepAria.replaceAll('{word}', 'avan'), isButton: true));
    await t.tap(find.byKey(const ValueKey('manglish-1')));
    expect(picked, 'അവന');
    await t.tap(find.byKey(const ValueKey('manglish-keep')));
    expect(english, isTrue);
    h.dispose();
  });
}
