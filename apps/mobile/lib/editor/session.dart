import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../core/manglish.dart';
import '../data/models.dart';
import '../data/spell.dart';
import '../data/store.dart';
import 'writing_timer.dart';
import 'block_controller.dart';
import 'document.dart';
import 'saver.dart';

/// One open work in the editor: the document model, a text controller and focus node per
/// editable line, the rules for Enter and Backspace, formatting, undo, and saving.
class EditorSession extends ChangeNotifier {
  EditorSession({required LitmaDoc doc, required this.store, Json? restored}) : _doc = doc {
    document = EditorDocument.fromJson(restored ?? doc.content);
    mode = inputModeFrom(doc.settings['inputMode']);
    pristine = doc.pristine && restored == null;
    _lastSavedWords = doc.wordCount;
    words = countWords(document.plainText);
    saver = DocSaver(id: doc.id, offline: store.offline, snapshot: () => document.toJson(), save: _save)..start();
    _history.add(_snap());
    if (restored != null) saver.touch(); // restored from the phone's journal: save it right away
  }

  final Store store;
  LitmaDoc _doc;
  LitmaDoc get doc => _doc;
  DocKind get kind => _doc.kind;
  Json get settings => _doc.settings;
  String get title => _doc.title;

  late EditorDocument document;
  late InputMode mode;

  /// Set by the editor screen: the best spelling it is showing for a Manglish word.
  String? Function(String word)? spelling;

  /// Set by the editor screen: Story World was closed (names may have changed).
  VoidCallback? storyClosed;
  late final DocSaver saver;

  /// New works stay pristine until the writer types; pristine works are discarded on close.
  bool pristine = false;
  int words = 0;
  int _lastSavedWords = 0;

  /// minutes (ms since epoch / 60 000) in which the text changed since the last save
  Set<int> _activeMinutes = {};
  DateTime _lastSnapshot = DateTime.now();

  final _controllers = <TextBlock, BlockController>{};
  final _focus = <TextBlock, FocusNode>{};

  /// The line being edited.
  TextBlock? focused;

  /// Styles text marks; set by the editor screen from the theme.
  MarkStyler styler = (m, b) => b;

  /// Set by the editor screen: scroll a line into view and put the cursor there (Contents, Find).
  void Function(TextBlock line)? reveal;

  // ── lines ──

  /// Every editable line, top to bottom (inside dialogues and cast entries too).
  List<TextBlock> get lines => [
        for (final b in document.blocks)
          if (b is TextBlock) b else if (b is GroupBlock) ...b.textChildren,
      ];

  BlockController controllerFor(TextBlock b) => _controllers.putIfAbsent(b, () {
        // a line coming into view gets its spelling marks
        _scheduleSpelling(const Duration(milliseconds: 300));
        return BlockController(block: b, styler: styler, mode: mode, spelling: (w) => spelling?.call(w), onSplit: _onSplit, onMergeBack: _onMergeBack, onChanged: _onChanged, onSpanEdit: _onSpanEdit);
      });

  // ── spelling marks ──

  /// Set by the editor screen: checks a line's text for spelling (null: marks off).
  Future<List<SpellIssue>> Function(String text)? spellCheck;

  /// Words ignored in this work since it opened (also saved in `settings.spellIgnored`, kept with the
  /// work on every device, as on the web); other works still mark them.
  final _ignoredNow = <String>{};

  /// Ignored in this work.
  bool isSpellIgnored(String word) => _ignoredNow.contains(word) || ((settings['spellIgnored'] as List?)?.contains(word) ?? false);
  Timer? _spellTimer;
  int _spellRun = 0;

  /// Check every line again (marks switched on or off, a word kept or ignored).
  void recheckSpelling() {
    _spellRun++;
    for (final c in _controllers.values) {
      c.spellCheckedText = null;
      if (spellCheck == null) c.setSpellIssues(const []);
    }
    _scheduleSpelling(const Duration(milliseconds: 50));
  }

  /// Leave this word as written in this work, kept with it (a reopen or another device keeps it).
  void ignoreSpelling(String word) {
    _ignoredNow.add(word);
    final kept = [...((settings['spellIgnored'] as List?)?.cast<String>() ?? const <String>[])];
    if (!kept.contains(word)) {
      kept.add(word);
      _doc = _doc.copyWith(settings: {..._doc.settings, 'spellIgnored': kept.length > 1000 ? kept.sublist(kept.length - 1000) : kept});
      unawaited(store.updateDoc(_doc.id, {'settings': _doc.settings}).catchError((_) => false));
    }
    for (final c in _controllers.values) {
      if (c.spellIssues.any((i) => i.text == word)) c.setSpellIssues([for (final i in c.spellIssues) if (i.text != word) i]);
    }
    notifyListeners();
  }

  void _scheduleSpelling([Duration delay = const Duration(milliseconds: 700)]) {
    if (spellCheck == null) return;
    _spellTimer?.cancel();
    _spellTimer = Timer(delay, _runSpelling);
  }

  /// Lines whose text changed since their last check (only lines that have been built), a few at
  /// a time so the engine gets their words in one request.
  Future<void> _runSpelling() async {
    final check = spellCheck;
    if (check == null) return;
    final run = ++_spellRun;
    final todo = [for (final c in _controllers.values) if (c.spellCheckedText != c.block.text) c];
    var changed = false;
    for (var i = 0; i < todo.length; i += 24) {
      final part = todo.sublist(i, i + 24 < todo.length ? i + 24 : todo.length);
      await Future.wait(part.map((c) async {
        final text = c.block.text;
        List<SpellIssue> found;
        try {
          found = await check(text);
        } catch (_) {
          return;
        }
        // the line changed or went away while it was being checked: it is done again later
        if (run != _spellRun || c.block.text != text || !identical(_controllers[c.block], c)) return;
        c.spellCheckedText = text;
        final marks = [for (final f in found) if (!isSpellIgnored(f.text)) f];
        if (marks.isNotEmpty || c.spellIssues.isNotEmpty) changed = true;
        c.setSpellIssues(marks);
      }));
      if (run != _spellRun) return;
    }
    if (changed) notifyListeners();
  }

  FocusNode focusFor(TextBlock b) => _focus.putIfAbsent(b, () {
        final f = FocusNode(debugLabel: b.type);
        f.addListener(() {
          if (f.hasFocus && focused != b) {
            focused = b;
            // the writer went to another line: a selection over several lines ends
            if (!_syncing && _anchor != null) _anchor = _extent = null;
            notifyListeners();
          } else if (!f.hasFocus) {
            // left the line: a Manglish word still being typed is finished, as a space would
            _controllers[b]?.finishPendingWord();
          }
        });
        return f;
      });

  BlockController? get current => focused == null ? null : _controllers[focused];

  /// Top-level block holding [line] (itself, or its dialogue / cast entry / list).
  int topIndexOf(TextBlock line) {
    for (var i = 0; i < document.blocks.length; i++) {
      final b = document.blocks[i];
      if (identical(b, line)) return i;
      if (b is GroupBlock && b.textChildren.any((c) => identical(c, line))) return i;
    }
    return -1;
  }

  GroupBlock? groupOf(TextBlock line) {
    final i = topIndexOf(line);
    final b = i < 0 ? null : document.blocks[i];
    return b is GroupBlock ? b : null;
  }

  void focusLine(TextBlock b, {int? at}) {
    focused = b;
    final c = controllerFor(b);
    c.placeCursor(at ?? b.text.length);
    notifyListeners();
    // the line's field may be built in this frame
    WidgetsBinding.instance.addPostFrameCallback((_) => focusFor(b).requestFocus());
  }

  // ── Enter ──

  /// What follows a line when Enter is pressed at its end and the template left no empty line.
  String _nextType(TextBlock b) => switch (b.type) {
        'sceneHeading' => 'sceneTime',
        'sceneTime' => 'sceneCast',
        'sceneCast' => 'action',
        'action' => 'action',
        'transition' => 'sceneHeading',
        _ => 'paragraph',
      };

  /// The next empty line the template left after [b] (stepping over a filled പല്ലവി or
  /// കഥാപാത്രങ്ങൾ label), like the web's moveToNextSlot.
  TextBlock? _nextSlot(TextBlock b) {
    final all = lines;
    final i = all.indexWhere((x) => identical(x, b));
    for (var j = i + 1; j < all.length; j++) {
      final n = all[j];
      if (n.isEmpty) return n;
      final label = n.type == 'styledBlock' && (n.variant == 'part' || n.variant == 'subhead');
      if (!label) return null;
    }
    return null;
  }

  void _onSplit(BlockController c, int at) {
    final b = c.block;
    _beforeChange();
    final atEnd = at >= b.text.length;
    final group = groupOf(b);

    if (group != null) {
      _enterInGroup(group, b, at, atEnd);
      return;
    }

    if (atEnd) {
      final slot = _nextSlot(b);
      if (slot != null) {
        focusLine(slot, at: 0);
        _afterChange();
        return;
      }
    }
    final i = topIndexOf(b);
    final TextBlock next;
    if (atEnd) {
      final type = _nextType(b);
      next = TextBlock(type, type == 'paragraph' && b.type == 'paragraph' ? _keepAlign(b.attrs) : {});
      if (b.text.isNotEmpty) next.marks = [];
    } else {
      next = b.splitAt(at, type: b.type == 'styledBlock' && at == 0 ? 'styledBlock' : null);
      c.reload(cursor: at);
    }
    document.blocks.insert(i + 1, next);
    focusLine(next, at: 0);
    _afterChange();
  }

  Json _keepAlign(Json attrs) => attrs['textAlign'] == null ? {} : {'textAlign': attrs['textAlign']};

  void _enterInGroup(GroupBlock g, TextBlock b, int at, bool atEnd) {
    final i = document.blocks.indexOf(g);
    final kids = g.textChildren.toList();
    final k = kids.indexWhere((x) => identical(x, b));
    // a play: Enter on an empty speaker line turns the dialogue into a stage direction
    if (kind == DocKind.drama && b.type == 'dialogueCue' && b.isEmpty && kids.every((x) => x.isEmpty)) {
      final stage = TextBlock('styledBlock', {'variant': 'stage'});
      document.blocks[i] = stage;
      focusLine(stage, at: 0);
      _afterChange();
      return;
    }
    // speaker → speech, name → role: go on to the next line of the same entry
    if (k < kids.length - 1 && atEnd) {
      focusLine(kids[k + 1], at: 0);
      _afterChange();
      return;
    }
    if (!atEnd) {
      // a line break inside a speech or list item
      final c = controllerFor(b);
      b.text = b.text.substring(0, at) + hardBreakChar + b.text.substring(at);
      b.marks.insert(at, at > 0 ? b.marks[at - 1] : MarkSet.empty);
      b.atoms = {for (final e in b.atoms.entries) (e.key >= at ? e.key + 1 : e.key): e.value};
      c.reload(cursor: at + 1);
      _afterChange();
      return;
    }
    // end of the entry: a new one of the same kind (empty last line in a list ends the list)
    final Block fresh;
    switch (g.type) {
      case 'dialogue':
        fresh = GroupBlock('dialogue', {}, [TextBlock('dialogueCue', {}), TextBlock('dialogueSpeech', {})]);
      case 'castEntry':
        fresh = GroupBlock('castEntry', {}, [TextBlock('castName', {}), TextBlock('castRole', {})]);
      default:
        if (b.isEmpty) {
          fresh = TextBlock('paragraph', {});
        } else {
          final item = g.children.last;
          fresh = item is GroupBlock ? GroupBlock(item.type, {...item.attrs}, [TextBlock('paragraph', {})]) : TextBlock('paragraph', {});
          if (fresh is GroupBlock) {
            g.children.add(fresh);
            focusLine(fresh.textChildren.first, at: 0);
            _afterChange();
            return;
          }
        }
    }
    document.blocks.insert(i + 1, fresh);
    focusLine(fresh is GroupBlock ? fresh.textChildren.first : fresh as TextBlock, at: 0);
    _afterChange();
  }

  // ── Backspace at the start of a line ──

  void _onMergeBack(BlockController c) {
    final b = c.block;
    final all = lines;
    final li = all.indexWhere((x) => identical(x, b));
    final group = groupOf(b);
    final i = topIndexOf(b);
    _beforeChange();

    if (group != null) {
      // an empty dialogue or cast entry goes away; otherwise step to the line before
      if (group.textChildren.every((x) => x.isEmpty)) {
        document.blocks.removeAt(i);
        if (document.blocks.isEmpty) document.blocks.add(TextBlock('paragraph', {}));
      }
      if (li > 0) focusLine(all[li - 1]);
      _afterChange();
      return;
    }
    if (i <= 0) {
      // first line of the work: a styled line becomes body text
      if (b.type != 'paragraph' && b.isEmpty && b.type == 'styledBlock') {
        b.type = 'paragraph';
        b.attrs = {};
        c.reload(cursor: 0);
        _afterChange();
      }
      return;
    }
    final prev = document.blocks[i - 1];
    if (prev is OpaqueBlock && prev.type == 'pageBreak' && b.isEmpty) {
      final next = i + 1 < document.blocks.length ? document.blocks[i + 1] : null;
      if (next == null || (next is OpaqueBlock && next.type == 'pageBreak')) {
        // An empty page (an empty line between two breaks, or after the last one) goes away whole:
        // the line, the break after it and the break before it, and the cursor goes to the end of
        // the line before (as on the web, like Google Docs).
        if (next != null) document.blocks.removeAt(i + 1);
        document.blocks.removeAt(i);
        _dropLine(b);
        document.blocks.removeAt(i - 1);
        if (li > 0) {
          focusLine(all[li - 1]);
        } else if (document.blocks.whereType<TextBlock>().isEmpty) {
          final first = TextBlock('paragraph', {});
          document.blocks.insert(0, first);
          focusLine(first, at: 0);
        }
        _afterChange();
        notifyListeners();
        return;
      }
    }
    if (prev is OpaqueBlock) {
      // Backspace at the start of a page removes the page break before it (as on the web)
      document.blocks.removeAt(i - 1);
      _afterChange();
      notifyListeners();
      return;
    }
    if (prev is TextBlock) {
      final join = prev.text.length;
      prev.append(b);
      document.blocks.removeAt(i);
      _dropLine(b);
      controllerFor(prev).reload(cursor: join);
      focusLine(prev, at: join);
      _afterChange();
      return;
    }
    // previous is a dialogue or list: an empty line goes away, otherwise move into it
    if (b.isEmpty) {
      document.blocks.removeAt(i);
      _dropLine(b);
    }
    if (li > 0) focusLine(all[li - 1]);
    _afterChange();
  }

  void _dropLine(TextBlock b) {
    _lineKeys.remove(b);
    _controllers.remove(b)?.dispose();
    final f = _focus.remove(b);
    WidgetsBinding.instance.addPostFrameCallback((_) => f?.dispose());
  }

  // ── typing ──

  void _onChanged(BlockController c, {required bool textChanged}) {
    if (!_syncing) _followFieldSelection(c, textChanged: textChanged);
    if (!textChanged) {
      notifyListeners(); // selection moved: toolbar state, suggestions
      return;
    }
    _afterChange();
  }

  void _beforeChange() {}

  void _afterChange() {
    _scheduleSpelling();
    if (pristine) pristine = false;
    words = countWords(document.plainText);
    _activeMinutes.add(DateTime.now().millisecondsSinceEpoch ~/ 60000);
    WritingTimer.instance.words(_doc.id, words);
    saver.touch();
    _scheduleHistory();
    notifyListeners();
  }

  // ── formatting ──

  /// The line's block type for the block menu: 'paragraph', a styled variant, or a node type.
  String get currentBlockKey {
    final f = focused;
    if (f == null) return 'paragraph';
    return f.type == 'styledBlock' ? (f.variant ?? 'paragraph') : f.type;
  }

  bool get canChangeBlock => focused != null && groupOf(focused!) == null;

  /// Turn the current line into body text or a styled block (text and marks stay).
  void setBlock(String key) {
    final f = focused;
    if (f == null || groupOf(f) != null) return;
    _beforeChange();
    final align = f.attrs['textAlign'];
    if (key == 'paragraph') {
      f.type = 'paragraph';
      f.attrs = {'textAlign': ?align};
    } else {
      f.type = 'styledBlock';
      f.attrs = {'textAlign': ?align, 'variant': key};
    }
    controllerFor(f).reload();
    _afterChange();
  }

  bool markActive(String type) => spanMultiLine ? _spanHas(type) : (current?.markActive(type) ?? false);

  void toggleMark(String type) {
    if (spanMultiLine) {
      _markSpan(type);
      return;
    }
    final c = current;
    if (c == null) return;
    c.toggleMark(type);
    notifyListeners();
  }

  /// Alignment buttons are disabled on screenplay scene and dialogue lines (as on the web).
  bool get canAlign {
    final f = focused;
    return f != null && const {'paragraph', 'heading', 'styledBlock', 'action', 'transition'}.contains(f.type);
  }

  String get align => focused?.align ?? 'start';

  void setAlign(String? value) {
    final f = focused;
    if (f == null || !canAlign) return;
    _beforeChange();
    if (value == null) {
      f.attrs.remove('textAlign');
    } else {
      f.attrs = {...f.attrs, 'textAlign': value};
    }
    _afterChange();
  }

  void setMode(InputMode m) {
    mode = m;
    for (final c in _controllers.values) {
      c.mode = m;
    }
    _doc = _doc.copyWith(settings: {..._doc.settings, 'inputMode': m.name});
    unawaited(store.updateDoc(_doc.id, {'settings': _doc.settings}).catchError((_) => false));
    notifyListeners();
  }

  /// Insert a dialogue (screenplay, play) after the current line.
  void insertDialogue() {
    final f = focused;
    final i = f == null ? document.blocks.length - 1 : topIndexOf(f);
    final d = GroupBlock('dialogue', {}, [TextBlock('dialogueCue', {}), TextBlock('dialogueSpeech', {})]);
    document.blocks.insert(i + 1, d);
    focusLine(d.textChildren.first, at: 0);
    _afterChange();
  }

  Future<void> rename(String title) async {
    final t = title.trim();
    if (t.isEmpty || t == _doc.title) return;
    _doc = _doc.copyWith(title: t);
    notifyListeners();
    saver.touch();
  }

  // ── text style, highlight, lists (the Format sheet) ──

  String? styleAt(String attr) => current?.styleAt(attr);
  String? get highlightAt => current?.highlightAt;

  /// Text colour (a CSS colour) or font size ("14pt"); null goes back to automatic.
  void setStyle(String attr, String? value) {
    final c = current;
    if (c == null) return;
    c.setStyleAttr(attr, value);
    notifyListeners();
  }

  void setHighlight(String? color) {
    final c = current;
    if (c == null) return;
    c.setHighlight(color);
    notifyListeners();
  }

  /// The writer's own font size at the cursor in pt, or the work's size when none is set.
  double get fontSizeAt {
    final own = double.tryParse((styleAt('fontSize') ?? '').replaceAll('pt', ''));
    return own ?? ((settings['fontSize'] as num?)?.toDouble() ?? 12);
  }

  /// The list type the current line is in ('bulletList', 'orderedList') or null.
  String? get listType {
    final f = focused;
    if (f == null) return null;
    final g = groupOf(f);
    return g != null && (g.type == 'bulletList' || g.type == 'orderedList') ? g.type : null;
  }

  bool get canList {
    final f = focused;
    if (f == null) return false;
    final g = groupOf(f);
    return (g == null && f.type == 'paragraph') || listType != null;
  }

  /// Make the current line a list item, switch the list's kind, or turn the list back into
  /// body lines (pressing the same list button again), like the web's list buttons.
  void toggleList(String type) {
    final f = focused;
    if (f == null || !canList) return;
    _beforeChange();
    final i = topIndexOf(f);
    final g = groupOf(f);
    if (g == null) {
      // join a list of the same kind right above, else start one
      final prev = i > 0 ? document.blocks[i - 1] : null;
      final item = GroupBlock('listItem', {}, [f]);
      if (prev is GroupBlock && prev.type == type) {
        prev.children.add(item);
        document.blocks.removeAt(i);
      } else {
        document.blocks[i] = GroupBlock(type, {}, [item]);
      }
    } else if (g.type != type) {
      document.blocks[i] = GroupBlock(type, {...g.attrs}, g.children, extra: g.extra);
    } else {
      document.blocks.replaceRange(i, i + 1, [
        for (final t in g.textChildren)
          if (t.type == 'paragraph') t else TextBlock('paragraph', {}, text: t.text, marks: [...t.marks], atoms: {...t.atoms}),
      ]);
    }
    focusLine(f, at: controllerFor(f).blockSelection.extentOffset);
    _afterChange();
  }

  // ── writing-type tools ──

  /// Essays and features: a footnote at the cursor (listed at the end on every app).
  void insertFootnote(String text) {
    final c = current;
    if (c == null || text.trim().isEmpty) return;
    _beforeChange();
    c.insertAtom({'type': 'footnote', 'attrs': {'text': text.trim()}});
    _afterChange();
  }

  /// Diary: today's date heading at the end (or go to today's entry), like the web's "New entry".
  void appendDiaryEntry(String today) {
    _beforeChange();
    TextBlock? lastDate;
    for (final b in document.blocks) {
      if (b is TextBlock && b.type == 'styledBlock' && b.variant == 'dateline') lastDate = b;
    }
    if (lastDate != null && lastDate.text.trim() == today) {
      final end = lines.last;
      focusLine(end, at: end.text.length);
      return;
    }
    final last = document.blocks.last;
    if (last is TextBlock && last.type == 'paragraph' && last.isEmpty) document.blocks.removeLast();
    final body = TextBlock('paragraph', {});
    document.blocks.addAll([TextBlock('styledBlock', {'variant': 'dateline'}, text: today), body]);
    focusLine(body, at: 0);
    _afterChange();
  }

  /// Plays: add Story World characters to the cast list (names already there are skipped).
  /// Returns how many were added.
  int fillCastList(List<({String name, String? role})> people) {
    final have = <String>{};
    int? emptyAt;
    var lastEnd = -1;
    var headingEnd = -1;
    for (var i = 0; i < document.blocks.length; i++) {
      final b = document.blocks[i];
      if (b is GroupBlock && b.type == 'castEntry') {
        final kids = b.textChildren.toList();
        final name = kids.isEmpty ? '' : kids.first.text.trim();
        if (name.isNotEmpty) {
          have.add(name);
        } else if (kids.every((k) => k.text.trim().isEmpty)) {
          emptyAt ??= i;
        }
        lastEnd = i + 1;
      } else if (b is TextBlock && b.type == 'styledBlock' && b.variant == 'subhead' && RegExp('കഥാപാത്ര|cast', caseSensitive: false).hasMatch(b.text) && headingEnd < 0) {
        headingEnd = i + 1;
      }
    }
    final fresh = people.where((p) => p.name.trim().isNotEmpty && !have.contains(p.name.trim())).toList();
    if (fresh.isEmpty) return 0;
    _beforeChange();
    final entries = [
      for (final p in fresh)
        GroupBlock('castEntry', {}, [TextBlock('castName', {}, text: p.name.trim()), TextBlock('castRole', {}, text: p.role?.trim() ?? '')]),
    ];
    if (emptyAt != null) {
      document.blocks.replaceRange(emptyAt, emptyAt + 1, entries);
    } else {
      final f = focused;
      final at = lastEnd >= 0 ? lastEnd : headingEnd >= 0 ? headingEnd : (f == null ? document.blocks.length : topIndexOf(f) + 1);
      document.blocks.insertAll(at, entries);
    }
    _afterChange();
    return fresh.length;
  }

  /// Screenplays: the scene the cursor is in, as [heading index, end index) of top-level blocks.
  (int, int)? _currentScene() {
    final heads = [for (var i = 0; i < document.blocks.length; i++) if (document.blocks[i] is TextBlock && document.blocks[i].type == 'sceneHeading') i];
    if (heads.isEmpty) return null;
    final f = focused;
    final cursor = f == null ? 0 : topIndexOf(f);
    final before = heads.where((h) => h <= cursor).length;
    final k = before == 0 ? 0 : before - 1;
    return (heads[k], k + 1 < heads.length ? heads[k + 1] : document.blocks.length);
  }

  bool get inScene => kind == DocKind.screenplay && _currentScene() != null;

  /// Int./Ext. at the start of the scene heading, keeping the place name.
  void setScenePlace(String prefix) {
    final sc = _currentScene();
    if (sc == null) return;
    final h = document.blocks[sc.$1] as TextBlock;
    _beforeChange();
    final rest = h.text.replaceFirst(RegExp(r'^\s*(int\.?\s*/\s*ext\.?|int\.?|ext\.?)\s*/?\s*', caseSensitive: false), '');
    final next = '$prefix$rest';
    final c = controllerFor(h);
    c.replaceRange(0, h.text.length, next);
    focusLine(h, at: prefix.length);
    _afterChange();
  }

  /// The scene's time line (പകൽ, രാത്രി…): filled in, or added after the heading.
  void setSceneTime(String time) {
    final sc = _currentScene();
    if (sc == null) return;
    _beforeChange();
    TextBlock? t;
    for (var i = sc.$1 + 1; i < sc.$2; i++) {
      final b = document.blocks[i];
      if (b is TextBlock && b.type == 'sceneTime') {
        t = b;
        break;
      }
    }
    if (t == null) {
      t = TextBlock('sceneTime', {});
      document.blocks.insert(sc.$1 + 1, t);
    }
    controllerFor(t).replaceRange(0, t.text.length, time);
    _afterChange();
  }

  /// The scene's cast line from the names that speak in it. Returns how many names were added.
  int fillSceneCast() {
    final sc = _currentScene();
    if (sc == null) return 0;
    final speakers = <String>[];
    TextBlock? cast;
    var timeAt = -1;
    for (var i = sc.$1; i < sc.$2; i++) {
      final b = document.blocks[i];
      if (b is TextBlock && b.type == 'sceneCast') cast ??= b;
      if (b is TextBlock && b.type == 'sceneTime' && timeAt < 0) timeAt = i;
      if (b is GroupBlock && b.type == 'dialogue') {
        final cue = b.textChildren.firstOrNull;
        final name = (cue?.text ?? '').replaceAll(RegExp(r'\(.*?\)'), '').replaceAll(RegExp(r'[:：]\s*$'), '').trim();
        if (name.isNotEmpty && !speakers.contains(name)) speakers.add(name);
      }
    }
    final existing = cast == null ? <String>[] : cast.text.split(RegExp('[,$hardBreakChar\n]')).map((x) => x.trim()).where((x) => x.isNotEmpty).toList();
    final fresh = speakers.where((x) => !existing.contains(x)).toList();
    if (fresh.isEmpty) return 0;
    _beforeChange();
    final text = [...existing, ...fresh].join(hardBreakChar);
    if (cast == null) {
      cast = TextBlock('sceneCast', {});
      document.blocks.insert(timeAt >= 0 ? timeAt + 1 : sc.$1 + 1, cast);
    }
    controllerFor(cast).replaceRange(0, cast.text.length, text);
    _afterChange();
    return fresh.length;
  }

  /// Insert page: a page of its own after the current line (page break, empty line, page
  /// break), like the web's "+ Insert page".
  void insertPage() {
    final f = focused;
    final i = f == null ? document.blocks.length - 1 : topIndexOf(f);
    _beforeChange();
    final blank = TextBlock('paragraph', {});
    document.blocks.insertAll(i + 1, [OpaqueBlock({'type': 'pageBreak'}), blank, OpaqueBlock({'type': 'pageBreak'})]);
    focusLine(blank, at: 0);
    _afterChange();
  }

  /// The + between two pages where the text ran on by itself: a blank page there, before the
  /// top-level block [index] (page break, empty line, page break), like the web's insertPageAt.
  void insertPageAt(int index) {
    final i = index.clamp(0, document.blocks.length);
    _beforeChange();
    final blank = TextBlock('paragraph', {});
    document.blocks.insertAll(i, [OpaqueBlock({'type': 'pageBreak'}), blank, OpaqueBlock({'type': 'pageBreak'})]);
    focusLine(blank, at: 0);
    _afterChange();
  }

  /// The + in the gap after an inserted page break: another blank page right after it.
  void insertPageAfter(OpaqueBlock pageBreak) {
    final i = document.blocks.indexWhere((b) => identical(b, pageBreak));
    if (i < 0) return insertPage();
    _beforeChange();
    final blank = TextBlock('paragraph', {});
    document.blocks.insertAll(i + 1, [blank, OpaqueBlock({'type': 'pageBreak'})]);
    focusLine(blank, at: 0);
    _afterChange();
  }

  // ── find, outline ──

  /// Every place [term] appears, top to bottom.
  List<({TextBlock line, int at})> find(String term, {bool caseSensitive = false}) {
    if (term.isEmpty) return const [];
    final needle = caseSensitive ? term : term.toLowerCase();
    final out = <({TextBlock line, int at})>[];
    for (final l in lines) {
      final hay = caseSensitive ? l.text : l.text.toLowerCase();
      var i = hay.indexOf(needle);
      while (i >= 0) {
        out.add((line: l, at: i));
        i = hay.indexOf(needle, i + needle.length);
      }
    }
    return out;
  }

  /// Select a found place (the editor has already brought its line into view).
  void showMatch(TextBlock line, int at, int length) {
    focused = line;
    controllerFor(line).select(at, at + length);
    notifyListeners();
  }

  /// Replace every place [term] appears with [text]; returns how many were replaced.
  int replaceAll(String term, String text, {bool caseSensitive = false}) {
    final hits = find(term, caseSensitive: caseSensitive);
    if (hits.isEmpty) return 0;
    _beforeChange();
    // from the end of each line so earlier positions stay right
    for (final h in hits.reversed) {
      controllerFor(h.line).replaceRange(h.at, h.at + term.length, text);
    }
    _afterChange();
    return hits.length;
  }

  /// The work's headings for the Contents sheet (same rules as the web's outline).
  List<({TextBlock line, String label, int level})> outline() {
    final en = settings['headingLabels'] == 'en';
    final out = <({TextBlock line, String label, int level})>[];
    var scene = 0, act = 0, dscene = 0, stanza = 0;
    for (final b in document.blocks) {
      if (b is! TextBlock) continue;
      final text = b.plainText.trim();
      final v = b.type == 'styledBlock' ? (b.variant ?? '') : '';
      if (b.type == 'heading') {
        out.add((line: b, label: text.isEmpty ? '—' : text, level: (b.attrs['level'] as num?)?.toInt() ?? 1));
      } else if (b.type == 'sceneHeading') {
        out.add((line: b, label: '${++scene}. ${text.isEmpty ? '—' : text}', level: 1));
      } else if (v == 'act') {
        dscene = 0;
        out.add((line: b, label: '${en ? 'Act' : 'അങ്കം'} ${++act}${text.isEmpty ? '' : ': $text'}', level: 1));
      } else if (v == 'scene') {
        out.add((line: b, label: '${en ? 'Scene' : 'രംഗം'} ${++dscene}${text.isEmpty ? '' : ': $text'}', level: act > 0 ? 2 : 1));
      } else if (v == 'stanza') {
        out.add((line: b, label: '${++stanza}${text.isEmpty ? '' : '. $text'}', level: 2));
      } else if (const {'title', 'chapter', 'subhead', 'part', 'dateline', 'references'}.contains(v) && text.isNotEmpty) {
        out.add((line: b, label: text, level: v == 'subhead' || v == 'part' ? 2 : 1));
      }
    }
    return out;
  }

  // ── tools (AI, inbox, dictionary, history) ──

  /// The selected text in the current line.
  String get selectedText {
    if (hasSpan) return spanText;
    final c = current;
    if (c == null) return '';
    final s = c.blockSelection;
    return s.isCollapsed ? '' : c.block.text.substring(s.start, s.end).replaceAll(hardBreakChar, '\n');
  }

  /// The writing before the cursor (context for the AI), at most the last [max] characters.
  String textBefore({int max = 6000}) {
    final f = focused;
    final all = lines;
    final i = f == null ? all.length : all.indexWhere((x) => identical(x, f));
    final parts = [for (final l in all.take(i < 0 ? all.length : i)) l.plainText];
    if (f != null) parts.add(f.text.substring(0, controllerFor(f).blockSelection.start).replaceAll(hardBreakChar, '\n'));
    final t = parts.join('\n');
    return t.length > max ? t.substring(t.length - max) : t;
  }

  /// Put [text] at the cursor (replacing a selection). Several paragraphs become lines of their own.
  void insertText(String text) {
    var f = focused;
    if (f == null) {
      final all = lines;
      if (all.isEmpty) return;
      f = all.last;
      focused = f;
      controllerFor(f).placeCursor(f.text.length);
    }
    final c = controllerFor(f);
    final sel = c.blockSelection;
    final paras = text.trim().split(RegExp(r'\n\s*\n|\n'));
    _beforeChange();
    c.replaceRange(sel.start, sel.end, paras.first);
    if (paras.length > 1 && groupOf(f) == null) {
      final at = c.blockSelection.extentOffset;
      final tail = f.splitAt(at, type: 'paragraph', attrs: {});
      c.reload(cursor: at);
      var i = topIndexOf(f);
      TextBlock last = f;
      for (final p in paras.skip(1)) {
        last = TextBlock('paragraph', {}, text: p);
        document.blocks.insert(++i, last);
      }
      if (tail.text.isNotEmpty) last.append(tail);
      focusLine(last, at: last.text.length - tail.text.length);
    }
    _afterChange();
  }

  /// Replace the first place [target] appears in the work with [text]; false when it isn't there.
  bool replaceInDocument(String target, String text) {
    for (final l in lines) {
      final i = l.text.indexOf(target);
      if (i >= 0) {
        focused = l;
        controllerFor(l).replaceRange(i, i + target.length, text);
        _afterChange();
        return true;
      }
    }
    return false;
  }

  /// Replace part of one line (a spelling fix).
  void replaceInLine(TextBlock line, int from, int to, String text) {
    if (from < 0 || to > line.text.length || from > to) return;
    focused = line;
    _beforeChange();
    controllerFor(line).replaceRange(from, to, text);
    _afterChange();
  }

  /// Save work settings (plot board columns, typing mode…).
  void updateSettings(Json patch) {
    _doc = _doc.copyWith(settings: {..._doc.settings, ...patch});
    unawaited(store.updateDoc(_doc.id, {'settings': _doc.settings}).catchError((_) => false));
    notifyListeners();
  }

  /// Bring back an earlier version (the current text is kept as a version first).
  Future<void> restoreVersion(Json content) async {
    await store.saveVersion(_doc.id, document.toJson(), words, 'Before restoring').catchError((_) {});
    _restore(jsonEncode(content));
    _pushHistory();
  }

  // ── selection across lines ──
  //
  // Each line is its own text field, so the fields' own selection stops at a line's end. A
  // selection is kept here instead, from one place in the work to another: the editor paints it
  // and its handles over the page (selection_layer.dart), and the line where it starts holds the
  // part in that line as its field's selection, so the keyboard replaces the whole range when
  // the writer types or presses Backspace (onSpanEdit). Undo takes it back in one step.

  DocPoint? _anchor, _extent;
  bool _syncing = false;
  final _lineKeys = <TextBlock, GlobalKey>{};

  /// Key on each line's field, so the selection layer can find where its text is drawn.
  GlobalKey keyFor(TextBlock b) => _lineKeys.putIfAbsent(b, () => GlobalKey(debugLabel: 'line'));

  /// The key of a line's field, if it has been built.
  GlobalKey? keyOf(TextBlock b) => _lineKeys[b];

  bool get hasSpan {
    final a = _anchor, e = _extent;
    return a != null && e != null && !(identical(a.line, e.line) && a.at == e.at);
  }

  /// The selection in reading order (start, end), or null.
  (DocPoint, DocPoint)? get spanRange {
    if (!hasSpan) return null;
    final all = lines;
    final a = _anchor!, e = _extent!;
    if (_index(a.line, all) < 0 || _index(e.line, all) < 0) return null;
    return _compare(a, e, all) <= 0 ? (a, e) : (e, a);
  }

  bool get spanMultiLine {
    final r = spanRange;
    return r != null && !identical(r.$1.line, r.$2.line);
  }

  int _index(TextBlock l, List<TextBlock> all) => all.indexWhere((x) => identical(x, l));

  int _compare(DocPoint a, DocPoint b, List<TextBlock> all) {
    final i = _index(a.line, all), j = _index(b.line, all);
    return i != j ? i - j : a.at - b.at;
  }

  /// Each line in the selection with the part of it that is selected.
  List<({TextBlock line, int from, int to})> get spanParts {
    final r = spanRange;
    if (r == null) return const [];
    final all = lines;
    final i = _index(r.$1.line, all), j = _index(r.$2.line, all);
    return [
      for (var k = i; k <= j; k++)
        (line: all[k], from: k == i ? r.$1.at.clamp(0, all[k].text.length) : 0, to: k == j ? r.$2.at.clamp(0, all[k].text.length) : all[k].text.length),
    ];
  }

  /// The selected text, lines joined with line breaks.
  String get spanText => spanParts.map((p) => p.line.text.substring(p.from, p.to).replaceAll(hardBreakChar, '\n').replaceAll(atomChar, '')).join('\n');

  /// Select from [anchor] to [extent] (either order). While a handle is being dragged [sync] is
  /// false, and [syncSpan] follows when the finger lifts.
  void setSpan(DocPoint anchor, DocPoint extent, {bool sync = true}) {
    _anchor = DocPoint(anchor.line, anchor.at.clamp(0, anchor.line.text.length));
    _extent = DocPoint(extent.line, extent.at.clamp(0, extent.line.text.length));
    if (sync) _syncSpanToField();
    notifyListeners();
  }

  void syncSpan() => _syncSpanToField();

  /// A handle is grabbed: the line holding the keyboard lets go of its own selection quietly (the
  /// long-pressed word), so nothing it reports while the finger moves or the page scrolls can shrink
  /// or end the selection. Its echo of the cursor is expected, not a tap.
  void beginHandleDrag() {
    final f = focused;
    final c = f == null ? null : _controllers[f];
    if (f == null || c == null) return;
    final at = c.blockSelection.extentOffset;
    if (!c.blockSelection.isCollapsed) {
      _syncing = true;
      try {
        c.placeCursor(at);
      } finally {
        _syncing = false;
      }
    }
    _synced = (f, at, at);
  }

  void clearSpan() {
    if (_anchor == null) return;
    _anchor = _extent = null;
    notifyListeners();
  }

  /// The whole work.
  void selectAll() {
    final all = lines;
    if (all.isEmpty) return;
    setSpan(DocPoint(all.first, 0), DocPoint(all.last, all.last.text.length));
  }

  /// True when the selection covers the whole work (the bar then offers Deselect all).
  bool get allSelected {
    final r = spanRange;
    final all = lines;
    if (r == null || all.isEmpty) return false;
    return identical(r.$1.line, all.first) && r.$1.at == 0 && identical(r.$2.line, all.last) && r.$2.at >= all.last.text.length;
  }

  /// End the selection and leave the cursor in the line that holds the keyboard (Deselect all).
  void deselectAll() {
    final f = focused;
    final c = f == null ? null : _controllers[f];
    _anchor = _extent = null;
    if (c != null && !c.blockSelection.isCollapsed) {
      _syncing = true;
      try {
        c.placeCursor(c.blockSelection.extentOffset);
      } finally {
        _syncing = false;
      }
    }
    _synced = null;
    notifyListeners();
  }

  /// The line where the selection was last moved to (on screen, under the writer's finger) holds
  /// its part of the selection as its field's own selection, with the keyboard.
  (TextBlock, int, int)? _synced;

  void _syncSpanToField() {
    final e = _extent;
    if (e == null || !hasSpan) return;
    ({TextBlock line, int from, int to})? part;
    for (final p in spanParts) {
      if (identical(p.line, e.line)) part = p;
    }
    if (part == null) return;
    final line = part.line;
    _syncing = true;
    try {
      // the line that held the selection before (where the long press was) lets go of it quietly,
      // or it reports its old word back when it loses focus and the selection shrinks to that word
      final before = focused;
      if (before != null && !identical(before, line)) {
        final c = _controllers[before];
        if (c != null && !c.blockSelection.isCollapsed) c.placeCursor(c.blockSelection.extentOffset);
      }
      focused = line;
      controllerFor(line).select(part.from, part.to);
      _synced = (line, part.from, part.to);
    } finally {
      _syncing = false;
    }
    final f = focusFor(line);
    if (!f.hasFocus) WidgetsBinding.instance.addPostFrameCallback((_) => f.requestFocus());
  }

  /// A field's own selection changed (long press, double tap, a mouse, Shift + arrows): it becomes
  /// the selection; a cursor ends it.
  void _followFieldSelection(BlockController c, {required bool textChanged}) {
    if (textChanged) {
      _anchor = _extent = null; // an edit inside one line (a selection over several is handled in _onSpanEdit)
      return;
    }
    final sel = c.blockSelection;
    final synced = _synced;
    // the field reporting back what this editor gave it
    if (hasSpan && synced != null && identical(synced.$1, c.block) && sel.start == synced.$2 && sel.end == synced.$3) return;
    // a selection over several lines: another line inside it repeating an old selection of its own
    // (a field losing focus) doesn't replace it
    if (!sel.isCollapsed && spanMultiLine && !identical(synced?.$1, c.block) && spanParts.any((p) => identical(p.line, c.block))) return;
    if (!sel.isCollapsed) {
      _anchor = DocPoint(c.block, sel.baseOffset);
      _extent = DocPoint(c.block, sel.extentOffset);
      _synced = (c.block, sel.start, sel.end);
      return;
    }
    // a cursor in the focused line (a tap) ends the selection; a field losing focus doesn't
    if (_anchor != null && (_focus[c.block]?.hasFocus ?? false)) _anchor = _extent = null;
  }

  /// Typing, Backspace or Enter with a selection over several lines.
  bool _onSpanEdit(BlockController c, String inserted) {
    if (!spanMultiLine) return false;
    replaceSpan(inserted);
    return true;
  }

  /// Replace the selection with [text] (nothing: delete it). Enter splits the line there.
  void replaceSpan(String text) {
    final r = spanRange;
    if (r == null) return;
    _beforeChange();
    final (line, at) = _deleteRange(r.$1, r.$2);
    _anchor = _extent = null;
    if (text == '\n') {
      _onSplit(controllerFor(line), at);
      return;
    }
    if (text.isNotEmpty) {
      if (text.contains('\n')) {
        insertText(text);
        return;
      }
      controllerFor(line).replaceRange(at, at, text);
    }
    _afterChange();
  }

  /// Remove the text from [s] to [e]: lines and pages wholly inside go, the start and end lines
  /// join (like Google Docs). Dialogue and cast entries keep their shape and only lose text.
  /// Returns where the cursor goes.
  (TextBlock, int) _deleteRange(DocPoint s, DocPoint e) {
    final all = lines;
    final i = _index(s.line, all), j = _index(e.line, all);
    for (var k = i; k <= j; k++) {
      final l = all[k];
      final from = k == i ? s.at.clamp(0, l.text.length) : 0;
      final to = k == j ? e.at.clamp(0, l.text.length) : l.text.length;
      l.removeRange(from, to);
    }
    final ti = topIndexOf(s.line), tj = topIndexOf(e.line);
    if (tj > ti + 1) {
      for (final b in document.blocks.sublist(ti + 1, tj)) {
        if (b is TextBlock) _dropLine(b);
        if (b is GroupBlock) b.textChildren.forEach(_dropLine);
      }
      document.blocks.removeRange(ti + 1, tj);
    }
    if (tj > ti) {
      final first = document.blocks[ti], last = document.blocks[ti + 1];
      if (first is TextBlock && last is TextBlock) {
        first.append(last);
        document.blocks.removeAt(ti + 1);
        _dropLine(last);
      } else if (last is TextBlock && last.isEmpty) {
        document.blocks.removeAt(ti + 1);
        _dropLine(last);
      }
    }
    if (document.blocks.isEmpty) document.blocks.add(TextBlock('paragraph', {}));
    // fields of the lines that changed show their new text
    for (var k = i; k <= j; k++) {
      _controllers[all[k]]?.reload(cursor: 0);
    }
    final at = s.at.clamp(0, s.line.text.length);
    _syncing = true;
    try {
      focused = s.line;
      controllerFor(s.line).reload(cursor: at);
    } finally {
      _syncing = false;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => focusFor(s.line).requestFocus());
    return (s.line, at);
  }

  /// Delete the selection (the bar's Delete, Cut).
  void deleteSpan() => replaceSpan('');

  bool _spanHas(String type) {
    for (final p in spanParts) {
      for (var k = p.from; k < p.to; k++) {
        if (p.line.text[k] == atomChar && p.line.atoms.containsKey(k)) continue;
        if (!p.line.marks[k].has(type)) return false;
      }
    }
    return true;
  }

  void _markSpan(String type) {
    final on = !_spanHas(type);
    _beforeChange();
    for (final p in spanParts) {
      for (var k = p.from; k < p.to; k++) {
        if (p.line.text[k] == atomChar && p.line.atoms.containsKey(k)) continue;
        p.line.marks[k] = on ? p.line.marks[k].add({'type': type}) : p.line.marks[k].remove(type);
      }
      _controllers[p.line]?.refresh();
    }
    _afterChange();
  }

  // ── undo ──

  final _history = <String>[];
  int _at = 0;
  Timer? _historyTimer;

  String _snap() => jsonEncode(document.toJson());

  void _scheduleHistory() {
    _historyTimer?.cancel();
    _historyTimer = Timer(const Duration(milliseconds: 450), _pushHistory);
  }

  void _pushHistory() {
    final s = _snap();
    if (_history.isNotEmpty && _history[_at] == s) return;
    _history.removeRange(_at + 1, _history.length);
    _history.add(s);
    if (_history.length > 200) _history.removeAt(0);
    _at = _history.length - 1;
    notifyListeners();
  }

  bool get canUndo => _at > 0 || (_historyTimer?.isActive ?? false);
  bool get canRedo => _at < _history.length - 1;

  void undo() {
    if (_historyTimer?.isActive ?? false) {
      _historyTimer!.cancel();
      _pushHistory();
    }
    if (_at == 0) return;
    _at--;
    _restore(_history[_at]);
  }

  void redo() {
    if (!canRedo) return;
    _at++;
    _restore(_history[_at]);
  }

  void _restore(String snap) {
    _anchor = _extent = null;
    _lineKeys.clear();
    final focusIndex = focused == null ? 0 : lines.indexWhere((x) => identical(x, focused));
    for (final c in _controllers.values) {
      c.dispose();
    }
    _controllers.clear();
    final old = Map.of(_focus);
    _focus.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final f in old.values) {
        f.dispose();
      }
    });
    document = EditorDocument.fromJson((jsonDecode(snap) as Map).cast<String, dynamic>());
    words = countWords(document.plainText);
    final all = lines;
    if (all.isNotEmpty) {
      focusLine(all[focusIndex.clamp(0, all.length - 1)]);
    }
    saver.touch();
    notifyListeners();
  }

  // ── saving ──

  Future<bool> _save(Json snap) async {
    final patch = <String, dynamic>{'content': snap, 'word_count': words, 'title': _doc.title};
    if (_doc.pristine && !pristine) {
      _doc = _doc.copyWith(settings: {..._doc.settings}..remove('pristine'));
      patch['settings'] = _doc.settings;
    }
    final queued = await store.updateDoc(_doc.id, patch);
    _doc = _doc.copyWith(content: snap, wordCount: words);
    final delta = words - _lastSavedWords;
    _lastSavedWords = words;
    final minutes = _activeMinutes.length;
    _activeMinutes = {};
    if (delta > 0 || minutes > 0) unawaited(store.logWriting(words: delta > 0 ? delta : 0, minutes: minutes, docId: _doc.id).catchError((_) {}));
    if (DateTime.now().difference(_lastSnapshot) > const Duration(minutes: 10)) {
      _lastSnapshot = DateTime.now();
      unawaited(store.saveVersion(_doc.id, snap, words, null).catchError((_) {}));
    }
    return queued;
  }

  /// Leaving the editor: save what's left, and discard a new work nobody typed in.
  Future<bool> close() async {
    _historyTimer?.cancel();
    if (pristine && _doc.pristine) {
      saver.dispose();
      await saver.clearJournal();
      await store.deleteDoc(_doc.id).catchError((_) {});
      return true;
    }
    await saver.flush();
    return false;
  }

  @override
  void dispose() {
    _historyTimer?.cancel();
    _spellTimer?.cancel();
    _spellRun++;
    spellCheck = null;
    saver.dispose();
    for (final c in _controllers.values) {
      c.dispose();
    }
    for (final f in _focus.values) {
      f.dispose();
    }
    super.dispose();
  }
}

/// A place in the work: a line and a position in its text.
class DocPoint {
  const DocPoint(this.line, this.at);
  final TextBlock line;
  final int at;
}
