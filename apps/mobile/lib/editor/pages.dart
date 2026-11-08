import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/i18n.dart';
import '../core/theme.dart';

/// Pages in the phone editor, like the web's (`extensions/pagination.ts`): a work starts as one
/// page, lines that no longer fit move to the next page, an inserted page break starts a new one,
/// and the gap between two pages has a small + that inserts a blank page there.

/// Paper sizes in millimetres (the web's `settings.pageSize`).
const paperMm = {'A4': (210.0, 297.0), 'A5': (148.0, 210.0), 'Letter': (215.9, 279.4)};
const _pxPerMm = 96 / 25.4;

/// Paper above the first line and below the last line of each page.
const pageTop = 28.0;
const pageBottom = 28.0;

/// Height of the writing on one phone page. Text shows at its print size (12 pt = 16 px) on a
/// narrower sheet, so a phone page is as tall as it takes to hold the same text as a printed page
/// of the work's paper and margins: phone page n is about printed page n.
double phonePageHeight(Map<String, dynamic> settings, double width) {
  final (pw, ph) = paperMm[settings['pageSize']] ?? paperMm['A4']!;
  final m = (settings['margins'] as Map?) ?? const {};
  double mm(String k) => (m[k] as num?)?.toDouble() ?? 25;
  final printW = (pw - mm('left') - mm('right')) * _pxPerMm;
  final printH = (ph - mm('top') - mm('bottom')) * _pxPerMm;
  if (width <= 0 || printW <= 0 || printH <= 0) return 900;
  return math.max(printH * printW / width, 320.0);
}

/// Where the pages break.
class PageFlow {
  const PageFlow(this.gapBefore, this.lastFill, this.pages);

  /// Item index → empty paper left at the bottom of the page that ends just above it.
  final Map<int, double> gapBefore;

  /// Empty paper left on the last page.
  final double lastFill;
  final int pages;
}

/// Lays items of [heights] onto pages of [pageHeight]. An item with [isBreak] (an inserted page
/// break, no height of its own) ends its page; an item that doesn't fit moves to the next page; an
/// item taller than a page gets a page of its own and runs over it.
PageFlow flowPages(List<double> heights, List<bool> isBreak, double pageHeight) {
  final gaps = <int, double>{};
  var y = 0.0;
  var pages = 1;
  for (var i = 0; i < heights.length; i++) {
    if (isBreak[i]) {
      gaps[i] = math.max(0.0, pageHeight - y);
      y = 0;
      pages++;
      continue;
    }
    final h = heights[i];
    if (y > 0 && y + h > pageHeight) {
      gaps[i] = math.max(0.0, pageHeight - y);
      y = 0;
      pages++;
    }
    y += h;
  }
  return PageFlow(gaps, math.max(0.0, pageHeight - y), pages);
}

/// The end of one page and the start of the next: the rest of the page's paper, a quiet gap with
/// a small + (inserts a blank page here), and the next page's top margin.
class PageEdge extends StatelessWidget {
  const PageEdge({super.key, required this.fill, required this.onInsert});
  final double fill;
  final VoidCallback onInsert;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final label = context.t('editor.insertPage');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ColoredBox(color: c.paper, child: SizedBox(height: fill + pageBottom)),
      Container(
        height: 30,
        decoration: BoxDecoration(color: c.canvas, border: Border.symmetric(horizontal: BorderSide(color: c.line, width: 0.5))),
        alignment: Alignment.center,
        child: Semantics(
          button: true,
          label: label,
          excludeSemantics: true,
          child: Tooltip(
            message: label,
            child: InkResponse(
              onTap: onInsert,
              radius: 18,
              child: SizedBox(
                width: 48,
                height: 30,
                child: Center(
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: c.lineStrong, width: 0.8)),
                    child: Icon(LucideIcons.plus, size: 12, color: c.muted),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      ColoredBox(color: c.paper, child: const SizedBox(height: pageTop)),
    ]);
  }
}

/// Reports its child's height after each layout (the editor measures lines to place pages).
class MeasureSize extends SingleChildRenderObjectWidget {
  const MeasureSize({super.key, required this.onHeight, super.child});
  final ValueChanged<double> onHeight;

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderMeasure(onHeight);

  @override
  void updateRenderObject(BuildContext context, covariant _RenderMeasure renderObject) => renderObject.onHeight = onHeight;
}

class _RenderMeasure extends RenderProxyBox {
  _RenderMeasure(this.onHeight);
  ValueChanged<double> onHeight;

  @override
  void performLayout() {
    super.performLayout();
    onHeight(size.height);
  }
}
