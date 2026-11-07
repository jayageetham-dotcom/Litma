import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/forms.dart';
import '../../data/models.dart';
import '../../editor/document.dart';
import '../../widgets/common.dart';
import '../reader/reader_screen.dart';
import '../../core/keyboard.dart';

Color? _hex(Object? v) {
  final s = '$v'.trim();
  final m = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(s);
  return m == null ? null : Color(int.parse('FF${m[1]}', radix: 16));
}

/// A small book cover in the book's own colours (title, author, accent rule), for cards and the
/// book screen. The full cover designer with artwork is on the web for now.
class MiniCover extends StatelessWidget {
  const MiniCover({super.key, required this.book, this.width = 96});
  final Book book;
  final double width;

  @override
  Widget build(BuildContext context) {
    final cv = book.cover;
    final bg = _hex(cv['bg']) ?? const Color(0xFFEFE9DC);
    final fg = _hex(cv['fg']) ?? const Color(0xFF3D4232);
    final accent = _hex(cv['accent']) ?? const Color(0xFFA8875A);
    final h = width * 1.48;
    return Container(
      width: width,
      height: h,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(width * 0.04),
        boxShadow: [BoxShadow(color: const Color(0xFF111113).withValues(alpha: 0.18), blurRadius: width * 0.12, offset: Offset(0, width * 0.05))],
      ),
      padding: EdgeInsets.all(width * 0.09),
      child: Container(
        decoration: cv['frame'] == true ? BoxDecoration(border: Border.all(color: accent.withValues(alpha: 0.7), width: 1)) : null,
        padding: EdgeInsets.all(width * 0.06),
        child: Column(children: [
          SizedBox(height: h * 0.08),
          Text(book.title, textAlign: TextAlign.center, maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w800, fontSize: width * 0.13, color: fg, height: 1.2)),
          SizedBox(height: width * 0.05),
          Container(width: width * 0.24, height: 1.5, color: accent),
          const Spacer(),
          if (book.author?.isNotEmpty ?? false)
            Text(book.author!, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: width * 0.09, color: fg.withValues(alpha: 0.85))),
        ]),
      ),
    );
  }
}

/// One book: its details, its contents in order (covers, front pages, chapters from works), and
/// reading it whole. Changes save as you go (offline too).
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
  final _title = TextEditingController();
  final _subtitle = TextEditingController();
  final _author = TextEditingController();

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
      _title.text = b.title;
      _subtitle.text = b.subtitle ?? '';
      _author.text = b.author ?? '';
      setState(() {
        _book = b;
        _docs = {for (final d in docs) d.id: d};
      });
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
    _title.dispose();
    _subtitle.dispose();
    _author.dispose();
    super.dispose();
  }

  String _itemTitle(Json it) {
    final type = it['type'] as String? ?? 'text';
    if (type == 'document') return (it['title'] as String?)?.trim().isNotEmpty == true ? it['title'] as String : (_docs[it['documentId']]?.title ?? context.t('app.books.missing'));
    if ((type == 'text' || type == 'part') && (it['title'] as String?)?.trim().isNotEmpty == true) return it['title'] as String;
    return bookItemLabels[type]?.ml ?? type;
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
    final items = [...b.structure];
    // chapters go before the back cover
    final back = items.indexWhere((i) => i['type'] == 'back-cover');
    final at = back < 0 ? items.length : back;
    items.insertAll(at, [for (final d in picked) {'id': bookItemId(), 'type': 'document', 'documentId': d.id, 'showTitle': true, 'inToc': true}]);
    Haptics.confirm();
    _change({'structure': items});
  }

  Future<void> _read() async {
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
    if (!mounted) return;
    Navigator.of(context).push(ReaderScreen.route(title: b.title, kind: DocKind.novel, settings: settingsFor(DocKind.novel), document: EditorDocument.fromJson({'type': 'doc', 'content': blocks})));
  }

  Future<void> _delete() async {
    final ok = await confirm(context, title: context.t('books.delete.title', {'title': _book!.title}), body: context.t('books.delete.body'), action: context.t('books.delete.confirm'), danger: true);
    if (!ok) return;
    _pending = {};
    await ref.read(servicesProvider).store.deleteBook(_book!.id);
    if (mounted) Navigator.pop(context, 'deleted');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final b = _book;
    if (_error != null) {
      return Scaffold(appBar: AppBar(), body: Center(child: Text(context.t('offline.notOnDeviceTitle'), style: Theme.of(context).textTheme.titleMedium)));
    }
    if (b == null) return const Scaffold(body: Center(child: SkeletonCard()));
    final items = b.structure;
    return Scaffold(
      appBar: AppBar(
        title: Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontFamily: LitmaFonts.display)),
        actions: [
          IconButton(tooltip: context.t('app.books.read'), icon: const Icon(LucideIcons.bookOpen, size: 21), onPressed: _read),
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
      floatingActionButton: FloatingActionButton.extended(onPressed: _addChapters, icon: const Icon(LucideIcons.plus, size: 20), label: Text(context.t('app.books.addChapters'))),
      body: CustomScrollView(slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Hero(tag: 'book-${b.id}', child: MiniCover(book: b, width: 104)),
              const SizedBox(width: 18),
              Expanded(
                child: Column(children: [
                  TextField(onTapOutside: dismissKeyboard, controller: _title, decoration: InputDecoration(labelText: context.t('app.books.title'), isDense: true), onChanged: (v) => _change({'title': v.trim().isEmpty ? 'പുതിയ പുസ്തകം' : v.trim()})),
                  const SizedBox(height: 10),
                  TextField(onTapOutside: dismissKeyboard, controller: _subtitle, decoration: InputDecoration(labelText: context.t('app.books.subtitle'), isDense: true), onChanged: (v) => _change({'subtitle': v.trim().isEmpty ? null : v.trim()})),
                  const SizedBox(height: 10),
                  TextField(onTapOutside: dismissKeyboard, controller: _author, decoration: InputDecoration(labelText: context.t('app.books.author'), isDense: true), onChanged: (v) => _change({'author': v.trim().isEmpty ? null : v.trim()})),
                ]),
              ),
            ]),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(26, 18, 20, 8),
            child: Row(children: [
              Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: c.accent)),
              const SizedBox(width: 8),
              Text(context.t('app.books.contents'), style: Theme.of(context).textTheme.labelLarge?.copyWith(color: c.muted)),
              const Spacer(),
              Text(context.t('common.chapters', {'count': b.chapters}), style: Theme.of(context).textTheme.labelSmall),
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
                    contentPadding: const EdgeInsets.only(left: 14, right: 4),
                    leading: Container(
                      width: 34,
                      height: 34,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: type == 'document' ? c.accentSoft : c.subtle, borderRadius: BorderRadius.circular(9)),
                      child: chapterNo != null
                          ? Text('$chapterNo', style: TextStyle(fontWeight: FontWeight.w700, color: c.optionSelectedInk))
                          : Icon(_itemIcon(type), size: 17, color: c.muted),
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
      ]),
    );
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
