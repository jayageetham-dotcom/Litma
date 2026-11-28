import 'dart:async';

import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/search.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/forms.dart';
import '../../data/analytics.dart';
import '../../data/backend.dart' show OfflineException;
import '../../data/backup.dart';
import '../../data/goals.dart';
import '../goals/goals_screen.dart' show rescheduleReminders;
import '../../data/journals.dart';
import '../../data/models.dart';
import '../../editor/document.dart';
import '../../editor/editor_screen.dart';
import '../../editor/journal_export.dart';
import '../../features/reader/reader_screen.dart';
import '../../widgets/brand.dart';
import '../../widgets/avatar.dart';
import '../../widgets/common.dart';
import '../books/book_screen.dart';
import '../profile/profile_screen.dart';
import 'journals_view.dart';
import 'type_picker.dart';
import '../../core/keyboard.dart';

enum DeskTab { works, books, journals, trash }

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
    if (tab == DeskTab.works || tab == DeskTab.journals) await store.discardPristine().catchError((_) => 0);
    final all = await store.listDocs(trash: tab == DeskTab.trash);
    // journals have their own tab; Works lists every other writing type
    return switch (tab) {
      DeskTab.works => all.where((d) => d.kind != DocKind.diary).toList(),
      DeskTab.journals => all.where((d) => d.kind == DocKind.diary).toList(),
      _ => all,
    };
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

/// Words written today and the streak (with the writer's rest days), from the shared goals rules.
final todayProvider = FutureProvider<({int today, int streak})>((ref) async {
  ref.watch(deskProvider);
  ref.watch(writingProvider);
  final days = await ref.read(servicesProvider).store.wordsByDay();
  final g = GoalPrefs.from(ref.read(profileProvider).value?.preferences['goals']);
  final s = streak(days, restDays: g.restDays, remembered: g.bestStreak);
  return (today: wordsOn(days, localDay()), streak: s.current);
});

/// The work pinned to the top of the desk (profile preferences.pinnedWork, as the web's lib/pin.ts).
String? pinnedWork(Profile? p) {
  final id = p?.preferences['pinnedWork'];
  return id is String && id.isNotEmpty ? id : null;
}

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
    // once the desk is up: the daily reminder for the next days, and today's backup copy if it is on
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      unawaited(rescheduleReminders(ref, context));
      final sv = ref.read(servicesProvider);
      if (Backup.due(sv.prefs)) unawaited(Backup.make(sv.store, sv.prefs).then((_) {}, onError: (_) {}));
    });
    // after writing (words counted), today's reminder is dropped once the goal is met
    _writing = ref.listenManual(writingProvider, (_, _) {
      _later?.cancel();
      _later = Timer(const Duration(seconds: 30), () {
        if (mounted) unawaited(rescheduleReminders(ref, context));
      });
    });
  }

  ProviderSubscription<int>? _writing;
  Timer? _later;

  @override
  void dispose() {
    _writing?.close();
    _later?.cancel();
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

  /// New journal: a journal titled with today's date, opened at once (no writing-type picker).
  Future<void> _newJournal() async {
    final doc = await ref.read(servicesProvider).store.createDoc(DocKind.diary, profile: ref.read(profileProvider).value);
    if (!mounted) return;
    final r = await Navigator.of(context).push(_editorRoute(doc.id, doc));
    _after(r);
  }

  void _exportJournals() {
    Analytics.tap('journals.export');
    showJournalExportSheet(context, ref, journals: ref.read(deskProvider).value ?? const []);
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
    if (result is TrashedWork) {
      unawaited(_trashId(result.id));
      return;
    }
    _desk.refresh();
  }

  void _toast(String text, {VoidCallback? undo}) {
    final m = ScaffoldMessenger.of(context);
    m.hideCurrentSnackBar();
    m.showSnackBar(SnackBar(
      content: Text(text),
      duration: const Duration(seconds: 4),
      // Flutter keeps a snack bar with an action until it is tapped unless persist is false.
      persist: false,
      action: undo == null ? null : SnackBarAction(label: context.t('app.desk.undo'), onPressed: undo),
    ));
  }

  Future<void> _trash(LitmaDoc d) => _trashId(d.id);

  /// Trash a work from the desk (swipe, long press) or from inside the editor: off the list at once,
  /// then the store, then a toast with Undo.
  Future<void> _trashId(String id) async {
    final store = ref.read(servicesProvider).store;
    _desk.drop(id);
    Haptics.soft();
    try {
      await store.trashDoc(id);
    } on OfflineException {
      // kept in the outbox; the list already shows it gone
    } catch (_) {
      // the server refused (not this writer's work, or gone): say so and show the list as it really is
      if (!mounted) return;
      _toast(context.t('app.desk.failed'));
      _desk.refresh();
      return;
    }
    if (!mounted) return;
    _toast(context.t('app.desk.trashed'), undo: () async {
      await store.restoreDoc(id);
      _desk.refresh();
    });
  }

  Future<void> _restore(LitmaDoc d) async {
    _desk.drop(d.id);
    try {
      await ref.read(servicesProvider).store.restoreDoc(d.id);
    } on OfflineException {
      // kept in the outbox
    } catch (_) {
      if (!mounted) return;
      _toast(context.t('app.desk.failed'));
      _desk.refresh();
      return;
    }
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

  /// Pin a work to the top of the desk (only one: pinning another moves the pin), or unpin it.
  Future<void> _pin(LitmaDoc d, bool on) async {
    final w = ref.read(writerProvider).value;
    final p = ref.read(profileProvider).value;
    if (w == null) return;
    Analytics.tap(on ? 'desk.pin.pin' : 'desk.pin.unpin');
    await ref.read(servicesProvider).store.updateProfile(w.id, {'preferences': {...?p?.preferences, 'pinnedWork': on ? d.id : null}});
    ref.invalidate(profileProvider);
    if (mounted) _toast(context.t(on ? 'desk.pin.done' : 'desk.pin.removed'));
  }

  void _actions(LitmaDoc d) {
    final c = context.c;
    final isPinned = pinnedWork(ref.read(profileProvider).value) == d.id;
    final journal = d.kind == DocKind.diary;
    showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
              child: Text(journal ? journalFace(d).title : d.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontFamily: LitmaFonts.display)),
            ),
            for (final (i, (icon, label, color, run)) in [
              // journals: no pin (the newest is first) and no duplicate (owner, 28 Nov)
              if (!journal) (isPinned ? LucideIcons.pinOff : LucideIcons.pin, context.t(isPinned ? 'desk.pin.unpin' : 'desk.pin.pin'), c.accent, () => _pin(d, !isPinned)),
              (LucideIcons.bookOpen, context.t('app.desk.read'), c.ink, () => _read(d)),
              if (!journal) (LucideIcons.copy, context.t('common.duplicate'), c.ink, () => _duplicate(d)),
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

  /// The Journals tab: one column, newest first, a month line before each month.
  List<Widget> _journalSlivers(BuildContext context, List<LitmaDoc>? all) {
    final width = MediaQuery.sizeOf(context).width;
    // one column; on a tablet it keeps a readable width
    final side = width > 760 ? (width - 720) / 2 : 16.0;
    if (all == null) {
      return [SliverPadding(padding: EdgeInsets.fromLTRB(side, 0, side, 120), sliver: const SliverToBoxAdapter(child: JournalsSkeleton()))];
    }
    if (all.isEmpty) return [SliverFillRemaining(hasScrollBody: false, child: JournalsEmpty(onNew: _newJournal))];
    final rows = journalRows(all, query: _query);
    if (rows.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 120),
            child: Text(context.t('journals.noMatch', {'q': _query.trim()}), style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: context.c.muted)),
          ),
        ),
      ];
    }
    return [
      SliverPadding(
        padding: EdgeInsets.fromLTRB(side, 0, side, 120),
        sliver: SliverList.builder(
          itemCount: rows.length,
          itemBuilder: (context, i) {
            final r = rows[i];
            final Widget row = r.month != null
                ? JournalMonthLine(key: ValueKey('m-${r.month}'), text: r.month!)
                : Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _OpenableCard(
                      key: ValueKey(r.doc!.id),
                      doc: r.doc!,
                      face: JournalCard(doc: r.doc!),
                      onClosed: _after,
                      onLongPress: () => _actions(r.doc!),
                      onSwipe: () => _trash(r.doc!),
                    ),
                  );
            return _firstLoad ? FadeSlideIn(index: i, child: row) : row;
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
    final pinned = tab == DeskTab.works ? pinnedWork(profile) : null;
    // while searching: as typed first, then by sound, then near misses (stable within each)
    final all = docs.value;
    final ranked = all == null ? null : [for (var i = 0; i < all.length; i++) (d: all[i], r: searchRank('${all[i].title} ${all[i].excerpt}', _query), i: i)].where((x) => x.r > 0).toList();
    if (ranked != null && _query.trim().isNotEmpty) ranked.sort((a, b) => a.r != b.r ? b.r.compareTo(a.r) : a.i.compareTo(b.i));
    final list = ranked?.map((x) => x.d).toList();
    // the pinned work always comes first
    final at = pinned == null ? -1 : (list?.indexWhere((d) => d.id == pinned) ?? -1);
    if (at > 0) list!.insert(0, list.removeAt(at));
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
                    // both sit at the left edge while they cross-fade; the default centres them in
                    // the wider one's box, so the logo jumped left when the fade finished
                    layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
                    child: collapsed
                        ? Text(_tabTitle(context, tab),
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
              if (tab == DeskTab.journals && (docs.value?.isNotEmpty ?? false))
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: OutlinedButton.icon(
                        onPressed: _exportJournals,
                        style: OutlinedButton.styleFrom(foregroundColor: c.ink, minimumSize: const Size(0, 44)),
                        icon: const Icon(LucideIcons.download, size: 16),
                        label: Text(context.t('journals.export')),
                      ),
                    ),
                  ),
                ),
              if ((tab == DeskTab.works || tab == DeskTab.journals) && (docs.value?.length ?? 0) > 3)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                    child: TextField(onTapOutside: dismissKeyboard, 
                      onChanged: (v) => setState(() => _query = v),
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => dismissKeyboard(),
                      decoration: InputDecoration(
                        hintText: context.t(tab == DeskTab.journals ? 'journals.search' : 'desk.search'),
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
              else if (tab == DeskTab.journals)
                ..._journalSlivers(context, docs.value)
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
                              pinned: d.id == pinned,
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
      // journals: no button while there are none (the empty state has its own)
      floatingActionButton: tab != DeskTab.trash && !(tab == DeskTab.journals && (docs.value?.isEmpty ?? true))
          ? ValueListenableBuilder<bool>(
              valueListenable: _fabExtended,
              builder: (context, extended, _) => FloatingActionButton.extended(
                onPressed: () {
                  Haptics.soft();
                  if (tab == DeskTab.books) {
                    _newBook();
                  } else if (tab == DeskTab.journals) {
                    _newJournal();
                  } else {
                    _newWork();
                  }
                },
                icon: Icon(tab == DeskTab.books ? LucideIcons.bookPlus : LucideIcons.plus, size: 20),
                isExtended: extended,
                extendedIconLabelSpacing: 8,
                label: SwapFade(child: Text(context.t(switch (tab) { DeskTab.books => 'desk.newBook', DeskTab.journals => 'journals.new', _ => 'desk.newWork' }), key: ValueKey(tab))),
              ),
            )
          : null,
    );
  }
}

/// Each tab's title (Malayalam in both languages, like the other desk titles).
String _tabTitle(BuildContext context, DeskTab tab) => context.t(switch (tab) {
      DeskTab.trash => 'trash.title',
      DeskTab.books => 'books.title',
      DeskTab.journals => 'journals.title',
      DeskTab.works => 'desk.title',
    });

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
    final journals = tab == DeskTab.journals;
    // phones: the Journals heading is 24 px and its line 14 px (owner, 28 Nov: the big title was too big)
    final phone = MediaQuery.sizeOf(context).width < 768;
    final text = Theme.of(context).textTheme;
    final titleStyle = journals && phone ? TextStyle(fontFamily: LitmaFonts.display, fontFamilyFallback: LitmaFonts.displayFallback, fontSize: 24, fontWeight: FontWeight.w600, height: 1.25, color: c.ink) : text.displaySmall;
    final description = context.t(switch (tab) {
      DeskTab.trash => 'trash.description',
      DeskTab.books => 'books.description',
      DeskTab.journals => 'journals.description',
      DeskTab.works => 'desk.description',
    });
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SwapFade(
          child: Semantics(key: ValueKey(tab), header: true, child: Text(_tabTitle(context, tab), style: titleStyle)),
        ),
        SizedBox(height: journals && phone ? 4 : 6),
        Text(description, style: text.bodyMedium?.copyWith(color: c.muted, fontSize: journals && phone ? 14 : null)),
        if (journals && docs != null && docs!.isNotEmpty) ...[
          const SizedBox(height: 14),
          _Stat(icon: LucideIcons.calendar, text: context.t('desk.stats', {'works': context.t('journals.count', {'count': docs!.length}), 'words': context.t('common.words', {'count': words})})),
        ],
        if (!trash && !books && !journals && docs != null) ...[
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

/// Works · Books · Journals · Trash. Each segment is as wide as its label; when they don't fit (in
/// Malayalam on every phone) the row scrolls sideways and the chosen tab is always fully in view.
/// When they fit, they share the whole width.
class _Tabs extends StatefulWidget {
  const _Tabs({required this.tab, required this.onChanged});
  final DeskTab tab;
  final ValueChanged<DeskTab> onChanged;

  @override
  State<_Tabs> createState() => _TabsState();
}

class _TabsState extends State<_Tabs> {
  final _scroll = ScrollController();
  List<double> _widths = const [];

  static const _pad = 10.0;

  @override
  void didUpdateWidget(_Tabs old) {
    super.didUpdateWidget(old);
    if (old.tab != widget.tab) WidgetsBinding.instance.addPostFrameCallback((_) => _reveal(animate: true));
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reveal(animate: false));
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// Scroll just enough to show the chosen segment whole.
  void _reveal({required bool animate}) {
    if (!mounted || !_scroll.hasClients || _widths.length != DeskTab.values.length) return;
    final i = widget.tab.index;
    final left = 2 + _widths.take(i).fold<double>(0, (a, w) => a + w);
    final right = left + _widths[i] + 2;
    final p = _scroll.position;
    var to = p.pixels;
    if (left - 2 < to) to = left - 2;
    if (right > to + p.viewportDimension) to = right - p.viewportDimension;
    to = to.clamp(0.0, p.maxScrollExtent);
    if ((to - p.pixels).abs() < 0.5) return;
    if (animate) {
      _scroll.animateTo(to, duration: Motion.of(context, Motion.medium), curve: Motion.emphasized);
    } else {
      _scroll.jumpTo(to);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final labels = [for (final t in DeskTab.values) context.t('desk.tabs.${t.name}')];
    final size = MediaQuery.sizeOf(context).width < 360 ? 13.0 : 14.0;
    TextStyle style(bool on) => TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: size, fontWeight: FontWeight.w600, color: on ? c.ink : c.muted);
    final scaler = MediaQuery.textScalerOf(context);
    double measure(String label) {
      final p = TextPainter(text: TextSpan(text: label, style: style(true)), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
      final w = p.width;
      p.dispose();
      return w.ceilToDouble() + 2 * _pad + 4;
    }

    final natural = [for (final l in labels) measure(l)];
    return LayoutBuilder(builder: (context, box) {
      final room = box.maxWidth - 4;
      final total = natural.fold<double>(0, (a, w) => a + w);
      final extra = total < room ? (room - total) / natural.length : 0.0;
      _widths = [for (final w in natural) w + extra];
      return Container(
        height: 48,
        decoration: BoxDecoration(color: c.subtle, borderRadius: BorderRadius.circular(12)),
        child: SingleChildScrollView(
          controller: _scroll,
          scrollDirection: Axis.horizontal,
          physics: total < room ? const NeverScrollableScrollPhysics() : const BouncingScrollPhysics(),
          padding: const EdgeInsets.all(2),
          child: Row(children: [
            for (final t in DeskTab.values)
              Semantics(
                selected: t == widget.tab,
                button: true,
                inMutuallyExclusiveGroup: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => t == widget.tab ? null : widget.onChanged(t),
                  child: SizedBox(
                    width: _widths[t.index],
                    height: 44,
                    child: AnimatedContainer(
                      duration: Motion.of(context, Motion.fast),
                      margin: const EdgeInsets.all(2),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: t == widget.tab ? (context.isDark ? Color.lerp(c.subtle, c.ink, 0.12) : c.surface) : c.subtle.withValues(alpha: 0),
                        borderRadius: BorderRadius.circular(9),
                        boxShadow: t == widget.tab ? const [BoxShadow(color: Color(0x14111113), blurRadius: 6, offset: Offset(0, 1))] : const [],
                      ),
                      child: AnimatedDefaultTextStyle(
                        duration: Motion.of(context, Motion.fast),
                        style: style(t == widget.tab),
                        child: Text(labels[t.index], maxLines: 1, softWrap: false),
                      ),
                    ),
                  ),
                ),
              ),
          ]),
        ),
      );
    });
  }
}

/// A work on the desk. Tapping grows the card into the editor (container transform).
class _OpenableCard extends StatelessWidget {
  const _OpenableCard({super.key, required this.doc, required this.onClosed, required this.onLongPress, required this.onSwipe, this.pinned = false, this.face});
  final LitmaDoc doc;

  /// The card's face; a work card by default (journals have their own).
  final Widget? face;
  final bool pinned;
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
        closedShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(LitmaRadius.lg), side: BorderSide(color: pinned ? c.accent.withValues(alpha: 0.6) : c.line, width: pinned ? 1.5 : 1)),
        onClosed: onClosed,
        openBuilder: (context, _) => EditorScreen(docId: doc.id),
        closedBuilder: (context, open) => Pressable(
          onTap: open,
          onLongPress: onLongPress,
          scale: 0.985,
          child: face ?? WorkCard(doc: doc, pinned: pinned),
        ),
      ),
    );
  }
}

/// The card face: writing type, title, opening lines, words and when it was last edited.
class WorkCard extends StatelessWidget {
  const WorkCard({super.key, required this.doc, this.footer, this.pinned = false});
  final LitmaDoc doc;
  final Widget? footer;

  /// pinned to the top of the desk: a small "Pinned" badge
  final bool pinned;

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
          if (pinned)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: c.accentSoft, borderRadius: BorderRadius.circular(99)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(LucideIcons.pin, size: 11, color: c.accent),
                const SizedBox(width: 4),
                Text(context.t('desk.pin.pinned'), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: c.accent)),
              ]),
            )
          else if (doc.pristine)
            Icon(LucideIcons.sparkle, size: 14, color: c.muted),
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

