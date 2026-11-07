import 'package:flutter/material.dart';

import '../core/akshara.dart';
import '../core/manglish.dart';
import '../data/forms.dart' show Json;
import 'document.dart';

/// How typed text is treated (settings.inputMode on the web).
enum InputMode { manglish, malayalam, english }

InputMode inputModeFrom(Object? s) => InputMode.values.firstWhere((m) => m.name == s, orElse: () => InputMode.manglish);

/// The invisible first character of every field. Phone keyboards send no key event for
/// Backspace in an empty field; deleting this character is how the editor sees it.
const sentinel = '​';

/// Styles a run of text from its marks (the page's own style is the base).
typedef MarkStyler = TextStyle Function(MarkSet marks, TextStyle base);

/// Text controller for one block. Keeps [TextBlock.marks] in step with every edit, draws marks
/// as styled spans, converts Manglish at word boundaries, and reports Enter (split) and
/// Backspace at the start (merge) to the editor instead of putting them in the text.
class BlockController extends TextEditingController {
  BlockController({
    required this.block,
    required this.styler,
    required this.onSplit,
    required this.onMergeBack,
    required this.onChanged,
    this.mode = InputMode.manglish,
    this.spelling,
  }) : super.fromValue(TextEditingValue(text: '$sentinel${block.text}', selection: TextSelection.collapsed(offset: block.text.length + 1)));

  final TextBlock block;
  MarkStyler styler;
  InputMode mode;

  /// The spelling the suggestion strip shows first for [word] (Google's best when it has
  /// answered), so a space takes what the writer sees. Null: the offline engine decides.
  final String? Function(String word)? spelling;

  /// Enter at [at] (position in the block's text). The editor splits the block.
  final void Function(BlockController c, int at) onSplit;

  /// Backspace at the very start. The editor merges into the previous block.
  final void Function(BlockController c) onMergeBack;

  /// Any change to text, marks or selection the editor should save or redraw for.
  final void Function(BlockController c, {required bool textChanged}) onChanged;

  /// Marks for the next typed characters (bold switched on with nothing selected, etc.).
  MarkSet? typingMarks;

  /// Latin word typed just now that the writer chose to keep in English (no conversion).
  String? keepEnglish;

  /// A Manglish word was typed and is still Latin. It is converted when the writer moves away
  /// from it or leaves the line, not only when they type a space: in the middle of a line the
  /// space after the word is already there.
  bool _typedLatin = false;

  /// Base style of this block (from the page and the block type).
  TextStyle baseStyle = const TextStyle();

  /// First-line indent (novel and story paragraphs): drawn as letter spacing on the invisible
  /// first character, so the text itself never contains spaces it didn't have.
  double indent = 0;

  /// The first letter after a chapter heading, set large in the accent colour (null: off).
  TextStyle? dropCapStyle;

  /// Block text selection (without the sentinel).
  TextSelection get blockSelection {
    final s = selection;
    if (!s.isValid) return TextSelection.collapsed(offset: block.text.length);
    return TextSelection(baseOffset: (s.baseOffset - 1).clamp(0, block.text.length), extentOffset: (s.extentOffset - 1).clamp(0, block.text.length));
  }

  /// Put the cursor at [at] in the block's text.
  void placeCursor(int at) {
    super.value = value.copyWith(selection: TextSelection.collapsed(offset: at.clamp(0, block.text.length) + 1), composing: TextRange.empty);
  }

  /// Reload from [block] after the editor changed it (split, merge, formatting, undo).
  void reload({int? cursor}) {
    _typedLatin = false;
    final at = (cursor ?? blockSelection.extentOffset).clamp(0, block.text.length);
    super.value = TextEditingValue(text: '$sentinel${block.text}', selection: TextSelection.collapsed(offset: at + 1));
  }

  @override
  set value(TextEditingValue v) {
    final old = super.value;
    var text = v.text;
    // Backspace at the start: the sentinel is gone
    if (!text.startsWith(sentinel)) {
      if (old.text.length > text.length && text == old.text.substring(1)) {
        super.value = old.copyWith(selection: const TextSelection.collapsed(offset: 1));
        onMergeBack(this);
        return;
      }
      text = '$sentinel$text';
      v = v.copyWith(text: text, selection: _shift(v.selection, 1), composing: _shiftRange(v.composing, 1));
    }
    // never let the cursor sit before the sentinel
    var sel = v.selection;
    if (sel.isValid && (sel.baseOffset < 1 || sel.extentOffset < 1)) {
      sel = TextSelection(baseOffset: sel.baseOffset.clamp(1, text.length), extentOffset: sel.extentOffset.clamp(1, text.length));
      v = v.copyWith(selection: sel);
    }

    final oldBody = old.text.substring(1);
    final newBody = text.substring(1);
    if (oldBody == newBody) {
      // the cursor moved elsewhere: bold/italic switched on for typing no longer applies
      if (old.selection != v.selection) typingMarks = null;
      // the cursor left a Manglish word that was just typed: finish it like a space would
      if (_typedLatin && old.selection.isValid && old.selection.isCollapsed && v.selection.isValid) {
        final converted = _finishWord(old.selection.extentOffset - 1, v.selection);
        if (converted != null) {
          super.value = v.copyWith(text: '$sentinel${block.text}', selection: converted, composing: TextRange.empty);
          onChanged(this, textChanged: true);
          return;
        }
      }
      super.value = v;
      onChanged(this, textChanged: false);
      return;
    }

    // what changed: common prefix and suffix
    var p = 0;
    final maxP = oldBody.length < newBody.length ? oldBody.length : newBody.length;
    while (p < maxP && oldBody.codeUnitAt(p) == newBody.codeUnitAt(p)) {
      p++;
    }
    var s = 0;
    while (s < maxP - p && oldBody.codeUnitAt(oldBody.length - 1 - s) == newBody.codeUnitAt(newBody.length - 1 - s)) {
      s++;
    }
    final removedEnd = oldBody.length - s;
    final inserted = newBody.substring(p, newBody.length - s);

    // Enter: split the block instead of adding a line break
    final nl = inserted.indexOf('\n');
    if (nl >= 0) {
      _apply(p, removedEnd, inserted.substring(0, nl));
      super.value = TextEditingValue(text: '$sentinel${block.text}', selection: TextSelection.collapsed(offset: p + nl + 1));
      onSplit(this, p + nl);
      return;
    }

    _apply(p, removedEnd, inserted);
    var cursor = sel.isValid ? sel.extentOffset - 1 : p + inserted.length;

    // Manglish: a finished word turns into Malayalam (not while the keyboard is still composing it)
    final composing = v.composing.isValid && !v.composing.isCollapsed;
    if (mode == InputMode.manglish && !composing && inserted.length == 1 && _isBoundary(inserted)) {
      final end = p; // the word ends just before the boundary character
      final m = manglishTailRe.firstMatch(block.text.substring(0, end));
      if (m != null) {
        final word = m[0]!;
        if (keepEnglish == word) {
          keepEnglish = null;
        } else {
          final ml = spelling?.call(word) ?? manglishWord(word);
          final start = end - word.length;
          final marksOfWord = block.marks[start];
          _replace(start, end, ml, marksOfWord);
          cursor += ml.length - word.length;
        }
      }
    }

    final at = cursor.clamp(0, block.text.length);
    _typedLatin = mode == InputMode.manglish && inserted.isNotEmpty && manglishTailRe.hasMatch(block.text.substring(0, at));
    super.value = TextEditingValue(
      text: '$sentinel${block.text}',
      selection: TextSelection.collapsed(offset: at + 1),
      composing: composing ? v.composing : TextRange.empty,
    );
    onChanged(this, textChanged: true);
  }

  /// Convert the just-typed Latin word ending at [end] (block position) unless [next] (a
  /// controller selection, sentinel included) is still inside it. Returns [next] moved to match
  /// the new text, or null when nothing was converted.
  TextSelection? _finishWord(int end, TextSelection next) {
    _typedLatin = false;
    if (mode != InputMode.manglish || end < 0 || end > block.text.length) return null;
    // the word must end here (the cursor was at its end, not inside it)
    if (end < block.text.length && RegExp(r'[A-Za-z~_^]').hasMatch(block.text[end])) return null;
    final m = manglishTailRe.firstMatch(block.text.substring(0, end));
    if (m == null) return null;
    final word = m[0]!;
    final start = end - word.length;
    final nb = next.baseOffset - 1, ne = next.extentOffset - 1;
    // still on the word: keep waiting
    if (next.isCollapsed && ne >= start && ne <= end) return null;
    if (keepEnglish == word) {
      keepEnglish = null;
      return null;
    }
    final ml = spelling?.call(word) ?? manglishWord(word);
    _replace(start, end, ml, block.marks.isEmpty ? MarkSet.empty : block.marks[start]);
    final d = ml.length - word.length;
    int moved(int x) => (x >= end ? x + d : x).clamp(0, block.text.length) + 1;
    return TextSelection(baseOffset: moved(nb), extentOffset: moved(ne));
  }

  /// The writer left this line (another line focused, keyboard hidden): finish a Manglish word
  /// that was still being typed.
  void finishPendingWord() {
    if (!_typedLatin || !selection.isValid || !selection.isCollapsed) {
      _typedLatin = false;
      return;
    }
    final end = blockSelection.extentOffset;
    final before = block.text.length;
    // a target outside the line, so the word always counts as left
    if (_finishWord(end, const TextSelection.collapsed(offset: -1)) == null) return;
    final after = end + block.text.length - before;
    super.value = TextEditingValue(text: '$sentinel${block.text}', selection: TextSelection.collapsed(offset: after + 1));
    onChanged(this, textChanged: true);
  }


  static bool _isBoundary(String ch) => RegExp(r'[\s.,;:!?"“”‘’()\[\]{}\-–—/]').hasMatch(ch);

  TextSelection _shift(TextSelection s, int by) => s.isValid ? TextSelection(baseOffset: s.baseOffset + by, extentOffset: s.extentOffset + by) : s;
  TextRange _shiftRange(TextRange r, int by) => r.isValid ? TextRange(start: r.start + by, end: r.end + by) : r;

  /// Replace block text [from, to) with [ins]; new characters take the typing marks, else the
  /// marks of the character before (or after, at the very start).
  void _apply(int from, int to, String ins) {
    final MarkSet m;
    if (typingMarks != null) {
      m = typingMarks!;
    } else if (from > 0) {
      m = _inheritable(block.marks[from - 1]);
    } else if (block.marks.isNotEmpty && to < block.marks.length) {
      m = _inheritable(block.marks[to]);
    } else {
      m = MarkSet.empty;
    }
    _replace(from, to, ins, m);
  }

  /// Links don't spread to text typed after them.
  MarkSet _inheritable(MarkSet m) => m.has('link') ? m.remove('link') : m;

  void _replace(int from, int to, String ins, MarkSet m) {
    final t = block.text;
    block.text = t.substring(0, from) + ins + t.substring(to);
    block.marks.replaceRange(from, to, List.filled(ins.length, m));
    // inline pieces after the change move with the text; removed ones are gone
    final delta = ins.length - (to - from);
    final moved = <int, Json>{};
    block.atoms.forEach((k, v) {
      if (k < from) moved[k] = v;
      if (k >= to) moved[k + delta] = v;
    });
    block.atoms = moved;
  }

  /// Replace the Latin word ending at the cursor with [replacement] (a suggestion was picked).
  void replaceWordAtCursor(String word, String replacement, {bool addSpace = true}) {
    final at = blockSelection.extentOffset;
    final start = at - word.length;
    if (start < 0 || block.text.substring(start, at) != word) return;
    final m = block.marks.isEmpty ? MarkSet.empty : block.marks[start];
    _typedLatin = false;
    // in the middle of a line the space is already there: step over it instead of adding one
    final spaceAfter = at < block.text.length && RegExp(r'\s').hasMatch(block.text[at]);
    final add = addSpace && !spaceAfter;
    _replace(start, at, replacement + (add ? ' ' : ''), m);
    super.value = TextEditingValue(text: '$sentinel${block.text}', selection: TextSelection.collapsed(offset: start + replacement.length + (addSpace ? 1 : 0) + 1));
    onChanged(this, textChanged: true);
  }

  /// Replace [start, end) of the block's text with [text] (AI results, inbox suggestions, a looked-up
  /// word), with the cursor after it. No Manglish conversion.
  void replaceRange(int start, int end, String text) {
    _typedLatin = false;
    final s = start.clamp(0, block.text.length), e = end.clamp(s, block.text.length);
    final m = block.marks.isEmpty ? MarkSet.empty : _inheritable(block.marks[(s > 0 ? s - 1 : 0).clamp(0, block.marks.length - 1)]);
    _replace(s, e, text, m);
    super.value = TextEditingValue(text: '$sentinel${block.text}', selection: TextSelection.collapsed(offset: s + text.length + 1));
    onChanged(this, textChanged: true);
  }

  /// The Latin word being typed at the cursor (for the suggestion strip), or null.
  String? get wordAtCursor {
    if (mode != InputMode.manglish) return null;
    final s = blockSelection;
    if (!s.isCollapsed) return null;
    final m = manglishTailRe.firstMatch(block.text.substring(0, s.extentOffset));
    return m?[0];
  }

  // ── formatting ──

  /// Is [type] on for the selection (or for what will be typed next)?
  bool markActive(String type) {
    final s = blockSelection;
    if (s.isCollapsed) {
      if (typingMarks != null) return typingMarks!.has(type);
      final i = s.start - 1;
      return i >= 0 && i < block.marks.length && block.marks[i].has(type);
    }
    for (var i = s.start; i < s.end; i++) {
      if (!block.marks[i].has(type)) return false;
    }
    return true;
  }

  /// Switch a mark on or off for the selection, or for the next typed text when nothing is selected.
  void toggleMark(String type, {Json? mark}) {
    final s = blockSelection;
    final on = !markActive(type);
    final m = mark ?? {'type': type};
    if (s.isCollapsed) {
      final base = typingMarks ?? (s.start > 0 ? block.marks[s.start - 1] : MarkSet.empty);
      typingMarks = on ? base.add(m) : base.remove(type);
    } else {
      for (var i = s.start; i < s.end; i++) {
        block.marks[i] = on ? block.marks[i].add(m) : block.marks[i].remove(type);
      }
      notifyListeners();
    }
    onChanged(this, textChanged: !s.isCollapsed);
  }

  /// Clear typing marks when the cursor moves somewhere else.
  void clearTypingMarks() => typingMarks = null;

  // ── drawing ──

  @override
  TextSpan buildTextSpan({required BuildContext context, TextStyle? style, required bool withComposing}) {
    final base = (style ?? const TextStyle()).merge(baseStyle);
    final t = block.text;
    final spans = <InlineSpan>[TextSpan(text: sentinel, style: indent > 0 ? base.copyWith(letterSpacing: indent) : base)];
    var i = 0;
    final capLength = dropCapStyle == null ? 0 : firstAksharaLength(t);
    if (capLength > 0 && !t.substring(0, capLength).contains(atomChar)) {
      final first = t.substring(0, capLength); // a whole akshara, so conjuncts stay shaped
      final own = block.marks.first.style('color') != null; // the writer's own colour wins
      final marked = styler(block.marks.first, base);
      spans.add(TextSpan(text: first, style: marked.merge(dropCapStyle!.copyWith(color: own ? marked.color : dropCapStyle!.color))));
      i = first.length;
    }
    while (i < t.length) {
      if (t[i] == atomChar && block.atoms.containsKey(i)) {
        spans.add(atomSpan(block.atoms[i]!, base));
        i++;
        continue;
      }
      final m = block.marks[i];
      var j = i + 1;
      while (j < t.length && block.marks[j] == m && !(t[j] == atomChar && block.atoms.containsKey(j))) {
        j++;
      }
      spans.add(TextSpan(text: t.substring(i, j), style: styler(m, base)));
      i = j;
    }
    // underline what the keyboard is still composing, like a native field
    if (withComposing && value.composing.isValid && !value.composing.isCollapsed) {
      return _withComposing(spans, base);
    }
    return TextSpan(style: base, children: spans);
  }

  /// An inline piece this editor doesn't edit (footnote, image…), drawn as a one-character
  /// superscript marker in its place, so caret positions still match and the piece is kept.
  /// [markerColor] is set by the editor from the theme.
  Color markerColor = const Color(0xFF5B3EF0);

  TextSpan atomSpan(Json atom, TextStyle base) => TextSpan(
        text: atom['type'] == 'footnote' ? '*' : '◆',
        semanticsLabel: atom['type'] == 'footnote' ? 'Footnote' : '${atom['type']}',
        style: base.copyWith(color: markerColor, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.superscripts()]),
      );

  TextSpan _withComposing(List<InlineSpan> spans, TextStyle base) {
    final r = value.composing;
    final out = <InlineSpan>[];
    var pos = 0;
    for (final sp in spans) {
      final text = (sp as TextSpan).text ?? '';
      final start = pos;
      final end = pos + text.length;
      pos = end;
      if (end <= r.start || start >= r.end) {
        out.add(sp);
        continue;
      }
      final a = (r.start - start).clamp(0, text.length);
      final b = (r.end - start).clamp(0, text.length);
      if (a > 0) out.add(TextSpan(text: text.substring(0, a), style: sp.style));
      out.add(TextSpan(text: text.substring(a, b), style: (sp.style ?? base).copyWith(decoration: TextDecoration.underline)));
      if (b < text.length) out.add(TextSpan(text: text.substring(b), style: sp.style));
    }
    return TextSpan(style: base, children: out);
  }
}
