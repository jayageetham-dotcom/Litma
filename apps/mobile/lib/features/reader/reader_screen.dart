import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n.dart';
import '../../core/manglish.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/forms.dart';
import '../../editor/block_style.dart';
import '../../editor/document.dart';
import '../../editor/page_view.dart';

/// Reading view: one continuous sheet like a pageless document (the web's /read/), the work's
/// own fonts and layout, reading progress across the top.
class ReaderScreen extends StatefulWidget {
  const ReaderScreen({super.key, required this.title, required this.kind, required this.settings, required this.document});
  final String title;
  final DocKind kind;
  final Json settings;
  final EditorDocument document;

  /// Rises in like a page lifted onto the desk (fade-through on Android, native slide on iOS).
  static Route<void> route({required String title, required DocKind kind, required Json settings, required EditorDocument document}) => PageRouteBuilder(
        transitionDuration: Motion.page,
        reverseTransitionDuration: Motion.medium,
        pageBuilder: (_, _, _) => ReaderScreen(title: title, kind: kind, settings: settings, document: document),
        transitionsBuilder: (context, a, _, child) {
          final curved = CurvedAnimation(parent: a, curve: Motion.emphasizedDecelerate, reverseCurve: Motion.emphasizedAccelerate);
          return FadeTransition(
            opacity: curved,
            child: SlideTransition(position: Tween(begin: const Offset(0, 0.06), end: Offset.zero).animate(curved), child: child),
          );
        },
      );

  @override
  State<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends State<ReaderScreen> {
  final _scroll = ScrollController();
  final _progress = ValueNotifier(0.0);
  final _showTitle = ValueNotifier(false);

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final p = _scroll.position;
      _progress.value = p.maxScrollExtent <= 0 ? 1 : (p.pixels / p.maxScrollExtent).clamp(0, 1);
      _showTitle.value = p.pixels > 120;
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final page = PageLook(kind: widget.kind, settings: widget.settings, t: c);
    final looks = computeLooks(widget.document, page);
    TextStyle styler(MarkSet m, TextStyle b) => markStyle(m, b, dark: context.isDark, t: c);
    final blocks = widget.document.blocks;
    final pad = pagePadding(context);
    final words = countWords(widget.document.plainText);
    final wide = MediaQuery.sizeOf(context).width >= 760;

    return Scaffold(
      backgroundColor: wide ? c.canvas : c.paper,
      appBar: AppBar(
        backgroundColor: wide ? c.canvas : c.paper,
        leading: IconButton(icon: const Icon(LucideIcons.x), tooltip: context.t('common.close'), onPressed: () => Navigator.pop(context)),
        title: ValueListenableBuilder<bool>(
          valueListenable: _showTitle,
          builder: (context, show, _) => AnimatedOpacity(
            opacity: show ? 1 : 0,
            duration: Motion.of(context, Motion.medium),
            child: Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontFamily: LitmaFonts.display)),
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(2),
          child: ValueListenableBuilder<double>(
            valueListenable: _progress,
            builder: (context, v, _) => Align(
              alignment: Alignment.centerLeft,
              child: FractionallySizedBox(widthFactor: v, child: Container(height: 2, color: c.accent)),
            ),
          ),
        ),
      ),
      body: PaperSheet(
        child: ListView.builder(
          controller: _scroll,
          padding: EdgeInsets.fromLTRB(pad.left, 24, pad.right, 64),
          itemCount: blocks.length + 1,
          itemBuilder: (context, i) {
            if (i == blocks.length) {
              return Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Text('${context.t('common.words', {'count': words})} · ${context.t('app.editor.minRead', {'n': readingMinutes(words)})}',
                    textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
              );
            }
            final b = blocks[i];
            Widget line(TextBlock t) => ReadLine(block: t, look: looks[t]!, styler: styler);
            final child = switch (b) {
              TextBlock() => line(b),
              GroupBlock() => GroupRow(group: b, kind: widget.kind, lineFor: line, em: page.fontSize),
              OpaqueBlock() => OpaqueView(block: b, em: page.fontSize),
            };
            return FadeSlideIn(index: i < 14 ? i : 0, step: const Duration(milliseconds: 30), offset: 10, child: SelectionArea(child: child));
          },
        ),
      ),
    );
  }
}
