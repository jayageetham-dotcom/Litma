import 'dart:async';

import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/forms.dart';
import '../../data/models.dart';
import '../../editor/document.dart';
import '../../editor/editor_screen.dart';
import '../../features/reader/reader_screen.dart';
import '../../widgets/brand.dart';
import '../../widgets/avatar.dart';
import '../../widgets/common.dart';
import '../books/book_screen.dart';
import '../profile/profile_screen.dart';
import 'type_picker.dart';
import '../../core/keyboard.dart';

enum DeskTab { works, books, trash }

/// The writer's works for one tab, kept in step with the store.
class DeskNotifier extends AsyncNotifier<List<LitmaDoc>> {
  DeskTab tab = DeskTab.works;

  @override
  Future<List<LitmaDoc>> build() async {
    ref.watch(writerProvider.select((w) => w.value?.id));
    return _load();
  }

  Future<List<LitmaDoc>> _load() async {
    final store = ref.read(servicesProvider).store;
    if (tab == DeskTab.books) return const []; // books come from booksProvider
    if (tab == DeskTab.works) await store.discardPristine().catchError((_) => 0);
    return store.listDocs(trash: tab == DeskTab.trash);
  }

  Future<void> show(DeskTab t) async {
    tab = t;
    state = const AsyncLoading<List<LitmaDoc>>();
    state = await AsyncValue.guard(_load);
  }

  Future<void> refresh() async => state = await AsyncValue.guard(_load);

  /// Take a work off the list at once (it animates away), the store catches up behind it.
  void drop(String id) => state = AsyncData([...?state.value?.where((d) => d.id != id)]);
}

final deskProvider = AsyncNotifierProvider<DeskNotifier, List<LitmaDoc>>(DeskNotifier.new);

/// The writer's books (Books tab).
final booksProvider = FutureProvider.autoDispose<List<Book>>((ref) async {
  ref.watch(writerProvider.select((w) => w.value?.id));
  return ref.read(servicesProvider).store.listBooks();
});

/// Words written today and the streak of days in a row.
final todayProvider = FutureProvider<({int today, int streak})>((ref) async {
  ref.watch(deskProvider);
  final days = await ref.read(servicesProvider).store.wordsByDay();
  final map = {for (final d in days) d.day: d.words};
  String key(DateTime d) => d.toIso8601String().substring(0, 10);
  var d = DateTime.now();
  final today = map[key(d)] ?? 0;
  if (today == 0) d = d.subtract(const Duration(days: 1));
  var streak = 0;
  while ((map[key(d)] ?? 0) > 0) {
    streak++;
    d = d.subtract(const Duration(days: 1));
  }
  return (today: today, streak: streak);
});

class DeskScreen extends ConsumerStatefulWidget {
  const DeskScreen({super.key});

  @override
  ConsumerState<DeskScreen> createState() => _DeskScreenState();
}

class _DeskScreenState extends ConsumerState<DeskScreen> {
  final _scroll = ScrollController();
  final _fabExtended = ValueNotifier(true);
  final _collapsed = ValueNotifier(false);
  String _query = '';
  bool _firstLoad = true;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final dir = _scroll.position.userScrollDirection;
      if (dir == ScrollDirection.reverse) _fabExtended.value = false;
      if (dir == ScrollDirection.forward) _fabExtended.value = true;
      _collapsed.value = _scroll.offset > 64;
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  DeskNotifier get _desk => ref.read(deskProvider.notifier);

  Future<void> _newWork() async {
    final doc = await showTypePicker(context, ref);
    if (doc == null || !mounted) return;
    final r = await Navigator.of(context).push(_editorRoute(doc.id, doc));
    _after(r);
  }

  Route<Object?> _editorRoute(String id, [LitmaDoc? doc]) => PageRouteBuilder(
        transitionDuration: Motion.page,
        reverseTransitionDuration: Motion.slow,
        pageBuilder: (_, _, _) => EditorScreen(docId: id, initial: doc),
        transitionsBuilder: (context, a, b, child) => SharedAxisTransition(
          animation: a,
          secondaryAnimation: b,
          transitionType: SharedAxisTransitionType.vertical,
          fillColor: context.c.paper,
          child: child,
        ),
      );

  void _after(Object? result) {
    _desk.refresh();
    if (result == 'trashed' && mounted) _toast(context.t('app.desk.trashed'));
  }

  void _toast(String text, {VoidCallback? undo}) {
    final m = ScaffoldMessenger.of(context);
    m.hideCurrentSnackBar();
    m.showSnackBar(SnackBar(
      content: Text(text),
      duration: const Duration(seconds: 4),
      action: undo == null ? null : SnackBarAction(label: context.t('app.desk.undo'), onPressed: undo),
    ));
  }

  Future<void> _trash(LitmaDoc d) async {
    final store = ref.read(servicesProvider).store;
    _desk.drop(d.id);
    Haptics.soft();
    await store.trashDoc(d.id);
    if (!mounted) return;
    _toast(context.t('app.desk.trashed'), undo: () async {
      await store.restoreDoc(d.id);
      _desk.refresh();
    });
  }

  Future<void> _restore(LitmaDoc d) async {
    _desk.drop(d.id);
    await ref.read(servicesProvider).store.restoreDoc(d.id);
    if (mounted) _toast(context.t('app.desk.restored'));
  }

  Future<void> _deleteForever(LitmaDoc d) async {
    final ok = await confirm(context,
        title: context.t('trash.deleteForever.title', {'title': d.title}), body: context.t('trash.deleteForever.body'), action: context.t('trash.deleteForever.confirm'), danger: true);
    if (!ok) return;
    _desk.drop(d.id);
    await ref.read(servicesProvider).store.deleteDoc(d.id);
    if (mounted) _toast(context.t('app.desk.deleted'));
  }

  Future<void> _emptyTrash(int n) async {
    final ok = await confirm(context,
        title: context.t('trash.emptyConfirm.title'),
        body: context.t('trash.emptyConfirm.body', {'works': context.t('common.works', {'count': n})}),
        action: context.t('trash.emptyConfirm.confirm'),
        danger: true);
    if (!ok) return;
    await ref.read(servicesProvider).store.emptyTrash();
    _desk.refresh();
  }

  Future<void> _duplicate(LitmaDoc d) async {
    final s = ref.read(servicesProvider);
    await s.store.duplicateDoc(d.id, profile: ref.read(profileProvider).value);
    _desk.refresh();
    if (mounted) _toast(context.t('app.desk.copied'));
  }

  Future<void> _read(LitmaDoc d) async {
    final full = await ref.read(servicesProvider).store.getDoc(d.id).catchError((_) => null);
    if (full == null || !mounted) return;
    Navigator.of(context).push(ReaderScreen.route(title: full.title, kind: full.kind, settings: full.settings, document: EditorDocument.fromJson(full.content)));
  }

  void _actions(LitmaDoc d) {
    final c = context.c;
    showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
              child: Text(d.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontFamily: LitmaFonts.display)),
            ),
            for (final (i, (icon, label, color, run)) in [
              (LucideIcons.bookOpen, context.t('app.desk.read'), c.ink, () => _read(d)),
              (LucideIcons.copy, context.t('common.duplicate'), c.ink, () => _duplicate(d)),
              (LucideIcons.trash2, context.t('desk.moveToTrash'), c.danger, () => _trash(d)),
            ].indexed)
              FadeSlideIn(
                index: i,
                offset: 8,
                child: ListTile(
                  leading: Icon(icon, color: color, size: 20),
                  title: Text(label, style: TextStyle(color: color)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  onTap: () {
                    Navigator.pop(context);
                    run();
                  },
                ),
              ),
          ]),
        ),
      ),
    );
  }

  Future<void> _newBook() async {
    final store = ref.read(servicesProvider).store;
    final book = await store.createBook(profile: ref.read(profileProvider).value);
    ref.invalidate(booksProvider);
    if (!mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => BookScreen(bookId: book.id, initial: book)));
    ref.invalidate(booksProvider);
  }

  List<Widget> _booksSlivers(BuildContext context, bool wide) {
    final books = ref.watch(booksProvider);
    final list = books.value;
    if (list == null) {
      return [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
          sliver: SliverList.separated(itemCount: 3, separatorBuilder: (_, _) => const SizedBox(height: 12), itemBuilder: (_, _) => const SkeletonCard()),
        ),
      ];
    }
    if (list.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(32, 24, 32, 140),
            child: FadeSlideIn(
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Container(width: 84, height: 84, decoration: BoxDecoration(color: context.c.accentSoft, borderRadius: BorderRadius.circular(24)), child: Icon(LucideIcons.bookCopy, size: 36, color: context.c.accent)),
                const SizedBox(height: 20),
                Text(context.t('books.empty'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: context.c.muted)),
                const SizedBox(height: 22),
                FilledButton.icon(onPressed: _newBook, icon: const Icon(LucideIcons.bookPlus, size: 18), label: Text(context.t('desk.newBook'))),
              ]),
            ),
          ),
        ),
      ];
    }
    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
        sliver: SliverGrid.builder(
          gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: wide ? 360 : 640, mainAxisSpacing: 12, crossAxisSpacing: 12, mainAxisExtent: 168),
          itemCount: list.length,
          itemBuilder: (context, i) {
            final b = list[i];
            final c = context.c;
            return FadeSlideIn(
              index: i,
              child: Pressable(
                scale: 0.985,
                onTap: () async {
                  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => BookScreen(bookId: b.id, initial: b)));
                  ref.invalidate(booksProvider);
                },
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
                  child: Row(children: [
                    Hero(tag: 'book-${b.id}', child: MiniCover(book: b, width: 92)),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                        Text(b.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 18, fontWeight: FontWeight.w700, color: c.ink, height: 1.25)),
                        if (b.author?.isNotEmpty ?? false) Padding(padding: const EdgeInsets.only(top: 4), child: Text(b.author!, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted))),
                        const SizedBox(height: 10),
                        Text('${context.t('common.chapters', {'count': b.chapters})} · ${relativeTime(context, b.updatedAt)}', style: Theme.of(context).textTheme.labelSmall),
                      ]),
                    ),
                  ]),
                ),
              ),
            );
          },
        ),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final docs = ref.watch(deskProvider);
    final tab = _desk.tab;
    final writer = ref.watch(writerProvider).value;
    final profile = ref.watch(profileProvider).value;
    final wide = MediaQuery.sizeOf(context).width >= 700;
    final list = docs.value
        ?.where((d) => _query.isEmpty || d.title.toLowerCase().contains(_query.toLowerCase()) || d.excerpt.toLowerCase().contains(_query.toLowerCase()))
        .toList();
    if (docs.hasValue && !docs.isLoading) WidgetsBinding.instance.addPostFrameCallback((_) => _firstLoad = false);

    return Scaffold(
      body: Stack(children: [
        RefreshIndicator(
          color: c.accent,
          backgroundColor: c.surface,
          onRefresh: _desk.refresh,
          child: CustomScrollView(
            // scrolling the desk closes the search keyboard, like other iPhone apps
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            slivers: [
              SliverAppBar(
                pinned: true,
                backgroundColor: c.canvas,
                toolbarHeight: 60,
                titleSpacing: 20,
                title: ValueListenableBuilder<bool>(
                  valueListenable: _collapsed,
                  builder: (context, collapsed, _) => AnimatedSwitcher(
                    duration: Motion.of(context, Motion.medium),
                    child: collapsed
                        ? Text(tab == DeskTab.trash ? context.t('trash.title') : (tab == DeskTab.books ? context.t('books.title') : context.t('desk.title')),
                            key: const ValueKey('t'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700))
                        : const Wordmark(key: ValueKey('w'), size: 24),
                  ),
                ),
                actions: [
                  Padding(
                    padding: const EdgeInsets.only(right: 14),
                    child: Pressable(
                      semanticLabel: context.t('nav.profile'),
                      onTap: () => Navigator.of(context).push(ProfileScreen.route()),
                      child: Hero(tag: 'avatar', child: ProfileAvatar(profile: profile, fallbackName: profile?.name ?? writer?.email ?? '?')),
                    ),
                  ),
                ],
              ),
              SliverToBoxAdapter(child: _Header(tab: tab, docs: docs.value)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                  child: _Tabs(
                    tab: tab,
                    onChanged: (t) {
                      Haptics.tap();
                      setState(() {
                        _query = '';
                        _firstLoad = true; // the new tab's cards slide in
                      });
                      _desk.show(t);
                    },
                  ),
                ),
              ),
              if (tab == DeskTab.works && (docs.value?.length ?? 0) > 3)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                    child: TextField(onTapOutside: dismissKeyboard, 
                      onChanged: (v) => setState(() => _query = v),
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => dismissKeyboard(),
                      decoration: InputDecoration(
                        hintText: context.t('desk.search'),
                        prefixIcon: Icon(LucideIcons.search, size: 18, color: c.muted),
                        contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ),
              if (tab == DeskTab.trash && (list?.isNotEmpty ?? false))
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: OutlinedButton.icon(
                        onPressed: () => _emptyTrash(list!.length),
                        style: OutlinedButton.styleFrom(foregroundColor: c.danger, minimumSize: const Size(0, 40)),
                        icon: const Icon(LucideIcons.trash2, size: 16),
                        label: Text(context.t('trash.emptyButton')),
                      ),
                    ),
                  ),
                ),
              if (tab == DeskTab.books)
                ..._booksSlivers(context, wide)
              else if (list == null)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                  sliver: SliverList.separated(itemCount: 4, separatorBuilder: (_, _) => const SizedBox(height: 12), itemBuilder: (_, _) => const SkeletonCard()),
                )
              else if (list.isEmpty)
                SliverFillRemaining(hasScrollBody: false, child: _Empty(tab: tab, onNew: _newWork))
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                  sliver: SliverGrid.builder(
                    gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: wide ? 360 : 640,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      mainAxisExtent: 196,
                    ),
                    itemCount: list.length,
                    itemBuilder: (context, i) {
                      final d = list[i];
                      final card = tab == DeskTab.works
                          ? _OpenableCard(
                              key: ValueKey(d.id),
                              doc: d,
                              onClosed: _after,
                              onLongPress: () => _actions(d),
                              onSwipe: () => _trash(d),
                            )
                          : _TrashCard(key: ValueKey(d.id), doc: d, onRestore: () => _restore(d), onDelete: () => _deleteForever(d));
                      return _firstLoad ? FadeSlideIn(index: i, child: card) : card;
                    },
                  ),
                ),
            ],
          ),
        ),
        const Positioned(left: 16, right: 16, bottom: 90, child: SafeArea(child: Center(child: OfflinePill()))),
      ]),
      floatingActionButton: tab != DeskTab.trash
          ? ValueListenableBuilder<bool>(
              valueListenable: _fabExtended,
              builder: (context, extended, _) => FloatingActionButton.extended(
                onPressed: () {
                  Haptics.soft();
                  tab == DeskTab.books ? _newBook() : _newWork();
                },
                icon: Icon(tab == DeskTab.books ? LucideIcons.bookPlus : LucideIcons.plus, size: 20),
                isExtended: extended,
                extendedIconLabelSpacing: 8,
                label: SwapFade(child: Text(tab == DeskTab.books ? context.t('desk.newBook') : context.t('desk.newWork'), key: ValueKey(tab))),
              ),
            )
          : null,
    );
  }
}

class _Header extends ConsumerWidget {
  const _Header({required this.tab, required this.docs});
  final DeskTab tab;
  final List<LitmaDoc>? docs;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final today = ref.watch(todayProvider).value;
    final words = docs?.fold<int>(0, (a, d) => a + d.wordCount) ?? 0;
    final trash = tab == DeskTab.trash;
    final books = tab == DeskTab.books;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SwapFade(
          child: Text(trash ? context.t('trash.title') : (books ? context.t('books.title') : context.t('desk.title')), key: ValueKey(tab), style: Theme.of(context).textTheme.displaySmall),
        ),
        const SizedBox(height: 6),
        Text(trash ? context.t('trash.description') : (books ? context.t('books.description') : context.t('desk.description')), style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted)),
        if (!trash && !books && docs != null) ...[
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 8, children: [
            _Stat(icon: LucideIcons.fileText, text: context.t('desk.stats', {'works': context.t('common.works', {'count': docs!.length}), 'words': context.t('common.words', {'count': words})})),
            if (today != null && today.today > 0) _Stat(icon: LucideIcons.pen, text: context.t('desk.today', {'n': today.today}), tint: c.tintLime),
            if (today != null && today.streak > 1) _Stat(icon: LucideIcons.flame, text: context.t('desk.streak', {'n': today.streak}), tint: c.tintTangerine),
          ]),
        ],
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.text, this.tint});
  final IconData icon;
  final String text;
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(99), border: Border.all(color: c.line)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: tint ?? c.muted),
        const SizedBox(width: 6),
        Text(text, style: Theme.of(context).textTheme.labelMedium),
      ]),
    );
  }
}

/// Works · Trash, with a pill that slides between them.
class _Tabs extends StatelessWidget {
  const _Tabs({required this.tab, required this.onChanged});
  final DeskTab tab;
  final ValueChanged<DeskTab> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final labels = [context.t('desk.tabs.works'), context.t('desk.tabs.books'), context.t('desk.tabs.trash')];
    return Container(
      height: 42,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: c.subtle, borderRadius: BorderRadius.circular(12)),
      child: LayoutBuilder(builder: (context, box) {
        final w = box.maxWidth / DeskTab.values.length;
        return Stack(children: [
          AnimatedPositioned(
            duration: Motion.of(context, Motion.medium),
            curve: Motion.emphasized,
            left: tab.index * w,
            width: w,
            top: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: context.isDark ? Color.lerp(c.subtle, c.ink, 0.12) : c.surface,
                borderRadius: BorderRadius.circular(9),
                boxShadow: const [BoxShadow(color: Color(0x14111113), blurRadius: 6, offset: Offset(0, 1))],
              ),
            ),
          ),
          Row(children: [
            for (final t in DeskTab.values)
              Expanded(
                child: Semantics(
                  selected: t == tab,
                  button: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => t == tab ? null : onChanged(t),
                    child: Center(
                      child: AnimatedDefaultTextStyle(
                        duration: Motion.of(context, Motion.fast),
                        style: TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: 14, fontWeight: FontWeight.w600, color: t == tab ? c.ink : c.muted),
                        child: Text(labels[t.index]),
                      ),
                    ),
                  ),
                ),
              ),
          ]),
        ]);
      }),
    );
  }
}

/// A work on the desk. Tapping grows the card into the editor (container transform).
class _OpenableCard extends StatelessWidget {
  const _OpenableCard({super.key, required this.doc, required this.onClosed, required this.onLongPress, required this.onSwipe});
  final LitmaDoc doc;
  final ValueChanged<Object?> onClosed;
  final VoidCallback onLongPress;
  final VoidCallback onSwipe;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Dismissible(
      key: ValueKey('swipe-${doc.id}'),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onSwipe(),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 28),
        decoration: BoxDecoration(color: c.dangerSoft, borderRadius: BorderRadius.circular(LitmaRadius.lg)),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(LucideIcons.trash2, color: c.danger),
          const SizedBox(height: 4),
          Text(context.t('desk.tabs.trash'), style: TextStyle(color: c.danger, fontWeight: FontWeight.w600, fontSize: 12)),
        ]),
      ),
      child: OpenContainer<Object?>(
        transitionDuration: Motion.of(context, Motion.page),
        transitionType: ContainerTransitionType.fadeThrough,
        closedElevation: 0,
        openElevation: 0,
        closedColor: c.surface,
        openColor: c.paper,
        middleColor: c.paper,
        closedShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(LitmaRadius.lg), side: BorderSide(color: c.line)),
        onClosed: onClosed,
        openBuilder: (context, _) => EditorScreen(docId: doc.id),
        closedBuilder: (context, open) => Pressable(
          onTap: open,
          onLongPress: onLongPress,
          scale: 0.985,
          child: WorkCard(doc: doc),
        ),
      ),
    );
  }
}

/// The card face: writing type, title, opening lines, words and when it was last edited.
class WorkCard extends StatelessWidget {
  const WorkCard({super.key, required this.doc, this.footer});
  final LitmaDoc doc;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final excerpt = doc.excerpt;
    return Container(
      color: Colors.transparent,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(shape: BoxShape.circle, color: kindDot(context, doc.kind))),
          const SizedBox(width: 7),
          Text(kindNames[doc.kind]!.ml, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 12.5, fontWeight: FontWeight.w600, color: c.highlight)),
          const Spacer(),
          if (doc.pristine) Icon(LucideIcons.sparkle, size: 14, color: c.muted),
        ]),
        const SizedBox(height: 8),
        Text(doc.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 19, fontWeight: FontWeight.w700, color: c.ink, height: 1.25)),
        const SizedBox(height: 6),
        Expanded(
          child: Text(
            excerpt,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontFamily: LitmaFonts.serif, fontSize: 14, height: 1.55, color: c.muted),
          ),
        ),
        const SizedBox(height: 8),
        footer ??
            Text('${context.t('common.words', {'count': doc.wordCount})} · ${relativeTime(context, doc.updatedAt)}', style: Theme.of(context).textTheme.labelSmall),
      ]),
    );
  }
}

class _TrashCard extends StatelessWidget {
  const _TrashCard({super.key, required this.doc, required this.onRestore, required this.onDelete});
  final LitmaDoc doc;
  final VoidCallback onRestore;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
      child: Opacity(
        opacity: 0.92,
        child: WorkCard(
          doc: doc,
          footer: Row(children: [
            Text(relativeTime(context, doc.updatedAt), style: Theme.of(context).textTheme.labelSmall),
            const Spacer(),
            TextButton.icon(onPressed: onRestore, icon: const Icon(LucideIcons.undo2, size: 16), label: Text(context.t('common.restore')), style: TextButton.styleFrom(visualDensity: VisualDensity.compact)),
            IconButton(
              onPressed: onDelete,
              tooltip: context.t('trash.deleteForever.confirm'),
              visualDensity: VisualDensity.compact,
              icon: Icon(LucideIcons.trash2, size: 18, color: c.danger),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.tab, required this.onNew});
  final DeskTab tab;
  final VoidCallback onNew;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final trash = tab == DeskTab.trash;
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 24, 32, 140),
      child: FadeSlideIn(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(color: trash ? c.subtle : c.accentSoft, borderRadius: BorderRadius.circular(24)),
            child: Icon(trash ? LucideIcons.trash : LucideIcons.feather, size: 36, color: trash ? c.muted : c.accent),
          ),
          const SizedBox(height: 20),
          Text(trash ? context.t('trash.empty') : context.t('desk.firstWork'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
          if (!trash) ...[
            const SizedBox(height: 8),
            Text(context.t('desk.firstWorkHint'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted)),
            const SizedBox(height: 22),
            FilledButton.icon(onPressed: onNew, icon: const Icon(LucideIcons.plus, size: 18), label: Text(context.t('desk.newWork'))),
          ],
        ]),
      ),
    );
  }
}

