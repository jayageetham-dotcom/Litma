import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/manglish.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/dictionary.dart';
import '../../widgets/common.dart';

/// നാട്ടറിവ് categories (assets/data/nattarivu.json, from packages/shared/src/nattarivu.ts).
class NattarivuCategory {
  NattarivuCategory(this.id, this.ml, this.en, this.tint, this.words);
  final String id, ml, en, tint;
  final List<({String ml, String en, String? groupMl, String? groupEn})> words;
}

final nattarivuProvider = FutureProvider<List<NattarivuCategory>>((ref) async => parseNattarivu(await rootBundle.loadString('assets/data/nattarivu.json')));

List<NattarivuCategory> parseNattarivu(String json) {
  final raw = jsonDecode(json) as List;
  return [
    for (final c in raw.cast<Map>())
      NattarivuCategory(c['id'] as String, c['ml'] as String, c['en'] as String, c['tint'] as String, [
        for (final w in (c['words'] as List).cast<Map>())
          (ml: w['ml'] as String, en: w['en'] as String, groupMl: (w['group'] as Map?)?['ml'] as String?, groupEn: (w['group'] as Map?)?['en'] as String?)
      ])
  ];
}

final bookmarksProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  ref.watch(writerProvider.select((w) => w.value?.id));
  return ref.read(servicesProvider).store.listBookmarks();
});

const nattarivuIcons = <String, IconData>{
  'flowers': LucideIcons.flower2,
  'trees': LucideIcons.treeDeciduous,
  'plants': LucideIcons.sprout,
  'herbs': LucideIcons.leaf,
  'fruits': LucideIcons.cherry,
  'vegetables': LucideIcons.carrot,
  'spices': LucideIcons.flame,
  'food': LucideIcons.soup,
  'birds': LucideIcons.bird,
  'animals': LucideIcons.pawPrint,
  'reptiles': LucideIcons.turtle,
  'insects': LucideIcons.bug,
  'aquatic': LucideIcons.fish,
  'time': LucideIcons.calendarDays,
  'weather': LucideIcons.cloudRain,
  'water': LucideIcons.waves,
  'mountains': LucideIcons.mountain,
  'farming': LucideIcons.wheat,
  'household': LucideIcons.cookingPot,
  'house': LucideIcons.house,
  'clothes': LucideIcons.shirt,
  'colours': LucideIcons.palette,
  'body': LucideIcons.hand,
  'feelings': LucideIcons.smile,
  'sounds': LucideIcons.audioLines,
  'kinship': LucideIcons.users,
  'measures': LucideIcons.ruler,
  'arts': LucideIcons.drama,
};

Color _tint(LitmaTokens c, String t) => switch (t) {
      'coral' => c.tintCoral,
      'sky' => c.tintSky,
      'lime' => c.tintLime,
      'tangerine' => c.tintTangerine,
      _ => c.tintViolet,
    };

/// The dictionary: Look up · നാട്ടറിവ് · Saved (the web's /dictionary/).
class DictionaryScreen extends ConsumerStatefulWidget {
  const DictionaryScreen({super.key, this.initialWord});
  final String? initialWord;

  @override
  ConsumerState<DictionaryScreen> createState() => _DictionaryScreenState();
}

class _DictionaryScreenState extends ConsumerState<DictionaryScreen> {
  int _tab = 0;
  final _lookup = GlobalKey<LookupViewState>();
  String? _fromCategory;

  void _open(String word, {String? from}) {
    setState(() {
      _tab = 0;
      _fromCategory = from;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _lookup.currentState?.search(word));
  }

  @override
  Widget build(BuildContext context) {
    final saved = ref.watch(bookmarksProvider).value?.length ?? 0;
    return Scaffold(
      appBar: AppBar(title: Text(context.t('nav.dictionary'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700))),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: SegmentTabs(
            labels: [context.t('saved.lookupTab'), context.t('nattarivu.title'), saved > 0 ? context.t('saved.tab', {'n': saved}) : context.t('saved.title')],
            index: _tab,
            onChanged: (i) => setState(() => _tab = i),
          ),
        ),
        Expanded(
          child: IndexedStack(index: _tab, children: [
            LookupView(
              key: _lookup,
              initialWord: widget.initialWord,
              backChip: _fromCategory == null ? null : (label: _fromCategory!, onTap: () => setState(() => _tab = 1)),
            ),
            _NattarivuView(onWord: (w, cat) => _open(w, from: cat)),
            _SavedView(onWord: _open),
          ]),
        ),
      ]),
    );
  }
}

/// Search and a word's entry. Also used inside the editor's Look up sheet ([onInsert] puts a word
/// into the writing).
class LookupView extends ConsumerStatefulWidget {
  const LookupView({super.key, this.initialWord, this.onInsert, this.backChip, this.compact = false});
  final String? initialWord;
  final ValueChanged<String>? onInsert;
  final ({String label, VoidCallback onTap})? backChip;
  final bool compact;

  @override
  ConsumerState<LookupView> createState() => LookupViewState();
}

class LookupViewState extends ConsumerState<LookupView> {
  final _q = TextEditingController();
  final _focus = FocusNode();
  Timer? _debounce;
  List<String> _suggestions = const [];
  List<String> _manglish = const [];
  LookupResult? _result;
  bool _busy = false;
  final _history = <String>[];

  Dictionary get _dict => ref.read(servicesProvider).dictionary;

  @override
  void initState() {
    super.initState();
    if (widget.initialWord?.trim().isNotEmpty ?? false) WidgetsBinding.instance.addPostFrameCallback((_) => search(widget.initialWord!));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _q.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _typed(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 180), () async {
      final q = v.trim();
      if (q.isEmpty) return setState(() => _suggestions = _manglish = const []);
      final sug = await _dict.suggest(q, max: 8);
      // Manglish typed in English letters: offer the Malayalam it may have been meant as
      var ml = <String>[];
      if (!isMalayalam(q) && RegExp(r'^[A-Za-z~_^]+$').hasMatch(q)) {
        ml = {...(await ref.read(servicesProvider).transliterator.candidates(q, num: 4)), manglishWord(q)}.take(4).toList();
      }
      if (mounted && _q.text.trim() == q) {
        setState(() {
          _suggestions = sug;
          _manglish = ml;
        });
      }
    });
  }

  Future<void> search(String word) async {
    final w = word.trim();
    if (w.isEmpty) return;
    _q.text = w;
    _focus.unfocus();
    setState(() {
      _busy = true;
      _suggestions = _manglish = const [];
    });
    final r = await _dict.lookup(w);
    if (!mounted) return;
    if (_result?.found ?? false) _history.add(_result!.head!);
    setState(() {
      _result = r;
      _busy = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final r = _result;
    return CustomScrollView(slivers: [
      SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, widget.compact ? 0 : 4, 16, 8),
          child: TextField(
            controller: _q,
            focusNode: _focus,
            textInputAction: TextInputAction.search,
            onChanged: _typed,
            onSubmitted: search,
            style: const TextStyle(fontFamily: LitmaFonts.display, fontSize: 18),
            decoration: InputDecoration(
              hintText: 'Malayalam, English or Manglish',
              prefixIcon: Icon(LucideIcons.search, size: 19, color: c.muted),
              suffixIcon: _q.text.isEmpty
                  ? null
                  : IconButton(
                      icon: Icon(LucideIcons.x, size: 18, color: c.muted),
                      onPressed: () => setState(() {
                        _q.clear();
                        _suggestions = _manglish = const [];
                      }),
                    ),
            ),
          ),
        ),
      ),
      if (widget.backChip != null)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
            child: Align(
              alignment: Alignment.centerLeft,
              child: ActionChip(avatar: const Icon(LucideIcons.arrowLeft, size: 15), label: Text(widget.backChip!.label), onPressed: widget.backChip!.onTap),
            ),
          ),
        ),
      if (_manglish.isNotEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
            child: Wrap(spacing: 6, runSpacing: 6, children: [
              for (final (i, m) in _manglish.indexed)
                FadeSlideIn(index: i, offset: 6, child: ActionChip(label: Text(m, style: const TextStyle(fontFamily: LitmaFonts.display, fontSize: 16)), onPressed: () => search(m))),
            ]),
          ),
        ),
      if (_suggestions.isNotEmpty)
        SliverList.builder(
          itemCount: _suggestions.length,
          itemBuilder: (context, i) => ListTile(
            dense: true,
            leading: Icon(LucideIcons.cornerDownRight, size: 16, color: c.muted),
            title: Text(_suggestions[i], style: const TextStyle(fontFamily: LitmaFonts.display, fontSize: 16)),
            onTap: () => search(_suggestions[i]),
          ),
        )
      else if (_busy)
        const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.all(16), child: SkeletonCard()))
      else if (r == null)
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 72, height: 72, decoration: BoxDecoration(color: c.accentSoft, borderRadius: BorderRadius.circular(22)), child: Icon(LucideIcons.bookA, size: 32, color: c.accent)),
                const SizedBox(height: 16),
                Text(context.t('nav.dictionaryTitle'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 6),
                Text(context.t('app.dict.hint'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted)),
              ]),
            ),
          ),
        )
      else if (!r.found)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(context.t('app.dict.notFound', {'q': r.query}), textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: c.muted)),
          ),
        )
      else
        SliverToBoxAdapter(child: _Entry(key: ValueKey(r.head), r: r, onWord: search, onInsert: widget.onInsert, history: _history.isEmpty ? null : () => search(_history.removeLast()))),
    ]);
  }
}

class _Entry extends ConsumerWidget {
  const _Entry({super.key, required this.r, required this.onWord, this.onInsert, this.history});
  final LookupResult r;
  final ValueChanged<String> onWord;
  final ValueChanged<String>? onInsert;
  final VoidCallback? history;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final saved = ref.watch(bookmarksProvider).value?.any((b) => b['word'] == r.head) ?? false;
    Widget chips(List<String> words, {bool ml = true}) => Wrap(spacing: 6, runSpacing: 6, children: [
          for (final (i, w) in words.indexed)
            FadeSlideIn(
              index: i,
              step: const Duration(milliseconds: 18),
              offset: 6,
              child: Pressable(
                onTap: () => onInsert != null ? onInsert!(w) : onWord(w),
                onLongPress: () => onWord(w),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(99), border: Border.all(color: c.line)),
                  child: Text(w, style: TextStyle(fontFamily: ml ? LitmaFonts.display : LitmaFonts.ui, fontSize: 15, color: c.ink)),
                ),
              ),
            ),
        ]);
    Widget section(String title, Widget child) => Padding(
          padding: const EdgeInsets.only(top: 18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: c.accent)),
              const SizedBox(width: 8),
              Text(title, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: c.muted)),
            ]),
            const SizedBox(height: 10),
            child,
          ]),
        );
    return FadeSlideIn(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (history != null) IconButton(onPressed: history, icon: const Icon(LucideIcons.arrowLeft, size: 20), visualDensity: VisualDensity.compact),
            Expanded(child: SelectableText(r.head!, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 34, fontWeight: FontWeight.w800, color: c.ink, height: 1.2))),
            IconButton(
              tooltip: context.t(saved ? 'saved.remove' : 'saved.add'),
              onPressed: () async {
                final store = ref.read(servicesProvider).store;
                Haptics.confirm();
                if (saved) {
                  await store.removeBookmark(r.head!);
                } else {
                  await store.addBookmark(word: r.head!, lang: r.lang, meaning: r.meanings.isEmpty ? null : r.meanings.first.defs.take(3).join('; '), synonyms: r.synonyms);
                }
                ref.invalidate(bookmarksProvider);
              },
              icon: AnimatedSwitcher(
                duration: Motion.of(context, Motion.medium),
                transitionBuilder: (child, a) => ScaleTransition(scale: CurvedAnimation(parent: a, curve: Curves.elasticOut), child: child),
                child: Icon(saved ? Icons.bookmark_rounded : Icons.bookmark_outline_rounded, key: ValueKey(saved), color: saved ? c.tintCoral : c.muted, size: 26),
              ),
            ),
            IconButton(
              tooltip: 'Copy',
              onPressed: () {
                Clipboard.setData(ClipboardData(text: r.head!));
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.t('app.dict.copied'))));
              },
              icon: Icon(LucideIcons.copy, size: 20, color: c.muted),
            ),
          ]),
          if (r.translations.isNotEmpty) section(r.lang == 'en' ? 'മലയാളം' : 'English', chips(r.translations, ml: r.lang == 'en')),
          if (r.meanings.isNotEmpty)
            section(
              context.t('app.dict.meanings'),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (final m in r.meanings)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: c.highlightSoft, borderRadius: BorderRadius.circular(6)),
                        child: Text(m.pos, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.highlight, fontFamily: LitmaFonts.display)),
                      ),
                      const SizedBox(height: 6),
                      for (final (i, d) in m.defs.take(8).indexed)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text('${i + 1}. $d', style: TextStyle(fontFamily: LitmaFonts.sans, fontSize: 15.5, height: 1.55, color: c.ink)),
                        ),
                    ]),
                  ),
              ]),
            ),
          if (r.synonyms.isNotEmpty) section(context.t('app.dict.synonyms'), chips(r.synonyms.take(30).toList(), ml: r.lang == 'ml')),
          if (onInsert != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(context.t('saved.pickHint'), style: Theme.of(context).textTheme.bodySmall)),
        ]),
      ),
    );
  }
}

class _NattarivuView extends ConsumerStatefulWidget {
  const _NattarivuView({required this.onWord});
  final void Function(String word, String category) onWord;

  @override
  ConsumerState<_NattarivuView> createState() => _NattarivuViewState();
}

class _NattarivuViewState extends ConsumerState<_NattarivuView> {
  NattarivuCategory? _open;
  String _filter = '';

  @override
  Widget build(BuildContext context) {
    final cats = ref.watch(nattarivuProvider).value;
    if (cats == null) return const SizedBox.shrink();
    return PopScope(
      canPop: _open == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _open = null);
      },
      child: AnimatedSwitcher(
        duration: Motion.of(context, Motion.medium),
        switchInCurve: Motion.emphasizedDecelerate,
        transitionBuilder: (child, a) => FadeTransition(opacity: a, child: ScaleTransition(scale: Tween(begin: 0.98, end: 1.0).animate(a), child: child)),
        child: _open == null ? _grid(cats) : _words(_open!),
      ),
    );
  }

  Widget _grid(List<NattarivuCategory> cats) {
    final c = context.c;
    final wide = MediaQuery.sizeOf(context).width >= 700;
    return CustomScrollView(key: const ValueKey('grid'), slivers: [
      SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.fromLTRB(20, 4, 20, 12), child: Text(context.t('nattarivu.intro'), style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted)))),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        sliver: SliverGrid.builder(
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: wide ? 4 : 2, mainAxisSpacing: 10, crossAxisSpacing: 10, mainAxisExtent: 118),
          itemCount: cats.length,
          itemBuilder: (context, i) {
            final cat = cats[i];
            final tint = _tint(c, cat.tint);
            return FadeSlideIn(
              index: i,
              step: const Duration(milliseconds: 25),
              child: Pressable(
                onTap: () => setState(() {
                  _open = cat;
                  _filter = '';
                }),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(color: Color.alphaBlend(tint.withValues(alpha: 0.14), c.surface), borderRadius: BorderRadius.circular(11)),
                      child: Icon(nattarivuIcons[cat.id] ?? LucideIcons.leaf, size: 18, color: tint),
                    ),
                    const Spacer(),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(cat.ml, maxLines: 1, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 17, fontWeight: FontWeight.w700, color: c.ink)),
                    ),
                    Text('${cat.en} · ${context.t('nattarivu.words', {'count': cat.words.length})}', maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelSmall),
                  ]),
                ),
              ),
            );
          },
        ),
      ),
    ]);
  }

  Widget _words(NattarivuCategory cat) {
    final c = context.c;
    final q = _filter.trim().toLowerCase();
    final words = cat.words.where((w) => q.isEmpty || w.ml.contains(q) || w.en.toLowerCase().contains(q)).toList();
    final rows = <Widget>[];
    String? group;
    for (final (i, w) in words.indexed) {
      if (w.groupMl != null && w.groupMl != group) {
        group = w.groupMl;
        rows.add(Padding(
          padding: const EdgeInsets.fromLTRB(6, 18, 6, 6),
          child: Text('${w.groupMl} · ${w.groupEn}', style: Theme.of(context).textTheme.labelLarge?.copyWith(color: _tint(c, cat.tint))),
        ));
      }
      rows.add(FadeSlideIn(
        index: i < 16 ? i : 0,
        step: const Duration(milliseconds: 15),
        offset: 6,
        child: ListTile(
          title: Text(w.ml, style: const TextStyle(fontFamily: LitmaFonts.display, fontSize: 18, fontWeight: FontWeight.w600)),
          subtitle: Text(w.en),
          trailing: Icon(LucideIcons.chevronRight, size: 18, color: c.muted),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          onTap: () => widget.onWord(w.ml, cat.ml),
        ),
      ));
    }
    return ListView(key: ValueKey(cat.id), padding: const EdgeInsets.fromLTRB(10, 0, 10, 40), children: [
      Row(children: [
        IconButton(icon: const Icon(LucideIcons.arrowLeft), onPressed: () => setState(() => _open = null), tooltip: context.t('nattarivu.all')),
        Icon(nattarivuIcons[cat.id] ?? LucideIcons.leaf, color: _tint(c, cat.tint), size: 20),
        const SizedBox(width: 10),
        Expanded(child: Text(cat.ml, style: Theme.of(context).textTheme.headlineSmall)),
      ]),
      Padding(
        padding: const EdgeInsets.fromLTRB(6, 6, 6, 4),
        child: TextField(
          onChanged: (v) => setState(() => _filter = v),
          decoration: InputDecoration(hintText: context.t('nattarivu.filter'), prefixIcon: Icon(LucideIcons.listFilter, size: 18, color: c.muted), contentPadding: const EdgeInsets.symmetric(vertical: 12)),
        ),
      ),
      if (words.isEmpty) Padding(padding: const EdgeInsets.all(24), child: Text(context.t('nattarivu.noMatch', {'q': _filter}), textAlign: TextAlign.center)),
      ...rows,
    ]);
  }
}

class _SavedView extends ConsumerWidget {
  const _SavedView({required this.onWord});
  final ValueChanged<String> onWord;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final list = ref.watch(bookmarksProvider).value;
    if (list == null) return const Padding(padding: EdgeInsets.all(16), child: SkeletonCard());
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 72, height: 72, decoration: BoxDecoration(color: c.subtle, borderRadius: BorderRadius.circular(22)), child: Icon(LucideIcons.bookmark, size: 30, color: c.tintCoral)),
            const SizedBox(height: 16),
            Text(context.t('saved.emptyTitle'), style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(context.t('saved.emptyBody'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted)),
          ]),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 40),
      itemCount: list.length,
      itemBuilder: (context, i) {
        final b = list[i];
        final word = '${b['word']}';
        return FadeSlideIn(
          index: i,
          child: Dismissible(
            key: ValueKey('bm-$word'),
            direction: DismissDirection.endToStart,
            background: Container(alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 20), child: Icon(LucideIcons.trash2, color: c.danger)),
            onDismissed: (_) async {
              await ref.read(servicesProvider).store.removeBookmark(word);
              ref.invalidate(bookmarksProvider);
            },
            child: Card(
              elevation: 0,
              color: c.surface,
              margin: const EdgeInsets.only(bottom: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(LitmaRadius.md), side: BorderSide(color: c.line)),
              child: ListTile(
                title: Text(word, style: const TextStyle(fontFamily: LitmaFonts.display, fontSize: 18, fontWeight: FontWeight.w700)),
                subtitle: b['meaning'] == null ? null : Text('${b['meaning']}', maxLines: 2, overflow: TextOverflow.ellipsis),
                trailing: Icon(LucideIcons.chevronRight, size: 18, color: c.muted),
                onTap: () => onWord(word),
              ),
            ),
          ),
        );
      },
    );
  }
}
