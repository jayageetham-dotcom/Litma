import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:printing/printing.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/keyboard.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/forms.dart';
import '../../data/models.dart';
import '../../editor/document.dart';
import '../../widgets/common.dart';
import '../../widgets/script_field.dart';
import '../reader/reader_screen.dart';
import 'book_export.dart';
import 'cover.dart';
import 'cover_designer.dart';

/// A book's front cover as a small card (desk and book screen), drawn like the real cover.
class MiniCover extends StatelessWidget {
  const MiniCover({super.key, required this.book, this.width = 96});
  final Book book;
  final double width;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(width * 0.035),
          boxShadow: [BoxShadow(color: const Color(0xFF111113).withValues(alpha: 0.18), blurRadius: width * 0.12, offset: Offset(0, width * 0.05))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(width * 0.035),
          child: IgnorePointer(child: CoverView(title: book.title, subtitle: book.subtitle, author: book.author, cover: book.cover, settings: book.settings, width: width)),
        ),
      );
}

/// Pages the writer can add besides chapters (the web's "Add page").
const _addablePages = ['dedication', 'epigraph', 'text', 'part'];

/// One book: its cover, contents in order (covers, front pages, chapters from works) and details,
/// reading it whole and making PDFs. Changes save as you go (offline too).
class BookScreen extends ConsumerStatefulWidget {
  const BookScreen({super.key, required this.bookId, this.initial});
  final String bookId;
  final Book? initial;

  @override
  ConsumerState<BookScreen> createState() => _BookScreenState();
}

class _BookScreenState extends ConsumerState<BookScreen> {
  Book? _book;
  Map<String, LitmaDoc> _docs = {};
  Object? _error;
  Timer? _saveTimer;
  Json _pending = {};
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final store = ref.read(servicesProvider).store;
    try {
      final b = widget.initial ?? await store.getBook(widget.bookId);
      if (b == null) throw StateError('missing');
      final docs = await store.listDocs().catchError((_) => <LitmaDoc>[]);
      if (!mounted) return;
      setState(() {
        _book = b;
        _docs = {for (final d in docs) d.id: d};
      });
      // fields never set get real sample text to edit (a cleared field stays empty), as on the web
      final samples = bookSamples(b.row);
      if (samples != null) _change(samples);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  /// Change the book now on screen, save it shortly after (several quick edits become one save).
  void _change(Json patch) {
    setState(() => _book = Book({..._book!.row, ...patch}));
    _pending = {..._pending, ...patch};
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 700), _flush);
  }

  void _changeCover(Json patch) => _change({
        'cover': {..._book!.cover, ...patch},
      });

  void _changeSettings(Json patch) => _change({
        'settings': {..._book!.settings, ...patch},
      });

  Future<void> _flush() async {
    _saveTimer?.cancel();
    if (_pending.isEmpty || _book == null) return;
    final p = _pending;
    _pending = {};
    await ref.read(servicesProvider).store.updateBook(_book!.id, p).catchError((_) {});
  }

  @override
  void dispose() {
    unawaited(_flush());
    super.dispose();
  }

  String _itemTitle(Json it) {
    final type = it['type'] as String? ?? 'text';
    if (type == 'document') return (it['title'] as String?)?.trim().isNotEmpty == true ? it['title'] as String : (_docs[it['documentId']]?.title ?? context.t('app.books.missing'));
    if ((type == 'text' || type == 'part' || type == 'toc') && (it['title'] as String?)?.trim().isNotEmpty == true) return it['title'] as String;
    return bookItemLabels[type]?.ml ?? type;
  }

  /// New items go before the back cover.
  void _insert(List<Json> added) {
    final items = [..._book!.structure];
    final back = items.indexWhere((i) => i['type'] == 'back-cover');
    items.insertAll(back < 0 ? items.length : back, added);
    Haptics.confirm();
    _change({'structure': items});
  }

  Future<void> _addChapters() async {
    final b = _book!;
    final used = {for (final i in b.structure) if (i['type'] == 'document') i['documentId']};
    final picked = await showModalBottomSheet<List<LitmaDoc>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _PickWorks(docs: _docs.values.where((d) => !d.pristine).toList(), used: used.cast<String>().toSet()),
    );
    if (picked == null || picked.isEmpty) return;
    _insert([for (final d in picked) {'id': bookItemId(), 'type': 'document', 'documentId': d.id, 'showTitle': true, 'inToc': true}]);
  }

  void _addPage(String type) {
    final it = <String, dynamic>{'id': bookItemId(), 'type': type, if (type == 'text' || type == 'part') 'title': '', if (type == 'text') 'inToc': true};
    _insert([it]);
    _editItem(it);
  }

  /// The whole book as one document, for the reader.
  Future<List<Json>> _bookBlocks() async {
    final b = _book!;
    final store = ref.read(servicesProvider).store;
    final blocks = <Json>[
      {'type': 'styledBlock', 'attrs': {'variant': 'title'}, 'content': [{'type': 'text', 'text': b.title}]},
      if (b.subtitle?.isNotEmpty ?? false) {'type': 'styledBlock', 'attrs': {'variant': 'subtitle'}, 'content': [{'type': 'text', 'text': b.subtitle}]},
      if (b.author?.isNotEmpty ?? false) {'type': 'styledBlock', 'attrs': {'variant': 'author'}, 'content': [{'type': 'text', 'text': b.author}]},
    ];
    for (final it in b.structure) {
      if (it['type'] == 'document') {
        final d = await store.getDoc(it['documentId'] as String).catchError((_) => null);
        if (d == null) continue;
        blocks.add({'type': 'pageBreak'});
        if (it['showTitle'] != false) blocks.add({'type': 'styledBlock', 'attrs': {'variant': 'chapter'}, 'content': [{'type': 'text', 'text': _itemTitle(it)}]});
        // the work's own title and author lines are left out: the chapter heading stands for them
        blocks.addAll(((d.content['content'] as List?) ?? const []).cast<Map>().map((m) => m.cast<String, dynamic>()).where((n) => !(n['type'] == 'styledBlock' && const ['title', 'author', 'byline'].contains((n['attrs'] as Map?)?['variant']))));
      } else if (it['content'] is Map) {
        blocks.add({'type': 'pageBreak'});
        blocks.addAll((((it['content'] as Map)['content'] as List?) ?? const []).cast<Map>().map((m) => m.cast<String, dynamic>()));
      }
    }
    return blocks;
  }

  Future<void> _read() async {
    final blocks = await _bookBlocks();
    if (!mounted) return;
    Navigator.of(context).push(ReaderScreen.route(title: _book!.title, kind: DocKind.novel, settings: settingsFor(DocKind.novel), document: EditorDocument.fromJson({'type': 'doc', 'content': blocks})));
  }

  Future<void> _export() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 4), child: Text(sheet.t('app.books.export'), style: Theme.of(sheet).textTheme.titleMedium)),
          Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text(sheet.t('app.books.exportHint'), style: Theme.of(sheet).textTheme.bodySmall)),
          ListTile(leading: const Icon(LucideIcons.bookOpenText), title: Text(sheet.t('app.books.exportBook')), onTap: () => Navigator.pop(sheet, 'pages')),
          ListTile(leading: const Icon(LucideIcons.bookImage), title: Text(sheet.t('app.books.exportCover')), onTap: () => Navigator.pop(sheet, 'cover')),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (choice == null || !mounted) return;
    await _flush();
    final b = _book!;
    if (choice == 'cover') {
      final bytes = await buildCoverPdf(context, b);
      if (bytes == null || !mounted) return;
      await showBookPdf(context, title: '${b.title} · ${context.t('app.books.exportCover')}', format: bookPageFormat(b.settings, margins: false), build: () => bytes);
      return;
    }
    final store = ref.read(servicesProvider).store;
    final docs = <String, LitmaDoc>{};
    for (final it in b.structure) {
      final id = it['documentId'];
      if (it['type'] == 'document' && id is String) {
        final d = await store.getDoc(id).catchError((_) => null);
        if (d != null) docs[id] = d;
      }
    }
    if (!mounted) return;
    final format = bookPageFormat(b.settings);
    final html = await bookInteriorHtml(b, docs);
    if (!mounted) return;
    // the phone's own web engine lays out the HTML, so Malayalam conjuncts shape correctly
    // ignore: deprecated_member_use
    await showBookPdf(context, title: b.title, format: format, build: () => Printing.convertHtml(format: format, html: html));
  }

  Future<void> _delete() async {
    final ok = await confirm(context, title: context.t('books.delete.title', {'title': _book!.title}), body: context.t('books.delete.body'), action: context.t('books.delete.confirm'), danger: true);
    if (!ok) return;
    _pending = {};
    await ref.read(servicesProvider).store.deleteBook(_book!.id);
    if (mounted) Navigator.pop(context, 'deleted');
  }

  void _designCover({bool back = false}) {
    Navigator.of(context).push(CoverDesignerScreen.route(book: _book!, onCover: _changeCover, back: back));
  }

  // ── a page of the book ──

  Future<void> _editItem(Json it) async {
    final type = it['type'] as String? ?? 'text';
    if (type == 'cover' || type == 'back-cover') {
      _designCover(back: type == 'back-cover');
      return;
    }
    final updated = await showModalBottomSheet<Json>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ItemSheet(item: it, docTitle: type == 'document' ? _docs[it['documentId']]?.title : null),
    );
    if (updated == null || !mounted) return;
    _change({
      'structure': [for (final x in _book!.structure) x['id'] == it['id'] ? updated : x],
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final b = _book;
    if (_error != null) {
      return Scaffold(appBar: AppBar(), body: Center(child: Text(context.t('offline.notOnDeviceTitle'), style: Theme.of(context).textTheme.titleMedium)));
    }
    if (b == null) return const Scaffold(body: Center(child: SkeletonCard()));
    return Scaffold(
      appBar: AppBar(
        title: Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontFamily: LitmaFonts.display)),
        actions: [
          IconButton(tooltip: context.t('app.books.read'), icon: const Icon(LucideIcons.bookOpen, size: 21), onPressed: _read),
          IconButton(tooltip: context.t('app.books.export'), icon: const Icon(LucideIcons.fileDown, size: 21), onPressed: _export),
          PopupMenuButton<String>(
            icon: const Icon(LucideIcons.ellipsisVertical, size: 21),
            position: PopupMenuPosition.under,
            onSelected: (v) => v == 'delete' ? _delete() : null,
            itemBuilder: (context) => [
              PopupMenuItem(value: 'delete', child: Row(children: [Icon(LucideIcons.trash2, size: 18, color: c.danger), const SizedBox(width: 12), Text(context.t('books.delete.confirm'), style: TextStyle(color: c.danger))])),
            ],
          ),
        ],
      ),
      floatingActionButton: _tab == 0 ? FloatingActionButton.extended(onPressed: _addChapters, icon: const Icon(LucideIcons.plus, size: 20), label: Text(context.t('app.books.addChapters'))) : null,
      body: CustomScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Pressable(semanticLabel: context.t('cover.design'), onTap: _designCover, child: Hero(tag: 'book-${b.id}', child: MiniCover(book: b, width: 108))),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(b.title, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700, fontSize: 20, height: 1.25)),
                    if (b.author?.isNotEmpty ?? false) Padding(padding: const EdgeInsets.only(top: 4), child: Text(b.author!, style: TextStyle(fontFamily: LitmaFonts.display, color: c.muted))),
                    const SizedBox(height: 4),
                    Text(context.t('common.chapters', {'count': b.chapters}), style: Theme.of(context).textTheme.labelSmall),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(onPressed: _designCover, icon: const Icon(LucideIcons.palette, size: 17), label: Text(context.t('cover.design'))),
                  ]),
                ),
              ]),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
              child: SegmentTabs(labels: [context.t('app.books.contents'), context.t('bookDetails.heading')], index: _tab, onChanged: (i) => setState(() => _tab = i)),
            ),
          ),
          if (_tab == 0) ..._contents(context, b) else SliverToBoxAdapter(child: _Details(book: b, onChange: _change, onSettings: _changeSettings)),
        ],
      ),
    );
  }

  List<Widget> _contents(BuildContext context, Book b) {
    final c = context.c;
    final items = b.structure;
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(26, 0, 8, 4),
          child: Row(children: [
            Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: c.accent)),
            const SizedBox(width: 8),
            Expanded(child: Text(context.t('app.books.contents'), style: Theme.of(context).textTheme.labelLarge?.copyWith(color: c.muted))),
            PopupMenuButton<String>(
              tooltip: context.t('app.books.add'),
              position: PopupMenuPosition.under,
              onSelected: _addPage,
              itemBuilder: (context) => [for (final t in _addablePages) PopupMenuItem(value: t, child: Text('${bookItemLabels[t]!.ml} · ${bookItemLabels[t]!.en}'))],
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(LucideIcons.plus, size: 16, color: c.accent),
                  const SizedBox(width: 4),
                  Text(context.t('app.books.add'), style: TextStyle(color: c.accent, fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
          ]),
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
        sliver: SliverReorderableList(
          itemCount: items.length,
          onReorderItem: (from, to) {
            final list = [...items];
            final it = list.removeAt(from);
            list.insert(to, it);
            Haptics.soft();
            _change({'structure': list});
          },
          proxyDecorator: (child, i, a) => AnimatedBuilder(
            animation: a,
            builder: (context, child) => Transform.scale(scale: 1 + 0.03 * Curves.easeOut.transform(a.value), child: Material(elevation: 8 * a.value, borderRadius: BorderRadius.circular(12), color: Colors.transparent, child: child)),
            child: child,
          ),
          itemBuilder: (context, i) {
            final it = items[i];
            final type = it['type'] as String? ?? 'text';
            final doc = type == 'document' ? _docs[it['documentId']] : null;
            final chapterNo = type == 'document' ? items.take(i + 1).where((x) => x['type'] == 'document').length : null;
            return Dismissible(
              key: ValueKey('item-${it['id']}'),
              direction: DismissDirection.endToStart,
              background: Container(
                alignment: Alignment.centerRight,
                padding: const EdgeInsets.only(right: 22),
                margin: const EdgeInsets.only(bottom: 6),
                decoration: BoxDecoration(color: c.dangerSoft, borderRadius: BorderRadius.circular(12)),
                child: Icon(LucideIcons.trash2, color: c.danger),
              ),
              onDismissed: (_) {
                final list = [...items]..removeAt(i);
                _change({'structure': list});
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text(context.t('app.books.removed')),
                  action: SnackBarAction(label: context.t('app.desk.undo'), onPressed: () => _change({'structure': items})),
                ));
              },
              child: Container(
                margin: const EdgeInsets.only(bottom: 6),
                decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: c.line)),
                child: ListTile(
                  onTap: () => _editItem(it),
                  contentPadding: const EdgeInsets.only(left: 14, right: 4),
                  leading: type == 'cover' || type == 'back-cover'
                      ? SizedBox(width: 34, child: Center(child: ClipRRect(borderRadius: BorderRadius.circular(3), child: IgnorePointer(child: CoverView(title: b.title, subtitle: b.subtitle, author: b.author, cover: b.cover, settings: b.settings, back: type == 'back-cover', width: 26)))))
                      : Container(
                          width: 34,
                          height: 34,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: type == 'document' ? c.accentSoft : c.subtle, borderRadius: BorderRadius.circular(9)),
                          child: chapterNo != null ? Text('$chapterNo', style: TextStyle(fontWeight: FontWeight.w700, color: c.optionSelectedInk)) : Icon(_itemIcon(type), size: 17, color: c.muted),
                        ),
                  title: Text(_itemTitle(it), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w600)),
                  subtitle: Text(doc != null ? '${kindNames[doc.kind]!.ml} · ${context.t('common.words', {'count': doc.wordCount})}' : (bookItemLabels[type]?.en ?? type)),
                  trailing: ReorderableDragStartListener(index: i, child: Padding(padding: const EdgeInsets.all(12), child: Icon(LucideIcons.gripVertical, size: 20, color: c.muted))),
                ),
              ),
            );
          },
        ),
      ),
    ];
  }

  IconData _itemIcon(String type) => switch (type) {
        'cover' || 'back-cover' => LucideIcons.bookImage,
        'toc' => LucideIcons.listOrdered,
        'copyright' => LucideIcons.copyright,
        'dedication' => LucideIcons.heart,
        'epigraph' => LucideIcons.quote,
        'part' => LucideIcons.bookmark,
        _ => LucideIcons.fileText,
      };
}

// ── Book details and Page & type (the web's right-hand panel) ──

class _Details extends StatelessWidget {
  const _Details({required this.book, required this.onChange, required this.onSettings});
  final Book book;
  final void Function(Json) onChange;
  final void Function(Json) onSettings;

  static const _fonts = ['Noto Serif Malayalam', 'Noto Sans Malayalam', 'Manjari', 'Gayathri', 'Anek Malayalam'];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final st = book.settings;
    final size = ((st['fontSize'] as num?) ?? 12).toDouble();
    final lh = ((st['lineHeight'] as num?) ?? 1.8).toDouble();
    final page = (st['pageSize'] as String?) ?? 'A4';
    final font = (st['font'] as String?) ?? _fonts.first;
    final margins = {'top': 22, 'bottom': 24, 'inner': 24, 'outer': 20, ...?((st['margins'] as Map?)?.cast<String, dynamic>())};
    // 12 → "12", 1.80 → "1.8", 10 stays "10"
    String one(double v) => v.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');

    Widget section(String label, Color tint, List<Widget> children) => Padding(
          padding: const EdgeInsets.only(bottom: 22),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(width: 7, height: 7, decoration: BoxDecoration(color: tint, shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text(label, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: c.muted)),
            ]),
            const SizedBox(height: 12),
            ...children,
          ]),
        );

    Widget option(String label, bool on, VoidCallback tap, {String? fontFamily}) => Pressable(
          onTap: tap,
          semanticLabel: label,
          child: AnimatedContainer(
            duration: Motion.of(context, Motion.fast),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(color: on ? c.optionSelected : c.surface, borderRadius: BorderRadius.circular(10), border: Border.all(color: on ? c.accent.withValues(alpha: 0.4) : c.line)),
            child: Text(label, style: TextStyle(fontFamily: fontFamily, fontSize: 14, fontWeight: FontWeight.w600, color: on ? c.optionSelectedInk : c.ink)),
          ),
        );

    Widget stepper(String label, String value, VoidCallback? down, VoidCallback? up) => Row(children: [
          Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          IconButton.outlined(onPressed: down, icon: const Icon(LucideIcons.minus, size: 17)),
          SizedBox(width: 56, child: Center(child: Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)))),
          IconButton.outlined(onPressed: up, icon: const Icon(LucideIcons.plus, size: 17)),
        ]);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 48),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        section(context.t('bookDetails.heading'), c.tintViolet, [
          ScriptField(label: context.t('bookDetails.title'), storageKey: 'book.title', value: book.title, onChanged: (v) => onChange({'title': v.trim().isEmpty ? 'പുതിയ പുസ്തകം' : v})),
          const SizedBox(height: 12),
          ScriptField(label: context.t('bookDetails.subtitle'), storageKey: 'book.subtitle', value: book.subtitle ?? '', onChanged: (v) => onChange({'subtitle': v})),
          const SizedBox(height: 12),
          ScriptField(label: context.t('bookDetails.author'), storageKey: 'book.author', plainByDefault: true, value: book.author ?? '', onChanged: (v) => onChange({'author': v})),
          const SizedBox(height: 12),
          _TextSetting(label: context.t('bookDetails.publisher'), value: (st['publisher'] as String?) ?? '', hint: defaultPublisher, onChanged: (v) => onSettings({'publisher': v})),
          Row(children: [
            Expanded(child: _TextSetting(label: context.t('bookDetails.year'), value: (st['year'] as String?) ?? '', number: true, onChanged: (v) => onSettings({'year': v}))),
            const SizedBox(width: 12),
            Expanded(child: _TextSetting(label: context.t('bookDetails.edition'), value: (st['edition'] as String?) ?? '', onChanged: (v) => onSettings({'edition': v}))),
          ]),
          _TextSetting(label: context.t('bookDetails.isbn'), value: (st['isbn'] as String?) ?? '', onChanged: (v) => onSettings({'isbn': v})),
        ]),
        section(context.t('bookDetails.pageType'), c.tintSky, [
          Text(context.t('bookDetails.pageSize'), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [for (final p in const ['A4', 'A5', 'Letter']) option(context.t('bookDetails.pageSizes.$p'), p == page, () => onSettings({'pageSize': p}))]),
          const SizedBox(height: 16),
          Text(context.t('bookDetails.bodyFont'), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [for (final f in _fonts) option(f, f == font, () => onSettings({'font': f}), fontFamily: LitmaFonts.document(f))]),
          const SizedBox(height: 14),
          stepper(context.t('bookDetails.fontSize'), one(size), size > 8 ? () => onSettings({'fontSize': size - 0.5}) : null, size < 20 ? () => onSettings({'fontSize': size + 0.5}) : null),
          const SizedBox(height: 6),
          stepper(
            context.t('bookDetails.lineHeight'),
            one(lh),
            lh > 1.2 ? () => onSettings({'lineHeight': double.parse((lh - 0.05).toStringAsFixed(2))}) : null,
            lh < 2.6 ? () => onSettings({'lineHeight': double.parse((lh + 0.05).toStringAsFixed(2))}) : null,
          ),
          const SizedBox(height: 16),
          Text(context.t('bookDetails.margins'), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted)),
          const SizedBox(height: 8),
          Row(children: [
            for (final k in const ['top', 'bottom', 'inner', 'outer']) ...[
              Expanded(
                child: _TextSetting(
                  label: context.t('bookDetails.margin.$k'),
                  value: '${margins[k]}',
                  number: true,
                  onChanged: (v) {
                    final n = int.tryParse(v.trim());
                    if (n != null) onSettings({'margins': {...margins, k: n < 5 ? 5 : n}});
                  },
                ),
              ),
              if (k != 'outer') const SizedBox(width: 8),
            ],
          ]),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: st['chaptersOnRight'] == true,
            onChanged: (v) => onSettings({'chaptersOnRight': v}),
            title: Text(context.t('bookDetails.chaptersOnRight')),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: st['runningHead'] != false,
            onChanged: (v) => onSettings({'runningHead': v}),
            title: Text(context.t('bookDetails.runningHead')),
          ),
          const SizedBox(height: 4),
          Text(context.t('bookDetails.phonePrint'), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted)),
        ]),
      ]),
    );
  }
}

/// A plain text setting that keeps its own controller (so typing never jumps the caret).
class _TextSetting extends StatefulWidget {
  const _TextSetting({required this.label, required this.value, required this.onChanged, this.hint, this.number = false});
  final String label;
  final String value;
  final String? hint;
  final bool number;
  final ValueChanged<String> onChanged;

  @override
  State<_TextSetting> createState() => _TextSettingState();
}

class _TextSettingState extends State<_TextSetting> {
  late final _text = TextEditingController(text: widget.value);
  final _focus = FocusNode();

  @override
  void didUpdateWidget(_TextSetting old) {
    super.didUpdateWidget(old);
    if (!_focus.hasFocus && widget.value != _text.text) _text.text = widget.value;
  }

  @override
  void dispose() {
    _text.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: _text,
          focusNode: _focus,
          onTapOutside: dismissKeyboard,
          keyboardType: widget.number ? TextInputType.number : TextInputType.text,
          style: const TextStyle(fontFamily: LitmaFonts.sans, fontFamilyFallback: ['Inter']),
          decoration: InputDecoration(labelText: widget.label, hintText: widget.hint, isDense: true),
          onChanged: widget.onChanged,
        ),
      );
}

// ── editing one page of the book ──

/// Plain paragraphs only (text with no marks): the phone can edit these without losing anything.
bool _plainContent(Object? content) {
  if (content == null) return true;
  if (content is! Map) return false;
  for (final n in ((content['content'] as List?) ?? const []).cast<Map>()) {
    if (n['type'] != 'paragraph') return false;
    for (final i in ((n['content'] as List?) ?? const []).cast<Map>()) {
      if (i['type'] == 'hardBreak') continue;
      if (i['type'] != 'text' || ((i['marks'] as List?)?.isNotEmpty ?? false)) return false;
    }
  }
  return true;
}

String _contentText(Object? content) => content is Map
    ? ((content['content'] as List?) ?? const [])
        .cast<Map>()
        .map((p) => ((p['content'] as List?) ?? const []).cast<Map>().map((i) => i['type'] == 'hardBreak' ? '\n' : '${i['text'] ?? ''}').join())
        .join('\n')
    : '';

Json? _textContent(String text) => text.trim().isEmpty
    ? null
    : {
        'type': 'doc',
        'content': [
          for (final line in text.split('\n'))
            {
              'type': 'paragraph',
              if (line.isNotEmpty) 'content': [{'type': 'text', 'text': line}],
            },
        ],
      };

class _ItemSheet extends StatefulWidget {
  const _ItemSheet({required this.item, this.docTitle});
  final Json item;
  final String? docTitle;

  @override
  State<_ItemSheet> createState() => _ItemSheetState();
}

class _ItemSheetState extends State<_ItemSheet> {
  late final Json _it = {...widget.item};
  late final _title = TextEditingController(text: (_it['title'] as String?) ?? '');
  late final _text = TextEditingController(text: _contentText(_it['content']));
  late final bool _editable = _plainContent(_it['content']);

  String get _type => _it['type'] as String? ?? 'text';
  bool get _hasTitle => const {'document', 'text', 'part', 'toc'}.contains(_type);
  bool get _hasText => const {'text', 'dedication', 'epigraph', 'copyright'}.contains(_type);

  @override
  void dispose() {
    _title.dispose();
    _text.dispose();
    super.dispose();
  }

  void _done() {
    final out = {..._it};
    if (_hasTitle) out['title'] = _title.text.trim();
    if (_hasText && _editable) {
      final content = _textContent(_text.text);
      if (content == null) {
        out.remove('content');
      } else {
        out['content'] = content;
      }
    }
    Navigator.pop(context, out);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final label = bookItemLabels[_type];
    final note = switch (_type) {
      'half-title' || 'title' => context.t('app.books.pageAuto'),
      'toc' => context.t('app.books.contentsHint'),
      'copyright' => context.t('app.books.copyrightHint'),
      _ => null,
    };
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(label == null ? _type : '${label.ml} · ${label.en}', style: Theme.of(context).textTheme.titleMedium)),
            FilledButton(onPressed: _done, child: Text(context.t('common.save'))),
          ]),
          const SizedBox(height: 14),
          if (_hasTitle)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextField(
                controller: _title,
                onTapOutside: dismissKeyboard,
                style: const TextStyle(fontFamily: LitmaFonts.display),
                decoration: InputDecoration(labelText: context.t('app.books.pageHeading'), hintText: widget.docTitle ?? label?.ml),
              ),
            ),
          if (_type == 'document') ...[
            SwitchListTile(contentPadding: EdgeInsets.zero, value: _it['showTitle'] != false, onChanged: (v) => setState(() => _it['showTitle'] = v), title: Text(context.t('app.books.showTitle'))),
            SwitchListTile(contentPadding: EdgeInsets.zero, value: _it['inToc'] != false, onChanged: (v) => setState(() => _it['inToc'] = v), title: Text(context.t('app.books.inToc'))),
          ],
          if (_type == 'text' || _type == 'part')
            SwitchListTile(contentPadding: EdgeInsets.zero, value: _it['inToc'] != false, onChanged: (v) => setState(() => _it['inToc'] = v), title: Text(context.t('app.books.inToc'))),
          if (_hasText)
            _editable
                ? TextField(
                    controller: _text,
                    onTapOutside: dismissKeyboard,
                    minLines: 5,
                    maxLines: 14,
                    style: const TextStyle(fontFamily: LitmaFonts.serif, height: 1.6),
                    decoration: InputDecoration(labelText: context.t('app.books.pageText'), alignLabelWithHint: true, hintText: _type == 'dedication' ? 'അമ്മയ്ക്ക്…' : 'എഴുതൂ…'),
                  )
                : Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: c.subtle, borderRadius: BorderRadius.circular(12)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text(_contentText(_it['content']), maxLines: 8, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: LitmaFonts.serif, height: 1.6)),
                      const SizedBox(height: 10),
                      Text(context.t('app.books.pageRich'), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted)),
                    ]),
                  ),
          if (note != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(note, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted))),
        ]),
      ),
    );
  }
}

/// Pick works to add as chapters (works already in the book are marked).
class _PickWorks extends StatefulWidget {
  const _PickWorks({required this.docs, required this.used});
  final List<LitmaDoc> docs;
  final Set<String> used;

  @override
  State<_PickWorks> createState() => _PickWorksState();
}

class _PickWorksState extends State<_PickWorks> {
  final _picked = <String>{};

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (context, scroll) => Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 12, 8),
          child: Row(children: [
            Expanded(child: Text(context.t('app.books.addChapters'), style: Theme.of(context).textTheme.titleMedium)),
            FilledButton(
              onPressed: _picked.isEmpty ? null : () => Navigator.pop(context, widget.docs.where((d) => _picked.contains(d.id)).toList()),
              child: Text(_picked.isEmpty ? context.t('app.books.add') : '${context.t('app.books.add')} (${_picked.length})'),
            ),
          ]),
        ),
        Expanded(
          child: ListView.builder(
            controller: scroll,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
            itemCount: widget.docs.length,
            itemBuilder: (context, i) {
              final d = widget.docs[i];
              final on = _picked.contains(d.id);
              return FadeSlideIn(
                index: i,
                offset: 8,
                child: Pressable(
                  onTap: () => setState(() => on ? _picked.remove(d.id) : _picked.add(d.id)),
                  child: AnimatedContainer(
                    duration: Motion.of(context, Motion.fast),
                    margin: const EdgeInsets.only(bottom: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(color: on ? c.optionSelected : Colors.transparent, borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(d.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w600, fontSize: 16)),
                          Text(
                            '${kindNames[d.kind]!.ml} · ${context.t('common.words', {'count': d.wordCount})}${widget.used.contains(d.id) ? ' · ${context.t('app.books.inBook')}' : ''}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ]),
                      ),
                      AnimatedScale(
                        scale: on ? 1 : 0,
                        duration: Motion.of(context, Motion.medium),
                        curve: Curves.elasticOut,
                        child: Icon(LucideIcons.circleCheck, color: c.accent),
                      ),
                    ]),
                  ),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}
