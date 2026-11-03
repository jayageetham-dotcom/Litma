import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/forms.dart';
import '../../data/models.dart';
import '../../editor/block_style.dart';
import '../../editor/document.dart';
import '../../editor/page_view.dart';

/// "സാഹിത്യരൂപം · What are you writing?": pick a writing type; the new work is made and returned.
Future<LitmaDoc?> showTypePicker(BuildContext context, WidgetRef ref) => showModalBottomSheet<LitmaDoc>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => const _Picker(),
    );

class _Picker extends ConsumerStatefulWidget {
  const _Picker();

  @override
  ConsumerState<_Picker> createState() => _PickerState();
}

class _PickerState extends ConsumerState<_Picker> {
  DocKind? _creating;

  Future<void> _pick(DocKind k) async {
    if (_creating != null) return;
    Haptics.confirm();
    setState(() => _creating = k);
    final s = ref.read(servicesProvider);
    try {
      final profile = ref.read(profileProvider).value;
      final doc = await s.store.createDoc(k, profile: profile);
      if (mounted) Navigator.pop(context, doc);
    } catch (e) {
      if (!mounted) return;
      setState(() => _creating = null);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.t('desk.createError'))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 700;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.86,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scroll) => CustomScrollView(
        controller: scroll,
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
              child: Text(context.t('desk.chooserTitle'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontFamily: LitmaFonts.display)),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            sliver: SliverGrid.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: wide ? 4 : 2, mainAxisSpacing: 14, crossAxisSpacing: 12, childAspectRatio: 0.58),
              itemCount: DocKind.values.length,
              itemBuilder: (context, i) {
                final k = DocKind.values[i];
                return FadeSlideIn(
                  index: i,
                  step: const Duration(milliseconds: 35),
                  child: _TypeCard(kind: k, busy: _creating == k, dimmed: _creating != null && _creating != k, onTap: () => _pick(k)),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TypeCard extends StatelessWidget {
  const _TypeCard({required this.kind, required this.busy, required this.dimmed, required this.onTap});
  final DocKind kind;
  final bool busy;
  final bool dimmed;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final names = kindNames[kind]!;
    return AnimatedOpacity(
      duration: Motion.of(context, Motion.medium),
      opacity: dimmed ? 0.45 : 1,
      child: Pressable(
        onTap: onTap,
        semanticLabel: '${names.ml}, ${names.en}',
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: AnimatedContainer(
              duration: Motion.of(context, Motion.medium),
              curve: Motion.emphasized,
              decoration: BoxDecoration(
                color: c.paper,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: busy ? c.accent : c.line, width: busy ? 2 : 1),
                boxShadow: [BoxShadow(color: const Color(0xFF111113).withValues(alpha: busy ? 0.16 : 0.06), blurRadius: busy ? 24 : 10, offset: const Offset(0, 4))],
              ),
              clipBehavior: Clip.antiAlias,
              child: TemplatePreview(kind: kind),
            ),
          ),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: Text(names.ml, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 16, fontWeight: FontWeight.w700, color: c.ink))),
            if (busy) SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2, color: c.accent)),
          ]),
          Text(names.en, style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 4),
          Text(
            busy ? context.t('desk.opening') : context.t('types.${kind.name}.blurb'),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: busy ? c.accent : c.muted, height: 1.35),
          ),
        ]),
      ),
    );
  }
}

/// A miniature first page of a writing type: its template lines (with their prompts) in the
/// type's own look, plus faint lines standing for the text to come.
class TemplatePreview extends StatelessWidget {
  const TemplatePreview({super.key, required this.kind});
  final DocKind kind;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final settings = settingsFor(kind)..['headingLabels'] = kind == DocKind.screenplay ? 'ml' : null;
    final page = PageLook(kind: kind, settings: settings, t: c);
    final doc = EditorDocument.fromJson(starterContent(kind, now: DateTime(2026, 11, 3)));
    final looks = computeLooks(doc, page);
    Widget line(TextBlock b) {
      final look = looks[b]!;
      final text = b.isEmpty ? (promptFor(b) ?? '') : b.plainText;
      final muted = b.isEmpty;
      final shown = BlockLook(
        style: look.style.copyWith(color: muted ? c.muted.withValues(alpha: 0.75) : look.style.color),
        align: look.align,
        margin: look.margin,
        label: look.label,
        labelStyle: look.labelStyle,
        ruleBelow: look.ruleBelow,
        lineBelow: look.lineBelow,
        boxed: look.boxed,
        prefix: look.prefix,
        suffix: look.suffix,
      );
      if (b.type == 'paragraph' && b.isEmpty) return _Bars(color: c.subtle, em: page.fontSize);
      return LineFrame(look: shown, child: Text(text, textAlign: look.align, maxLines: 2, overflow: TextOverflow.ellipsis, style: shown.style));
    }

    return IgnorePointer(
      child: FittedBox(
        fit: BoxFit.fitWidth,
        alignment: Alignment.topCenter,
        child: SizedBox(
          width: 340,
          height: 520,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(26, 26, 26, 0),
            child: ClipRect(
              child: OverflowBox(
                alignment: Alignment.topCenter,
                maxHeight: double.infinity,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final b in doc.blocks)
                      switch (b) {
                        TextBlock() => line(b),
                        GroupBlock() => GroupRow(group: b, kind: kind, lineFor: line, em: page.fontSize),
                        OpaqueBlock() => const SizedBox.shrink(),
                      },
                    _Bars(color: c.subtle, em: page.fontSize, lines: 6),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Bars extends StatelessWidget {
  const _Bars({required this.color, required this.em, this.lines = 4});
  final Color color;
  final double em;
  final int lines;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < lines; i++)
            FractionallySizedBox(
              widthFactor: i == lines - 1 ? 0.55 : (i.isEven ? 1 : 0.92),
              child: Container(height: em * 0.42, margin: EdgeInsets.only(bottom: em * 0.62), decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
            ),
        ],
      );
}
