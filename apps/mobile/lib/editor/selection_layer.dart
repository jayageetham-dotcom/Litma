import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderEditable;
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/i18n.dart';
import '../core/theme.dart';
import 'document.dart';
import 'session.dart';

/// The drawn text of a line's field, if the line is built.
RenderEditable? editableOf(EditorSession s, TextBlock line) {
  final r = s.keyOf(line)?.currentContext?.findRenderObject();
  return r == null ? null : _findEditable(r);
}

RenderEditable? _findEditable(RenderObject r) {
  if (r is RenderEditable) return r;
  RenderEditable? out;
  r.visitChildren((c) => out ??= _findEditable(c));
  return out;
}

EditableTextState? _editableState(EditorSession s, TextBlock line) {
  final ctx = s.keyOf(line)?.currentContext;
  if (ctx is! Element) return null;
  EditableTextState? out;
  void visit(Element e) {
    if (out != null) return;
    if (e is StatefulElement && e.state is EditableTextState) {
      out = e.state as EditableTextState;
      return;
    }
    e.visitChildElements(visit);
  }

  ctx.visitChildElements(visit);
  return out;
}

bool _laidOut(RenderEditable? r) => r != null && r.attached && r.hasSize;

/// The place in the work under [global] (the nearest built line, the nearest character in it).
DocPoint? pointAt(EditorSession s, Offset global) {
  TextBlock? best;
  RenderEditable? bestR;
  var gap = double.infinity;
  for (final l in s.lines) {
    final r = editableOf(s, l);
    if (r == null || !_laidOut(r)) continue;
    final top = r.localToGlobal(Offset.zero).dy, bottom = top + r.size.height;
    final d = global.dy < top ? top - global.dy : (global.dy > bottom ? global.dy - bottom : 0.0);
    if (d < gap) {
      gap = d;
      best = l;
      bestR = r;
      if (d == 0) break;
    }
  }
  if (best == null || bestR == null) return null;
  final top = bestR.localToGlobal(Offset.zero).dy;
  final y = global.dy.clamp(top + 1, top + bestR.size.height - 1).toDouble();
  final pos = bestR.getPositionForPoint(Offset(global.dx, y));
  return DocPoint(best, (pos.offset - 1).clamp(0, best.text.length));
}

/// Where the selection is drawn, in the layer's coordinates.
class _Geometry {
  const _Geometry(this.rects, this.start, this.end, {this.lineAbove});
  final List<Rect> rects;
  final Rect? start;
  final Rect? end;

  /// The line before the selection's first line, so the bar can keep it clear.
  final Rect? lineAbove;

  bool same(_Geometry? o) {
    if (o == null || o.start != start || o.end != end || o.lineAbove != lineAbove || o.rects.length != rects.length) return false;
    for (var i = 0; i < rects.length; i++) {
      if (o.rects[i] != rects[i]) return false;
    }
    return true;
  }
}

_Geometry? _geometry(EditorSession s, RenderBox layer) {
  final parts = s.spanParts;
  if (parts.isEmpty || !layer.attached || !layer.hasSize) return null;
  final rects = <Rect>[];
  Rect? start, end;
  for (final (i, p) in parts.indexed) {
    final r = editableOf(s, p.line);
    if (r == null || !_laidOut(r)) continue;
    Rect toLayer(Rect local) => layer.globalToLocal(r.localToGlobal(local.topLeft)) & local.size;
    if (p.to > p.from) {
      for (final b in r.getBoxesForSelection(TextSelection(baseOffset: p.from + 1, extentOffset: p.to + 1))) {
        rects.add(toLayer(b.toRect()));
      }
    }
    // the line break after a line selected to its end (so an empty line shows it is selected too)
    if (i < parts.length - 1) {
      final c = r.getLocalRectForCaret(TextPosition(offset: p.line.text.length + 1));
      rects.add(toLayer(Rect.fromLTWH(c.left, c.top, r.preferredLineHeight * 0.35, c.height)));
    }
    if (i == 0) start = toLayer(r.getLocalRectForCaret(TextPosition(offset: p.from + 1)));
    if (i == parts.length - 1) end = toLayer(r.getLocalRectForCaret(TextPosition(offset: p.to + 1)));
  }
  Rect? lineAbove;
  final i = s.lines.indexOf(parts.first.line);
  if (i > 0) {
    final box = s.keyOf(s.lines[i - 1])?.currentContext?.findRenderObject();
    if (box is RenderBox && box.attached && box.hasSize) lineAbove = layer.globalToLocal(box.localToGlobal(Offset.zero)) & box.size;
  }
  return _Geometry(rects, start, end, lineAbove: lineAbove);
}

/// A selection that can run over many lines and pages, drawn over the page: the highlight, two
/// handles to drag (across lines, like Google Docs) and a bar with Cut, Copy, Paste, Delete,
/// Bold, Italic and Select all (Deselect all once everything is selected). The text itself lives in the session ([EditorSession.spanRange]).
class SelectionLayer extends StatefulWidget {
  const SelectionLayer({super.key, required this.session, required this.scroll});
  final EditorSession session;
  final ScrollController scroll;

  @override
  State<SelectionLayer> createState() => _SelectionLayerState();
}

class _SelectionLayerState extends State<SelectionLayer> {
  late final Listenable _changes = Listenable.merge([widget.session, widget.scroll]);
  _Geometry? _shown;
  bool _dragging = false;
  DocPoint? _fixed;
  Object? _hiddenFor;

  EditorSession get s => widget.session;

  RenderBox? get _box {
    final r = context.findRenderObject();
    return r is RenderBox ? r : null;
  }

  void _settle() {
    if (!mounted) return;
    final box = _box;
    final g = s.hasSpan && box != null ? _geometry(s, box) : null;
    if (!(g?.same(_shown) ?? _shown == null)) setState(() => _shown = g);
    // the field's own handles and menu stay hidden: these handles and this bar take their place
    final r = s.spanRange;
    if (r != null) {
      final key = (r.$1.line, r.$1.at, r.$2.line, r.$2.at);
      if (key != _hiddenFor) {
        _hiddenFor = key;
        for (final l in {r.$1.line, r.$2.line}) {
          _editableState(s, l)?.hideToolbar();
        }
      }
    } else {
      _hiddenFor = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: AnimatedBuilder(
        animation: _changes,
        builder: (context, _) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _settle());
          final box = _box;
          final g = s.hasSpan && box != null ? (_geometry(s, box) ?? _shown) : null;
          if (g == null) return const SizedBox.shrink();
          final c = context.c;
          final size = box!.size;
          return Stack(clipBehavior: Clip.none, children: [
            Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _HighlightPainter(g.rects, c.accent.withValues(alpha: 0.24))))),
            if (g.start != null) _handle(g.start!, start: true, color: c.accent),
            if (g.end != null) _handle(g.end!, start: false, color: c.accent),
            // no bar while the selection is scrolled out of sight (it would float over other text)
            if (!_dragging && (g.start != null || g.end != null) && g.rects.any((r) => r.bottom > 0 && r.top < size.height)) _bar(g, size),
          ]);
        },
      ),
    );
  }

  // ── handles ──

  static const _knob = 11.0;

  Widget _handle(Rect caret, {required bool start, required Color color}) {
    const touch = 44.0;
    final height = caret.height + _knob * 2 + 10;
    // Only the knob under the line takes touches; the caret line over the text lets taps through,
    // so the text beside a selection's ends stays tappable (audit, 26 Nov).
    return Positioned(
      left: caret.center.dx - touch / 2,
      top: caret.top,
      width: touch,
      height: height,
      child: Stack(fit: StackFit.expand, children: [
        IgnorePointer(child: CustomPaint(painter: _HandlePainter(color: color, caretHeight: caret.height))),
        Positioned(
          left: 0,
          right: 0,
          top: caret.height,
          bottom: 0,
          child: Semantics(
        label: context.t(start ? 'app.selection.start' : 'app.selection.end'),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onPanStart: (_) {
            final r = s.spanRange;
            if (r == null) return;
            _fixed = start ? r.$2 : r.$1;
            s.beginHandleDrag();
            setState(() => _dragging = true);
            HapticFeedback.selectionClick();
          },
          onPanUpdate: (d) => _drag(d.globalPosition, caret.height),
          onPanEnd: (_) => _endDrag(),
          onPanCancel: _endDrag,
        ),
          ),
        ),
      ]),
    );
  }

  void _drag(Offset finger, double lineHeight) {
    final fixed = _fixed;
    final box = _box;
    if (fixed == null || box == null) return;
    // aim at the text just above the finger (the knob sits under the line)
    final target = finger - Offset(0, lineHeight / 2 + _knob + 6);
    // near the top or bottom edge: scroll on, so a selection can run past the screen
    final local = box.globalToLocal(finger);
    final sc = widget.scroll;
    if (sc.hasClients) {
      final edge = local.dy < 56 ? -16.0 : (local.dy > box.size.height - 56 ? 16.0 : 0.0);
      if (edge != 0) sc.jumpTo((sc.offset + edge).clamp(sc.position.minScrollExtent, sc.position.maxScrollExtent));
    }
    final p = pointAt(s, target);
    if (p == null || (identical(p.line, fixed.line) && p.at == fixed.at)) return;
    s.setSpan(fixed, p, sync: false);
  }

  void _endDrag() {
    _fixed = null;
    s.syncSpan();
    if (mounted) setState(() => _dragging = false);
  }

  // ── the bar ──

  Widget _bar(_Geometry g, Size layer) {
    final c = context.c;
    const height = 44.0;
    final anchor = g.start ?? g.end!;
    final below = g.end ?? anchor;
    // above the selection with the whole line before it kept clear (the owner's screenshot, 26 Nov:
    // the bar hid that line), or under the end knob when there is no room
    final clear = g.lineAbove == null ? anchor.top - anchor.height * 0.4 : g.lineAbove!.top.clamp(anchor.top - anchor.height * 2.2, anchor.top).toDouble();
    final above = clear - height - 6;
    final top = above >= 8 ? above : (below.bottom + _knob * 2 + 16).clamp(8.0, (layer.height - height - 8).clamp(8.0, double.infinity));
    final maxWidth = (layer.width - 16).clamp(120.0, 560.0);
    final left = (anchor.left - 24).clamp(8.0, (layer.width - maxWidth - 8).clamp(8.0, double.infinity));
    Widget button(String label, VoidCallback onTap, {IconData? icon}) => Semantics(
          button: true,
          label: label,
          child: InkWell(
            borderRadius: BorderRadius.circular(6),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: icon != null
                  ? Icon(icon, size: 18, color: c.ink)
                  : Text(label, style: TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: 14, fontWeight: FontWeight.w500, color: c.ink)),
            ),
          ),
        );
    return Positioned(
      left: left.toDouble(),
      top: top.toDouble(),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth.toDouble()),
        child: Material(
          color: c.dialog,
          elevation: 6,
          shadowColor: const Color(0x33111113),
          borderRadius: BorderRadius.circular(10),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              button(context.t('app.selection.cut'), _cut),
              button(context.t('app.selection.copy'), _copy),
              button(context.t('app.selection.paste'), _paste),
              button(context.t('common.delete'), s.deleteSpan),
              button(context.t('app.editor.bold'), () => s.toggleMark('bold'), icon: LucideIcons.bold),
              button(context.t('app.editor.italic'), () => s.toggleMark('italic'), icon: LucideIcons.italic),
              // the whole work selected: the same place offers the way back
              if (s.allSelected)
                button(context.t('app.selection.deselectAll'), s.deselectAll)
              else
                button(context.t('app.selection.selectAll'), s.selectAll),
            ]),
          ),
        ),
      ),
    );
  }

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: s.spanText));
    HapticFeedback.selectionClick();
  }

  Future<void> _cut() async {
    await Clipboard.setData(ClipboardData(text: s.spanText));
    s.deleteSpan();
  }

  Future<void> _paste() async {
    final d = await Clipboard.getData(Clipboard.kTextPlain);
    final text = d?.text;
    if (text == null || text.isEmpty) return;
    s.replaceSpan(text);
  }
}

class _HighlightPainter extends CustomPainter {
  _HighlightPainter(this.rects, this.color);
  final List<Rect> rects;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = color;
    for (final r in rects) {
      canvas.drawRect(r, p);
    }
  }

  @override
  bool shouldRepaint(_HighlightPainter old) => old.color != color || old.rects != rects;
}

/// A handle: a thin bar along the caret and a round knob under the line to drag.
class _HandlePainter extends CustomPainter {
  _HandlePainter({required this.color, required this.caretHeight});
  final Color color;
  final double caretHeight;

  @override
  void paint(Canvas canvas, Size size) {
    final x = size.width / 2;
    final p = Paint()..color = color;
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x - 1, 0, 2, caretHeight + 2), const Radius.circular(1)), p);
    canvas.drawCircle(Offset(x, caretHeight + _SelectionLayerState._knob), _SelectionLayerState._knob - 2, p);
  }

  @override
  bool shouldRepaint(_HandlePainter old) => old.color != color || old.caretHeight != caretHeight;
}
