import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../data/forms.dart';
import 'document.dart';

/// How one block looks on the page: the native version of the web's editor.scss rules
/// (.sb-title, .sb-chapter, .sp-scene…), so a work looks the same on the phone and the web.
class BlockLook {
  const BlockLook({
    required this.style,
    this.align = TextAlign.start,
    this.margin = EdgeInsets.zero,
    this.indent = 0,
    this.label,
    this.labelStyle,
    this.ruleBelow = false,
    this.ruleAbove = false,
    this.lineBelow = false,
    this.boxed = false,
    this.prefix,
    this.suffix,
    this.dropCap = false,
  });

  final TextStyle style;
  final TextAlign align;
  final EdgeInsets margin;

  /// First-line indent (novel and story paragraphs), in logical pixels.
  final double indent;

  /// A number shown above the line (രംഗം 1, അങ്കം 2, stanza 3…).
  final String? label;
  final TextStyle? labelStyle;

  /// The short amber rule under a chapter heading.
  final bool ruleBelow;

  /// A thin line above (references) or below (byline, dateline).
  final bool ruleAbove;

  /// A thin full-width line under the text (byline, date line).
  final bool lineBelow;
  final bool boxed;

  /// Shown around the text but not part of it (a stage direction's brackets, a refrain's ↻).
  final String? prefix;
  final String? suffix;

  /// The first letter after a chapter heading is set large in the accent colour.
  final bool dropCap;
}

/// Page metrics for a work, from its settings (font, size in pt, line height).
class PageLook {
  PageLook({required this.kind, required this.settings, required this.t});
  final DocKind kind;
  final Json settings;
  final LitmaTokens t;

  String get family => LitmaFonts.document(settings['font'] as String?);

  /// The writer's point size at full size on screen (12 pt = 16 px, as on the web).
  double get fontSize => ((settings['fontSize'] as num?)?.toDouble() ?? 12) * 4 / 3;
  double get lineHeight => (settings['lineHeight'] as num?)?.toDouble() ?? 1.75;

  /// Ink on the paper: black on white, like the web's --paper.
  Color get ink => t.ink;

  TextStyle get body => TextStyle(
        fontFamily: family,
        fontFamilyFallback: const ['NotoSerifMalayalam', 'NotoSansMalayalam', 'Inter'],
        fontSize: fontSize,
        height: lineHeight,
        color: ink,
      );

  TextStyle get uiSmall => TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: fontSize * 0.85, height: 1.5, color: t.muted);

  bool get prose => kind == DocKind.novel || kind == DocKind.story;
  bool get labelsEn => settings['headingLabels'] == 'en';
}

/// Running numbers for numbered blocks (scenes, acts, stanzas), counted down the page.
class Counters {
  int scene = 0, act = 0, dscene = 0, stanza = 0, chapter = 0;
}

TextAlign alignFrom(String? a, TextAlign fallback) => switch (a) {
      'left' => TextAlign.left,
      'center' => TextAlign.center,
      'right' => TextAlign.right,
      'justify' => TextAlign.justify,
      _ => fallback,
    };

/// The look of [b] on [page]. [previous] is the block before it (indents, drop cap); counters
/// advance as blocks are looked up from the top of the page down.
BlockLook lookFor(TextBlock b, PageLook page, Counters n, {Block? previous, bool firstOfWork = false}) {
  final body = page.body;
  final t = page.t;
  final em = page.fontSize;
  EdgeInsets m(double top, double bottom, {double left = 0, double right = 0}) => EdgeInsets.fromLTRB(left * em, top * em, right * em, bottom * em);
  TextAlign a(TextAlign fallback) => alignFrom(b.align, fallback);

  switch (b.type) {
    case 'styledBlock':
      switch (b.variant) {
        case 'title':
          return BlockLook(style: body.copyWith(fontSize: em * 2.05, fontWeight: FontWeight.w700, height: 1.3), align: a(TextAlign.center), margin: m(0.4, 0.25));
        case 'subtitle':
          return BlockLook(style: body.copyWith(fontSize: em * 1.2, color: t.muted), align: a(TextAlign.center), margin: m(0, 0.5));
        case 'author':
          return BlockLook(style: body.copyWith(fontSize: em * 1.05, color: Color.lerp(t.ink, t.muted, 0.2)), align: a(TextAlign.center), margin: m(0, 1.6));
        case 'epigraph':
          return BlockLook(style: body.copyWith(fontSize: em * 0.9, fontStyle: FontStyle.italic, color: t.muted), align: a(TextAlign.right), margin: m(1, 1.6, left: 3));
        case 'chapter':
          n.chapter++;
          return BlockLook(
            style: body.copyWith(fontSize: em * 1.35, fontWeight: FontWeight.w700, height: 1.4),
            align: a(TextAlign.center),
            margin: m(2.4, 1.4),
            ruleBelow: true,
            label: page.settings['chapterNumbers'] == true && !b.isEmpty ? (page.labelsEn ? 'Chapter ${n.chapter}' : 'അദ്ധ്യായം ${n.chapter}') : null,
            labelStyle: page.uiSmall.copyWith(color: t.highlight, fontWeight: FontWeight.w600),
          );
        case 'kicker':
          return BlockLook(style: page.uiSmall.copyWith(fontWeight: FontWeight.w600, color: t.highlight), align: a(TextAlign.start), margin: m(0, 0.2));
        case 'standfirst':
          return BlockLook(style: body.copyWith(fontSize: em * 1.18, height: 1.6, color: Color.lerp(t.ink, t.muted, 0.15)), align: a(TextAlign.start), margin: m(0, 0.6));
        case 'byline':
          return BlockLook(style: page.uiSmall, align: a(TextAlign.start), margin: m(0, 1.2), lineBelow: true);
        case 'subhead':
          return BlockLook(style: body.copyWith(fontSize: em * 1.15, fontWeight: FontWeight.w700), align: a(TextAlign.start), margin: m(1.2, 0.35));
        case 'pullquote':
          return BlockLook(style: body.copyWith(fontSize: em * 1.35, height: 1.5, fontWeight: FontWeight.w600, color: t.accent), align: a(TextAlign.center), margin: m(1, 1, left: 1, right: 1));
        case 'caption':
          return BlockLook(style: page.uiSmall, align: a(TextAlign.center), margin: m(0, 0.5));
        case 'part':
          return BlockLook(style: page.uiSmall.copyWith(fontWeight: FontWeight.w600, color: t.highlight), align: a(TextAlign.start), margin: m(1.3, 0.35));
        case 'stage':
          return BlockLook(
              style: body.copyWith(fontStyle: FontStyle.italic, color: Color.lerp(t.ink, t.muted, 0.25)),
              align: a(TextAlign.start),
              margin: m(0.5, 0.7, left: 2.5),
              prefix: b.isEmpty ? null : '(',
              suffix: b.isEmpty ? null : ')');
        case 'dateline':
          return BlockLook(style: page.uiSmall.copyWith(fontWeight: FontWeight.w600, color: t.accent, fontSize: em), align: a(TextAlign.start), margin: m(1.4, 0.8), lineBelow: true);
        case 'act':
          n.act++;
          n.dscene = 0;
          return BlockLook(
            style: body.copyWith(fontSize: em * 1.45, fontWeight: FontWeight.w700),
            align: TextAlign.center,
            margin: m(2.2, 1.2),
            label: page.labelsEn ? 'Act ${n.act}' : 'അങ്കം ${n.act}',
            labelStyle: body.copyWith(fontSize: em * 1.0, color: t.highlight, fontWeight: FontWeight.w700),
          );
        case 'scene':
          n.dscene++;
          return BlockLook(
            style: body.copyWith(fontWeight: FontWeight.w500, color: Color.lerp(t.ink, t.muted, 0.2)),
            align: TextAlign.center,
            margin: m(1.8, 0.8),
            label: page.labelsEn ? 'Scene ${n.dscene}' : 'രംഗം ${n.dscene}',
            labelStyle: body.copyWith(fontSize: em * 1.2, fontWeight: FontWeight.w700),
          );
        case 'stanza':
          n.stanza++;
          return BlockLook(
            style: body.copyWith(fontSize: em * 0.92, color: t.muted),
            align: TextAlign.center,
            margin: m(1.1, 0.4),
            label: '${n.stanza}',
            labelStyle: page.uiSmall.copyWith(color: t.highlight, fontWeight: FontWeight.w600),
          );
        case 'refrain':
          return BlockLook(style: body.copyWith(fontStyle: FontStyle.italic, color: Color.lerp(t.ink, t.muted, 0.25)), align: a(TextAlign.start), margin: m(0.4, 0.6, left: 1.5), prefix: b.isEmpty ? null : '↻ ');
        case 'credits':
          return BlockLook(style: page.uiSmall, align: a(TextAlign.center), margin: m(0, 1.4));
        case 'infobox':
          return BlockLook(style: body.copyWith(fontSize: em * 0.92, height: 1.6), align: a(TextAlign.start), margin: m(1, 1.2), boxed: true);
        case 'references':
          return BlockLook(style: body.copyWith(fontSize: em * 1.1, fontWeight: FontWeight.w700), align: a(TextAlign.start), margin: m(2, 0.5), ruleAbove: true);
      }
      return BlockLook(style: body, align: a(TextAlign.start), margin: m(0, 0.5));

    case 'heading':
      final level = (b.attrs['level'] as num?)?.toInt() ?? 2;
      final size = switch (level) { 1 => 1.6, 2 => 1.3, _ => 1.12 };
      return BlockLook(style: body.copyWith(fontSize: em * size, fontWeight: FontWeight.w700, height: 1.35), align: a(TextAlign.start), margin: m(1.1, 0.4));

    // screenplay (pageless phone layout from editor.scss)
    case 'sceneHeading':
      n.scene++;
      final legacy = page.settings['headingLabels'] == null;
      return BlockLook(
        style: body.copyWith(fontSize: em * 0.95, fontWeight: FontWeight.w700),
        margin: m(n.scene == 1 && firstOfWork ? 0 : 1.8, 0),
        label: legacy ? 'Scene: ${n.scene}' : (page.labelsEn ? 'Scene ${n.scene}' : 'രംഗം ${n.scene}'),
        labelStyle: TextStyle(
          fontFamily: legacy || page.labelsEn ? LitmaFonts.ui : LitmaFonts.display,
          fontFamilyFallback: LitmaFonts.uiFallback,
          fontSize: em * 1.2,
          fontWeight: FontWeight.w700,
          color: t.ink,
        ),
      );
    case 'sceneTime':
      return BlockLook(style: body.copyWith(fontWeight: FontWeight.w500), margin: m(0, 0.3));
    case 'sceneCast':
      return BlockLook(style: body.copyWith(fontSize: em * 0.88, height: 1.55), align: TextAlign.right, margin: m(0, 1, left: 6));
    case 'action':
      return BlockLook(style: body, align: a(TextAlign.start), margin: m(0.2, 0.9));
    case 'transition':
      return BlockLook(style: body.copyWith(fontWeight: FontWeight.w600), align: a(TextAlign.right), margin: m(0.4, 1));
    case 'dialogueCue':
      final drama = page.kind == DocKind.drama;
      return BlockLook(style: body.copyWith(fontWeight: drama ? FontWeight.w700 : FontWeight.w500), align: drama ? TextAlign.start : TextAlign.right, suffix: b.isEmpty ? null : ':');
    case 'dialogueSpeech':
      return BlockLook(style: body);
    case 'castName':
      return BlockLook(style: body.copyWith(fontWeight: FontWeight.w600));
    case 'castRole':
      return BlockLook(style: body.copyWith(color: t.muted));
    case 'codeBlock':
      return BlockLook(style: body.copyWith(fontFamily: 'monospace', fontSize: em * 0.85), margin: m(0.5, 0.5), boxed: true);
  }

  // body paragraphs: novels and stories indent like a printed book, except the first paragraph
  // of the work and the first after a heading
  final afterHeading = previous is TextBlock && previous.type != 'paragraph';
  final indent = page.prose && !firstOfWork && !afterHeading && previous is! OpaqueBlock ? em * 1.6 : 0.0;
  final verseCentre = (page.kind == DocKind.poem || page.kind == DocKind.lyrics) && page.settings['verseAlign'] == 'center';
  return BlockLook(
    style: body,
    align: a(verseCentre ? TextAlign.center : TextAlign.start),
    margin: page.prose ? m(0, 0.15) : m(0, 0.6),
    indent: indent,
    dropCap: page.prose && previous is TextBlock && previous.variant == 'chapter',
  );
}

/// Draw text marks: bold, italic, underline, strike, colour, highlight, size, super/subscript.
TextStyle markStyle(MarkSet marks, TextStyle base, {required bool dark, required LitmaTokens t}) {
  if (marks.marks.isEmpty) return base;
  var s = base;
  final deco = <TextDecoration>[];
  for (final m in marks.marks) {
    switch (m['type']) {
      case 'bold':
        s = s.copyWith(fontWeight: FontWeight.w700);
      case 'italic':
        s = s.copyWith(fontStyle: FontStyle.italic);
      case 'underline':
        deco.add(TextDecoration.underline);
      case 'strike':
        deco.add(TextDecoration.lineThrough);
      case 'link':
        deco.add(TextDecoration.underline);
        s = s.copyWith(color: t.accent);
      case 'superscript':
        s = s.copyWith(fontFeatures: const [FontFeature.superscripts()]);
      case 'subscript':
        s = s.copyWith(fontFeatures: const [FontFeature.subscripts()]);
      case 'highlight':
        final c = _parseColor(m['attrs']?['color'] as String?) ?? const Color(0xFFFFF3A3);
        s = s.copyWith(backgroundColor: c, color: dark ? const Color(0xFF111113) : s.color);
      case 'textStyle':
        final a = (m['attrs'] as Map?) ?? const {};
        final c = _parseColor(a['color'] as String?);
        if (c != null) s = s.copyWith(color: dark ? _lighten(c) : c);
        final size = a['fontSize'] as String?;
        final pt = size == null ? null : double.tryParse(size.replaceAll('pt', ''));
        if (pt != null) s = s.copyWith(fontSize: pt * 4 / 3);
        if (a['fontWeight'] == '400') s = s.copyWith(fontWeight: FontWeight.w400);
    }
  }
  if (deco.isNotEmpty) s = s.copyWith(decoration: TextDecoration.combine(deco), decorationColor: s.color);
  return s;
}

Color? _parseColor(String? css) {
  if (css == null) return null;
  final h = css.trim();
  final m = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(h) ?? RegExp(r'^#([0-9a-fA-F]{3})$').firstMatch(h);
  if (m == null) return null;
  var hex = m[1]!;
  if (hex.length == 3) hex = hex.split('').map((c) => '$c$c').join();
  return Color(int.parse('FF$hex', radix: 16));
}

/// Dark mode shows a writer's text colour lighter (the web keeps OKLCH lightness ≥ 0.78) without
/// changing the stored colour.
Color _lighten(Color c) {
  final hsl = HSLColor.fromColor(c);
  return hsl.lightness >= 0.72 ? c : hsl.withLightness(0.74).toColor();
}
