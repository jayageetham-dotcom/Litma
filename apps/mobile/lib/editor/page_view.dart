import 'package:flutter/material.dart';

import '../core/akshara.dart';
import '../core/metre.dart';
import '../core/motion.dart';
import '../core/theme.dart';
import '../data/forms.dart';
import 'block_style.dart';
import 'document.dart';
import 'session.dart';

/// Work out every line's look, top to bottom (numbers count down the page).
Map<TextBlock, BlockLook> computeLooks(EditorDocument doc, PageLook page) {
  final n = Counters();
  final out = <TextBlock, BlockLook>{};
  Block? prev;
  var first = true;
  for (final b in doc.blocks) {
    if (b is TextBlock) {
      out[b] = lookFor(b, page, n, previous: prev, firstOfWork: first);
    } else if (b is GroupBlock) {
      for (final c in b.textChildren) {
        out[c] = lookFor(c, page, n, previous: prev, firstOfWork: first);
      }
    }
    prev = b;
    first = false;
  }
  return out;
}

/// The writing sheet: white paper with the work's own font, full width on phones (like the web's
/// pageless phone view) and a centred sheet on tablets.
class PaperSheet extends StatelessWidget {
  const PaperSheet({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 760;
    final c = context.c;
    if (!wide) return ColoredBox(color: c.paper, child: child);
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 760),
        margin: const EdgeInsets.symmetric(vertical: 24),
        decoration: BoxDecoration(
          color: c.paper,
          borderRadius: BorderRadius.circular(6),
          boxShadow: const [
            BoxShadow(color: Color(0x0F111113), blurRadius: 2, offset: Offset(0, 1)),
            BoxShadow(color: Color(0x12111113), blurRadius: 30, offset: Offset(0, 10)),
          ],
        ),
        child: child,
      ),
    );
  }
}

/// Horizontal padding of the writing on the paper.
EdgeInsets pagePadding(BuildContext context) {
  final w = MediaQuery.sizeOf(context).width;
  return EdgeInsets.symmetric(horizontal: w >= 760 ? 64 : 22);
}

/// One editable line in the editor.
class EditableLine extends StatelessWidget {
  const EditableLine({super.key, required this.session, required this.block, required this.look, required this.prompt});
  final EditorSession session;
  final TextBlock block;
  final BlockLook look;
  final String? prompt;

  @override
  Widget build(BuildContext context) {
    final c = session.controllerFor(block);
    final focus = session.focusFor(block);
    final t = context.c;
    c
      ..indent = look.indent
      ..dropCapStyle = look.dropCap ? look.style.copyWith(fontSize: (look.style.fontSize ?? 16) * 1.6, fontWeight: FontWeight.w700, color: t.accent) : null
      ..markerColor = t.accent;

    final field = TweenAnimationBuilder<TextStyle>(
      tween: TextStyleTween(end: look.style),
      duration: Motion.of(context, Motion.medium),
      curve: Motion.emphasized,
      builder: (context, style, _) {
        c.baseStyle = style;
        return TextField(
          controller: c,
          focusNode: focus,
          style: style,
          textAlign: look.align,
          maxLines: null,
          minLines: 1,
          keyboardType: TextInputType.multiline,
          textInputAction: TextInputAction.newline,
          textCapitalization: TextCapitalization.sentences,
          // a bare line of text on the paper: no box, no fill (the theme's field borders don't apply)
          decoration: const InputDecoration(
            isCollapsed: true,
            filled: false,
            contentPadding: EdgeInsets.zero,
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            disabledBorder: InputBorder.none,
          ),
          cursorColor: t.accent,
          cursorWidth: 2,
          cursorRadius: const Radius.circular(1),
          scrollPadding: const EdgeInsets.fromLTRB(0, 80, 0, 160),
          spellCheckConfiguration: const SpellCheckConfiguration.disabled(),
          autocorrect: false,
          enableSuggestions: false,
        );
      },
    );

    final withPrompt = Stack(
      children: [
        if (prompt != null)
          Positioned.fill(
            child: IgnorePointer(
              child: AnimatedOpacity(
                opacity: block.isEmpty ? 1 : 0,
                duration: Motion.of(context, Motion.fast),
                child: Text(
                  prompt!,
                  textAlign: look.align,
                  maxLines: 1,
                  overflow: TextOverflow.fade,
                  softWrap: false,
                  style: look.style.copyWith(color: t.muted.withValues(alpha: 0.7), fontStyle: FontStyle.normal, fontWeight: FontWeight.w400),
                ),
              ),
            ),
          ),
        Padding(padding: EdgeInsets.only(left: look.prefix == null ? 0 : 0), child: field),
      ],
    );

    // വൃത്തം: akshara count and the laghu (∪) / guru (–) pattern under each verse line
    final verse = session.kind == DocKind.poem || session.kind == DocKind.lyrics;
    final metre = verse && session.settings['showMetre'] == true && (block.type == 'paragraph' || block.variant == 'part') && block.text.trim().isNotEmpty;
    if (metre) {
      final a = aksharas(block.plainText);
      return LineFrame(
        look: look,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          _affixed(withPrompt, look),
          Text('${a.length} · ${a.map((x) => x.long ? '–' : '∪').join()}',
              textAlign: look.align, maxLines: 1, overflow: TextOverflow.fade, softWrap: false, style: TextStyle(fontSize: 11, letterSpacing: 1, color: t.muted)),
        ]),
      );
    }
    return LineFrame(look: look, child: _affixed(withPrompt, look));
  }
}

/// The footnotes of a work in order, numbered (the web's Endnotes, "കുറിപ്പുകൾ").
List<Json> footnotesOf(EditorSession s) => [
      for (final l in s.lines)
        for (final i in (l.atoms.keys.toList()..sort()))
          if (l.atoms[i]!['type'] == 'footnote') l.atoms[i]!,
    ];

class Endnotes extends StatelessWidget {
  const Endnotes({super.key, required this.notes, required this.style});
  final List<Json> notes;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final t = context.c;
    final em = style.fontSize ?? 16;
    return Padding(
      padding: EdgeInsets.only(top: em * 2),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Divider(color: t.line, height: 1),
        SizedBox(height: em * 0.8),
        Text('കുറിപ്പുകൾ', style: style.copyWith(fontWeight: FontWeight.w700)),
        SizedBox(height: em * 0.4),
        for (final (i, n) in notes.indexed)
          Padding(
            padding: EdgeInsets.only(bottom: em * 0.3),
            child: Text('${i + 1}. ${n['attrs']?['text'] ?? ''}', style: style.copyWith(fontSize: em * 0.85)),
          ),
      ]),
    );
  }
}

Widget _affixed(Widget text, BlockLook look) {
  if (look.prefix == null && look.suffix == null) return text;
  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (look.prefix != null) Text(look.prefix!, style: look.style.copyWith(fontStyle: FontStyle.normal)),
      Flexible(child: text),
      if (look.suffix != null) Text(look.suffix!, style: look.style.copyWith(fontStyle: FontStyle.normal)),
    ],
  );
}

/// Margins, the number above, the chapter rule, lines and boxes around a line.
class LineFrame extends StatelessWidget {
  const LineFrame({super.key, required this.look, required this.child});
  final BlockLook look;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = context.c;
    final em = look.style.fontSize ?? 16;
    Widget body = child;
    if (look.boxed) {
      body = Container(
        padding: EdgeInsets.symmetric(horizontal: em, vertical: em * 0.8),
        decoration: BoxDecoration(border: Border.all(color: t.lineStrong), borderRadius: BorderRadius.circular(6)),
        child: body,
      );
    }
    final cross = switch (look.align) {
      TextAlign.center => CrossAxisAlignment.center,
      TextAlign.right || TextAlign.end => CrossAxisAlignment.end,
      _ => CrossAxisAlignment.stretch,
    };
    return Padding(
      padding: look.margin,
      child: Column(
        crossAxisAlignment: look.label != null || look.ruleBelow ? CrossAxisAlignment.stretch : cross,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (look.ruleAbove) Padding(padding: EdgeInsets.only(bottom: em * 0.6), child: Divider(color: t.line, height: 1)),
          if (look.label != null)
            Padding(
              padding: EdgeInsets.only(bottom: em * 0.15),
              child: Text(look.label!, textAlign: look.align == TextAlign.start ? TextAlign.start : TextAlign.center, style: look.labelStyle),
            ),
          body,
          if (look.ruleBelow)
            Center(
              child: Container(margin: EdgeInsets.only(top: em * 0.55), width: em * 3, height: 2, color: t.highlight),
            ),
          if (look.lineBelow) Padding(padding: EdgeInsets.only(top: em * 0.3), child: Divider(color: t.line, height: 1)),
        ],
      ),
    );
  }
}

/// The prompt for an empty line ("ശീർഷകം", "കഥാപാത്രം"…), or null for body text.
String? promptFor(TextBlock b) => b.type == 'styledBlock' ? variantPrompt[b.variant] : nodePrompt[b.type];

/// A dialogue (speaker, speech) or cast entry (name, role) laid out in columns, like the web:
/// a screenplay's speaker sits right-aligned in its own column, a play's speaker hangs on the left.
class GroupRow extends StatelessWidget {
  const GroupRow({super.key, required this.group, required this.kind, required this.lineFor, required this.em});
  final GroupBlock group;
  final DocKind kind;
  final Widget Function(TextBlock) lineFor;
  final double em;

  @override
  Widget build(BuildContext context) {
    final kids = group.children;
    if ((group.type == 'dialogue' || group.type == 'castEntry') && kids.length == 2 && kids.every((k) => k is TextBlock)) {
      final first = kids[0] as TextBlock, second = kids[1] as TextBlock;
      final drama = kind == DocKind.drama;
      final leftFlex = group.type == 'castEntry' ? 28 : (drama ? 0 : 34);
      return Padding(
        padding: EdgeInsets.only(bottom: em * (drama ? 0.7 : 0.9)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (leftFlex == 0) SizedBox(width: em * 5.5, child: lineFor(first)) else Expanded(flex: leftFlex, child: lineFor(first)),
            SizedBox(width: em * 0.9),
            Expanded(flex: 66, child: lineFor(second)),
          ],
        ),
      );
    }
    final list = group.type == 'bulletList' || group.type == 'orderedList';
    final quote = group.type == 'blockquote';
    var i = 0;
    return Container(
      margin: EdgeInsets.symmetric(vertical: em * 0.3),
      padding: quote ? EdgeInsets.only(left: em) : EdgeInsets.zero,
      decoration: quote ? BoxDecoration(border: Border(left: BorderSide(color: context.c.line, width: 3))) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final k in kids)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (list)
                  SizedBox(
                    width: em * 1.6,
                    child: Padding(
                      padding: EdgeInsets.only(top: em * 0.25),
                      child: Text(group.type == 'orderedList' ? '${++i}.' : '•', style: TextStyle(fontSize: em, color: context.c.muted)),
                    ),
                  ),
                Expanded(
                  child: k is TextBlock
                      ? lineFor(k)
                      : k is GroupBlock
                          ? GroupRow(group: k, kind: kind, lineFor: lineFor, em: em)
                          : OpaqueView(block: k as OpaqueBlock, em: em),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

/// A part this editor keeps but doesn't edit yet (page break, rule, image, table…).
class OpaqueView extends StatelessWidget {
  const OpaqueView({super.key, required this.block, required this.em});
  final OpaqueBlock block;
  final double em;

  @override
  Widget build(BuildContext context) {
    final t = context.c;
    switch (block.type) {
      case 'pageBreak':
        // pageless view: an inserted page is a small pause (like the web's reader)
        return SizedBox(height: em * 1.5);
      case 'horizontalRule':
        return Padding(padding: EdgeInsets.symmetric(vertical: em), child: Divider(color: t.line));
      default:
        final text = block.plainText.trim();
        return Container(
          margin: EdgeInsets.symmetric(vertical: em * 0.5),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: t.subtle, borderRadius: BorderRadius.circular(8)),
          child: Row(children: [
            Icon(Icons.lock_outline_rounded, size: 16, color: t.muted),
            const SizedBox(width: 8),
            Expanded(
              child: Text(text.isEmpty ? block.type : text, maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyle(color: t.muted, fontSize: 13)),
            ),
          ]),
        );
    }
  }
}

/// A read-only line (reader view, previews): the same look, as selectable text.
class ReadLine extends StatelessWidget {
  const ReadLine({super.key, required this.block, required this.look, required this.styler});
  final TextBlock block;
  final BlockLook look;
  final TextStyle Function(MarkSet, TextStyle) styler;

  @override
  Widget build(BuildContext context) {
    if (block.isEmpty) return SizedBox(height: look.margin.vertical > 0 ? 0 : (look.style.fontSize ?? 16) * 0.6);
    final spans = <InlineSpan>[];
    if (look.indent > 0) spans.add(WidgetSpan(child: SizedBox(width: look.indent)));
    final t = block.text;
    var i = 0;
    final capLength = look.dropCap ? firstAksharaLength(t) : 0;
    if (capLength > 0 && !t.substring(0, capLength).contains(atomChar)) {
      final first = t.substring(0, capLength); // a whole akshara, so conjuncts stay shaped
      final marked = styler(block.marks[0], look.style);
      final own = block.marks[0].style('color') != null; // the writer's own colour wins, as on the web
      spans.add(TextSpan(text: first, style: marked.copyWith(fontSize: (look.style.fontSize ?? 16) * 1.6, fontWeight: FontWeight.w700, color: own ? marked.color : context.c.accent)));
      i = first.length;
    }
    while (i < t.length) {
      if (t[i] == atomChar && block.atoms.containsKey(i)) {
        spans.add(TextSpan(text: '*', style: look.style.copyWith(color: context.c.accent, fontFeatures: const [FontFeature.superscripts()])));
        i++;
        continue;
      }
      final m = block.marks[i];
      var j = i + 1;
      while (j < t.length && block.marks[j] == m && t[j] != atomChar) {
        j++;
      }
      spans.add(TextSpan(text: t.substring(i, j).replaceAll(hardBreakChar, '\n'), style: styler(m, look.style)));
      i = j;
    }
    return LineFrame(look: look, child: _affixed(Text.rich(TextSpan(children: spans), textAlign: look.align, style: look.style), look));
  }
}
