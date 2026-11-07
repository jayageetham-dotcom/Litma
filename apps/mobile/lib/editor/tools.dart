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
import 'package:url_launcher/url_launcher.dart';

import '../app/providers.dart';
import '../core/config.dart';
import '../core/i18n.dart';
import '../core/motion.dart';
import '../core/theme.dart';
import '../data/ai.dart';
import '../data/forms.dart' show DocKind, todayLine;
import '../features/dictionary/dictionary_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/story/story_world_screen.dart';
import '../widgets/common.dart';
import 'document.dart';
import 'export.dart';
import 'session.dart';
import 'work_tools.dart';

/// The editor's tools, as tinted tiles (the web's phone "More" sheet: each tool keeps its own tint).
Future<void> showToolsSheet(BuildContext context, WidgetRef ref, EditorSession s) async {
  final c = context.c;
  final tools = [
    (LucideIcons.notebookPen, context.t('app.tools.story'), c.tintLime, () => openStoryWorld(context, s)),
    (LucideIcons.bookA, context.t('nav.dictionary'), c.tintTangerine, () => showLookUpSheet(context, s)),
    (LucideIcons.sparkles, context.t('app.tools.ai'), c.tintViolet, () => showAiSheet(context, ref, s)),
    (LucideIcons.inbox, context.t('app.tools.inbox'), c.tintViolet, () => showInboxSheet(context, ref, s)),
    (LucideIcons.history, context.t('app.tools.history'), c.tintSky, () => showHistorySheet(context, ref, s)),
    (LucideIcons.share2, context.t('app.tools.share'), c.tintCoral, () => showShareSheet(context, ref, s)),
    (LucideIcons.a, context.t('app.tools.format'), c.tintViolet, () => showFormatSheet(context, s)),
    (LucideIcons.list, context.t('app.tools.outline'), c.tintSky, () => showOutlineSheet(context, s)),
    (LucideIcons.search, context.t('app.tools.find'), c.tintTangerine, () => showFindSheet(context, s)),
    (LucideIcons.bookmark, context.t('saved.title'), c.tintLime, () => showSavedWordsSheet(context, ref, s)),
    (LucideIcons.ruler, context.t('app.tools.page'), c.tintCoral, () => showPageSetupSheet(context, s)),
    (LucideIcons.fileText, context.t('editor.pages.tile'), c.tintSky, () => showPagesPreview(context, s)),
    (LucideIcons.plus, context.t('editor.insertPage'), c.tintLime, s.insertPage),
    // each writing type's own tools, as on the web toolbar
    if (s.kind == DocKind.essay || s.kind == DocKind.feature) (LucideIcons.superscript, context.t('editor.footnote.add'), c.tintViolet, () => showFootnoteDialog(context, s)),
    if (s.kind == DocKind.drama) (LucideIcons.users, context.t('editor.drama.fillCast'), c.tintCoral, () => fillCastFromStory(context, ref, s)),
    if (s.kind == DocKind.screenplay) (LucideIcons.drama, context.t('editor.scene.tools'), c.tintTangerine, () => showSceneSheet(context, s)),
    if (s.kind == DocKind.diary) (LucideIcons.calendarDays, context.t('editor.diary.newEntry'), c.tintSky, () => s.appendDiaryEntry(todayLine(DateTime.now()))),
  ];
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (sheet) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * 0.8),
        child: GridView.count(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          crossAxisCount: 3,
          shrinkWrap: true,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.05,
          children: [
            for (final (i, (icon, label, tint, run)) in tools.indexed)
              FadeSlideIn(
                index: i,
                step: const Duration(milliseconds: 30),
                child: Pressable(
                  onTap: () {
                    Navigator.pop(sheet);
                    run();
                  },
                  child: Container(
                    decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(color: Color.alphaBlend(tint.withValues(alpha: 0.14), c.surface), borderRadius: BorderRadius.circular(14)),
                        child: Icon(icon, color: tint, size: 21),
                      ),
                      const SizedBox(height: 10),
                      Text(label, textAlign: TextAlign.center, maxLines: 2, style: Theme.of(context).textTheme.labelMedium),
                    ]),
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

void openStoryWorld(BuildContext context, EditorSession s) {
  FocusScope.of(context).unfocus();
  Navigator.of(context).push(StoryWorldScreen.route(docId: s.doc.id, kind: s.kind, settings: s.settings, onSettings: s.updateSettings));
}

/// A sheet with the dictionary; tapping a word puts it into the writing (replacing a selection).
Future<void> showLookUpSheet(BuildContext context, EditorSession s) {
  final word = s.selectedText.trim().isNotEmpty ? s.selectedText.trim() : (s.current?.wordAtCursor ?? _wordAtCursor(s));
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheet) => FractionallySizedBox(
      heightFactor: 0.85,
      child: LookupView(
        compact: true,
        initialWord: word,
        onInsert: (w) {
          Navigator.pop(sheet);
          s.insertText(w);
          Haptics.confirm();
        },
      ),
    ),
  );
}

/// The Malayalam or English word around the cursor.
String? _wordAtCursor(EditorSession s) {
  final c = s.current;
  if (c == null) return null;
  final t = c.block.text;
  final at = c.blockSelection.start;
  final before = RegExp(r'[^\s.,;:!?"“”()]+$').firstMatch(t.substring(0, at))?[0] ?? '';
  final after = RegExp(r'^[^\s.,;:!?"“”()]+').firstMatch(t.substring(at))?[0] ?? '';
  final w = before + after;
  return w.isEmpty ? null : w;
}

// ── AI companion ──

Future<void> showAiSheet(BuildContext context, WidgetRef ref, EditorSession s) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AiPanel(session: s),
    );

class _AiPanel extends ConsumerStatefulWidget {
  const _AiPanel({required this.session});
  final EditorSession session;

  @override
  ConsumerState<_AiPanel> createState() => _AiPanelState();
}

class _AiPanelState extends ConsumerState<_AiPanel> {
  EditorSession get s => widget.session;
  late final String _selection = s.selectedText;
  final _ask = TextEditingController();
  String _provider = 'anthropic';
  List<String>? _keyed;
  bool? _connected;
  String _out = '';
  String? _busy;
  String? _error;
  ({String prompt, AiWhy why, bool opened})? _handoff;
  StreamSubscription<String>? _sub;

  @override
  void initState() {
    super.initState();
    final sv = ref.read(servicesProvider);
    sv.ai.keys().then((k) {
      if (!mounted) return;
      setState(() {
        _keyed = [for (final x in k) x.provider];
        if (_keyed!.isNotEmpty && !_keyed!.contains(_provider)) _provider = _keyed!.first;
      });
    }).catchError((_) {
      if (mounted) setState(() => _keyed = []);
    });
    sv.store.listTokens().then((t) {
      if (mounted) setState(() => _connected = t.any((x) => x['last_used_at'] != null));
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _run(String action) {
    _sub?.cancel();
    final hasKey = _keyed?.contains(_provider) ?? false;
    setState(() {
      _out = '';
      _error = null;
      _handoff = null;
    });
    if (!hasKey) return _prepareHandoff(action, AiWhy.nokey);
    setState(() => _busy = action);
    _sub = ref
        .read(servicesProvider)
        .ai
        .chat(provider: _provider, action: action, kind: s.kind.name, selection: _selection, context: s.textBefore(), instruction: _ask.text)
        .listen(
          (chunk) => setState(() => _out += chunk),
          onError: (Object e) {
            final why = e is AiException ? e.why : null;
            setState(() => _busy = null);
            if (why != null) return _prepareHandoff(action, why);
            setState(() => _error = e is AiException ? context.t('app.ai.failed') : "${context.t('app.ai.failed')} ($e)");
          },
          onDone: () => setState(() => _busy = null),
        );
  }

  void _prepareHandoff(String action, AiWhy why) => setState(() => _handoff = (
        prompt: claudeAppPrompt(action: action, instruction: _ask.text, title: s.title, docId: s.doc.id, selection: _selection),
        why: why,
        opened: false,
      ));

  Future<void> _openClaude() async {
    final h = _handoff!;
    await Clipboard.setData(ClipboardData(text: h.prompt));
    await launchUrl(Uri.parse('https://claude.ai/new?q=${Uri.encodeComponent(h.prompt)}'), mode: LaunchMode.externalApplication);
    setState(() => _handoff = (prompt: h.prompt, why: h.why, opened: true));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final hasSel = _selection.trim().isNotEmpty;
    Widget heading(String t, Color tint) => Padding(
          padding: const EdgeInsets.only(top: 18, bottom: 10),
          child: Row(children: [
            Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: tint)),
            const SizedBox(width: 8),
            Text(t, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: c.muted)),
          ]),
        );
    Widget action(String key) {
      final a = aiActions[key]!;
      final enabled = !a.needsSelection || hasSel;
      return Opacity(
        opacity: enabled ? 1 : 0.45,
        child: Pressable(
          onTap: enabled && _busy == null ? () => _run(key) : null,
          child: AnimatedContainer(
            duration: Motion.fast,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(color: _busy == key ? c.optionSelected : c.surface, borderRadius: BorderRadius.circular(10), border: Border.all(color: c.line)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(a.ml, style: const TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700, fontSize: 14.5)),
              Text(a.label, style: Theme.of(context).textTheme.labelSmall),
            ]),
          ),
        ),
      );
    }

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.9,
      maxChildSize: 0.95,
      builder: (context, scroll) => ListView(controller: scroll, padding: EdgeInsets.fromLTRB(20, 0, 20, 24 + MediaQuery.viewInsetsOf(context).bottom), children: [
        Row(children: [
          Icon(LucideIcons.sparkles, color: c.tintViolet, size: 20),
          const SizedBox(width: 8),
          Expanded(child: Text(context.t('app.tools.ai'), style: Theme.of(context).textTheme.titleMedium)),
          if ((_keyed?.length ?? 0) > 1)
            DropdownButton<String>(
              value: _provider,
              underline: const SizedBox.shrink(),
              items: [for (final p in _keyed!) DropdownMenuItem(value: p, child: Text(aiProviders[p] ?? p))],
              onChanged: (v) => setState(() => _provider = v!),
            ),
        ]),
        heading(context.t('app.ai.whole'), c.tintViolet),
        Wrap(spacing: 8, runSpacing: 8, children: [for (final k in aiActions.keys.where((k) => !aiActions[k]!.needsSelection)) action(k)]),
        heading(hasSel ? context.t('app.ai.selected') : context.t('app.ai.selectFirst'), c.tintCoral),
        Wrap(spacing: 8, runSpacing: 8, children: [for (final k in aiActions.keys.where((k) => aiActions[k]!.needsSelection)) action(k)]),
        heading(context.t('app.ai.ask'), c.tintSky),
        TextField(
          controller: _ask,
          minLines: 1,
          maxLines: 4,
          decoration: InputDecoration(
            hintText: context.t('app.ai.askHint'),
            suffixIcon: IconButton(icon: Icon(LucideIcons.send, color: c.accent), onPressed: _busy == null ? () => _run('custom') : null),
          ),
        ),
        AnimatedSize(
          duration: Motion.of(context, Motion.medium),
          curve: Motion.emphasized,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_handoff != null) _handoffCard(context),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(_error!, style: TextStyle(color: c.danger))),
            if (_out.isNotEmpty || _busy != null)
              Container(
                margin: const EdgeInsets.only(top: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: c.paper, borderRadius: BorderRadius.circular(LitmaRadius.md), border: Border.all(color: c.line)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  if (_out.isEmpty) const _Typing() else SelectableText(_out, style: TextStyle(fontFamily: LitmaFonts.serif, fontSize: 16, height: 1.7, color: c.ink)),
                  if (_busy == null && _out.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      FilledButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          s.insertText(_out);
                        },
                        icon: const Icon(LucideIcons.textCursorInput, size: 16),
                        label: Text(hasSel ? context.t('app.ai.replace') : context.t('app.ai.insert')),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => Clipboard.setData(ClipboardData(text: _out)),
                        icon: const Icon(LucideIcons.copy, size: 16),
                        label: Text(context.t('app.ai.copy')),
                      ),
                    ]),
                  ],
                ]),
              ),
          ]),
        ),
      ]),
    );
  }

  Widget _handoffCard(BuildContext context) {
    final c = context.c;
    final h = _handoff!;
    final why = switch (h.why) { AiWhy.nokey => context.t('app.ai.noKey'), AiWhy.nocredit => context.t('app.ai.noCredit'), AiWhy.badkey => context.t('app.ai.badKey') };
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: c.accentSoft, borderRadius: BorderRadius.circular(LitmaRadius.md)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(why, style: TextStyle(color: c.optionSelectedInk, height: 1.45)),
        const SizedBox(height: 12),
        if (_connected == false) ...[
          Text(context.t('app.ai.connectFirst'), style: TextStyle(color: c.ink, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => Navigator.of(context).push(SettingsScreen.route()),
            child: Text(context.t('app.ai.connect')),
          ),
          const SizedBox(height: 8),
        ],
        FilledButton.icon(onPressed: _openClaude, icon: const Icon(LucideIcons.externalLink, size: 16), label: Text(context.t('app.ai.openClaude'))),
        if (h.opened) ...[
          const SizedBox(height: 10),
          Text(context.t('app.ai.afterClaude'), style: Theme.of(context).textTheme.bodySmall),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              showInboxSheet(context, ref, s);
            },
            child: Text(context.t('app.tools.inbox')),
          ),
        ],
      ]),
    );
  }
}

/// Three dots while the answer starts.
class _Typing extends StatefulWidget {
  const _Typing();
  @override
  State<_Typing> createState() => _TypingState();
}

class _TypingState extends State<_Typing> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, _) => Row(children: [
          for (var i = 0; i < 3; i++)
            Container(
              width: 7,
              height: 7,
              margin: const EdgeInsets.only(right: 5),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: context.c.accent.withValues(alpha: 0.3 + 0.7 * (1 - ((_c.value * 3 - i) % 3).clamp(0, 1)).toDouble()),
              ),
            ),
        ]),
      );
}

// ── assistant inbox ──

Future<void> showInboxSheet(BuildContext context, WidgetRef ref, EditorSession s) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _Inbox(session: s),
    );

class _Inbox extends ConsumerStatefulWidget {
  const _Inbox({required this.session});
  final EditorSession session;
  @override
  ConsumerState<_Inbox> createState() => _InboxState();
}

class _InboxState extends ConsumerState<_Inbox> {
  List<Map<String, dynamic>>? _list;
  Object? _copied;
  Timer? _copiedTimer;

  @override
  void dispose() {
    _copiedTimer?.cancel();
    super.dispose();
  }

  /// Copy only copies: the suggestion stays until the writer applies or dismisses it.
  Future<void> _copy(Map<String, dynamic> sug) async {
    await Clipboard.setData(ClipboardData(text: '${sug['content'] ?? ''}'));
    Haptics.confirm();
    if (!mounted) return;
    setState(() => _copied = sug['id']);
    _copiedTimer?.cancel();
    _copiedTimer = Timer(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => _copied = null);
    });
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final l = await ref.read(servicesProvider).store.listSuggestions(widget.session.doc.id);
    if (mounted) setState(() => _list = l);
  }

  Future<void> _decide(Map<String, dynamic> sug, bool accept) async {
    final s = widget.session;
    if (accept) {
      final target = (sug['target_text'] as String?)?.trim();
      final content = '${sug['content'] ?? ''}';
      if (sug['kind'] == 'comment') {
        return; // notes are only read or copied, never put into the work
      } else if (target != null && target.isNotEmpty) {
        if (!s.replaceInDocument(target, content)) s.insertText(content);
      } else {
        s.insertText(content);
      }
      Haptics.confirm();
    }
    setState(() => _list = _list!.where((x) => x['id'] != sug['id']).toList());
    await ref.read(servicesProvider).store.setSuggestionStatus('${sug['id']}', accept ? 'accepted' : 'dismissed');
  }

  Widget _copyButton(BuildContext context, Map<String, dynamic> sug, {required bool filled}) {
    final done = _copied == sug['id'];
    final icon = Icon(done ? LucideIcons.check : LucideIcons.copy, size: 16);
    final label = Text(context.t(done ? 'app.inbox.copied' : 'app.inbox.copy'));
    return filled ? FilledButton.icon(onPressed: () => _copy(sug), icon: icon, label: label) : OutlinedButton.icon(onPressed: () => _copy(sug), icon: icon, label: label);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final list = _list;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.8,
      maxChildSize: 0.95,
      builder: (context, scroll) => ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
        Text(context.t('app.tools.inbox'), style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(context.t('app.inbox.hint'), style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 12),
        if (list == null) const SkeletonCard(),
        if (list != null && list.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Column(children: [
              Icon(LucideIcons.inbox, size: 36, color: c.muted),
              const SizedBox(height: 10),
              Text(context.t('app.inbox.empty'), textAlign: TextAlign.center, style: TextStyle(color: c.muted)),
            ]),
          ),
        for (final (i, sug) in (list ?? const <Map<String, dynamic>>[]).indexed)
          FadeSlideIn(
            index: i,
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.md), border: Border.all(color: c.line)),
              // press and hold to select and copy just a part (one idea from a list, say)
              child: SelectionArea(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: c.accentSoft, borderRadius: BorderRadius.circular(6)),
                    child: Text('${sug['kind']}', style: TextStyle(fontSize: 12, color: c.optionSelectedInk, fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(width: 8),
                  Text('${sug['source'] ?? ''}', style: Theme.of(context).textTheme.labelSmall),
                ]),
                if ((sug['target_text'] as String?)?.isNotEmpty ?? false)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text('${sug['target_text']}', style: TextStyle(decoration: TextDecoration.lineThrough, color: c.muted, fontFamily: LitmaFonts.serif)),
                  ),
                Padding(padding: const EdgeInsets.only(top: 8), child: Text('${sug['content']}', style: const TextStyle(fontFamily: LitmaFonts.serif, fontSize: 15.5, height: 1.6))),
                if ((sug['note'] as String?)?.isNotEmpty ?? false) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${sug['note']}', style: Theme.of(context).textTheme.bodySmall)),
                const SizedBox(height: 10),
                SelectionContainer.disabled(
                  child: Wrap(spacing: 8, runSpacing: 6, children: [
                    if (sug['kind'] != 'comment')
                      FilledButton.icon(onPressed: () => _decide(sug, true), icon: const Icon(LucideIcons.check, size: 16), label: Text(context.t('app.inbox.apply'))),
                    _copyButton(context, sug, filled: sug['kind'] == 'comment'),
                    TextButton(onPressed: () => _decide(sug, false), style: TextButton.styleFrom(foregroundColor: c.muted), child: Text(context.t('app.inbox.dismiss'))),
                  ]),
                ),
              ])),
            ),
          ),
      ]),
    );
  }
}

// ── version history ──

Future<void> showHistorySheet(BuildContext context, WidgetRef ref, EditorSession s) async {
  await s.saver.flush();
  if (!context.mounted) return;
  final versions = await ref.read(servicesProvider).store.listVersions(s.doc.id);
  if (!context.mounted) return;
  final c = context.c;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheet) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (context, scroll) => ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
        Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 10), child: Text(context.t('app.tools.history'), style: Theme.of(context).textTheme.titleMedium)),
        if (versions.isEmpty) Padding(padding: const EdgeInsets.all(24), child: Text(context.t('app.history.empty'), textAlign: TextAlign.center, style: TextStyle(color: c.muted))),
        for (final (i, v) in versions.indexed)
          FadeSlideIn(
            index: i,
            child: ListTile(
              leading: Icon(LucideIcons.history, color: c.tintSky),
              title: Text((v['label'] as String?)?.isNotEmpty == true ? '${v['label']}' : relativeTime(context, DateTime.tryParse('${v['created_at']}') ?? DateTime.now())),
              subtitle: Text('${relativeTime(context, DateTime.tryParse('${v['created_at']}') ?? DateTime.now())} · ${context.t('common.words', {'count': (v['word_count'] as num?)?.toInt() ?? 0})}'),
              trailing: TextButton(
                onPressed: () async {
                  final ok = await confirm(context, title: context.t('app.history.restoreTitle'), body: context.t('app.history.restoreBody'), action: context.t('common.restore'));
                  if (!ok || !sheet.mounted) return;
                  Navigator.pop(sheet);
                  await s.restoreVersion((v['content'] as Map).cast<String, dynamic>());
                },
                child: Text(context.t('common.restore')),
              ),
            ),
          ),
      ]),
    ),
  );
}

// ── share and export ──

Future<void> showShareSheet(BuildContext context, WidgetRef ref, EditorSession s) => showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      builder: (_) => _Share(session: s),
    );

class _Share extends ConsumerStatefulWidget {
  const _Share({required this.session});
  final EditorSession session;
  @override
  ConsumerState<_Share> createState() => _ShareState();
}

class _ShareState extends ConsumerState<_Share> {
  late bool _public = widget.session.doc.isPublic;
  late String? _shareId = widget.session.doc.shareId;
  bool _busy = false;

  String get _link => '${AppConfig.site}/read/?s=$_shareId';

  Future<void> _toggle(bool on) async {
    setState(() => _busy = true);
    final id = await ref.read(servicesProvider).store.setPublic(widget.session.doc.id, on).catchError((_) => null);
    setState(() {
      _busy = false;
      _public = on;
      _shareId = on ? id : null;
    });
  }

  Future<void> _export(String format) async {
    final s = widget.session;
    await s.saver.flush();
    final html = docToHtml(s.document, title: s.title, kind: s.kind, settings: s.settings);
    final safe = s.title.replaceAll(RegExp(r'[\\/:*?"<>|]'), ' ').trim();
    if (format == 'pdf') {
      // the phone's own web engine lays out the HTML, so Malayalam conjuncts shape correctly
      // (the pure-Dart PDF writer can't); deprecated upstream but still the right tool here
      // ignore: deprecated_member_use
      await Printing.layoutPdf(name: safe, onLayout: (f) => Printing.convertHtml(format: f, html: html));
      return;
    }
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$safe.${format == 'doc' ? 'doc' : 'txt'}');
    await file.writeAsString(format == 'doc' ? html : '${s.title}\n\n${_plain(s.document)}', encoding: utf8);
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], subject: s.title));
  }

  String _plain(EditorDocument d) => d.plainText.replaceAll(' ', '\n').replaceAll('￼', '');

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(context.t('app.tools.share'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _public,
            onChanged: _busy ? null : _toggle,
            title: Text(context.t('app.share.public')),
            subtitle: Text(context.t('app.share.publicHint')),
          ),
          AnimatedSize(
            duration: Motion.of(context, Motion.medium),
            child: _public && _shareId != null
                ? Container(
                    padding: const EdgeInsets.only(left: 12),
                    decoration: BoxDecoration(color: c.subtle, borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      Expanded(child: Text(_link, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13))),
                      IconButton(icon: const Icon(LucideIcons.copy, size: 18), onPressed: () => Clipboard.setData(ClipboardData(text: _link))),
                      IconButton(icon: const Icon(LucideIcons.share, size: 18), onPressed: () => SharePlus.instance.share(ShareParams(uri: Uri.parse(_link), subject: widget.session.title))),
                    ]),
                  )
                : const SizedBox(width: double.infinity),
          ),
          const SizedBox(height: 18),
          Text(context.t('app.share.export'), style: Theme.of(context).textTheme.labelLarge?.copyWith(color: c.muted)),
          const SizedBox(height: 10),
          Row(children: [
            for (final (f, icon, label) in [('pdf', LucideIcons.fileText, 'PDF'), ('doc', LucideIcons.fileType, 'Word'), ('txt', LucideIcons.fileCode, context.t('app.share.text'))])
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: OutlinedButton.icon(onPressed: () => _export(f), icon: Icon(icon, size: 17), label: Text(label)),
                ),
              ),
          ]),
        ]),
      ),
    );
  }
}
