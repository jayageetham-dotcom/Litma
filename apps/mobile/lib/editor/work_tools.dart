import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:printing/printing.dart';

import '../app/providers.dart';
import '../core/i18n.dart';
import '../core/motion.dart';
import '../core/theme.dart';
import '../data/forms.dart';
import 'document.dart';
import 'export.dart';
import 'session.dart';

/// Text colours and highlights: the same swatches as the web's ColorTools.
const textColours = ['#1a1d24', '#5f6672', '#d92d20', '#c2410c', '#a15c07', '#15803d', '#0f766e', '#0369a1', '#2563eb', '#5b3ef0', '#9333ea', '#db2777'];
const highlightColours = ['#fde68a', '#fed7aa', '#fecaca', '#fbcfe8', '#e9d5ff', '#c7d2fe', '#bfdbfe', '#bbf7d0', '#d9f99d', '#e5e7eb'];

/// Document fonts offered in Page setup (the ones bundled in the app; the web lists the same).
const documentFonts = ['Noto Serif Malayalam', 'Noto Sans Malayalam', 'Manjari', 'Gayathri', 'Anek Malayalam'];
const pageSizes = ['A4', 'A5', 'Letter'];

Color _hex(String h) => Color(int.parse('FF${h.substring(1)}', radix: 16));

Widget _title(BuildContext context, String text) =>
    Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 10), child: Text(text, style: Theme.of(context).textTheme.titleMedium));

/// A small titled group in a sheet, with a tint dot (like the web panels' sections).
Widget _section(BuildContext context, String label, Color tint, Widget child) {
  final c = context.c;
  return Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Container(width: 7, height: 7, decoration: BoxDecoration(color: tint, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(label, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: c.muted)),
      ]),
      const SizedBox(height: 10),
      child,
    ]),
  );
}

/// Give the cursor back to the line the writer was on once a sheet closes.
void _refocus(EditorSession s) {
  WidgetsBinding.instance.addPostFrameCallback((_) {
    final f = s.focused;
    if (f != null) s.focusLine(f, at: s.controllerFor(f).blockSelection.extentOffset);
  });
}

// ── Format: size, colour, highlight, lists, alignment ──

Future<void> showFormatSheet(BuildContext context, EditorSession s) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => ListenableBuilder(listenable: s, builder: (context, _) => _FormatSheet(session: s)),
  );
  _refocus(s);
}

class _FormatSheet extends StatelessWidget {
  const _FormatSheet({required this.session});
  final EditorSession session;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final s = session;
    final size = s.fontSizeAt;
    final own = s.styleAt('fontSize') != null;
    final colour = s.styleAt('color');
    final mark = s.highlightAt;
    String pt(double v) => '${v == v.roundToDouble() ? v.toInt() : v}pt';

    Widget chip(String label, bool on, VoidCallback? tap, {IconData? icon}) => Pressable(
          onTap: tap,
          child: AnimatedContainer(
            duration: Motion.of(context, Motion.fast),
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: on ? c.optionSelected : c.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: on ? c.accent.withValues(alpha: 0.4) : c.line),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) Icon(icon, size: 18, color: tap == null ? c.disabledInk : (on ? c.optionSelectedInk : c.ink)),
              if (icon != null && label.isNotEmpty) const SizedBox(width: 6),
              if (label.isNotEmpty) Text(label, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: tap == null ? c.disabledInk : (on ? c.optionSelectedInk : c.ink))),
            ]),
          ),
        );

    Widget swatch(String? hex, bool on, VoidCallback tap, {required bool highlight}) => Pressable(
          onTap: tap,
          semanticLabel: hex ?? context.t(highlight ? 'color.none' : 'color.automatic'),
          child: Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: hex == null ? c.paper : _hex(hex),
              shape: BoxShape.circle,
              border: Border.all(color: on ? c.accent : c.lineStrong, width: on ? 2.5 : 1),
            ),
            child: hex == null
                ? (highlight ? Icon(LucideIcons.ban, size: 16, color: c.muted) : Center(child: Text('A', style: TextStyle(fontWeight: FontWeight.w700, color: c.ink))))
                : null,
          ),
        );

    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      children: [
        _title(context, context.t('app.tools.format')),
        _section(
          context,
          context.t('app.format.style'),
          c.tintViolet,
          Wrap(spacing: 8, runSpacing: 8, children: [
            chip('', s.markActive('bold'), () => s.toggleMark('bold'), icon: LucideIcons.bold),
            chip('', s.markActive('italic'), () => s.toggleMark('italic'), icon: LucideIcons.italic),
            chip('', s.markActive('underline'), () => s.toggleMark('underline'), icon: LucideIcons.underline),
            chip('', s.markActive('strike'), () => s.toggleMark('strike'), icon: LucideIcons.strikethrough),
            chip('', s.markActive('superscript'), () => s.toggleMark('superscript'), icon: LucideIcons.superscript),
            chip('', s.markActive('subscript'), () => s.toggleMark('subscript'), icon: LucideIcons.subscript),
          ]),
        ),
        _section(
          context,
          context.t('editor.fontSize.label'),
          c.tintSky,
          Row(children: [
            chip('', false, size > 6 ? () => s.setStyle('fontSize', pt((size - 1).clamp(6, 96))) : null, icon: LucideIcons.minus),
            Expanded(
              child: Center(
                child: Text(own ? pt(size) : '${context.t('editor.fontSize.auto')} · ${pt(size)}',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.ink)),
              ),
            ),
            chip('', false, size < 96 ? () => s.setStyle('fontSize', pt((size + 1).clamp(6, 96))) : null, icon: LucideIcons.plus),
            const SizedBox(width: 8),
            chip(context.t('editor.fontSize.auto'), !own, own ? () => s.setStyle('fontSize', null) : null),
          ]),
        ),
        _section(
          context,
          context.t('color.text'),
          c.tintCoral,
          Wrap(spacing: 10, runSpacing: 10, children: [
            swatch(null, colour == null, () => s.setStyle('color', null), highlight: false),
            for (final h in textColours) swatch(h, colour?.toLowerCase() == h, () => s.setStyle('color', h), highlight: false),
          ]),
        ),
        _section(
          context,
          context.t('color.highlight'),
          c.tintTangerine,
          Wrap(spacing: 10, runSpacing: 10, children: [
            swatch(null, mark == null, () => s.setHighlight(null), highlight: true),
            for (final h in highlightColours) swatch(h, mark?.toLowerCase() == h, () => s.setHighlight(h), highlight: true),
          ]),
        ),
        if (s.kind != DocKind.screenplay)
          _section(
            context,
            context.t('app.format.lists'),
            c.tintLime,
            Wrap(spacing: 8, runSpacing: 8, children: [
              chip(context.t('app.format.bullet'), s.listType == 'bulletList', s.canList ? () => s.toggleList('bulletList') : null, icon: LucideIcons.list),
              chip(context.t('app.format.numbered'), s.listType == 'orderedList', s.canList ? () => s.toggleList('orderedList') : null, icon: LucideIcons.listOrdered),
            ]),
          ),
        _section(
          context,
          context.t('app.format.align'),
          c.tintSky,
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final (v, icon) in [
              (null, LucideIcons.textAlignStart),
              ('center', LucideIcons.textAlignCenter),
              ('right', LucideIcons.textAlignEnd),
              ('justify', LucideIcons.textAlignJustify),
            ])
              chip('', (v ?? 'start') == s.align || (v == null && s.align == 'left'), s.canAlign ? () => s.setAlign(v) : null, icon: icon),
          ]),
        ),
      ],
    );
  }
}

// ── Contents (outline) ──

Future<void> showOutlineSheet(BuildContext context, EditorSession s) {
  final items = s.outline();
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheet) {
      final c = sheet.c;
      return ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * 0.75),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            _title(sheet, sheet.t('app.tools.outline')),
            if (items.isEmpty)
              Padding(padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 4), child: Text(sheet.t('app.outline.empty'), style: TextStyle(color: c.muted))),
            for (final (i, it) in items.indexed)
              FadeSlideIn(
                index: i < 12 ? i : 12,
                offset: 6,
                child: Pressable(
                  onTap: () {
                    Navigator.pop(sheet);
                    s.reveal?.call(it.line);
                  },
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(4.0 + (it.level - 1) * 18, 11, 4, 11),
                    child: Text(it.label,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontFamily: LitmaFonts.display, fontSize: it.level == 1 ? 16 : 14.5, fontWeight: it.level == 1 ? FontWeight.w600 : FontWeight.w500, color: it.level == 1 ? c.ink : c.muted)),
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );
}

// ── Find and replace ──

Future<void> showFindSheet(BuildContext context, EditorSession s) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheet) => Padding(padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(sheet).bottom), child: _FindSheet(session: s)),
    );

class _FindSheet extends StatefulWidget {
  const _FindSheet({required this.session});
  final EditorSession session;
  @override
  State<_FindSheet> createState() => _FindSheetState();
}

class _FindSheetState extends State<_FindSheet> {
  final _term = TextEditingController();
  final _with = TextEditingController();
  int _at = 0;
  String? _note;

  @override
  void dispose() {
    _term.dispose();
    _with.dispose();
    super.dispose();
  }

  List<({TextBlock line, int at})> get _hits => widget.session.find(_term.text);

  void _show(int i) {
    final hits = _hits;
    if (hits.isEmpty) return;
    _at = (i % hits.length + hits.length) % hits.length;
    final h = hits[_at];
    final len = _term.text.length;
    widget.session.reveal?.call(h.line);
    // after the line is shown and focused, select the match
    WidgetsBinding.instance.addPostFrameCallback((_) => WidgetsBinding.instance.addPostFrameCallback((_) => widget.session.showMatch(h.line, h.at, len)));
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final hits = _hits;
    final count = hits.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _title(context, context.t('app.tools.find')),
        TextField(
          controller: _term,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onChanged: (_) => setState(() {
            _at = 0;
            _note = null;
          }),
          onSubmitted: (_) => _show(_at),
          decoration: InputDecoration(hintText: context.t('app.find.hint'), prefixIcon: Icon(LucideIcons.search, size: 18, color: c.muted)),
        ),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
            child: Text(
              _note ?? (_term.text.isEmpty ? '' : count == 0 ? context.t('app.find.none') : '${_at + 1} / ${context.t('app.find.count', {'count': count})}'),
              style: TextStyle(color: c.muted, fontSize: 13),
            ),
          ),
          IconButton(tooltip: context.t('app.find.previous'), onPressed: count == 0 ? null : () => _show(_at - 1), icon: const Icon(LucideIcons.chevronUp, size: 20)),
          IconButton(tooltip: context.t('app.find.next'), onPressed: count == 0 ? null : () => _show(_at + 1), icon: const Icon(LucideIcons.chevronDown, size: 20)),
        ]),
        const SizedBox(height: 6),
        TextField(controller: _with, decoration: InputDecoration(hintText: context.t('app.find.replace'))),
        const SizedBox(height: 10),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: count == 0
                ? null
                : () {
                    final n = widget.session.replaceAll(_term.text, _with.text);
                    setState(() => _note = context.t('app.find.replaced', {'count': n}));
                  },
            child: Text(context.t('app.find.replaceAll')),
          ),
        ),
      ]),
    );
  }
}

// ── Saved words ──

Future<void> showSavedWordsSheet(BuildContext context, WidgetRef ref, EditorSession s) async {
  final words = await ref.read(servicesProvider).store.listBookmarks().catchError((_) => <Json>[]);
  if (!context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheet) {
      final c = sheet.c;
      return ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * 0.75),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            _title(sheet, sheet.t('saved.title')),
            if (words.isEmpty) ...[
              Padding(padding: const EdgeInsets.fromLTRB(4, 12, 4, 4), child: Text(sheet.t('saved.emptyTitle'), style: Theme.of(sheet).textTheme.titleSmall)),
              Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: Text(sheet.t('saved.emptyBody'), style: TextStyle(color: c.muted))),
            ] else ...[
              Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 8), child: Text(sheet.t('saved.pickHint'), style: TextStyle(color: c.muted, fontSize: 13))),
              for (final w in words.reversed)
                Pressable(
                  semanticLabel: sheet.t('saved.insert'),
                  onTap: () {
                    Navigator.pop(sheet);
                    s.insertText('${w['word']}');
                  },
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: c.line)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${w['word']}', style: const TextStyle(fontFamily: LitmaFonts.display, fontSize: 17, fontWeight: FontWeight.w600)),
                      if ((w['meaning'] as String?)?.isNotEmpty ?? false)
                        Padding(padding: const EdgeInsets.only(top: 3), child: Text('${w['meaning']}', maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.muted, fontSize: 13))),
                    ]),
                  ),
                ),
            ],
          ],
        ),
      );
    },
  );
}

// ── Page setup: font, size, spacing, page size and the writing type's layout choices ──

Future<void> showPageSetupSheet(BuildContext context, EditorSession s) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => ListenableBuilder(listenable: s, builder: (context, _) => _PageSetup(session: s)),
    );

class _PageSetup extends StatelessWidget {
  const _PageSetup({required this.session});
  final EditorSession session;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final s = session;
    final st = s.settings;
    final font = (st['font'] as String?) ?? documentFonts.first;
    final size = (st['fontSize'] as num?)?.toDouble() ?? 12;
    final line = (st['lineHeight'] as num?)?.toDouble() ?? 1.75;
    final page = (st['pageSize'] as String?) ?? 'A4';

    Widget option(String label, bool on, VoidCallback tap, {String? fontFamily}) => Pressable(
          onTap: tap,
          child: AnimatedContainer(
            duration: Motion.of(context, Motion.fast),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: on ? c.optionSelected : c.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: on ? c.accent.withValues(alpha: 0.4) : c.line),
            ),
            child: Text(label, style: TextStyle(fontFamily: fontFamily, fontSize: 14, fontWeight: FontWeight.w600, color: on ? c.optionSelectedInk : c.ink)),
          ),
        );

    Widget stepper(String value, VoidCallback? down, VoidCallback? up) => Row(children: [
          IconButton.outlined(onPressed: down, icon: const Icon(LucideIcons.minus, size: 18)),
          Expanded(child: Center(child: Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.ink)))),
          IconButton.outlined(onPressed: up, icon: const Icon(LucideIcons.plus, size: 18)),
        ]);

    final prose = s.kind == DocKind.novel || s.kind == DocKind.story;
    final labels = s.kind == DocKind.screenplay || s.kind == DocKind.drama;
    final verse = s.kind == DocKind.poem || s.kind == DocKind.lyrics;
    String one(double v) => v.toStringAsFixed(v == v.roundToDouble() ? 0 : 1);

    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      children: [
        _title(context, context.t('app.tools.page')),
        _section(context, context.t('app.page.font'), c.tintViolet,
            Wrap(spacing: 8, runSpacing: 8, children: [for (final f in documentFonts) option(f, f == font, () => s.updateSettings({'font': f}), fontFamily: LitmaFonts.document(f))])),
        _section(context, context.t('app.page.fontSize'), c.tintSky,
            stepper('${one(size)}pt', size > 9 ? () => s.updateSettings({'fontSize': size - 1}) : null, size < 24 ? () => s.updateSettings({'fontSize': size + 1}) : null)),
        _section(context, context.t('app.page.lineHeight'), c.tintLime,
            stepper(one(line), line > 1.2 ? () => s.updateSettings({'lineHeight': double.parse((line - 0.1).toStringAsFixed(1))}) : null, line < 2.6 ? () => s.updateSettings({'lineHeight': double.parse((line + 0.1).toStringAsFixed(1))}) : null)),
        _section(context, context.t('app.page.pageSize'), c.tintCoral, Wrap(spacing: 8, runSpacing: 8, children: [for (final p in pageSizes) option(p, p == page, () => s.updateSettings({'pageSize': p}))])),
        if (prose)
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: st['chapterNumbers'] == true,
            onChanged: (v) => s.updateSettings({'chapterNumbers': v}),
            title: Text(context.t('editor.page.chapterNumbers')),
          ),
        if (labels)
          _section(
            context,
            context.t('editor.page.headingLabels'),
            c.tintTangerine,
            Wrap(spacing: 8, runSpacing: 8, children: [
              option(context.t(s.kind == DocKind.drama ? 'editor.page.labelsMlDrama' : 'editor.page.labelsMl'), st['headingLabels'] == 'ml', () => s.updateSettings({'headingLabels': 'ml'})),
              option(context.t(s.kind == DocKind.drama ? 'editor.page.labelsEnDrama' : 'editor.page.labelsEn'), st['headingLabels'] == 'en', () => s.updateSettings({'headingLabels': 'en'})),
              if (s.kind == DocKind.screenplay) option(context.t('editor.page.labelsLegacy'), st['headingLabels'] == null, () => s.updateSettings({'headingLabels': null})),
            ]),
          ),
        if (verse) ...[
          _section(
            context,
            context.t('editor.page.verseAlign'),
            c.tintTangerine,
            Wrap(spacing: 8, runSpacing: 8, children: [
              option(context.t('editor.page.verseStart'), st['verseAlign'] != 'center', () => s.updateSettings({'verseAlign': null})),
              option(context.t('editor.page.verseCenter'), st['verseAlign'] == 'center', () => s.updateSettings({'verseAlign': 'center'})),
            ]),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: st['showMetre'] == true,
            onChanged: (v) => s.updateSettings({'showMetre': v}),
            title: Text(context.t('app.tools.metre')),
            subtitle: Text(context.t('app.page.metreHint')),
          ),
        ],
      ],
    );
  }
}

// ── Pages: the work as printed ──

Future<void> showPagesPreview(BuildContext context, EditorSession s) {
  FocusScope.of(context).unfocus();
  return Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (context) => Scaffold(
      appBar: AppBar(title: Text(context.t('editor.pages.tile'))),
      body: PdfPreview(
        canChangeOrientation: false,
        canDebug: false,
        allowSharing: false,
        allowPrinting: true,
        pdfFileName: '${s.title}.pdf',
        // ignore: deprecated_member_use
        build: (format) => Printing.convertHtml(format: format, html: docToHtml(s.document, title: s.title, kind: s.kind, settings: s.settings)),
      ),
    ),
  ));
}

// ── Footnote ──

Future<void> showFootnoteDialog(BuildContext context, EditorSession s) async {
  final ctrl = TextEditingController();
  final text = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(context.t('editor.footnote.title')),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(controller: ctrl, autofocus: true, maxLines: 4, minLines: 2, decoration: InputDecoration(hintText: context.t('editor.footnote.placeholder'))),
        const SizedBox(height: 8),
        Text(context.t('editor.footnote.help'), style: Theme.of(context).textTheme.bodySmall),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), style: TextButton.styleFrom(foregroundColor: context.c.ink), child: Text(context.t('editor.footnote.cancel'))),
        FilledButton(onPressed: () => Navigator.pop(context, ctrl.text), child: Text(context.t('editor.footnote.insert'))),
      ],
    ),
  );
  ctrl.dispose();
  if (text != null && text.trim().isNotEmpty) s.insertFootnote(text);
  _refocus(s);
}

// ── Plays and screenplays ──

Future<void> fillCastFromStory(BuildContext context, WidgetRef ref, EditorSession s) async {
  final messenger = ScaffoldMessenger.of(context);
  final t = context.t;
  final items = await ref.read(servicesProvider).store.listStory(s.doc.id).catchError((_) => <Json>[]);
  final people = (items.where((i) => i['kind'] == 'character' && '${i['name'] ?? ''}'.trim().isNotEmpty).toList()
        ..sort((a, b) => ((a['position'] as num?) ?? 0).compareTo((b['position'] as num?) ?? 0)))
      .map((i) => (name: '${i['name']}', role: i['summary'] as String?))
      .toList();
  final added = s.fillCastList(people);
  messenger.showSnackBar(SnackBar(
    content: Text(added > 0 ? t('editor.drama.fillCastDone', {'count': added}) : people.isEmpty ? t('editor.drama.fillCastEmpty') : t('editor.drama.fillCastNone')),
  ));
}

const scenePlaces = ['Int./', 'Ext./', 'Int./Ext./'];
const sceneTimes = ['പകൽ', 'രാത്രി', 'രാവിലെ', 'ഉച്ച', 'വൈകുന്നേരം', 'സന്ധ്യ', 'പുലർച്ചെ'];

Future<void> showSceneSheet(BuildContext context, EditorSession s) async {
  await showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    builder: (sheet) {
      final c = sheet.c;
      Widget pick(String label, VoidCallback tap) => ActionChip(label: Text(label, style: const TextStyle(fontFamily: LitmaFonts.display)), onPressed: () {
            Navigator.pop(sheet);
            tap();
          });
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _title(sheet, sheet.t('editor.scene.tools')),
          if (!s.inScene)
            Text(sheet.t('app.scene.none'), style: TextStyle(color: c.muted))
          else ...[
            _section(sheet, 'Int. / Ext.', c.tintSky, Wrap(spacing: 8, runSpacing: 8, children: [for (final p in scenePlaces) pick(p, () => s.setScenePlace(p))])),
            _section(sheet, sheet.t('editor.scene.time'), c.tintTangerine, Wrap(spacing: 8, runSpacing: 8, children: [for (final t in sceneTimes) pick(t, () => s.setSceneTime(t))])),
            OutlinedButton.icon(
              onPressed: () {
                final messenger = ScaffoldMessenger.of(sheet);
                final t = sheet.t;
                Navigator.pop(sheet);
                final n = s.fillSceneCast();
                messenger.showSnackBar(SnackBar(content: Text(n > 0 ? t('app.scene.castDone', {'count': n}) : t('app.scene.castNone'))));
              },
              icon: const Icon(LucideIcons.users, size: 16),
              label: Text(sheet.t('editor.scene.fillCast')),
            ),
            const SizedBox(height: 4),
            Text(sheet.t('editor.scene.fillCastHint'), style: Theme.of(sheet).textTheme.bodySmall),
          ],
        ]),
      );
    },
  );
}
