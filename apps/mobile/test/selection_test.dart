// Interaction audit (26 Nov 2026, owner on 0.7.33: "I selected a word and clicked outside which
// doesn't deselect the word"). The whole editor screen is pumped at phone size and driven with
// taps, so these follow what a writer does: make a selection, then tap outside it, in another
// line, beside it, on the bar, hide the keyboard, scroll away.
//
// Tests marked `skip:` fail because of a real app bug; the reason names the bug and the work file
// (docs/work/claude-interaction-audit.md, "Tests (tester)") says where it is. Fix the app, then
// remove the skip.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:litma/app/providers.dart';
import 'package:litma/data/forms.dart';
import 'package:litma/data/spell.dart';
import 'package:litma/editor/document.dart';
import 'package:litma/editor/editor_screen.dart';
import 'package:litma/editor/selection_layer.dart';
import 'package:litma/editor/session.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'screenshots/screens_test.dart' as h;

Map<String, dynamic> para(String text) => {
      'type': 'paragraph',
      if (text.isNotEmpty) 'content': [{'type': 'text', 'text': text}],
    };

/// Short Latin lines (one visual line each in the test font) so offsets and places are plain.
/// Line 6 starts with a Malayalam word for the spelling test (a Latin word at the cursor would
/// show the Manglish row instead).
List<String> lineTexts(int n) => [for (var i = 0; i < n; i++) i == 6 ? 'പോയീ word${i}x end' : 'line $i word${i}x end'];

/// "word<i>x" in line i.
const wordFrom = 7, wordTo = 13;

/// Bugs found by the audit: their tests are skipped until the app is fixed (see the work file).
const knownBug = true;

/// Steps the clock in frames (taps start timers; one long pump would skip the frames between).
Future<void> frames(WidgetTester t, [int n = 8]) async {
  for (var i = 0; i < n; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

/// The editor at phone size (390 × 844) on a story whose body is [lines].
Future<EditorSession> openEditor(WidgetTester t, {int lines = 8}) async {
  t.view.physicalSize = const Size(390, 844) * 3;
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  final services = await t.runAsync(() async {
    final s = await h.services();
    final doc = await s.store.createDoc(DocKind.story);
    await s.store.updateDoc(doc.id, {
      'content': {'type': 'doc', 'content': [for (final l in lineTexts(lines)) para(l)]},
      'settings': {...doc.settings, 'pristine': false},
    });
    return (s, doc.id);
  });
  final (Services s, String id) = services!;
  await t.pumpWidget(h.app(s, home: EditorScreen(docId: id)));
  await frames(t, 20);
  await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
  await frames(t, 20);
  expect(find.byType(SelectionLayer), findsOneWidget, reason: 'the editor opened');
  return t.widget<SelectionLayer>(find.byType(SelectionLayer)).session;
}

Future<void> closeEditor(WidgetTester t) async {
  await t.pumpWidget(const SizedBox());
  for (var i = 0; i < 6; i++) {
    await t.pump(const Duration(seconds: 1));
  }
}

Rect lineRect(WidgetTester t, EditorSession s, TextBlock line) => t.getRect(find.byKey(s.keyOf(line)!));

/// Tap a line (the keyboard comes to it), then select [from, to) of its text the way a long press
/// or a double tap does: through the field's own selection (+1 for the line's hidden first character).
Future<void> selectInLine(WidgetTester t, EditorSession s, TextBlock line, int from, int to) async {
  await t.tapAt(lineRect(t, s, line).centerLeft + const Offset(4, 0));
  await frames(t, 5);
  final c = s.controllerFor(line);
  c.value = c.value.copyWith(selection: TextSelection(baseOffset: from + 1, extentOffset: to + 1));
  await frames(t, 5);
}

Finder barButton(String label) => find.descendant(of: find.byType(SelectionLayer), matching: find.text(label));

/// Tap a button of the bar (it scrolls sideways on a phone).
Future<void> tapBar(WidgetTester t, Finder f) async {
  await t.ensureVisible(f);
  await frames(t, 3);
  await t.tap(f);
  await frames(t);
}

Rect barRect(WidgetTester t) => t.getRect(find.ancestor(of: barButton('Copy'), matching: find.byType(Material)).first);

/// The middle of character [i] of [line] on screen.
Offset charAt(EditorSession s, TextBlock line, int i) {
  final ed = editableOf(s, line)!;
  final a = ed.getLocalRectForCaret(TextPosition(offset: i + 1)), b = ed.getLocalRectForCaret(TextPosition(offset: i + 2));
  return ed.localToGlobal(Offset((a.left + b.left) / 2, a.center.dy));
}

/// Where the selection's end is drawn, in screen coordinates.
Offset endCaret(EditorSession s) {
  final r = s.spanRange!;
  final ed = editableOf(s, r.$2.line)!;
  return ed.localToGlobal(ed.getLocalRectForCaret(TextPosition(offset: r.$2.at + 1)).center);
}

void main() {
  setUpAll(() async {
    PackageInfo.setMockInitialValues(appName: 'Litma', packageName: 'in.getlitma.litma', version: '0.7.33', buildNumber: '1', buildSignature: '');
    // the app's own fonts, so lines, the footer and the bar measure as on a phone (the test font's
    // square glyphs are far wider and overflow the footer)
    await h.loadFonts();
  });

  // ── the owner's report ──

  testWidgets('owner, 26 Nov: a word picked by long press, then a tap on the page below the text, ends the selection', (t) async {
    final s = await openEditor(t);
    final last = s.lines.last;
    // the writer is typing in this line (it holds the keyboard), then long-presses a word in it
    await t.tapAt(lineRect(t, s, last).centerRight - const Offset(4, 0));
    await frames(t, 5);
    await t.longPressAt(charAt(s, last, wordFrom + 2));
    await frames(t);
    debugPrint('long press (focused line): field selection=${s.controllerFor(last).blockSelection} hasSpan=${s.hasSpan}');
    expect(s.hasSpan, isTrue, reason: 'the long press selected a word');
    expect(barButton('Copy'), findsOneWidget, reason: 'the selection bar shows');
    // the paper under the last line: this lands on the line that already holds the keyboard
    await t.tapAt(Offset(195, lineRect(t, s, last).bottom + 60));
    await frames(t);
    expect(s.hasSpan, isFalse);
    expect(barButton('Copy'), findsNothing, reason: 'the bar goes with it');
    expect(s.controllerFor(last).blockSelection.isCollapsed, isTrue, reason: 'no hidden selection is left in the field');
    await closeEditor(t);
  });

  testWidgets('a long press on a line that does not hold the keyboard shows the selection',
      skip: knownBug, // BUG (tester, 26 Nov; CI log: field selection 7..13, focused, hasSpan=false): the field
      // reports the long-pressed word first, then gets focus; the focus listener in session.focusFor
      // ("the writer went to another line") then clears _anchor/_extent. The word stays selected in the
      // field with a clear highlight: no highlight, handles or bar, and typing replaces a word the writer
      // can't see. Remove the skip once fixed.
      (t) async {
    final s = await openEditor(t);
    final last = s.lines.last;
    await t.longPressAt(charAt(s, last, wordFrom + 2));
    await frames(t);
    expect(s.hasSpan, isTrue);
    expect(s.spanText, 'word7x');
    expect(barButton('Copy'), findsOneWidget);
    await closeEditor(t);
  });

  testWidgets('a tap on the page below the text ends a selection made in the focused line', (t) async {
    final s = await openEditor(t);
    final last = s.lines.last;
    await selectInLine(t, s, last, wordFrom, wordTo);
    expect(s.spanText, 'word7x');
    await t.tapAt(Offset(195, lineRect(t, s, last).bottom + 60));
    await frames(t);
    expect(s.hasSpan, isFalse);
    expect(barButton('Copy'), findsNothing);
    await closeEditor(t);
  });

  testWidgets('a tap on another line ends the selection and puts the cursor there', (t) async {
    final s = await openEditor(t);
    await selectInLine(t, s, s.lines[2], wordFrom, wordTo);
    expect(s.hasSpan, isTrue);
    await t.tapAt(lineRect(t, s, s.lines[5]).center);
    await frames(t);
    expect(s.hasSpan, isFalse);
    expect(identical(s.focused, s.lines[5]), isTrue);
    expect(barButton('Copy'), findsNothing);
    await closeEditor(t);
  });

  testWidgets('a tap elsewhere in the same line ends the selection', (t) async {
    final s = await openEditor(t);
    final line = s.lines[3];
    await selectInLine(t, s, line, 0, 4);
    expect(s.spanText, 'line');
    await t.tapAt(charAt(s, line, 15));
    await frames(t);
    expect(s.hasSpan, isFalse);
    await closeEditor(t);
  });

  testWidgets('keyboard hidden with a selection, then a tap in the same line: the selection ends',
      skip: knownBug, // BUG (tester, 26 Nov): the field reports the tap's cursor before it gets focus back, so
      // session._followFieldSelection ("a field losing focus doesn't" end it) keeps the span, and the
      // focus listener doesn't clear it either because `focused` is still this line. Highlight, handles
      // and bar stay. Remove the skip once fixed.
      (t) async {
    final s = await openEditor(t);
    final line = s.lines[3];
    await selectInLine(t, s, line, 0, 4);
    FocusManager.instance.primaryFocus?.unfocus(); // Hide keyboard does exactly this
    await frames(t);
    expect(s.hasSpan, isTrue, reason: 'hiding the keyboard keeps the selection (Format, Look up still use it)');
    await t.tapAt(charAt(s, line, 15));
    await frames(t);
    expect(s.hasSpan, isFalse);
    expect(barButton('Copy'), findsNothing);
    await closeEditor(t);
  });

  testWidgets('a tap right after the selected word (beside the end handle) moves the cursor and ends it',
      skip: knownBug, // BUG (tester, 26 Nov): selection_layer.dart _handle() is a 44 px wide opaque GestureDetector
      // (pan only) from the caret top to the knob under the line. A tap there reaches nothing: the text
      // 22 px either side of each selection end, and the line below the knob, can't be tapped.
      (t) async {
    final s = await openEditor(t);
    final line = s.lines[3];
    await selectInLine(t, s, line, 0, 4);
    await t.tapAt(endCaret(s) + const Offset(14, 0));
    await frames(t);
    expect(s.hasSpan, isFalse);
    await closeEditor(t);
  });

  // ── the bar ──

  testWidgets('Select all, then Deselect all from the same place', (t) async {
    final s = await openEditor(t);
    await selectInLine(t, s, s.lines[3], 0, 4);
    await t.ensureVisible(barButton('Select all'));
    await frames(t, 3);
    await t.tap(barButton('Select all'));
    await frames(t);
    expect(s.allSelected, isTrue);
    expect(s.spanText.split('\n').length, 8);
    await t.ensureVisible(barButton('Deselect all'));
    await frames(t, 3);
    await t.tap(barButton('Deselect all'));
    await frames(t);
    expect(s.hasSpan, isFalse);
    expect(barButton('Copy'), findsNothing);
    final f = s.current!;
    expect(f.blockSelection.isCollapsed, isTrue, reason: 'no hidden selection is left in the field (typing would replace it)');
    await closeEditor(t);
  });

  testWidgets('bar buttons: Copy, Cut, Paste, Delete, Bold', (t) async {
    String? clip;
    t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') clip = (call.arguments as Map)['text'] as String?;
      if (call.method == 'Clipboard.getData') return {'text': clip};
      return null;
    });
    addTearDown(() => t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    final s = await openEditor(t);
    final line = s.lines[3];
    await selectInLine(t, s, line, wordFrom, wordTo);
    await tapBar(t, barButton('Copy'));
    expect(clip, 'word3x');
    expect(s.hasSpan, isTrue, reason: 'Copy keeps the selection');
    await tapBar(t, find.descendant(of: find.byType(SelectionLayer), matching: find.byIcon(LucideIcons.bold)));
    expect(line.marks.sublist(wordFrom, wordTo).every((m) => m.has('bold')), isTrue);
    // Bold ends a one-line selection (a separate test below): select the word again for Cut
    await selectInLine(t, s, line, wordFrom, wordTo);
    await tapBar(t, barButton('Cut'));
    expect(line.text, 'line 3  end');
    expect(s.hasSpan, isFalse);
    // Paste over a new selection
    await selectInLine(t, s, s.lines[1], 0, 4);
    await tapBar(t, barButton('Paste'));
    expect(s.lines[1].text, 'word3x 1 word1x end');
    await selectInLine(t, s, s.lines[2], 0, 5);
    await tapBar(t, barButton('Delete'));
    expect(s.lines[2].text, '2 word2x end');
    await closeEditor(t);
  });

  testWidgets('Bold or Italic from the bar keeps a one-line selection',
      skip: knownBug, // BUG (tester, 26 Nov; CI: after Bold the bar was gone): session.toggleMark on a one-line
      // selection calls BlockController.toggleMark, which reports onChanged(textChanged: true), and
      // session._followFieldSelection then clears the span. Highlight, handles and bar vanish while the
      // field still holds the word (invisible), so Italic next is impossible and typing replaces it.
      // The keyboard strip's B / I / U and the Format sheet go the same way.
      (t) async {
    final s = await openEditor(t);
    final line = s.lines[3];
    await selectInLine(t, s, line, wordFrom, wordTo);
    await tapBar(t, find.descendant(of: find.byType(SelectionLayer), matching: find.byIcon(LucideIcons.bold)));
    expect(s.hasSpan, isTrue);
    expect(barButton('Copy'), findsOneWidget);
    await tapBar(t, find.descendant(of: find.byType(SelectionLayer), matching: find.byIcon(LucideIcons.italic)));
    expect(line.marks.sublist(wordFrom, wordTo).every((m) => m.has('italic')), isTrue);
    await closeEditor(t);
  });

  testWidgets('bar placement: never over the selected line; with no room above it goes below', (t) async {
    final s = await openEditor(t);
    final mid = s.lines[4];
    await selectInLine(t, s, mid, wordFrom, wordTo);
    final bar = barRect(t), sel = lineRect(t, s, mid), above = lineRect(t, s, s.lines[3]);
    debugPrint('bar placement (middle): bar=$bar selected=$sel lineAbove=$above');
    expect(bar.overlaps(sel), isFalse, reason: 'the selected line stays readable');
    // the first line, right under the app bar: the bar goes below the selection
    final first = s.lines.first;
    await t.tapAt(lineRect(t, s, s.lines[6]).center);
    await frames(t);
    await selectInLine(t, s, first, wordFrom, wordTo);
    final bar2 = barRect(t), sel2 = lineRect(t, s, first);
    debugPrint('bar placement (first line): bar=$bar2 selected=$sel2 lineBelow=${lineRect(t, s, s.lines[1])}');
    expect(bar2.overlaps(sel2), isFalse);
    // with the keyboard up the bar stays inside what is left of the screen
    t.view.viewInsets = const FakeViewPadding(bottom: 300 * 3);
    await frames(t);
    final bar3 = barRect(t);
    debugPrint('bar placement (keyboard up): bar=$bar3');
    expect(bar3.bottom, lessThanOrEqualTo(844 - 300));
    await closeEditor(t);
  });

  testWidgets('bar placement: the line above the selection stays visible and tappable',
      skip: knownBug, // BUG (owner's screenshot, 26 Nov): selection_layer.dart _bar() puts the bar 12 px above the
      // selection's first caret (`anchor.top - height - 12`), so its 44 px cover the line above. The bar
      // is wider than a phone (seven buttons, it scrolls), so a tap meant for that line lands on Cut,
      // Paste or Delete instead. Needs a design decision (designer): keep a whole line clear, or dock it.
      (t) async {
    final s = await openEditor(t);
    await selectInLine(t, s, s.lines[4], wordFrom, wordTo);
    expect(barRect(t).overlaps(lineRect(t, s, s.lines[3])), isFalse);
    await closeEditor(t);
  });

  testWidgets('a selection scrolled off screen leaves no bar over other text',
      skip: knownBug, // BUG (tester, 26 Nov): lines stay built 2400 px past the screen (scrollCacheExtent), so
      // _geometry still has the handles' places (off screen) and _bar() clamps its top to 8: the bar
      // floats at the top of the page over unrelated text while the selection is far away.
      (t) async {
    final s = await openEditor(t, lines: 80);
    await selectInLine(t, s, s.lines[1], wordFrom, wordTo);
    expect(barButton('Copy'), findsOneWidget);
    t.widget<SelectionLayer>(find.byType(SelectionLayer)).scroll.jumpTo(1500);
    await frames(t);
    expect(s.hasSpan, isTrue, reason: 'scrolling keeps the selection');
    expect(barButton('Copy'), findsNothing);
    await closeEditor(t);
  });

  // ── keyboard strip ──

  testWidgets('Hide keyboard in the strip takes the keyboard away from the line', (t) async {
    final s = await openEditor(t);
    final line = s.lines[2];
    await t.tapAt(lineRect(t, s, line).center);
    t.view.viewInsets = const FakeViewPadding(bottom: 300 * 3);
    await frames(t);
    expect(s.focusFor(line).hasFocus, isTrue);
    final hide = find.byTooltip('Hide keyboard');
    // the strip is a lazy sideways list: scroll it until the last tool is built
    final strip = find.ancestor(of: find.byTooltip('Undo'), matching: find.byType(Scrollable)).first;
    await t.dragUntilVisible(hide, strip, const Offset(-200, 0));
    await frames(t, 3);
    await t.tap(hide);
    await frames(t);
    expect(s.focusFor(line).hasFocus, isFalse);
    await closeEditor(t);
  });

  testWidgets('spelling: Ignore in the strip clears the mark in every line and is kept with the work', (t) async {
    final s = await openEditor(t);
    final line = s.lines[6];
    expect(line.text.startsWith('പോയീ'), isTrue);
    await t.tapAt(lineRect(t, s, line).centerRight - const Offset(4, 0));
    await frames(t, 3);
    for (final l in [line, s.lines[5]]) {
      final c = s.controllerFor(l);
      c.spellCheckedText = l.text; // the background check leaves these lines alone
      c.setSpellIssues([const SpellIssue(0, 4, 'പോയീ', SpellKind.suspect, ['പോയി'])]);
    }
    final c = s.controllerFor(line);
    c.value = c.value.copyWith(selection: const TextSelection.collapsed(offset: 3)); // cursor inside the marked word
    t.view.viewInsets = const FakeViewPadding(bottom: 300 * 3);
    await frames(t);
    expect(find.byKey(const ValueKey('spell-row')), findsOneWidget, reason: 'the marked word shows its row above the keyboard');
    await t.tap(find.byKey(const ValueKey('spell-ignore')));
    await frames(t);
    expect(s.isSpellIgnored('പോയീ'), isTrue);
    expect(s.controllerFor(s.lines[5]).spellIssues, isEmpty, reason: 'the same word elsewhere is left too');
    expect(find.byKey(const ValueKey('spell-row')), findsNothing);
    expect(((s.settings['spellIgnored'] as List?) ?? const []).contains('പോയീ'), isTrue);
    await closeEditor(t);
  });
}
