import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../core/manglish.dart';
import '../data/models.dart';
import '../data/store.dart';
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
  late final DocSaver saver;

  /// New works stay pristine until the writer types; pristine works are discarded on close.
  bool pristine = false;
  int words = 0;
  int _lastSavedWords = 0;
  DateTime _lastSnapshot = DateTime.now();

  final _controllers = <TextBlock, BlockController>{};
  final _focus = <TextBlock, FocusNode>{};

  /// The line being edited.
  TextBlock? focused;

  /// Styles text marks; set by the editor screen from the theme.
  MarkStyler styler = (m, b) => b;

  // ── lines ──

  /// Every editable line, top to bottom (inside dialogues and cast entries too).
  List<TextBlock> get lines => [
        for (final b in document.blocks)
          if (b is TextBlock) b else if (b is GroupBlock) ...b.textChildren,
      ];

  BlockController controllerFor(TextBlock b) => _controllers.putIfAbsent(
        b,
        () => BlockController(block: b, styler: styler, mode: mode, onSplit: _onSplit, onMergeBack: _onMergeBack, onChanged: _onChanged),
      );

  FocusNode focusFor(TextBlock b) => _focus.putIfAbsent(b, () {
        final f = FocusNode(debugLabel: b.type);
        f.addListener(() {
          if (f.hasFocus && focused != b) {
            focused = b;
            notifyListeners();
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
    _controllers.remove(b)?.dispose();
    final f = _focus.remove(b);
    WidgetsBinding.instance.addPostFrameCallback((_) => f?.dispose());
  }

  // ── typing ──

  void _onChanged(BlockController c, {required bool textChanged}) {
    if (!textChanged) {
      notifyListeners(); // selection moved: toolbar state, suggestions
      return;
    }
    _afterChange();
  }

  void _beforeChange() {}

  void _afterChange() {
    if (pristine) pristine = false;
    words = countWords(document.plainText);
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

  bool markActive(String type) => current?.markActive(type) ?? false;

  void toggleMark(String type) {
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

  // ── tools (AI, inbox, dictionary, history) ──

  /// The selected text in the current line.
  String get selectedText {
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
    if (delta > 0) unawaited(store.addWordsToday(delta).catchError((_) {}));
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
