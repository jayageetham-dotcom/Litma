import 'dart:async';

import 'package:flutter/material.dart';
// material exports ScrollCacheExtent from Flutter 3.50; older SDKs need this import
// ignore: unnecessary_import
import 'package:flutter/rendering.dart' show ScrollCacheExtent;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app/providers.dart';
import '../core/config.dart';
import '../core/i18n.dart';
import '../core/manglish.dart';
import '../core/motion.dart';
import '../core/theme.dart';
import '../data/forms.dart';
import '../data/models.dart';
import '../data/spell.dart';
import '../features/reader/reader_screen.dart';
import '../widgets/brand.dart';
import '../widgets/script_field.dart';
import 'block_controller.dart';
import 'block_style.dart';
import 'document.dart';
import 'page_view.dart';
import 'pages.dart';
import 'saver.dart';
import 'selection_layer.dart';
import 'session.dart';
import 'suggestion_rows.dart';
import 'tools.dart';
import 'work_tools.dart';
import 'writing_aids.dart';
import 'writing_timer.dart';
import '../data/analytics.dart';

/// Opens a work: loads it (from the server or this phone), restores a newer journal, then edits.
class EditorScreen extends ConsumerStatefulWidget {
  const EditorScreen({super.key, required this.docId, this.initial});
  final String docId;

  /// The work when the caller already has it (just created): no loading step.
  final LitmaDoc? initial;

  @override
  ConsumerState<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends ConsumerState<EditorScreen> {
  EditorSession? _session;
  Object? _error;

  @override
  void initState() {
    super.initState();
    Analytics.screen('/write/');
    _open();
  }

  Future<void> _open() async {
    final services = ref.read(servicesProvider);
    try {
      final doc = widget.initial ?? await services.store.getDoc(widget.docId);
      if (doc == null) throw StateError('missing');
      // crash recovery: a journal on the phone newer than the saved copy wins
      final j = await services.offline.get('journal', doc.id);
      Json? restored;
      if (j != null && DateTime.tryParse('${j['at']}')?.isAfter(doc.updatedAt) == true) restored = (j['doc'] as Map).cast<String, dynamic>();
      final s = EditorSession(doc: doc, store: services.store, restored: restored);
      if (await services.offline.hasPending('documents', doc.id)) s.saver.markLocal();
      if (mounted) setState(() => _session = s);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  void dispose() {
    final s = _session;
    if (s != null) {
      // save what's left (or discard an untouched new work), then let go
      unawaited(s.close().whenComplete(s.dispose));
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = _session;
    if (_error != null) return _NotAvailable(offline: '$_error'.contains('Offline'));
    if (s == null) return Scaffold(body: InkLoader(label: context.t('loading.work')));
    return _Editor(session: s);
  }
}

class _NotAvailable extends StatelessWidget {
  const _NotAvailable({required this.offline});
  final bool offline;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(offline ? LucideIcons.cloudOff : LucideIcons.fileQuestion, size: 40, color: context.c.muted),
              const SizedBox(height: 16),
              Text(offline ? context.t('offline.notOnDeviceTitle') : 'Document not found', style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(offline ? context.t('offline.notOnDevice') : 'It may have been deleted, or it belongs to another account.', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: context.c.muted)),
            ]),
          ),
        ),
      );
}

class _Editor extends ConsumerStatefulWidget {
  const _Editor({required this.session});
  final EditorSession session;

  @override
  ConsumerState<_Editor> createState() => _EditorState();
}

class _EditorState extends ConsumerState<_Editor> {
  EditorSession get s => widget.session;
  final _scroll = ScrollController();

  // suggestions for the Manglish word being typed
  String? _word;
  List<String> _candidates = const [];
  Timer? _suggestTimer;

  @override
  void initState() {
    super.initState();
    s.addListener(_changed);
    // a space takes what the strip shows first: Google's best once it answered, else the offline list's
    s.spelling = (word) => _best[word] ?? _firstOffline(word);
    s.reveal = _reveal;
    s.storyClosed = _loadStoryNames;
    _translit = ref.read(servicesProvider).transliterator;
    _loadStoryNames();
    WritingTimer.instance.onDone = _timerDone;
    setupSpellMarks(ref, s);
  }

  /// The writing timer ended while the work is open: a card with the words written.
  void _timerDone(int words, int minutes) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('${context.t('goals.timer.doneTitle')}. ${context.t('goals.timer.doneBody', {'count': words, 'minutes': minutes})}'),
      duration: const Duration(seconds: 8),
      persist: false,
      action: SnackBarAction(label: context.t('goals.timer.again', {'minutes': minutes}), onPressed: () => WritingTimer.instance.start(minutes, s.doc.id, s.words, title: context.t('goals.timer.doneTitle'), body: context.t('goals.timer.notifyBody', {'minutes': minutes}))),
    ));
  }

  /// Lines far down the page aren't built yet: scroll near the line first, then focus it.
  void _reveal(TextBlock line) {
    final i = s.topIndexOf(line);
    if (i >= 0 && _scroll.hasClients) {
      final max = _scroll.position.maxScrollExtent;
      final n = s.document.blocks.length;
      _scroll.jumpTo((max * i / (n > 1 ? n - 1 : 1)).clamp(0.0, max));
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => s.focusLine(line, at: s.controllerFor(line).blockSelection.extentOffset));
  }

  @override
  void dispose() {
    s.removeListener(_changed);
    s.spelling = null;
    s.reveal = null;
    s.storyClosed = null;
    _translit.setStoryNames(const []); // another work's names don't carry over
    if (WritingTimer.instance.onDone == _timerDone) WritingTimer.instance.onDone = null;
    _suggestTimer?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  late final Transliterator _translit;

  String? _firstOffline(String word) {
    final list = ref.read(servicesProvider).transliterator.offline(word);
    return list.isEmpty ? null : list.first;
  }

  /// The work's Story World names become the writer's own words (first in Manglish suggestions when
  /// they fit, never marked by the spelling check). Again whenever Story World closes.
  Future<void> _loadStoryNames() async {
    final services = ref.read(servicesProvider);
    final items = await services.store.listStory(s.doc.id).catchError((_) => <Json>[]);
    if (!mounted) return;
    services.transliterator.setStoryNames(items.map((i) => '${i['name'] ?? ''}'));
    _best.clear(); // lists change with the names
    setupSpellMarks(ref, s);
  }

  /// The writer chose [choice] for [word]: remembered on this phone and used for the next space.
  void _chose(String word, String choice) {
    ref.read(servicesProvider).transliterator.rememberPick(word, choice);
    _best[word] = choice;
  }

  /// Best spelling per word once Google has answered, so a space takes what the strip shows.
  final _best = <String, String>{};

  void _changed() {
    final word = s.current?.wordAtCursor;
    if (word != _word) {
      _word = word;
      _suggestTimer?.cancel();
      if (word == null) {
        _candidates = const [];
      } else {
        final known = _best[word];
        _candidates = known != null ? [known] : ref.read(servicesProvider).transliterator.offline(word);
        _suggestTimer = Timer(const Duration(milliseconds: 140), () async {
          final list = await ref.read(servicesProvider).transliterator.candidates(word);
          if (list.isNotEmpty) {
            if (_best.length > 300) _best.clear();
            _best[word] = list.first;
          }
          if (mounted && _word == word) setState(() => _candidates = list.take(Transliterator.maxCandidates).toList());
        });
      }
    }
    if (mounted) setState(() {});
  }

  Future<void> _rename() async {
    // Manglish, Malayalam or English, with the same മലയാളം / As typed switch as Book details
    var name = s.title;
    final save = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.t('app.editor.renameTitle')),
        content: SizedBox(
          width: 420,
          child: ScriptField(
            label: context.t('bookDetails.title'),
            storageKey: 'work.title',
            value: name,
            autofocus: true,
            onChanged: (v) => name = v,
            onSubmitted: () => Navigator.pop(context, true),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), style: TextButton.styleFrom(foregroundColor: context.c.ink), child: Text(context.t('common.cancel'))),
          FilledButton(
            onPressed: () async {
              // leaving the field turns a last Manglish word into Malayalam first
              FocusManager.instance.primaryFocus?.unfocus();
              await Future<void>.delayed(Duration.zero);
              if (context.mounted) Navigator.pop(context, true);
            },
            child: Text(context.t('common.save')),
          ),
        ],
      ),
    );
    if (save == true && name.trim().isNotEmpty) await s.rename(name.trim());
  }

  void _read() {
    FocusScope.of(context).unfocus();
    Navigator.of(context).push(ReaderScreen.route(title: s.title, kind: s.kind, settings: s.settings, document: s.document));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom > 0;
    final writing = keyboard && s.focused != null;
    s.styler = (m, b) => markStyle(m, b, dark: context.isDark, t: c);

    return PopScope(
      // Android back with a selection ends the selection first, as with the keyboard (audit, 26 Nov)
      canPop: !s.hasSpan,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) s.clearSpan();
      },
      child: Scaffold(
        backgroundColor: MediaQuery.sizeOf(context).width >= 760 ? c.canvas : c.paper,
        appBar: AppBar(
          backgroundColor: MediaQuery.sizeOf(context).width >= 760 ? c.canvas : c.paper,
          titleSpacing: 0,
          title: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: _rename,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontFamily: LitmaFonts.display)),
                  const SizedBox(height: 1),
                  _SaveLine(session: s),
                ],
              ),
            ),
          ),
          actions: [
            // the writing timer's time left; opens Goal and timer
            ListenableBuilder(
              listenable: WritingTimer.instance,
              builder: (context, _) {
                final t = WritingTimer.instance;
                if (!t.active) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(right: 2),
                  child: ActionChip(
                    avatar: Icon(LucideIcons.timer, size: 14, color: t.running ? c.accent : c.muted),
                    label: Text(t.clock, style: TextStyle(fontFeatures: const [FontFeature.tabularFigures()], color: t.running ? c.accent : c.muted, fontWeight: FontWeight.w600, fontSize: 12.5)),
                    visualDensity: VisualDensity.compact,
                    side: BorderSide.none,
                    backgroundColor: t.running ? c.accentSoft : c.subtle,
                    tooltip: context.t('goals.timer.chip', {'time': t.clock}),
                    onPressed: () => showGoalSheet(context, ref, s),
                  ),
                );
              },
            ),
            IconButton(
              tooltip: context.t('app.tools.find'),
              onPressed: () {
                Analytics.tap('app.tools.find');
                showFindSheet(context, s);
              },
              icon: Icon(LucideIcons.search, size: 21, color: c.ink),
            ),
            IconButton(tooltip: context.t('app.tools.title'), onPressed: () => showToolsSheet(context, ref, s), icon: Icon(LucideIcons.layoutGrid, size: 21, color: c.ink)),
            IconButton(tooltip: context.t('app.editor.read'), onPressed: _read, icon: const Icon(LucideIcons.bookOpen, size: 21)),
            _MoreMenu(session: s, onRename: _rename, onRead: _read),
          ],
        ),
        body: Column(
          children: [
            Expanded(child: _Page(session: s, controller: _scroll)),
            AnimatedSwitcher(
              duration: Motion.of(context, Motion.medium),
              switchInCurve: Motion.emphasizedDecelerate,
              switchOutCurve: Curves.easeIn,
              transitionBuilder: (child, a) => SizeTransition(sizeFactor: a, alignment: Alignment.topCenter, child: FadeTransition(opacity: a, child: child)),
              child: writing
                  ? _KeyboardBar(key: const ValueKey('bar'), session: s, word: _word, candidates: _candidates, onKeepWord: (w) => keepSpellingWord(ref, s, w), onSuggestWord: (w) => ref.read(servicesProvider).transliterator.similar(w), onChoseSpelling: _chose, onLookUp: () => showLookUpSheet(context, s), onAi: () => showAiSheet(context, ref, s), onInbox: () {
                      FocusScope.of(context).unfocus();
                      showInboxSheet(context, ref, s);
                    })
                  : _Footer(key: const ValueKey('footer'), session: s),
            ),
          ],
        ),
      ),
    );
  }
}

/// "നോവൽ · All changes saved", morphing as the status changes.
class _SaveLine extends StatelessWidget {
  const _SaveLine({required this.session});
  final EditorSession session;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ValueListenableBuilder<SaveStatus>(
      valueListenable: session.saver.status,
      builder: (context, st, _) {
        final narrow = MediaQuery.sizeOf(context).width < 400;
        final (String text, Widget? icon, Color color) = session.pristine && session.doc.pristine
            ? (context.t('app.editor.empty'), null, c.muted)
            : switch (st) {
                SaveStatus.saving => (context.t('app.editor.saving'), SizedBox.square(dimension: 9, child: CircularProgressIndicator(strokeWidth: 1.6, color: c.muted)), c.muted),
                SaveStatus.dirty => (context.t('app.editor.dirty'), Icon(LucideIcons.pen, size: 11, color: c.muted), c.muted),
                SaveStatus.local => (narrow ? context.t('app.editor.localShort') : context.t('app.editor.local'), Icon(LucideIcons.cloudOff, size: 11, color: c.highlight), c.highlight),
                SaveStatus.failed => (context.t('app.editor.failed'), Icon(LucideIcons.triangleAlert, size: 11, color: c.danger), c.danger),
                SaveStatus.saved => (narrow ? context.t('app.editor.savedShort') : context.t('app.editor.saved'), Icon(LucideIcons.check, size: 11, color: c.accent), c.muted),
              };
        return Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: _kindDot(context, session.kind))),
          const SizedBox(width: 6),
          Text(kindNames[session.kind]!.ml, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 12, fontWeight: FontWeight.w600, color: c.highlight)),
          Text('  ·  ', style: TextStyle(fontSize: 12, color: c.muted)),
          Flexible(
            child: SwapFade(
              child: Row(key: ValueKey('$st${session.pristine}'), mainAxisSize: MainAxisSize.min, children: [
                if (icon != null) ...[icon, const SizedBox(width: 4)],
                Flexible(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: color))),
              ]),
            ),
          ),
        ]);
      },
    );
  }
}

/// The small dot per writing type (the web's kindDot, same order as the home page).
Color _kindDot(BuildContext context, DocKind k) {
  final c = context.c;
  final tints = [c.tintViolet, c.tintCoral, c.tintSky, c.tintLime, c.tintTangerine];
  return tints[DocKind.values.indexOf(k) % tints.length];
}

Color kindDot(BuildContext context, DocKind k) => _kindDot(context, k);

/// The writing as pages (`pages.dart`): measured lines flow onto pages of the work's paper size,
/// with a quiet gap and a small + between two pages.
class _Page extends StatefulWidget {
  const _Page({required this.session, required this.controller});
  final EditorSession session;
  final ScrollController controller;

  @override
  State<_Page> createState() => _PageState();
}

class _PageState extends State<_Page> {
  /// Measured heights of lines on screen (by block; endnotes by [_notesKey]).
  final _heights = Map<Object, double>.identity();
  static const _notesKey = 'endnotes';
  var _relayout = false;

  void _measured(Object key, double h) {
    final old = _heights[key];
    if (old != null && (old - h).abs() < 0.5) return;
    _heights[key] = h;
    if (_relayout) return;
    _relayout = true;
    // pages move after the frame that measured the lines
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _relayout = false;
      if (mounted) setState(() {});
    });
  }

  /// A rough height for a line not built yet (far off screen); replaced once it is measured.
  double _estimate(Block b, Map<TextBlock, BlockLook> looks, double width, double em) {
    if (b is OpaqueBlock) return em * 3;
    final look = b is TextBlock ? looks[b] : null;
    final size = look?.style.fontSize ?? em;
    final line = (look?.style.height ?? 1.75) * size;
    final perLine = (width / (size * 0.62)).floor().clamp(8, 400);
    var lines = 0;
    for (final part in b.plainText.split('\n')) {
      lines += (part.length / perLine).ceil().clamp(1, 100000);
    }
    return lines * line + size * 0.6;
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final c = context.c;
    final page = PageLook(kind: session.kind, settings: session.settings, t: c);
    final looks = computeLooks(session.document, page);
    final blocks = session.document.blocks;
    final pad = pagePadding(context);
    final notes = footnotesOf(session);
    final numbers = Map<Json, int>.identity();
    for (final (i, n) in notes.indexed) {
      numbers[n] = i + 1;
    }
    final spellColors = {SpellKind.unicode: c.accent, SpellKind.mistake: c.danger, SpellKind.suspect: c.highlight, SpellKind.unknown: c.muted};
    Widget lineFor(TextBlock b) {
      session.controllerFor(b)
        ..footnoteNumber = ((atom) => numbers[atom])
        ..spellColors = spellColors;
      return EditableLine(session: session, block: b, look: looks[b]!, prompt: promptFor(b));
    }

    // forget lines that are gone
    if (_heights.length > blocks.length + 64) {
      final live = Set<Object>.identity()..addAll(blocks)..add(_notesKey);
      _heights.removeWhere((k, _) => !live.contains(k));
    }

    final wide = MediaQuery.sizeOf(context).width >= 760;
    Widget paper(Widget child) => ColoredBox(color: c.paper, child: Padding(padding: pad, child: child));

    return ColoredBox(
      color: c.canvas,
      child: LayoutBuilder(builder: (context, box) {
        final sheet = wide && box.maxWidth > 760 ? 760.0 : box.maxWidth;
        final width = sheet - pad.horizontal;
        final pageHeight = phonePageHeight(session.settings, width);
        final items = blocks.length + (notes.isEmpty ? 0 : 1);
        final heights = <double>[];
        final breaks = <bool>[];
        for (var i = 0; i < items; i++) {
          if (i >= blocks.length) {
            heights.add(_heights[_notesKey] ?? page.fontSize * 4);
            breaks.add(false);
            continue;
          }
          final b = blocks[i];
          final isBreak = b is OpaqueBlock && b.type == 'pageBreak';
          breaks.add(isBreak);
          heights.add(isBreak ? 0 : _heights[b] ?? _estimate(b, looks, width, page.fontSize));
        }
        final flow = flowPages(heights, breaks, pageHeight);
        Widget edge(int i, VoidCallback insert) => PageEdge(fill: flow.gapBefore[i] ?? 0.0, onInsert: insert);

        final list = GestureDetector(
          // a tap on empty paper (below the last line, between lines, in the margins) puts the cursor
          // on the nearest line, like the web's caretNear; taps on a line's text go to that line
          onTapUp: (d) => tapPaper(session, d.globalPosition),
          child: ListView.builder(
            controller: widget.controller,
            scrollCacheExtent: const ScrollCacheExtent.pixels(2400),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
            padding: EdgeInsets.only(top: wide ? 24 : 0, bottom: 140),
            // the first page's top margin, the items, and the rest of the last page
            itemCount: items + 2,
            // keep each line's field (and its focus, so the keyboard stays up) when lines are added or
            // removed above it: find a line by its key, not by its position
            findChildIndexCallback: (key) {
              if (key is! ObjectKey) return null;
              final i = blocks.indexWhere((b) => identical(b, key.value));
              return i < 0 ? null : i + 1;
            },
            itemBuilder: (context, j) {
              if (j == 0) return ColoredBox(color: c.paper, child: const SizedBox(height: pageTop));
              if (j == items + 1) return ColoredBox(color: c.paper, child: SizedBox(height: flow.lastFill + pageBottom));
              final i = j - 1;
              final starts = flow.gapBefore.containsKey(i);
              if (i >= blocks.length) {
                return Column(key: const ValueKey('endnotes'), crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  if (starts) edge(i, () => session.insertPageAt(blocks.length)) else const SizedBox.shrink(),
                  MeasureSize(onHeight: (h) => _measured(_notesKey, h), child: paper(Endnotes(notes: notes, style: page.body))),
                ]);
              }
              final b = blocks[i];
              // an inserted page break is only the edge between two pages
              if (b is OpaqueBlock && b.type == 'pageBreak') return KeyedSubtree(key: ObjectKey(b), child: edge(i, () => session.insertPageAfter(b)));
              final content = switch (b) {
                TextBlock() => lineFor(b),
                GroupBlock() => GroupRow(group: b, kind: session.kind, lineFor: lineFor, em: page.fontSize),
                OpaqueBlock() => OpaqueView(block: b, em: page.fontSize),
              };
              // always two children, so the line's field (and focus) stays when a page starts above it
              return KeyedSubtree(
                key: ObjectKey(b),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  if (starts) edge(i, () => session.insertPageAt(i)) else const SizedBox.shrink(),
                  MeasureSize(onHeight: (h) => _measured(b, h), child: paper(content)),
                ]),
              );
            },
          ),
        );
        // the selection over many lines (highlight, handles, bar) is drawn above the page
        final withSelection = Stack(children: [list, Positioned.fill(child: SelectionLayer(session: session, scroll: widget.controller))]);
        return wide ? Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 760), child: withSelection)) : withSelection;
      }),
    );
  }
}

/// When the keyboard is down: words, reading time and the typing mode.
class _Footer extends StatelessWidget {
  const _Footer({super.key, required this.session});
  final EditorSession session;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final w = session.words;
    return Container(
      decoration: BoxDecoration(color: c.paper, border: Border(top: BorderSide(color: c.line))),
      padding: EdgeInsets.fromLTRB(20, 10, 12, 10 + MediaQuery.paddingOf(context).bottom),
      child: Row(children: [
        Text(context.t('common.words', {'count': w}), style: Theme.of(context).textTheme.labelMedium?.copyWith(color: c.muted)),
        if (w > 0) Text('  ·  ${context.t('app.editor.minRead', {'n': readingMinutes(w)})}', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: c.muted)),
        const Spacer(),
        _ModeChip(session: session),
      ]),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({required this.session});
  final EditorSession session;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final label = switch (session.mode) { InputMode.manglish => 'Manglish → മലയാളം', InputMode.malayalam => 'മലയാളം', InputMode.english => 'English' };
    return Pressable(
      onTap: () => showModeSheet(context, session),
      child: AnimatedContainer(
        duration: Motion.medium,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: c.accentSoft, borderRadius: BorderRadius.circular(8)),
        child: Text(label, style: TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: 12.5, fontWeight: FontWeight.w600, color: c.optionSelectedInk)),
      ),
    );
  }
}

/// Where the writer last scrolled the tool row. The bar is rebuilt each time the keyboard
/// opens, so without this it always jumped back to the start.
double _barOffset = 0;

/// The keyboard accessory: suggestions for the Manglish word, then the writing tools.
class _KeyboardBar extends StatefulWidget {
  const _KeyboardBar({super.key, required this.session, required this.word, required this.candidates, required this.onKeepWord, required this.onSuggestWord, required this.onChoseSpelling, required this.onLookUp, required this.onAi, required this.onInbox});
  final void Function(String word) onKeepWord;
  /// Known words that sound like an unknown word (spelling "Suggest").
  final Future<List<String>> Function(String word) onSuggestWord;
  /// The writer picked a spelling other than the first for a Manglish word.
  final void Function(String word, String choice) onChoseSpelling;
  final VoidCallback onLookUp;
  final VoidCallback onAi;
  final VoidCallback onInbox;
  final EditorSession session;
  final String? word;
  final List<String> candidates;

  @override
  State<_KeyboardBar> createState() => _KeyboardBarState();
}

class _KeyboardBarState extends State<_KeyboardBar> {
  late final ScrollController _tools = ScrollController(initialScrollOffset: _barOffset)..addListener(_remember);

  void _remember() => _barOffset = _tools.offset;

  @override
  void dispose() {
    _tools.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final s = widget.session;
    final word = widget.word;
    final candidates = widget.candidates;
    // a marked word the cursor is in (no Manglish word being typed): its spellings take the row
    final spell = word == null ? s.current?.spellAtCursor : null;
    final drama = s.kind == DocKind.drama || s.kind == DocKind.screenplay;
    return Material(
      color: c.surface,
      child: Container(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line))),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(
            height: 50,
            child: ListView(
              controller: _tools,
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 6),
              children: [
                _Tool(icon: LucideIcons.undo2, label: context.t('app.editor.undo'), onTap: s.canUndo ? s.undo : null),
                _Tool(icon: LucideIcons.redo2, label: context.t('app.editor.redo'), onTap: s.canRedo ? s.redo : null),
                const _Sep(),
                _BlockButton(session: s),
                const _Sep(),
                _Tool(icon: LucideIcons.bold, label: context.t('app.editor.bold'), active: s.markActive('bold'), onTap: () => s.toggleMark('bold')),
                _Tool(icon: LucideIcons.italic, label: context.t('app.editor.italic'), active: s.markActive('italic'), onTap: () => s.toggleMark('italic')),
                _Tool(icon: LucideIcons.underline, label: context.t('app.editor.underline'), active: s.markActive('underline'), onTap: () => s.toggleMark('underline')),
                _Tool(icon: LucideIcons.strikethrough, label: context.t('app.editor.strike'), active: s.markActive('strike'), onTap: () => s.toggleMark('strike')),
                // size, colour, highlight, lists: the full Format sheet (the web's "All formatting")
                _Tool(
                  icon: LucideIcons.palette,
                  label: context.t('app.tools.format'),
                  tint: c.tintViolet,
                  onTap: () {
                    FocusScope.of(context).unfocus();
                    showFormatSheet(context, s);
                  },
                ),
                const _Sep(),
                _Tool(
                  icon: switch (s.align) { 'center' => LucideIcons.textAlignCenter, 'right' => LucideIcons.textAlignEnd, 'justify' => LucideIcons.textAlignJustify, _ => LucideIcons.textAlignStart },
                  label: context.t('app.editor.align'),
                  onTap: s.canAlign
                      ? () => s.setAlign(switch (s.align) { 'center' => 'right', 'right' => 'justify', 'justify' => null, _ => 'center' })
                      : null,
                ),
                if (drama) _Tool(icon: LucideIcons.messageSquareQuote, label: context.t('app.editor.dialogue'), tint: c.tintCoral, onTap: s.insertDialogue),
                _Tool(icon: LucideIcons.bookA, label: context.t('mobile.lookUp'), tint: c.tintTangerine, onTap: widget.onLookUp),
                _Tool(icon: LucideIcons.sparkles, label: context.t('mobile.askAI'), tint: c.tintViolet, onTap: widget.onAi),
                _Tool(icon: LucideIcons.inbox, label: context.t('mobile.inbox'), tint: c.tintViolet, onTap: widget.onInbox),
                _Tool(icon: LucideIcons.languages, label: context.t('app.editor.typing'), tint: c.tintTangerine, onTap: () => showModeSheet(context, s)),
                const _Sep(),
                _Tool(icon: LucideIcons.keyboardOff, label: context.t('mobile.hideKeyboard'), onTap: () => FocusScope.of(context).unfocus()),
              ],
            ),
          ),
          // right on top of the keyboard, where a phone keyboard shows its own suggestions; the row
          // stays while Manglish is on so the tools above don't jump at every word
          AnimatedSize(
            duration: Motion.of(context, Motion.fast),
            curve: Motion.emphasized,
            alignment: Alignment.bottomCenter,
            child: spell != null
                ? _SpellRow(session: s, issue: spell, onKeep: widget.onKeepWord, onSuggest: widget.onSuggestWord)
                : s.mode == InputMode.manglish
                    ? _Suggestions(session: s, word: word, candidates: candidates, onChose: widget.onChoseSpelling)
                    : const SizedBox(width: double.infinity),
          ),
        ]),
      ),
    );
  }
}

/// Malayalam spellings for the word being typed, laid out like a phone keyboard's suggestion
/// row: the word as typed in quotes (keeps English), then every spelling, best one marked, in a
/// row that scrolls sideways. A new word starts the row at the beginning.
class _Suggestions extends StatelessWidget {
  const _Suggestions({required this.session, required this.word, required this.candidates, required this.onChose});
  final EditorSession session;
  final String? word;
  final List<String> candidates;
  final void Function(String word, String choice) onChose;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final ctrl = session.current;
    final w = word;
    final list = w == null ? const <String>[] : candidates.take(Transliterator.maxCandidates).toList();
    return Container(
      height: 46,
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(6, 4, 6, 4),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line))),
      child: w == null
          ? const SizedBox.shrink()
          : ManglishRow(
              word: w,
              candidates: list,
              onKeepEnglish: () {
                ctrl?.keepEnglish = w;
                ctrl?.replaceWordAtCursor(w, w);
              },
              onPick: (cand) {
                // a spelling other than the first is the writer's own choice: offered first next time
                if (list.isNotEmpty && cand != list.first) onChose(w, cand);
                ctrl?.replaceWordAtCursor(w, cand);
              },
            ),
    );
  }
}

/// Spellings for a marked word the cursor is in (tapped, selected, or just edited and checked
/// again), in the same row as the Manglish suggestions: pick one, or Ignore (left as written for
/// this visit) or Keep (never marked again on this device). Typing on simply goes on: dialect and
/// regional words are often "unknown", and leaving them is the writer's choice.
class _SpellRow extends StatelessWidget {
  const _SpellRow({required this.session, required this.issue, required this.onKeep, this.onSuggest});
  final EditorSession session;
  final SpellIssue issue;
  final void Function(String word) onKeep;
  final Future<List<String>> Function(String word)? onSuggest;

  @override
  Widget build(BuildContext context) {
    final ctrl = session.current;
    return SpellRow(
      issue: issue,
      onFix: (fix) => session.fixAsOneStep(() => ctrl?.fixSpelling(issue, fix)),
      onIgnore: () => session.ignoreSpelling(issue.text),
      onKeep: issue.kind == SpellKind.unicode ? null : () => onKeep(issue.text),
      onSuggest: onSuggest == null ? null : () => onSuggest!(issue.text),
    );
  }
}

class _Tool extends StatelessWidget {
  const _Tool({required this.icon, required this.label, this.onTap, this.active = false, this.tint});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool active;
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final enabled = onTap != null;
    return Tooltip(
      message: label,
      child: Pressable(
        onTap: onTap,
        semanticLabel: label,
        scale: 0.9,
        child: AnimatedContainer(
          duration: Motion.of(context, Motion.fast),
          curve: Motion.pop,
          width: 44,
          margin: const EdgeInsets.symmetric(horizontal: 1, vertical: 6),
          decoration: BoxDecoration(color: active ? c.optionSelected : Colors.transparent, borderRadius: BorderRadius.circular(9)),
          child: Icon(icon, size: 20, color: !enabled ? c.disabledInk : (active ? c.optionSelectedInk : (tint ?? c.ink))),
        ),
      ),
    );
  }
}

class _Sep extends StatelessWidget {
  const _Sep();
  @override
  Widget build(BuildContext context) => Center(child: Container(width: 1, height: 22, margin: const EdgeInsets.symmetric(horizontal: 4), color: context.c.line));
}

class _BlockButton extends StatelessWidget {
  const _BlockButton({required this.session});
  final EditorSession session;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final key = session.currentBlockKey;
    final name = key == 'paragraph' ? context.t('app.editor.body') : (variantNames[key]?.ml ?? nodePrompt[key] ?? key);
    return Pressable(
      onTap: session.canChangeBlock ? () => showBlockSheet(context, session) : null,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(9), border: Border.all(color: c.line)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          SwapFade(child: Text(name, key: ValueKey(name), style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 14, fontWeight: FontWeight.w600, color: session.canChangeBlock ? c.ink : c.disabledInk))),
          const SizedBox(width: 4),
          Icon(LucideIcons.chevronDown, size: 15, color: c.muted),
        ]),
      ),
    );
  }
}

/// Line style: body text or one of the writing type's blocks, each shown in its own look.
Future<void> showBlockSheet(BuildContext context, EditorSession s) async {
  final c = context.c;
  final page = PageLook(kind: s.kind, settings: s.settings, t: c);
  final keys = ['paragraph', ...menuVariants(s.kind)];
  final current = s.currentBlockKey;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.7),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          children: [
            Padding(padding: const EdgeInsets.fromLTRB(8, 0, 8, 10), child: Text(context.t('app.editor.blockType'), style: Theme.of(context).textTheme.titleMedium)),
            for (final (i, k) in keys.indexed)
              FadeSlideIn(
                index: i,
                offset: 8,
                child: _BlockOption(
                  selected: k == current,
                  title: k == 'paragraph' ? context.t('app.editor.body') : variantNames[k]!.ml,
                  subtitle: k == 'paragraph' ? null : variantNames[k]!.label,
                  style: k == 'paragraph'
                      ? page.body
                      : lookFor(TextBlock('styledBlock', {'variant': k}, text: 'x'), page, Counters()).style,
                  onTap: () {
                    Navigator.pop(context);
                    s.setBlock(k);
                  },
                ),
              ),
          ],
        ),
      ),
    ),
  );
  WidgetsBinding.instance.addPostFrameCallback((_) {
    final f = s.focused;
    if (f != null) s.focusLine(f, at: s.controllerFor(f).blockSelection.extentOffset);
  });
}

class _BlockOption extends StatelessWidget {
  const _BlockOption({required this.selected, required this.title, this.subtitle, required this.style, required this.onTap});
  final bool selected;
  final String title;
  final String? subtitle;
  final TextStyle style;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final shown = style.copyWith(fontSize: ((style.fontSize ?? 16).clamp(13, 24)).toDouble(), height: 1.3, color: style.color);
    return Pressable(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.of(context, Motion.fast),
        margin: const EdgeInsets.only(bottom: 2),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: selected ? c.optionSelected : Colors.transparent, borderRadius: BorderRadius.circular(10)),
        child: Row(children: [
          Expanded(child: Text(title, style: shown, maxLines: 1, overflow: TextOverflow.ellipsis)),
          if (subtitle != null) Text(subtitle!, style: Theme.of(context).textTheme.bodySmall),
          AnimatedScale(
            scale: selected ? 1 : 0,
            duration: Motion.of(context, Motion.medium),
            curve: Curves.elasticOut,
            child: Padding(padding: const EdgeInsets.only(left: 10), child: Icon(LucideIcons.check, size: 18, color: c.optionSelectedInk)),
          ),
        ]),
      ),
    );
  }
}

/// Typing mode: Manglish (converted), the phone's own Malayalam keyboard, or English.
Future<void> showModeSheet(BuildContext context, EditorSession s) async {
  final c = context.c;
  final modes = [
    (InputMode.manglish, context.t('app.editor.manglish'), context.t('app.editor.manglishHint'), 'ente → എന്റെ'),
    (InputMode.malayalam, context.t('app.editor.malayalam'), context.t('app.editor.malayalamHint'), 'അ ആ ഇ'),
    (InputMode.english, context.t('app.editor.english'), context.t('app.editor.englishHint'), 'Aa'),
  ];
  await showModalBottomSheet<void>(
    context: context,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.fromLTRB(8, 0, 8, 10), child: Text(context.t('app.editor.typing'), style: Theme.of(context).textTheme.titleMedium)),
          for (final (i, (m, name, hint, sample)) in modes.indexed)
            FadeSlideIn(
              index: i,
              offset: 8,
              child: Pressable(
                onTap: () {
                  Navigator.pop(context);
                  s.setMode(m);
                },
                child: AnimatedContainer(
                  duration: Motion.fast,
                  margin: const EdgeInsets.only(bottom: 4),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: s.mode == m ? c.optionSelected : c.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: s.mode == m ? c.accent.withValues(alpha: 0.4) : c.line),
                  ),
                  child: Row(children: [
                    Container(
                      width: 64,
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: c.subtle, borderRadius: BorderRadius.circular(8)),
                      child: Text(sample, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 12.5, fontWeight: FontWeight.w600, color: c.ink)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(name, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontFamily: LitmaFonts.display)),
                        const SizedBox(height: 2),
                        Text(hint, style: Theme.of(context).textTheme.bodySmall),
                      ]),
                    ),
                    if (s.mode == m) Icon(LucideIcons.check, size: 18, color: c.optionSelectedInk),
                  ]),
                ),
              ),
            ),
        ]),
      ),
    ),
  );
}

/// What the editor hands back when the writer moved the work to trash from its menu: the desk
/// trashes it, takes it off the list and offers Undo.
class TrashedWork {
  const TrashedWork(this.id);
  final String id;
}

class _MoreMenu extends ConsumerWidget {
  const _MoreMenu({required this.session, required this.onRename, required this.onRead});
  final EditorSession session;
  final VoidCallback onRename;
  final VoidCallback onRead;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return PopupMenuButton<String>(
      icon: const Icon(LucideIcons.ellipsisVertical, size: 21),
      position: PopupMenuPosition.under,
      onSelected: (v) async {
        switch (v) {
          case 'rename':
            onRename();
          case 'story':
            openStoryWorld(context, session);
          case 'share':
            await showShareSheet(context, ref, session);
          case 'history':
            await showHistorySheet(context, ref, session);
          case 'read':
            onRead();
          case 'mode':
            await showModeSheet(context, session);
          case 'trash':
            // Close at once: the desk moves the work to trash (with Undo) and refreshes. Waiting on the
            // network here left the editor open on a slow or missing connection. An untouched new work
            // is simply discarded when the editor closes.
            final nav = Navigator.of(context);
            if (session.pristine && session.doc.pristine) {
              nav.pop();
              return;
            }
            await session.saver.flush().timeout(const Duration(seconds: 2), onTimeout: () {});
            nav.pop(TrashedWork(session.doc.id));
        }
      },
      itemBuilder: (context) => [
        _item('read', LucideIcons.bookOpen, context.t('app.editor.read'), c.ink),
        _item('story', LucideIcons.notebookPen, context.t('app.tools.story'), c.ink),
        _item('history', LucideIcons.history, context.t('app.tools.history'), c.ink),
        _item('share', LucideIcons.share2, context.t('app.tools.share'), c.ink),
        _item('rename', LucideIcons.pencilLine, context.t('app.editor.rename'), c.ink),
        _item('mode', LucideIcons.languages, context.t('app.editor.typing'), c.ink),
        const PopupMenuDivider(),
        _item('trash', LucideIcons.trash2, context.t('app.editor.moveToTrash'), c.danger),
      ],
    );
  }

  PopupMenuItem<String> _item(String v, IconData icon, String label, Color color) => PopupMenuItem(
        value: v,
        height: 44,
        child: Row(children: [Icon(icon, size: 18, color: color), const SizedBox(width: 12), Text(label, style: TextStyle(color: color))]),
      );
}

/// Puts the cursor on the line nearest [global] (a tap on empty paper): the line under the tap, or
/// the closest one above or below it. Only lines on screen count. Nothing happens if the tap was on
/// a line's own text (the line handles it).
void tapPaper(EditorSession session, Offset global) {
  // a tap on the page outside the text ends a selection, as anywhere else (owner, 26 Nov: the
  // highlight, handles and bar stayed when the tap landed on the line that was already focused)
  session.clearSpan();
  TextBlock? best;
  var bestGap = double.infinity;
  for (final b in session.lines) {
    final ctx = session.focusFor(b).context;
    final box = ctx?.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) continue;
    final rect = box.localToGlobal(Offset.zero) & box.size;
    if (rect.contains(global)) return;
    final gap = global.dy < rect.top ? rect.top - global.dy : global.dy > rect.bottom ? global.dy - rect.bottom : 0.0;
    // on equal distance prefer the later line (a tap below everything lands on the last one)
    if (gap <= bestGap) {
      bestGap = gap;
      best = b;
    }
  }
  if (best != null) session.focusLine(best);
}
