import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/forms.dart';
import '../../data/story.dart';
import '../../widgets/common.dart';
import '../../core/keyboard.dart';
import '../../data/analytics.dart';

/// Story World (കഥാലോകം) for one work: characters, places, objects, plot board, timeline, notes
/// and a report, with the sections each writing type uses (the web's StoryWorld).
class StoryWorldScreen extends ConsumerStatefulWidget {
  const StoryWorldScreen({super.key, required this.docId, required this.kind, required this.settings, required this.onSettings});
  final String docId;
  final DocKind kind;
  final Json settings;

  /// Save work settings (plot board columns live in settings.beatColumns).
  final void Function(Json patch) onSettings;

  static Route<void> route({required String docId, required DocKind kind, required Json settings, required void Function(Json) onSettings}) =>
      MaterialPageRoute(builder: (_) => StoryWorldScreen(docId: docId, kind: kind, settings: settings, onSettings: onSettings));

  @override
  ConsumerState<StoryWorldScreen> createState() => _StoryWorldScreenState();
}

class _StoryWorldScreenState extends ConsumerState<StoryWorldScreen> {
  late final tabs = storyTabsFor(widget.kind);
  int _tab = 0;
  List<Json>? _items;
  late List<String> _columns = ((widget.settings['beatColumns'] as List?)?.cast<String>()) ?? defaultBeatGroups(widget.kind);

  @override
  void initState() {
    super.initState();
    Analytics.screen('/story/');
    _load();
  }

  Future<void> _load() async {
    final items = await ref.read(servicesProvider).store.listStory(widget.docId).catchError((_) => <Json>[]);
    if (mounted) setState(() => _items = items);
  }

  StoryTab get _current => tabs[_tab];

  Future<void> _edit({Json? item, StoryKind? kind, String? group}) async {
    final k = kind ?? storyKindFrom(item?['kind'] as String?);
    final tab = tabs.firstWhere((t) => t.kind == k, orElse: () => tabs.first);
    final draft = item ?? {'document_id': widget.docId, 'kind': k.name, 'name': '', 'summary': '', 'data': {if (k == StoryKind.beat) 'group': group ?? _columns.first}};
    final result = await showModalBottomSheet<Object>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _CardEditor(item: draft, tab: tab, columns: _columns),
    );
    final store = ref.read(servicesProvider).store;
    if (result == 'delete' && item?['id'] != null) {
      await store.deleteStory(item!['id'] as String);
    } else if (result is Json) {
      // a card closed with nothing written in it is not kept (as on the web)
      if (isBlankItem(result)) {
        if (result['id'] != null) await store.deleteStory(result['id'] as String);
      } else {
        await store.saveStory(result);
      }
    }
    await _load();
  }

  Future<void> _moveBeat(Json it, int dir) async {
    final g = (it['data'] as Map?)?['group'] as String? ?? _columns.first;
    final i = (_columns.indexOf(g) + dir).clamp(0, _columns.length - 1);
    Haptics.tap();
    await ref.read(servicesProvider).store.saveStory({...it, 'data': {...?(it['data'] as Map?)?.cast<String, dynamic>(), 'group': _columns[i]}});
    await _load();
  }

  Future<void> _addColumn() async {
    final ctrl = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.t('app.story.newColumn')),
        content: TextField(controller: ctrl, autofocus: true, onSubmitted: (v) => Navigator.pop(context, v)),
        actions: [FilledButton(onPressed: () => Navigator.pop(context, ctrl.text), child: Text(context.t('app.books.add')))],
      ),
    );
    if (name == null || name.trim().isEmpty) return;
    setState(() => _columns = [..._columns, name.trim()]);
    widget.onSettings({'beatColumns': _columns});
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final items = _items;
    final t = _current;
    return Scaffold(
      appBar: AppBar(title: Text('കഥാലോകം · Story World', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700))),
      floatingActionButton: t.kind == null
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _edit(kind: t.kind),
              icon: const Icon(LucideIcons.plus, size: 20),
              label: Text(context.t('app.story.add', {'what': t.ml})),
            ),
      body: Column(children: [
        SegmentTabs(scrollable: true, labels: [for (final x in tabs) x.ml], index: _tab, onChanged: (i) => setState(() => _tab = i)),
        const SizedBox(height: 8),
        Expanded(
          child: items == null
              ? const Padding(padding: EdgeInsets.all(16), child: SkeletonCard())
              : AnimatedSwitcher(
                  duration: Motion.of(context, Motion.medium),
                  switchInCurve: Motion.emphasizedDecelerate,
                  child: KeyedSubtree(key: ValueKey(_tab), child: _body(context, c, items, t)),
                ),
        ),
      ]),
    );
  }

  Widget _body(BuildContext context, LitmaTokens c, List<Json> items, StoryTab t) {
    if (t.kind == null) return _report(context, c, items);
    final mine = items.where((i) => i['kind'] == t.kind!.name).toList();
    if (t.kind == StoryKind.beat) return _board(context, c, mine);
    if (mine.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 72, height: 72, decoration: BoxDecoration(color: c.accentSoft, borderRadius: BorderRadius.circular(22)), child: Icon(_icon(t.kind!), size: 30, color: c.accent)),
            const SizedBox(height: 14),
            Text(context.t('app.story.empty', {'what': t.ml}), textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: c.muted)),
          ]),
        ),
      );
    }
    final timeline = t.kind == StoryKind.event;
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 110),
      itemCount: mine.length,
      itemBuilder: (context, i) {
        final it = mine[i];
        final data = (it['data'] as Map?) ?? const {};
        final sub = [if ('${it['summary'] ?? ''}'.isNotEmpty) '${it['summary']}', for (final f in storyFields[t.kind]!.take(3)) if ('${data[f.key] ?? ''}'.isNotEmpty) '${data[f.key]}'].join(' · ');
        final card = Pressable(
          onTap: () => _edit(item: it),
          scale: 0.985,
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (!timeline)
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  margin: const EdgeInsets.only(right: 14),
                  decoration: BoxDecoration(color: c.accentSoft, shape: BoxShape.circle),
                  child: Text(('${it['name']}'.trim().isEmpty ? '?' : '${it['name']}'.trim().characters.first), style: TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700, color: c.optionSelectedInk, fontSize: 17)),
                ),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (timeline && '${data['when'] ?? ''}'.isNotEmpty) Text('${data['when']}', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: c.highlight)),
                  Text('${it['name']}'.trim().isEmpty ? context.t('app.story.untitled') : '${it['name']}', style: const TextStyle(fontFamily: LitmaFonts.display, fontSize: 17, fontWeight: FontWeight.w700)),
                  if (sub.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(sub, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted))),
                ]),
              ),
            ]),
          ),
        );
        if (!timeline) return FadeSlideIn(index: i, child: card);
        // a timeline: dots on a line down the left
        return FadeSlideIn(
          index: i,
          child: IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SizedBox(
                width: 26,
                child: Column(children: [
                  Container(width: 2, height: 18, color: i == 0 ? Colors.transparent : c.line),
                  Container(width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, color: c.accent, border: Border.all(color: c.surface, width: 2))),
                  Expanded(child: Container(width: 2, color: i == mine.length - 1 ? Colors.transparent : c.line)),
                ]),
              ),
              const SizedBox(width: 6),
              Expanded(child: card),
            ]),
          ),
        );
      },
    );
  }

  Widget _board(BuildContext context, LitmaTokens c, List<Json> beats) {
    Color beatColor(String? k) => switch (k) { 'kasavu' => c.highlight, 'rose' => c.tintCoral, 'sky' => c.tintSky, 'grey' => c.muted, _ => c.accent };
    return ListView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
      children: [
        for (final (ci, col) in _columns.indexed)
          FadeSlideIn(
            index: ci,
            child: Container(
              width: 270,
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: c.subtle, borderRadius: BorderRadius.circular(LitmaRadius.lg)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(6, 4, 6, 10),
                  child: Row(children: [
                    Expanded(child: Text(col, style: const TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700, fontSize: 15.5))),
                    Text('${beats.where((b) => ((b['data'] as Map?)?['group'] ?? _columns.first) == col).length}', style: Theme.of(context).textTheme.labelSmall),
                  ]),
                ),
                Expanded(
                  child: ListView(children: [
                    for (final b in beats.where((b) => ((b['data'] as Map?)?['group'] ?? _columns.first) == col))
                      Pressable(
                        onTap: () => _edit(item: b),
                        scale: 0.98,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
                          decoration: BoxDecoration(
                            color: c.surface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border(left: BorderSide(color: beatColor((b['data'] as Map?)?['color'] as String?), width: 4)),
                          ),
                          child: Row(children: [
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('${b['name']}'.trim().isEmpty ? context.t('app.story.untitled') : '${b['name']}', style: const TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w600)),
                                if ('${b['summary'] ?? ''}'.isNotEmpty) Text('${b['summary']}', maxLines: 3, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
                                if ('${(b['data'] as Map?)?['status'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('${(b['data'] as Map)['status']}', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: c.highlight))),
                              ]),
                            ),
                            Column(children: [
                              IconButton(visualDensity: VisualDensity.compact, iconSize: 18, onPressed: ci == 0 ? null : () => _moveBeat(b, -1), icon: const Icon(LucideIcons.chevronLeft)),
                              IconButton(visualDensity: VisualDensity.compact, iconSize: 18, onPressed: ci == _columns.length - 1 ? null : () => _moveBeat(b, 1), icon: const Icon(LucideIcons.chevronRight)),
                            ]),
                          ]),
                        ),
                      ),
                    TextButton.icon(onPressed: () => _edit(kind: StoryKind.beat, group: col), icon: const Icon(LucideIcons.plus, size: 16), label: Text(context.t('app.story.addCard'))),
                  ]),
                ),
              ]),
            ),
          ),
        Center(child: OutlinedButton.icon(onPressed: _addColumn, icon: const Icon(LucideIcons.columns3, size: 16), label: Text(context.t('app.story.newColumn')))),
      ],
    );
  }

  Widget _report(BuildContext context, LitmaTokens c, List<Json> items) {
    final counts = {for (final tb in tabs.where((x) => x.kind != null)) tb: items.where((i) => i['kind'] == tb.kind!.name).length};
    return ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
      for (final (i, e) in counts.entries.indexed)
        FadeSlideIn(
          index: i,
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(_icon(e.key.kind!), size: 18, color: c.accent),
                const SizedBox(width: 10),
                Expanded(child: Text('${e.key.ml} · ${e.key.label}', style: const TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700))),
                Text('${e.value}', style: Theme.of(context).textTheme.titleMedium),
              ]),
              if (e.value > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    items.where((it) => it['kind'] == e.key.kind!.name).map((it) => '${it['name']}'.trim()).where((n) => n.isNotEmpty).join(' · '),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
            ]),
          ),
        ),
    ]);
  }

  IconData _icon(StoryKind k) => switch (k) {
        StoryKind.character => LucideIcons.users,
        StoryKind.location => LucideIcons.mapPin,
        StoryKind.item => LucideIcons.package,
        StoryKind.beat => LucideIcons.columns3,
        StoryKind.event => LucideIcons.history,
        StoryKind.note => LucideIcons.stickyNote,
      };
}

/// The card editor: name, the one-line summary and the kind's own fields.
class _CardEditor extends StatefulWidget {
  const _CardEditor({required this.item, required this.tab, required this.columns});
  final Json item;
  final StoryTab tab;
  final List<String> columns;

  @override
  State<_CardEditor> createState() => _CardEditorState();
}

class _CardEditorState extends State<_CardEditor> {
  late final Json _data = {...?(widget.item['data'] as Map?)?.cast<String, dynamic>()};
  late final _name = TextEditingController(text: '${widget.item['name'] ?? ''}');
  late final _summary = TextEditingController(text: '${widget.item['summary'] ?? ''}');
  late final _fields = {for (final f in storyFields[storyKindFrom(widget.item['kind'] as String?)]!) f.key: TextEditingController(text: '${_data[f.key] ?? ''}')};

  Json _result() => {
        ...widget.item,
        'name': _name.text.trim(),
        'summary': _summary.text.trim(),
        'data': {..._data, for (final e in _fields.entries) if (!_isOption(e.key)) e.key: e.value.text.trim()},
      };

  bool _isOption(String key) => storyFields[storyKindFrom(widget.item['kind'] as String?)]!.any((f) => f.key == key && f.options != null) || key == 'group';

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final kind = storyKindFrom(widget.item['kind'] as String?);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _result());
      },
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.85,
          maxChildSize: 0.95,
          builder: (context, scroll) => ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(20, 0, 20, 32), children: [
            Row(children: [
              Expanded(child: Text(widget.tab.ml, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontFamily: LitmaFonts.display))),
              if (widget.item['id'] != null)
                IconButton(tooltip: context.t('common.delete'), onPressed: () => Navigator.pop(context, 'delete'), icon: Icon(LucideIcons.trash2, color: c.danger, size: 20)),
              FilledButton(onPressed: () => Navigator.pop(context, _result()), child: Text(context.t('common.save'))),
            ]),
            const SizedBox(height: 12),
            TextField(onTapOutside: dismissKeyboard, controller: _name, autofocus: widget.item['id'] == null, style: const TextStyle(fontFamily: LitmaFonts.display, fontSize: 20, fontWeight: FontWeight.w700), decoration: InputDecoration(labelText: context.t('app.story.name'))),
            const SizedBox(height: 12),
            TextField(onTapOutside: dismissKeyboard, controller: _summary, maxLines: 3, minLines: 1, decoration: InputDecoration(labelText: widget.tab.summary ?? context.t('app.story.summary'))),
            for (final f in storyFields[kind]!)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: f.key == 'group'
                    ? _choice(context, f.label, widget.columns, _data['group'] as String? ?? widget.columns.first, (v) => setState(() => _data['group'] = v))
                    : f.options != null
                        ? _choice(context, f.label, f.options!, _data[f.key] as String?, (v) => setState(() => _data[f.key] = v))
                        : TextField(onTapOutside: dismissKeyboard, controller: _fields[f.key], maxLines: f.multiline ? 5 : 1, minLines: 1, decoration: InputDecoration(labelText: f.label, hintText: f.placeholder)),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _choice(BuildContext context, String label, List<String> options, String? value, ValueChanged<String> onPick) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final o in options) ChoiceChip(label: Text(o), selected: o == value, onSelected: (_) => onPick(o)),
        ]),
      ]);
}
