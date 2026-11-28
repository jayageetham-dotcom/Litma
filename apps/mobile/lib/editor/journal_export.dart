import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import '../app/providers.dart';
import '../core/i18n.dart';
import '../core/motion.dart';
import '../core/theme.dart';
import '../data/analytics.dart';
import '../data/forms.dart';
import '../data/journals.dart';
import '../data/models.dart';
import 'document.dart';
import 'export.dart';
import 'pdf_fonts.dart';
import 'session.dart';

/// Where the last export format is remembered on this phone (same key as the web).
const _formatKey = 'litma:journal-export';

/// "21 ഒക്ടോ 2026": a date field's text, always with the year.
String fieldDate(DateTime d) {
  final j = journalDay(d);
  return '${j.day} ${j.month} ${(d.isUtc ? d.toLocal() : d).year}';
}

/// One file of journals, oldest first: a contents page with each journal's date line and title, then
/// each journal on a new page under its title and date. [contents] is the contents page's heading.
String journalsHtml(List<(LitmaDoc, EditorDocument)> journals, {required String contents, String fontsCss = ''}) {
  final esc = htmlText;
  final first = journals.isEmpty ? defaultSettings : journals.first.$1.settings;
  final font = (first['font'] as String?) ?? 'Gayathri';
  final size = (first['fontSize'] as num?)?.toDouble() ?? 13;
  final lh = (first['lineHeight'] as num?)?.toDouble() ?? 1.85;
  final toc = StringBuffer();
  final body = StringBuffer();
  for (final (i, (d, doc)) in journals.indexed) {
    final date = todayLine(d.createdAt);
    final face = journalFace(d.copyWith(content: doc.toJson()));
    final named = !isUntitledJournal(d.title, d.createdAt);
    toc.write('<li><span class="toc-date">${esc(date)}</span>${named ? '<span class="toc-title">${esc(d.title.trim())}</span>' : (face.title.isEmpty ? '' : '<span class="toc-title">${esc(face.title)}</span>')}</li>');
    // the journal's own title and dateline lines, unless its text already starts with them
    final lead = <TextBlock>[for (final b in doc.blocks.take(3)) if (b is TextBlock && b.type == 'styledBlock') b];
    final hasTitle = lead.any((b) => b.variant == 'title' && b.plainText.trim().isNotEmpty);
    final hasDate = lead.any((b) => b.variant == 'dateline' && b.plainText.trim() == date);
    body.write('<section class="journal" id="j${i + 1}">');
    if (named && !hasTitle) body.write('<p class="sb sb-title j-title">${esc(d.title.trim())}</p>');
    if (!hasDate) body.write('<p class="j-date">${esc(date)}</p>');
    body.write(docBodyHtml(doc, kind: DocKind.diary));
    body.write('</section>');
  }
  return '''<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>${esc(contents)}</title>
<style>
$fontsCss@page { size: A4; margin: 25mm; }
body { font-family: '$font', 'Noto Serif Malayalam', serif; font-size: ${size}pt; line-height: $lh; color: #111; text-align: start; margin: 0; }
$exportCss
h1.contents { font-size: 1.6em; margin: 0 0 1em; }
ol.toc { list-style: none; padding: 0; margin: 0; }
ol.toc li { margin: 0 0 .7em; }
.toc-date { display: block; color: #555; font-size: .9em; }
.toc-title { display: block; font-weight: 700; }
section.journal { page-break-before: always; break-before: page; }
.j-title { text-align: start; font-size: 1.6em; }
.j-date { color: #555; margin-bottom: 1.2em; }
.sb-dateline { color: #555; }
</style></head><body><h1 class="contents">${esc(contents)}</h1><ol class="toc">$toc</ol>$body</body></html>''';
}

/// The journal export sheet: This journal (from the editor) or All journals started between two
/// dates, as PDF or Word, in one file. From the desk only All journals.
Future<void> showJournalExportSheet(BuildContext context, WidgetRef ref, {List<LitmaDoc>? journals, EditorSession? current}) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: context.c.dialog,
      builder: (sheet) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(sheet).bottom),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * 0.9),
          child: JournalExportSheet(journals: journals, current: current),
        ),
      ),
    );

class JournalExportSheet extends ConsumerStatefulWidget {
  const JournalExportSheet({super.key, this.journals, this.current, this.today});
  final List<LitmaDoc>? journals;
  final EditorSession? current;

  /// For tests and screenshots: today's date.
  final DateTime? today;

  @override
  ConsumerState<JournalExportSheet> createState() => _JournalExportSheetState();
}

class _JournalExportSheetState extends ConsumerState<JournalExportSheet> {
  List<LitmaDoc>? _list;
  late bool _all = widget.current == null;
  late DateTime _from;
  late DateTime _to;
  bool _pdf = true;
  bool _busy = false;
  bool _error = false;
  int _done = 0;
  int _total = 0;
  int _missing = 0;
  bool _closed = false;

  DateTime get _today => widget.today ?? DateTime.now();

  @override
  void initState() {
    super.initState();
    _pdf = ref.read(servicesProvider).prefs.getString(_formatKey) != 'word';
    _to = _today;
    _from = _today;
    final given = widget.journals;
    if (given != null && given.isNotEmpty) {
      _setList(given);
    } else {
      unawaited(ref.read(servicesProvider).store.listDocs().then((l) {
        if (mounted) setState(() => _setList(l));
      }, onError: (_) {
        if (mounted) setState(() => _setList(const []));
      }));
    }
  }

  @override
  void dispose() {
    _closed = true; // a running export stops at the next journal
    super.dispose();
  }

  void _setList(List<LitmaDoc> all) {
    final cur = widget.current?.doc;
    final list = journalOrder([...all, if (cur != null && !all.any((d) => d.id == cur.id)) cur]);
    _list = list;
    if (list.isNotEmpty) _from = list.first.createdAt;
    unawaited(_checkDevice());
  }

  List<LitmaDoc> get _picked {
    final cur = widget.current?.doc;
    if (!_all && cur != null) return [cur];
    return journalsBetween(_list ?? const [], _from, _to);
  }

  /// Offline: how many journals in the range have no text on this phone.
  Future<void> _checkDevice() async {
    final offline = ref.read(servicesProvider).offline;
    if (!offline.offline || !_all) {
      if (_missing != 0 && mounted) setState(() => _missing = 0);
      return;
    }
    var n = 0;
    for (final d in _picked) {
      if (d.id == widget.current?.doc.id) continue;
      final kept = await offline.get('documents', d.id);
      if ((kept?['content'] as Map?)?['type'] == null) n++;
    }
    if (mounted) setState(() => _missing = n);
  }

  Future<void> _pickDate(bool from) async {
    final now = _today;
    final picked = await showDatePicker(
      context: context,
      initialDate: from ? _from : _to,
      firstDate: DateTime(2000),
      lastDate: DateTime(now.year + 1, 12, 31),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (from) {
        _from = picked;
      } else {
        _to = picked;
      }
    });
    unawaited(_checkDevice());
  }

  Future<void> _export() async {
    final services = ref.read(servicesProvider);
    final picked = _picked;
    if (picked.isEmpty) return;
    final contents = context.t('journals.exportDialog.contents');
    final cur = widget.current;
    setState(() {
      _busy = true;
      _error = false;
      _done = 0;
      _total = picked.length;
    });
    unawaited(services.prefs.setString(_formatKey, _pdf ? 'pdf' : 'word'));
    try {
      final docs = <(LitmaDoc, EditorDocument)>[];
      for (final d in picked) {
        if (_closed) return;
        if (cur != null && d.id == cur.doc.id) {
          await cur.saver.flush();
          docs.add((cur.doc, cur.document));
        } else {
          LitmaDoc? full;
          try {
            full = await services.store.getDoc(d.id);
          } catch (_) {
            // not on this phone while offline: the file holds the ones that are here
            if (!services.offline.offline) rethrow;
          }
          if (full != null) docs.add((full, EditorDocument.fromJson(full.content)));
        }
        if (mounted) setState(() => _done++);
      }
      if (docs.isEmpty || _closed) throw StateError('nothing to export');
      Analytics.track('export', {'format': _pdf ? 'pdf' : 'doc', 'kind': DocKind.diary.name});
      final fonts = _pdf ? await fontFaceCss({for (final (d, _) in docs) d.settings['font'] as String?}) : '';
      final html = journalsHtml(docs, contents: contents, fontsCss: fonts);
      final name = docs.length == 1 ? (isUntitledJournal(docs.first.$1.title, docs.first.$1.createdAt) ? todayLine(docs.first.$1.createdAt) : docs.first.$1.title) : '${journalTitle(docs.first.$1.createdAt)} – ${journalTitle(docs.last.$1.createdAt)}';
      final safe = name.replaceAll(RegExp(r'[\\/:*?"<>|]'), ' ').trim();
      if (_pdf) {
        // the phone's own web engine lays out the HTML, so Malayalam shapes correctly (as for works)
        // ignore: deprecated_member_use
        await Printing.layoutPdf(name: safe, onLayout: (f) => Printing.convertHtml(format: f, html: html));
      } else {
        final dir = await getTemporaryDirectory();
        final file = File('${dir.path}/$safe.doc');
        await file.writeAsString(html, encoding: utf8);
        await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], subject: name));
      }
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) setState(() => _error = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final narrow = MediaQuery.sizeOf(context).width < 360;
    final list = _list;
    final picked = _picked;
    final none = _all && list != null && picked.isEmpty;
    final cur = widget.current;
    final text = Theme.of(context).textTheme;
    final hint = text.bodySmall?.copyWith(color: c.muted, fontSize: 13);

    Widget dateField(bool from) {
      final label = Text(context.t(from ? 'journals.exportDialog.from' : 'journals.exportDialog.to'), style: hint);
      final field = Semantics(
        button: true,
        label: '${context.t(from ? 'journals.exportDialog.from' : 'journals.exportDialog.to')}, ${todayLine(from ? _from : _to)}',
        excludeSemantics: true,
        child: InkWell(
          onTap: _busy ? null : () => _pickDate(from),
          borderRadius: BorderRadius.circular(10),
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            alignment: Alignment.centerLeft,
            decoration: BoxDecoration(color: c.dialog, borderRadius: BorderRadius.circular(10), border: Border.all(color: c.lineStrong)),
            child: Text(fieldDate(from ? _from : _to), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: 16, color: c.ink)),
          ),
        ),
      );
      if (narrow) {
        return Row(children: [SizedBox(width: 52, child: label), Expanded(child: field)]);
      }
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [label, const SizedBox(height: 6), field]);
    }

    final count = list == null
        ? const SizedBox.shrink()
        : none
            ? Text(context.t('journals.exportDialog.none'), style: hint?.copyWith(color: c.danger, fontWeight: FontWeight.w600))
            : Text(context.t('journals.exportDialog.inRange', {'count': picked.length}), style: hint);

    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // header: the brand dot, the title and Close
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 8, 8),
        child: Row(children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(shape: BoxShape.circle, color: c.brandMark)),
          const SizedBox(width: 10),
          Expanded(child: Semantics(header: true, child: Text(context.t('journals.exportDialog.title'), style: TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: 15, fontWeight: FontWeight.w600, color: c.ink)))),
          IconButton(
            tooltip: context.t('common.close'),
            constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
            onPressed: () => Navigator.of(context).pop(),
            icon: Icon(LucideIcons.x, size: 20, color: c.ink),
          ),
        ]),
      ),
      Divider(height: 1, color: c.line),
      Flexible(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          children: [
            if (cur != null) ...[
              _Section(tint: c.tintViolet, title: context.t('journals.exportDialog.which')),
              _Switcher(
                labels: [context.t('journals.exportDialog.this'), context.t('journals.exportDialog.all')],
                selected: _all ? 1 : 0,
                onChanged: _busy
                    ? null
                    : (i) {
                        setState(() => _all = i == 1);
                        unawaited(_checkDevice());
                      },
              ),
              const SizedBox(height: 8),
              Text(_all ? context.t('journals.exportDialog.allHint') : '${shortDate(cur.doc.createdAt, _today)} · ${isUntitledJournal(cur.title, cur.doc.createdAt) ? todayLine(cur.doc.createdAt) : cur.title}', maxLines: 2, overflow: TextOverflow.ellipsis, style: hint),
              const SizedBox(height: 20),
            ],
            AnimatedSize(
              duration: Motion.of(context, Motion.medium),
              curve: Motion.emphasized,
              alignment: Alignment.topCenter,
              child: !_all
                  ? const SizedBox(width: double.infinity)
                  : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      _Section(tint: c.tintSky, title: context.t('journals.exportDialog.dates'), aside: cur == null ? context.t('journals.exportDialog.allHint') : null),
                      if (narrow) ...[dateField(true), const SizedBox(height: 10), dateField(false)] else Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: dateField(true)), const SizedBox(width: 12), Expanded(child: dateField(false))]),
                      const SizedBox(height: 8),
                      // a fixed-height line, so nothing jumps when the count changes
                      Semantics(liveRegion: true, child: ConstrainedBox(constraints: const BoxConstraints(minHeight: 20), child: count)),
                      if (_missing > 0) ...[
                        const SizedBox(height: 10),
                        _Notice(icon: LucideIcons.cloudOff, color: c.highlight, background: c.highlightSoft, text: context.t('journals.exportDialog.notOnDevice', {'count': _missing})),
                      ],
                      const SizedBox(height: 20),
                    ]),
            ),
            _Section(tint: c.tintCoral, title: context.t('journals.exportDialog.format')),
            _Switcher(
              labels: const ['PDF', 'Word'],
              selected: _pdf ? 0 : 1,
              onChanged: _busy ? null : (i) => setState(() => _pdf = i == 0),
            ),
            const SizedBox(height: 8),
            Text(context.t(_pdf ? 'journals.exportDialog.pdfHint' : 'journals.exportDialog.wordHint'), style: hint),
            const SizedBox(height: 20),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons.lock, size: 16, color: c.muted)),
              const SizedBox(width: 10),
              Expanded(child: Text(context.t('journals.exportDialog.private'), style: hint)),
            ]),
            if (_busy) ...[
              const SizedBox(height: 18),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(minHeight: 6, value: _total == 0 ? null : _done / _total, color: c.accent, backgroundColor: c.subtle),
              ),
            ],
            Semantics(
              liveRegion: true,
              child: Padding(
                padding: EdgeInsets.only(top: _busy ? 8 : 0),
                child: _busy ? Text(context.t('journals.exportDialog.working', {'n': _done, 'total': _total}), style: hint) : const SizedBox.shrink(),
              ),
            ),
            if (_error) ...[
              const SizedBox(height: 14),
              _Notice(icon: LucideIcons.circleAlert, color: c.danger, background: c.dangerSoft, text: context.t('journals.exportDialog.error')),
            ],
          ],
        ),
      ),
      // the Export button stays at the bottom, above a hairline, so it is always in reach
      Divider(height: 1, color: c.line),
      SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
          child: SizedBox(
            height: 50,
            child: FilledButton.icon(
              onPressed: _busy || list == null || picked.isEmpty ? null : _export,
              icon: _busy ? SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2, color: c.disabledInk)) : const Icon(LucideIcons.download, size: 18),
              label: Text(context.t(_error ? 'common.retry' : 'journals.exportDialog.button')),
            ),
          ),
        ),
      ),
    ]);
  }
}

/// A section heading with its tint dot (as in the AI companion), and an optional hint beside it.
class _Section extends StatelessWidget {
  const _Section({required this.tint, required this.title, this.aside});
  final Color tint;
  final String title;
  final String? aside;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Container(width: 7, height: 7, decoration: BoxDecoration(shape: BoxShape.circle, color: tint)),
        const SizedBox(width: 10),
        Semantics(header: true, child: Text(title, style: TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: 14, fontWeight: FontWeight.w600, color: c.ink))),
        if (aside != null) ...[
          const SizedBox(width: 10),
          Expanded(child: Text(aside!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: c.muted))),
        ],
      ]),
    );
  }
}

/// Two choices side by side on a well that stays visible on dark sheets (`--dialog-well`).
class _Switcher extends StatelessWidget {
  const _Switcher({required this.labels, required this.selected, required this.onChanged});
  final List<String> labels;
  final int selected;
  final ValueChanged<int>? onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      height: 48,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(color: c.dialogWell, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        for (final (i, l) in labels.indexed)
          Expanded(
            child: Semantics(
              button: true,
              selected: i == selected,
              inMutuallyExclusiveGroup: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onChanged == null || i == selected
                    ? null
                    : () {
                        HapticFeedback.selectionClick();
                        onChanged!(i);
                      },
                child: AnimatedContainer(
                  duration: Motion.of(context, Motion.fast),
                  margin: const EdgeInsets.all(2),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: i == selected ? c.dialog : c.dialogWell.withValues(alpha: 0),
                    borderRadius: BorderRadius.circular(9),
                    boxShadow: i == selected ? const [BoxShadow(color: Color(0x14111113), blurRadius: 6, offset: Offset(0, 1))] : const [],
                  ),
                  child: Text(l,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: 15, fontWeight: FontWeight.w600, color: i == selected ? c.ink : c.muted)),
                ),
              ),
            ),
          ),
      ]),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.color, required this.background, required this.text});
  final IconData icon;
  final Color color;
  final Color background;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(10)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: color, fontWeight: FontWeight.w600, height: 1.4))),
        ]),
      );
}
