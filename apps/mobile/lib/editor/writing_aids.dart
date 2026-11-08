import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app/providers.dart';
import '../core/i18n.dart';
import '../core/manglish.dart';
import '../core/metre.dart';
import '../core/theme.dart';
import '../data/analytics.dart';
import '../data/goals.dart';
import '../data/rhyme.dart';
import '../data/spell.dart';
import '../features/goals/goals_screen.dart';
import 'document.dart';
import 'session.dart';
import 'tools.dart' show showAiSheet;
import 'writing_timer.dart';

/// Writing aids on the phone, as the web's editor panels: rhymes (പ്രാസം), spelling and grammar,
/// read aloud, and goal and timer. Keep them in step with components/editor/RhymePanel.tsx,
/// CheckPanel.tsx, ReadAloudPanel.tsx and GoalPanel.tsx.

const _ml = TextStyle(fontFamily: LitmaFonts.sans, fontFamilyFallback: [LitmaFonts.ui]);

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

Widget _title(BuildContext context, String text) => Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 12), child: Text(text, style: Theme.of(context).textTheme.titleMedium));

Future<void> _sheet(BuildContext context, Widget child) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheet) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(sheet).bottom),
        child: ConstrainedBox(constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * 0.85), child: child),
      ),
    );

/// The line the rhyme finder follows: the selection, the current line, or the line above when empty.
String _rhymeLine(EditorSession s) {
  final sel = s.selectedText.trim();
  if (sel.isNotEmpty && sel.split(RegExp(r'\s+')).length <= 2) return sel;
  final all = s.lines;
  final f = s.focused;
  var i = f == null ? all.length - 1 : all.indexWhere((l) => identical(l, f));
  while (i >= 0) {
    final t = all[i].plainText;
    if (t.trim().isNotEmpty) return t;
    i--;
  }
  return '';
}

// ── Rhymes ──

Future<void> showRhymeSheet(BuildContext context, WidgetRef ref, EditorSession s) {
  Analytics.track('rhyme_lookup');
  return _sheet(context, _RhymeSheet(line: _rhymeLine(s), onPick: s.insertText));
}

class _RhymeSheet extends ConsumerStatefulWidget {
  const _RhymeSheet({required this.line, required this.onPick});
  final String line;
  final void Function(String) onPick;

  @override
  ConsumerState<_RhymeSheet> createState() => _RhymeSheetState();
}

class _RhymeSheetState extends ConsumerState<_RhymeSheet> {
  final _field = TextEditingController();
  var _kind = RhymeKind.second;
  var _sameLength = false;
  var _sameMetre = false;
  List<Rhyme>? _list;
  var _busy = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _field.text = rhymeSource(widget.line, _kind);
    _find();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _field.dispose();
    super.dispose();
  }

  String get _word {
    final w = _field.text.trim().split(RegExp(r'\s+')).first;
    if (w.isEmpty) return '';
    if (RegExp('[ഀ-ൿ]').hasMatch(w)) return w.replaceAll(RegExp('[^ഀ-ൿ‌‍]'), '');
    return RegExp(r'^[A-Za-z~_^]+$').hasMatch(w) ? manglishWord(w) : '';
  }

  Future<void> _find() async {
    final w = _word;
    if (w.isEmpty || rhymeKey(w, _kind) == null) {
      setState(() => _list = null);
      return;
    }
    setState(() => _busy = true);
    final r = await RhymeFinder(ref.read(servicesProvider).dictionary).find(w, _kind, sameLength: _sameLength, sameMetre: _sameMetre);
    if (!mounted) return;
    setState(() {
      _list = r;
      _busy = false;
    });
  }

  void _kindTo(RhymeKind k) {
    // still showing the word taken from the line: take the one this kind of rhyme needs
    if (widget.line.isNotEmpty && _field.text.trim() == rhymeSource(widget.line, _kind)) _field.text = rhymeSource(widget.line, k);
    setState(() => _kind = k);
    _find();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final w = _word;
    return ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
      _title(context, context.t('rhyme.tab')),
      TextField(
        controller: _field,
        style: _ml.copyWith(fontSize: 16),
        decoration: InputDecoration(prefixIcon: const Icon(LucideIcons.search, size: 18), hintText: context.t('rhyme.placeholder')),
        onChanged: (_) {
          _debounce?.cancel();
          _debounce = Timer(const Duration(milliseconds: 250), _find);
        },
      ),
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final k in RhymeKind.values)
          ChoiceChip(
            selected: _kind == k,
            onSelected: (_) => _kindTo(k),
            label: Text('${context.t('rhyme.kind.${k.name}.ml')} · ${context.t('rhyme.kind.${k.name}.en')}', style: _ml.copyWith(fontSize: 13)),
          ),
      ]),
      Padding(padding: const EdgeInsets.only(top: 8), child: Text(context.t('rhyme.kind.${_kind.name}.hint'), style: TextStyle(color: c.muted, fontSize: 12.5))),
      SwitchListTile(contentPadding: EdgeInsets.zero, dense: true, value: _sameLength, title: Text(context.t('rhyme.sameLength')), onChanged: (v) {
          setState(() => _sameLength = v);
          _find();
        }),
      SwitchListTile(contentPadding: EdgeInsets.zero, dense: true, value: _sameMetre, title: Text(context.t('rhyme.sameMetre')), onChanged: (v) {
          setState(() => _sameMetre = v);
          _find();
        }),
      if (w.isNotEmpty && rhymeKey(w, _kind) != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text.rich(TextSpan(children: [
            TextSpan(text: '${context.t('rhyme.for')} ', style: TextStyle(color: c.muted)),
            TextSpan(text: w, style: _ml.copyWith(fontWeight: FontWeight.w700)),
            TextSpan(text: '  ${metrePattern(w)}', style: TextStyle(color: c.muted, fontSize: 12)),
          ])),
        ),
      if (w.isEmpty)
        Text(context.t('rhyme.empty'), style: TextStyle(color: c.muted))
      else if (rhymeKey(w, _kind) == null)
        Text(context.t('rhyme.tooShort'), style: TextStyle(color: c.muted))
      else if (_busy && _list == null)
        const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator.adaptive()))
      else if (_list != null && _list!.isEmpty)
        Text(context.t('rhyme.none'), style: TextStyle(color: c.muted))
      else if (_list != null) ...[
        Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(context.t('rhyme.pickHint'), style: TextStyle(color: c.muted, fontSize: 12.5))),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final r in _list!)
            ActionChip(
              onPressed: () {
                Navigator.pop(context);
                widget.onPick(r.word);
              },
              side: BorderSide(color: r.sameMetre ? c.lineStrong : c.line),
              label: Text.rich(TextSpan(children: [
                TextSpan(text: r.word, style: _ml.copyWith(fontSize: 15)),
                TextSpan(text: ' ${r.metre}', style: TextStyle(color: c.muted, fontSize: 10)),
              ])),
            ),
        ]),
        Padding(padding: const EdgeInsets.only(top: 14), child: Text(context.t('rhyme.source'), style: TextStyle(color: c.muted, fontSize: 11))),
      ],
    ]);
  }
}

// ── Spelling and grammar ──

const _myWordsKey = 'litma:my-words';
const _unknownKey = 'litma:spell-unknown';

Future<void> showCheckSheet(BuildContext context, WidgetRef ref, EditorSession s) => _sheet(context, _CheckSheet(session: s));

class _Found {
  _Found(this.line, this.issue);
  final TextBlock line;
  final SpellIssue issue;
}

class _CheckSheet extends ConsumerStatefulWidget {
  const _CheckSheet({required this.session});
  final EditorSession session;

  @override
  ConsumerState<_CheckSheet> createState() => _CheckSheetState();
}

class _CheckSheetState extends ConsumerState<_CheckSheet> {
  List<_Found>? _found;
  late bool _unknown;
  late Set<String> _mine;

  @override
  void initState() {
    super.initState();
    final p = ref.read(servicesProvider).prefs;
    _unknown = p.getBool(_unknownKey) ?? false;
    _mine = (p.getStringList(_myWordsKey) ?? const []).toSet();
    _check();
  }

  Future<void> _check() async {
    setState(() => _found = null);
    final sp = Speller(ref.read(servicesProvider).dictionary);
    final out = <_Found>[];
    for (final l in widget.session.lines) {
      for (final i in await sp.check(l.text, unknown: _unknown, mine: _mine)) {
        out.add(_Found(l, i));
      }
      if (out.length >= 300) break;
    }
    if (mounted) setState(() => _found = out);
  }

  void _fix(_Found f, String text) {
    widget.session.replaceInLine(f.line, f.issue.from, f.issue.to, text);
    _check();
  }

  Future<void> _keep(String word) async {
    _mine.add(word);
    await ref.read(servicesProvider).prefs.setStringList(_myWordsKey, _mine.toList());
    _check();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final found = _found;
    final broken = found?.where((f) => f.issue.kind == SpellKind.unicode).toList() ?? const <_Found>[];
    return ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
      _title(context, context.t('check.spelling')),
      SwitchListTile(
        contentPadding: EdgeInsets.zero,
        value: _unknown,
        title: Text(context.t('check.unknown')),
        subtitle: Text(context.t('check.unknownHint')),
        onChanged: (v) {
          ref.read(servicesProvider).prefs.setBool(_unknownKey, v);
          setState(() => _unknown = v);
          _check();
        },
      ),
      const SizedBox(height: 8),
      if (found == null)
        const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator.adaptive()))
      else if (found.isEmpty)
        Row(children: [Icon(LucideIcons.check, size: 16, color: c.tintLime), const SizedBox(width: 8), Text(context.t('check.none'), style: TextStyle(color: c.muted))])
      else ...[
        Text(context.t('check.count', {'count': found.length}), style: TextStyle(color: c.muted, fontSize: 12.5)),
        if (broken.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: OutlinedButton.icon(
              icon: const Icon(LucideIcons.wandSparkles, size: 16),
              label: Text(context.t('check.fixAll', {'count': broken.length})),
              onPressed: () {
                // from the end of each line, so earlier positions stay right
                for (final f in broken.reversed) {
                  if (f.issue.fix.isNotEmpty) widget.session.replaceInLine(f.line, f.issue.from, f.issue.to, f.issue.fix.first);
                }
                _check();
              },
            ),
          ),
        const SizedBox(height: 10),
        for (final f in found)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
            decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.md), border: Border.all(color: c.line)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(f.issue.text, style: _ml.copyWith(fontSize: 16))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: f.issue.kind == SpellKind.unknown ? c.subtle : c.dangerSoft, borderRadius: BorderRadius.circular(99)),
                  child: Text(context.t('check.kind.${f.issue.kind.name}'), style: TextStyle(fontSize: 11, color: f.issue.kind == SpellKind.unknown ? c.muted : c.danger)),
                ),
              ]),
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                for (final x in f.issue.fix) ActionChip(label: Text(x, style: _ml.copyWith(fontSize: 14)), onPressed: () => _fix(f, x)),
                if (f.issue.kind != SpellKind.unicode) TextButton(onPressed: () => _keep(f.issue.text), child: Text(context.t('check.keep'))),
              ]),
            ]),
          ),
      ],
      const SizedBox(height: 10),
      _section(
        context,
        context.t('check.grammar'),
        c.tintViolet,
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(context.t('check.grammarHint'), style: TextStyle(color: c.muted, fontSize: 12.5)),
          const SizedBox(height: 10),
          FilledButton.icon(
            icon: const Icon(LucideIcons.sparkles, size: 16),
            label: Text(context.t('check.grammarButton')),
            onPressed: () {
              Navigator.pop(context);
              showAiSheet(context, ref, widget.session, start: 'grammar');
            },
          ),
        ]),
      ),
    ]);
  }
}

// ── Read aloud ──

Future<void> showReadAloudSheet(BuildContext context, WidgetRef ref, EditorSession s) => _sheet(context, _ReadAloud(session: s));

class _ReadAloud extends ConsumerStatefulWidget {
  const _ReadAloud({required this.session});
  final EditorSession session;

  @override
  ConsumerState<_ReadAloud> createState() => _ReadAloudState();
}

class _ReadAloudState extends ConsumerState<_ReadAloud> {
  final _tts = FlutterTts();
  bool? _hasVoice;
  late double _rate;
  int? _at;
  var _paused = false;
  var _stopped = true;
  List<String> _pieces = const [];

  static const _rateKey = 'litma:read-rate';

  @override
  void initState() {
    super.initState();
    _rate = ref.read(servicesProvider).prefs.getDouble(_rateKey) ?? 1;
    _setup();
  }

  Future<void> _setup() async {
    try {
      final ok = await _tts.isLanguageAvailable('ml-IN');
      final voices = ((await _tts.getVoices) as List?) ?? const [];
      final has = ok == true || voices.any((v) => v is Map && '${v['locale']}'.toLowerCase().startsWith('ml'));
      if (has) await _tts.setLanguage('ml-IN');
      await _tts.awaitSpeakCompletion(true);
      if (mounted) setState(() => _hasVoice = has);
    } catch (_) {
      if (mounted) setState(() => _hasVoice = false);
    }
  }

  @override
  void dispose() {
    _stopped = true;
    _tts.stop();
    super.dispose();
  }

  /// The work as sentences and verse lines, from the cursor or the start.
  List<String> _split({required bool fromStart}) {
    final s = widget.session;
    final all = s.lines;
    final f = s.focused;
    final start = fromStart || f == null ? 0 : all.indexWhere((l) => identical(l, f)).clamp(0, all.length);
    final out = <String>[];
    for (final l in all.skip(start)) {
      for (final m in RegExp(r'[^.!?।\n]+[.!?।]*').allMatches(l.plainText)) {
        final t = m.group(0)!.trim();
        if (t.isNotEmpty) out.add(t);
      }
    }
    return out;
  }

  // Android's normal speed is 1.0, iOS's 0.5
  double get _engineRate => Theme.of(context).platform == TargetPlatform.iOS ? _rate * 0.5 : _rate.clamp(0.1, 2.0);

  Future<void> _play(int from) async {
    _stopped = false;
    _paused = false;
    await _tts.setSpeechRate(_engineRate);
    for (var i = from; i < _pieces.length; i++) {
      if (_stopped || _paused || !mounted) return;
      setState(() => _at = i);
      await _tts.speak(_pieces[i]);
    }
    if (mounted && !_paused) {
      setState(() {
        _at = null;
        _stopped = true;
      });
    }
  }

  void _start(bool fromStart) {
    Analytics.track('read_aloud');
    _pieces = _split(fromStart: fromStart);
    _play(0);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (_hasVoice == null) return Padding(padding: const EdgeInsets.all(24), child: Text(context.t('read.loading'), style: TextStyle(color: c.muted)));
    if (_hasVoice == false) {
      final ios = Theme.of(context).platform == TargetPlatform.iOS;
      return ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
        _title(context, context.t('read.noVoice')),
        Text(context.t(ios ? 'read.help.ios' : 'read.help.android'), style: TextStyle(color: c.muted)),
        const SizedBox(height: 10),
        Text(context.t('read.helpFree'), style: TextStyle(color: c.muted, fontSize: 12.5)),
      ]);
    }
    final reading = _at != null;
    return ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
      _title(context, context.t('app.tools.listen')),
      Row(children: [Text(context.t('read.speed')), const Spacer(), Text('${_rate.toStringAsFixed(1)}×', style: TextStyle(color: c.muted))]),
      Slider.adaptive(
        min: 0.6,
        max: 1.6,
        divisions: 10,
        value: _rate,
        onChanged: (v) => setState(() => _rate = v),
        onChangeEnd: (v) => ref.read(servicesProvider).prefs.setDouble(_rateKey, v),
      ),
      if (reading) ...[
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: c.highlightSoft, borderRadius: BorderRadius.circular(LitmaRadius.md)),
          child: Text(_pieces[_at!], style: _ml.copyWith(fontSize: 16)),
        ),
        const SizedBox(height: 6),
        Text(context.t('read.progress', {'n': _at! + 1, 'total': _pieces.length}), style: TextStyle(color: c.muted, fontSize: 12)),
        const SizedBox(height: 10),
        Row(children: [
          if (_paused)
            FilledButton.icon(icon: const Icon(LucideIcons.play, size: 16), label: Text(context.t('read.resume')), onPressed: () => _play(_at!))
          else
            OutlinedButton.icon(
              icon: const Icon(LucideIcons.pause, size: 16),
              label: Text(context.t('read.pause')),
              onPressed: () {
                setState(() => _paused = true);
                _tts.stop();
              },
            ),
          const SizedBox(width: 8),
          TextButton.icon(
            icon: const Icon(LucideIcons.square, size: 14),
            label: Text(context.t('read.stop')),
            onPressed: () {
              _stopped = true;
              _tts.stop();
              setState(() => _at = null);
            },
          ),
        ]),
      ] else ...[
        FilledButton.icon(icon: const Icon(LucideIcons.play, size: 16), label: Text(context.t('read.fromCursor')), onPressed: () => _start(false)),
        const SizedBox(height: 8),
        OutlinedButton(onPressed: () => _start(true), child: Text(context.t('read.fromStart'))),
      ],
      const SizedBox(height: 12),
      Text(context.t('read.hint'), style: TextStyle(color: c.muted, fontSize: 12.5)),
    ]);
  }
}

// ── Goal and timer ──

Future<void> showGoalSheet(BuildContext context, WidgetRef ref, EditorSession s) => _sheet(context, _GoalSheet(session: s));

class _GoalSheet extends ConsumerStatefulWidget {
  const _GoalSheet({required this.session});
  final EditorSession session;

  @override
  ConsumerState<_GoalSheet> createState() => _GoalSheetState();
}

class _GoalSheetState extends ConsumerState<_GoalSheet> {
  late int _minutes;
  late final TextEditingController _goal;

  @override
  void initState() {
    super.initState();
    _minutes = GoalPrefs.from(ref.read(profileProvider).value?.preferences['goals']).timer;
    _goal = TextEditingController(text: '${(widget.session.settings['goal'] as num?)?.toInt() ?? 0}');
  }

  @override
  void dispose() {
    _goal.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final s = widget.session;
    final timer = WritingTimer.instance;
    final p = ref.watch(profileProvider).value;
    final days = ref.watch(_daysProvider).value ?? const <WritingDay>[];
    final g = GoalPrefs.from(p?.preferences['goals']);
    final daily = p?.dailyGoal ?? 0;
    final today = wordsOn(days, localDay());
    final st = streak(days, restDays: g.restDays, remembered: g.bestStreak);
    final goal = (s.settings['goal'] as num?)?.toInt() ?? 0;
    final deadline = s.settings['deadline'] as String?;
    final pace = deadlinePace(s.words, goal, deadline);

    return ListenableBuilder(
      listenable: timer,
      builder: (context, _) => ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
        _title(context, context.t('app.tools.goals')),
        _section(
          context,
          context.t('goals.panel.timer'),
          c.tintSky,
          timer.active
              ? Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.md), border: Border.all(color: c.line)),
                  child: Column(children: [
                    Text(timer.clock, style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w600, fontFeatures: [FontFeature.tabularFigures()])),
                    Text(context.t('goals.timer.written', {'count': timer.written}), style: TextStyle(color: c.muted, fontSize: 12.5)),
                    const SizedBox(height: 10),
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      if (timer.running)
                        OutlinedButton.icon(icon: const Icon(LucideIcons.pause, size: 16), label: Text(context.t('goals.timer.pause')), onPressed: timer.pause)
                      else
                        FilledButton.icon(icon: const Icon(LucideIcons.play, size: 16), label: Text(context.t('goals.timer.resume')), onPressed: timer.resume),
                      const SizedBox(width: 8),
                      TextButton.icon(icon: const Icon(LucideIcons.square, size: 14), label: Text(context.t('goals.timer.stop')), onPressed: timer.stop),
                    ]),
                  ]),
                )
              : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    for (final m in timerChoices) ChoiceChip(selected: _minutes == m, label: Text(context.t('goals.timer.min', {'n': m})), onSelected: (_) => setState(() => _minutes = m)),
                  ]),
                  const SizedBox(height: 10),
                  FilledButton.icon(
                    icon: const Icon(LucideIcons.timer, size: 16),
                    label: Text(context.t('goals.timer.start', {'n': _minutes})),
                    onPressed: () {
                      Analytics.track('writing_timer');
                      timer.start(_minutes, s.doc.id, s.words, title: context.t('goals.timer.doneTitle'), body: context.t('goals.timer.notifyBody', {'minutes': _minutes}));
                    },
                  ),
                  Padding(padding: const EdgeInsets.only(top: 8), child: Text(context.t('goals.timer.hint'), style: TextStyle(color: c.muted, fontSize: 12.5))),
                ]),
        ),
        _section(
          context,
          context.t('goals.panel.today'),
          c.tintTangerine,
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Text(daily > 0 ? '$today / $daily ${context.t('goals.words')}' : '$today ${context.t('goals.words')}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const Spacer(),
              if (st.current > 0) Text('🔥 ${context.t('goals.streakDays', {'count': st.current})}', style: TextStyle(color: c.highlight, fontWeight: FontWeight.w600, fontSize: 12.5)),
            ]),
            if (daily > 0) ...[
              const SizedBox(height: 8),
              ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(value: (today / daily).clamp(0, 1).toDouble(), minHeight: 6, color: c.highlight, backgroundColor: c.subtle)),
            ],
            if (daily > 0 && today >= daily) Padding(padding: const EdgeInsets.only(top: 6), child: Text(context.t('goals.met'), style: TextStyle(color: c.highlight, fontSize: 12.5))),
          ]),
        ),
        _section(
          context,
          context.t('goals.panel.work'),
          c.tintViolet,
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _goal,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: context.t('goals.work.goal')),
                  onChanged: (v) => s.updateSettings({'goal': int.tryParse(v) ?? 0}),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(LucideIcons.calendarDays, size: 16),
                  label: Text(deadline ?? context.t('goals.work.deadline')),
                  onPressed: () async {
                    final now = DateTime.now();
                    final d = await showDatePicker(context: context, firstDate: now, lastDate: DateTime(now.year + 5), initialDate: deadline != null ? parseDay(deadline) : now.add(const Duration(days: 30)));
                    if (d != null) {
                      s.updateSettings({'deadline': localDay(d)});
                      setState(() {});
                    }
                  },
                ),
              ),
            ]),
            if (pace != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  pace.left == 0
                      ? context.t('goals.work.reached')
                      : pace.daysLeft == 0
                          ? context.t('goals.work.passed', {'n': pace.left})
                          : context.t('goals.work.pace', {'n': pace.perDay, 'count': pace.daysLeft}),
                  style: TextStyle(color: c.muted, fontSize: 12.5),
                ),
              ),
          ]),
        ),
        OutlinedButton(onPressed: () => Navigator.of(context).push(GoalsScreen.route()), child: Text(context.t('goals.panel.more'))),
      ]),
    );
  }
}

final _daysProvider = FutureProvider.autoDispose<List<WritingDay>>((ref) {
  ref.watch(writingProvider);
  return ref.read(servicesProvider).store.wordsByDay();
});
