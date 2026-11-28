import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/forms.dart';
import '../../data/journals.dart';
import '../../data/models.dart';
import '../../widgets/common.dart';

/// The started date as a small calendar: short month on an accent band, the day, the weekday.
/// [dashed] draws the empty state's block (the date the first journal will get).
class JournalDateBlock extends StatelessWidget {
  const JournalDateBlock({super.key, required this.date, this.dashed = false});
  final DateTime date;
  final bool dashed;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final d = journalDay(date);
    final face = ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: SizedBox(
        width: 48,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: double.infinity,
            color: c.accentSoft,
            padding: const EdgeInsets.symmetric(vertical: 2),
            alignment: Alignment.center,
            child: Text(d.month, maxLines: 1, style: TextStyle(fontFamily: LitmaFonts.display, fontFamilyFallback: LitmaFonts.displayFallback, fontSize: 11, fontWeight: FontWeight.w600, color: c.accent, height: 1.3)),
          ),
          Text('${d.day}', style: TextStyle(fontFamily: LitmaFonts.ui, fontSize: 22, fontWeight: FontWeight.w700, color: c.ink, height: 1.25)),
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(d.weekday, maxLines: 1, style: TextStyle(fontFamily: LitmaFonts.display, fontFamilyFallback: LitmaFonts.displayFallback, fontSize: 10.5, color: c.muted, height: 1.3)),
          ),
        ]),
      ),
    );
    return Semantics(
      label: todayLine(date),
      excludeSemantics: true,
      child: dashed
          ? CustomPaint(foregroundPainter: _DashedEdge(color: c.lineStrong), child: DecoratedBox(decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(10)), child: face))
          : DecoratedBox(
              decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(10)),
              child: DecoratedBox(
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), border: Border.all(color: c.line)),
                position: DecorationPosition.foreground,
                child: face,
              ),
            ),
    );
  }
}

class _DashedEdge extends CustomPainter {
  _DashedEdge({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final path = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(10)).deflate(0.6));
    for (final m in path.computeMetrics()) {
      for (var at = 0.0; at < m.length; at += 7) {
        canvas.drawPath(m.extractPath(at, at + 4), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedEdge old) => old.color != color;
}

/// A month line between journal cards: "2026 നവംബർ" and a hairline.
class JournalMonthLine extends StatelessWidget {
  const JournalMonthLine({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Semantics(
      header: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 10, 4, 10),
        child: Row(children: [
          Text(text, style: TextStyle(fontFamily: LitmaFonts.display, fontFamilyFallback: LitmaFonts.displayFallback, fontSize: 15, fontWeight: FontWeight.w600, color: c.muted)),
          const SizedBox(width: 12),
          Expanded(child: Container(height: 1, color: c.line)),
        ]),
      ),
    );
  }
}

/// The face of a journal on the desk: calendar block, title (or the first line of an untitled
/// journal), three lines of text, words and the day it was last edited (only another day).
class JournalCard extends StatelessWidget {
  const JournalCard({super.key, required this.doc, this.now});
  final LitmaDoc doc;

  /// For tests and screenshots: "today" for the dates.
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final f = journalFace(doc);
    final edited = sameDay(doc.createdAt, doc.updatedAt) ? null : context.t('journals.edited', {'date': shortDate(doc.updatedAt, now)});
    final small = Theme.of(context).textTheme.labelSmall;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          JournalDateBlock(date: doc.createdAt),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: f.title.isEmpty
                  ? Text(context.t('journals.nothingYet'), style: TextStyle(fontSize: 15, color: c.muted, height: 1.35))
                  : Text(f.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontFamily: LitmaFonts.display, fontFamilyFallback: LitmaFonts.displayFallback, fontSize: 16, fontWeight: FontWeight.w700, color: c.ink, height: 1.35)),
            ),
          ),
        ]),
        if (f.text.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(f.text, maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: LitmaFonts.serif, fontSize: 13.5, height: 1.6, color: c.muted)),
        ],
        const SizedBox(height: 10),
        Row(children: [
          Text(context.t('common.words', {'count': doc.wordCount}), style: small),
          const Spacer(),
          if (edited != null) Flexible(child: Text(edited, maxLines: 1, overflow: TextOverflow.ellipsis, style: small)),
        ]),
      ]),
    );
  }
}

/// Loading: a month-line bar and cards shaped like journal cards.
class JournalsSkeleton extends StatelessWidget {
  const JournalsSkeleton({super.key, this.count = 4});
  final int count;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Widget card() => Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
          child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Bone(width: 48, height: 66, radius: 10),
              SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(height: 4),
                  Bone(height: 14),
                  SizedBox(height: 8),
                  Bone(width: 120, height: 14),
                ]),
              ),
            ]),
            SizedBox(height: 14),
            Bone(height: 10),
            SizedBox(height: 8),
            Bone(width: 180, height: 10),
          ]),
        );
    return Shimmer(
      base: c.subtle,
      glow: c.surface,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Padding(padding: EdgeInsets.fromLTRB(4, 10, 4, 12), child: Bone(width: 110, height: 14)),
        for (var i = 0; i < count; i++) ...[card(), const SizedBox(height: 12)],
      ]),
    );
  }
}

/// No journals yet: today's block with a dashed edge, a line and the New journal button.
class JournalsEmpty extends StatelessWidget {
  const JournalsEmpty({super.key, required this.onNew, this.today});
  final VoidCallback onNew;
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 24, 32, 140),
      child: FadeSlideIn(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Transform.scale(scale: 1.3, child: JournalDateBlock(date: today ?? DateTime.now(), dashed: true)),
          const SizedBox(height: 28),
          Text(context.t('journals.empty.title'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(context.t('journals.empty.body'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted)),
          const SizedBox(height: 22),
          FilledButton.icon(onPressed: onNew, icon: const Icon(LucideIcons.plus, size: 18), label: Text(context.t('journals.new'))),
        ]),
      ),
    );
  }
}
