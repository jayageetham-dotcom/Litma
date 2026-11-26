import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../app/providers.dart';
import '../core/i18n.dart';
import '../core/manglish.dart';
import '../core/manglish_rank.dart';
import '../core/metre.dart';
import '../core/speech.dart';
import '../core/theme.dart';
import '../core/wav.dart';
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
  return _sheet(context, RhymeFinderView(line: _rhymeLine(s), onPick: s.insertText));
}

/// The rhyme finder (the web's components/RhymeFinder.tsx). In the editor's sheet ([inSheet]) a
/// picked word goes into the writing and the sheet closes; in the Dictionary's പ്രാസം tab it opens
/// the word's entry.
class RhymeFinderView extends ConsumerStatefulWidget {
  const RhymeFinderView({super.key, this.line = '', required this.onPick, this.inSheet = true});
  final String line;
  final void Function(String) onPick;
  final bool inSheet;

  @override
  ConsumerState<RhymeFinderView> createState() => _RhymeFinderViewState();
}

class _RhymeFinderViewState extends ConsumerState<RhymeFinderView> {
  final _field = TextEditingController();
  var _kind = RhymeKind.second;
  var _sameLength = false;
  var _sameMetre = false;
  List<Rhyme>? _list;
  var _busy = false;
  var _start = 0;
  Timer? _debounce;

  /// Rhymes shown at a time; "Next set" moves through the rest (as the web's RhymeFinder).
  static const _page = 40;

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
    final r = await RhymeFinder(ref.read(servicesProvider).dictionary).find(w, _kind, max: 1000, sameLength: _sameLength, sameMetre: _sameMetre);
    if (!mounted) return;
    setState(() {
      _list = r;
      _start = 0;
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
    return ListView(shrinkWrap: widget.inSheet, keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
      if (widget.inSheet) _title(context, context.t('rhyme.tab')),
      TextField(
        controller: _field,
        style: _ml.copyWith(fontSize: 16),
        autocorrect: false,
        enableSuggestions: false,
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
        Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(context.t(widget.inSheet ? 'rhyme.pickHint' : 'rhyme.openHint'), style: TextStyle(color: c.muted, fontSize: 12.5))),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final r in _list!.skip(_start).take(_page))
            ActionChip(
              onPressed: () {
                if (widget.inSheet) Navigator.pop(context);
                widget.onPick(r.word);
              },
              side: BorderSide(color: r.sameMetre ? c.lineStrong : c.line),
              label: Text.rich(TextSpan(children: [
                TextSpan(text: r.word, style: _ml.copyWith(fontSize: 15)),
                TextSpan(text: ' ${r.metre}', style: TextStyle(color: c.muted, fontSize: 10)),
              ])),
            ),
        ]),
        if (_list!.length > _page)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Row(children: [
              OutlinedButton.icon(
                onPressed: () {
                  Analytics.track('rhyme_next');
                  setState(() => _start = _start + _page >= _list!.length ? 0 : _start + _page);
                },
                icon: const Icon(LucideIcons.refreshCw, size: 16),
                label: Text(context.t('rhyme.next')),
              ),
              const SizedBox(width: 12),
              Flexible(
                child: Text(
                  context.t('rhyme.range', {'from': _start + 1, 'to': (_start + _page).clamp(0, _list!.length), 'total': _list!.length}),
                  style: TextStyle(color: c.muted, fontSize: 12.5),
                ),
              ),
            ]),
          ),
        Padding(padding: const EdgeInsets.only(top: 14), child: Text(context.t('rhyme.source'), style: TextStyle(color: c.muted, fontSize: 11))),
      ],
    ]);
  }
}

// ── Spelling and grammar ──

const _myWordsKey = 'litma:my-words';
const _unknownKey = 'litma:spell-unknown';
const _marksKey = 'litma:spell-marks';

/// Spelling marks in the text (on by default, per device, like the web's "Mark spelling in the
/// text"): wavy lines under broken letters, misspellings and likely typos, with suggestions above
/// the keyboard when the cursor is in a marked word. Call again after a setting or kept word changes.
void setupSpellMarks(WidgetRef ref, EditorSession s) {
  final services = ref.read(servicesProvider);
  final p = services.prefs;
  if (p.getBool(_marksKey) ?? true) {
    final unknown = p.getBool(_unknownKey) ?? false;
    // kept words, and the work's Story World names (the writer's own words)
    final mine = {...(p.getStringList(_myWordsKey) ?? const []), ...services.transliterator.storyWords};
    // the offline word list ranks the fixes and catches typos the engine has nothing for; until it
    // has loaded the check runs without it, and checks again once it is there
    Future<List<SpellIssue>> Function(String) make(ManglishRanker? r) => (text) => services.speller.check(text,
        unknown: unknown, mine: mine, engine: services.spellEngine.call, rankFixes: r?.rankFixes, closeWords: r?.closeWords);
    s.spellCheck = make(services.transliterator.ranker);
    if (services.transliterator.ranker == null) {
      services.transliterator.wordsReady().then((_) {
        final r = services.transliterator.ranker;
        if (r == null || s.spellCheck == null) return;
        s.spellCheck = make(r);
        s.recheckSpelling();
      });
    }
  } else {
    s.spellCheck = null;
  }
  s.recheckSpelling();
}

/// "Keep": the word is never marked again on this device.
Future<void> keepSpellingWord(WidgetRef ref, EditorSession s, String word) async {
  final p = ref.read(servicesProvider).prefs;
  final mine = (p.getStringList(_myWordsKey) ?? const []).toList();
  if (!mine.contains(word)) mine.add(word);
  await p.setStringList(_myWordsKey, mine.length > 5000 ? mine.sublist(mine.length - 5000) : mine);
  setupSpellMarks(ref, s);
}

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
  late bool _marks;
  late Set<String> _mine;

  @override
  void initState() {
    super.initState();
    final p = ref.read(servicesProvider).prefs;
    _unknown = p.getBool(_unknownKey) ?? false;
    _marks = p.getBool(_marksKey) ?? true;
    _mine = (p.getStringList(_myWordsKey) ?? const []).toSet();
    _check();
  }

  Future<void> _check() async {
    setState(() => _found = null);
    final services = ref.read(servicesProvider);
    final out = <_Found>[];
    for (final l in widget.session.lines) {
      final r = services.transliterator.ranker;
      for (final i in await services.speller.check(l.text, unknown: _unknown, mine: _mine, engine: services.spellEngine.call, rankFixes: r?.rankFixes, closeWords: r?.closeWords)) {
        if (EditorSession.spellIgnored.contains(i.text)) continue;
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
    await keepSpellingWord(ref, widget.session, word);
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
        value: _marks,
        title: Text(context.t('check.markOn')),
        onChanged: (v) async {
          await ref.read(servicesProvider).prefs.setBool(_marksKey, v);
          setState(() => _marks = v);
          setupSpellMarks(ref, widget.session);
        },
      ),
      SwitchListTile(
        contentPadding: EdgeInsets.zero,
        value: _unknown,
        title: Text(context.t('check.unknown')),
        subtitle: Text(context.t('check.unknownHint')),
        onChanged: (v) async {
          await ref.read(servicesProvider).prefs.setBool(_unknownKey, v);
          setState(() => _unknown = v);
          setupSpellMarks(ref, widget.session);
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
                  decoration: BoxDecoration(color: switch (f.issue.kind) { SpellKind.unknown => c.subtle, SpellKind.suspect => c.highlightSoft, _ => c.dangerSoft }, borderRadius: BorderRadius.circular(99)),
                  child: Text(context.t('check.kind.${f.issue.kind.name}'), style: TextStyle(fontSize: 11, color: switch (f.issue.kind) { SpellKind.unknown => c.muted, SpellKind.suspect => c.highlight, _ => c.danger })),
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
  final _tts = Speech();
  StreamSubscription<SpokenWord>? _wordSub;
  bool? _hasVoice;
  List<SpeechVoice> _voices = const [];
  String? _voice;
  late double _rate;
  late double _pitch;
  late double _volume;
  int? _at;
  SpokenWord? _word;
  var _paused = false;
  var _stopped = true;
  List<String> _pieces = const [];

  /// While saving an audio file: pieces made so far and in all.
  (int, int)? _saving;
  var _saveCancelled = false;
  String? _saveError;

  static const _rateKey = 'litma:read-rate';
  static const _pitchKey = 'litma:read-pitch';
  static const _volumeKey = 'litma:read-volume';
  static const _voiceKey = 'litma:read-voice';
  static const _language = 'ml-IN';

  double _pref(String key, double fallback, double min, double max) {
    final v = ref.read(servicesProvider).prefs.getDouble(key);
    return v != null && v >= min && v <= max ? v : fallback;
  }

  @override
  void initState() {
    super.initState();
    _rate = _pref(_rateKey, 1, 0.6, 1.6);
    _pitch = _pref(_pitchKey, 1, 0.5, 1.5);
    _volume = _pref(_volumeKey, 1, 0.1, 1);
    _voice = ref.read(servicesProvider).prefs.getString(_voiceKey);
    _wordSub = _tts.words.listen((w) {
      if (mounted && _at != null) setState(() => _word = w);
    });
    _setup();
  }

  Future<void> _setup() async {
    try {
      final voices = await _tts.voices('ml');
      final has = voices.isNotEmpty || await _tts.hasVoice('ml');
      if (!mounted) return;
      setState(() {
        _voices = voices;
        if (!voices.any((v) => v.id == _voice)) _voice = voices.isEmpty ? null : voices.first.id;
        _hasVoice = has;
      });
    } catch (_) {
      if (mounted) setState(() => _hasVoice = false);
    }
  }

  @override
  void dispose() {
    _stopped = true;
    _saveCancelled = true;
    _wordSub?.cancel();
    _tts.dispose();
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
      for (final m in RegExp(r'[^.!?।\n]+[.!?।]*').allMatches(l.plainText.replaceAll('￼', ' '))) {
        final t = m.group(0)!.trim();
        if (t.isNotEmpty) out.add(t);
      }
    }
    return out;
  }

  Future<void> _play(int from) async {
    _stopped = false;
    _paused = false;
    for (var i = from; i < _pieces.length; i++) {
      if (_stopped || _paused || !mounted) return;
      setState(() {
        _at = i;
        _word = null;
      });
      // voice, speed, pitch and volume changed while reading apply from the next sentence
      await _tts.speak(_pieces[i], language: _language, voice: _voice, rate: _rate, pitch: _pitch, volume: _volume);
    }
    if (mounted && !_paused) {
      setState(() {
        _at = null;
        _word = null;
        _stopped = true;
      });
    }
  }

  void _start(bool fromStart) {
    Analytics.track('read_aloud');
    _pieces = _split(fromStart: fromStart);
    _play(0);
  }

  /// The whole work as one WAV file, made piece by piece (engines take a few thousand characters
  /// at a time) and joined, then shared.
  Future<void> _saveAudio() async {
    final sentences = _split(fromStart: true);
    if (sentences.isEmpty) return;
    final chunks = <String>[];
    var buf = StringBuffer();
    for (final s in sentences) {
      for (var i = 0; i < s.length; i += 3000) {
        final part = s.substring(i, (i + 3000).clamp(0, s.length));
        if (buf.length + part.length > 3000 && buf.isNotEmpty) {
          chunks.add(buf.toString());
          buf = StringBuffer();
        }
        if (buf.isNotEmpty) buf.write('\n');
        buf.write(part);
      }
    }
    if (buf.isNotEmpty) chunks.add(buf.toString());

    Analytics.track('read_aloud_save');
    setState(() {
      _saving = (0, chunks.length);
      _saveCancelled = false;
      _saveError = null;
    });
    final dir = await getTemporaryDirectory();
    final stamp = DateTime.now().millisecondsSinceEpoch;
    final parts = <String>[];
    var ok = true;
    try {
      for (var i = 0; i < chunks.length; i++) {
        if (_saveCancelled || !mounted) return;
        final path = '${dir.path}/litma-read-$stamp-$i.wav';
        parts.add(path);
        if (!await _tts.synthesizeToFile(chunks[i], path, language: _language, voice: _voice, rate: _rate, pitch: _pitch) || !File(path).existsSync()) {
          ok = false;
          break;
        }
        if (mounted) setState(() => _saving = (i + 1, chunks.length));
      }
      if (_saveCancelled || !mounted) return;
      final safe = widget.session.title.replaceAll(RegExp(r'[\\/:*?"<>|]'), ' ').trim();
      final out = '${dir.path}/${safe.isEmpty ? 'Litma' : safe}.wav';
      if (ok) ok = await joinWav(parts, out);
      if (!mounted) return;
      setState(() => _saving = null);
      if (!ok) {
        setState(() => _saveError = context.t('read.saveFailed'));
        return;
      }
      await SharePlus.instance.share(ShareParams(files: [XFile(out, mimeType: 'audio/wav')], subject: widget.session.title));
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = null;
          _saveError = context.t('read.saveFailed');
        });
      }
    } finally {
      for (final p in parts) {
        try {
          File(p).deleteSync();
        } catch (_) {
          // already gone
        }
      }
      if (mounted && _saving != null) setState(() => _saving = null);
    }
  }

  String _voiceLabel(BuildContext context, SpeechVoice v, int index) {
    // Android names voices with codes (ml-in-x-mlf-local); iOS gives real names
    final coded = RegExp(r'^[a-z]{2,3}[-_][a-z]{2}', caseSensitive: false).hasMatch(v.name);
    final name = coded ? context.t('read.voiceN', {'n': index + 1}) : v.name;
    return v.network ? '$name (${context.t('read.needsInternet')})' : name;
  }

  Widget _slider(BuildContext context, {required String label, required String shown, required double min, required double max, required int divisions, required double value, required ValueChanged<double> onChanged, required String prefKey}) {
    final c = context.c;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [Text(label), const Spacer(), Text(shown, style: TextStyle(color: c.muted))]),
      Slider.adaptive(
        min: min,
        max: max,
        divisions: divisions,
        value: value.clamp(min, max),
        onChanged: onChanged,
        onChangeEnd: (v) => ref.read(servicesProvider).prefs.setDouble(prefKey, v),
      ),
    ]);
  }

  /// The sentence being read, with the spoken word marked when the voice reports words.
  Widget _current(BuildContext context, String text) {
    final c = context.c;
    final w = _word;
    final base = _ml.copyWith(fontSize: 16, color: c.ink);
    if (w == null || w.start < 0 || w.end > text.length || w.start >= w.end) return Text(text, style: base);
    return Text.rich(TextSpan(style: base, children: [
      TextSpan(text: text.substring(0, w.start)),
      TextSpan(
        text: text.substring(w.start, w.end),
        style: TextStyle(decoration: TextDecoration.underline, decorationColor: c.highlight, decorationThickness: 2.5),
      ),
      TextSpan(text: text.substring(w.end)),
    ]));
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
    final saving = _saving;
    return ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
      _title(context, context.t('app.tools.listen')),
      if (_voices.length > 1) ...[
        Text(context.t('read.voice')),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final (i, v) in _voices.indexed)
            ChoiceChip(
              selected: v.id == _voice,
              label: Text(_voiceLabel(context, v, i)),
              onSelected: (_) {
                setState(() => _voice = v.id);
                ref.read(servicesProvider).prefs.setString(_voiceKey, v.id);
              },
            ),
        ]),
        const SizedBox(height: 14),
      ],
      _slider(context, label: context.t('read.speed'), shown: '${_rate.toStringAsFixed(1)}×', min: 0.6, max: 1.6, divisions: 10, value: _rate, onChanged: (v) => setState(() => _rate = v), prefKey: _rateKey),
      _slider(context, label: context.t('read.pitch'), shown: _pitch.toStringAsFixed(1), min: 0.5, max: 1.5, divisions: 10, value: _pitch, onChanged: (v) => setState(() => _pitch = v), prefKey: _pitchKey),
      _slider(context, label: context.t('read.volume'), shown: '${(_volume * 100).round()}%', min: 0.1, max: 1, divisions: 9, value: _volume, onChanged: (v) => setState(() => _volume = v), prefKey: _volumeKey),
      const SizedBox(height: 6),
      if (reading) ...[
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: c.highlightSoft, borderRadius: BorderRadius.circular(LitmaRadius.md)),
          child: _current(context, _pieces[_at!]),
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
                setState(() {
                  _paused = true;
                  _word = null;
                });
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
              setState(() {
                _at = null;
                _word = null;
              });
            },
          ),
        ]),
      ] else if (saving != null) ...[
        Text(context.t('read.saving', {'n': saving.$1, 'total': saving.$2}), style: TextStyle(color: c.muted)),
        const SizedBox(height: 8),
        LinearProgressIndicator(value: saving.$2 == 0 ? null : saving.$1 / saving.$2),
        const SizedBox(height: 10),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton.icon(
            icon: const Icon(LucideIcons.square, size: 14),
            label: Text(context.t('read.stop')),
            onPressed: () {
              setState(() {
                _saveCancelled = true;
                _saving = null;
              });
              _tts.stop();
            },
          ),
        ),
      ] else ...[
        FilledButton.icon(icon: const Icon(LucideIcons.play, size: 16), label: Text(context.t('read.fromCursor')), onPressed: () => _start(false)),
        const SizedBox(height: 8),
        OutlinedButton(onPressed: () => _start(true), child: Text(context.t('read.fromStart'))),
        const SizedBox(height: 8),
        OutlinedButton.icon(icon: const Icon(LucideIcons.download, size: 16), label: Text(context.t('read.saveAudio')), onPressed: _saveAudio),
        const SizedBox(height: 6),
        Text(context.t('read.saveHint'), style: TextStyle(color: c.muted, fontSize: 12.5)),
        if (_saveError != null) ...[
          const SizedBox(height: 6),
          Text(_saveError!, style: TextStyle(color: c.danger, fontSize: 12.5)),
        ],
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
