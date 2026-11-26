import 'package:flutter/material.dart';

import '../core/i18n.dart';
import '../core/metre_check.dart';
import '../core/theme.dart';
import '../data/analytics.dart';
import 'document.dart';
import 'session.dart';
import 'suggestion_rows.dart' show mlLabel;

/// The metre (വൃത്തം) of the stanza being written, as the web's components/editor/MetrePanel.tsx:
/// the metre's name and rule, then every line in syllables with laghu (∪) and guru (–), the ones
/// that don't fit marked. Tapping a syllable selects it in the writing. Keep the two in step.

const _ml = TextStyle(fontFamily: LitmaFonts.sans, fontFamilyFallback: [LitmaFonts.ui]);

/// A line of the stanza: its text and where it starts in its block's text.
class _StanzaLine {
  _StanzaLine(this.block, this.text, this.offset);
  final TextBlock block;
  final String text;
  final int offset;
}

bool _filled(Block b) => b is TextBlock && b.type == 'paragraph' && b.plainText.trim().isNotEmpty;

/// The stanza around the cursor: the run of non-empty lines it is in, or the one just above when
/// the cursor sits on an empty line.
List<_StanzaLine> _stanzaAt(EditorSession s) {
  final blocks = s.document.blocks;
  if (blocks.isEmpty) return [];
  final f = s.focused;
  var idx = f == null ? blocks.length - 1 : blocks.indexWhere((b) => identical(b, f));
  if (idx < 0) idx = blocks.length - 1;
  if (!_filled(blocks[idx])) {
    var k = idx - 1;
    while (k >= 0 && !_filled(blocks[k])) {
      final b = blocks[k];
      if (b is! TextBlock || b.type != 'paragraph') return [];
      k--;
    }
    if (k < 0) return [];
    idx = k;
  }
  var a = idx;
  while (a > 0 && _filled(blocks[a - 1])) {
    a--;
  }
  var z = idx;
  while (z < blocks.length - 1 && _filled(blocks[z + 1])) {
    z++;
  }
  final out = <_StanzaLine>[];
  for (var i = a; i <= z; i++) {
    final b = blocks[i] as TextBlock;
    // one character per character of the block's text, so offsets stay true: a hard break starts
    // a new line, anything else that isn't text reads as a space
    final text = b.text.replaceAll(atomChar, ' ');
    var at = 0;
    for (final line in text.split(hardBreakChar)) {
      if (line.trim().isNotEmpty) out.add(_StanzaLine(b, line, at));
      at += line.length + 1;
    }
  }
  return out;
}

bool _marksOn(EditorSession s) => s.settings['showMetre'] == true;

Future<void> showMetreSheet(BuildContext context, EditorSession s) {
  Analytics.track('metre_check');
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheet) => ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * 0.85),
      child: MetreView(
        session: s,
        onPick: (block, from, to) {
          Navigator.pop(sheet);
          s.reveal?.call(block);
          s.setSpan(DocPoint(block, from), DocPoint(block, to));
        },
      ),
    ),
  );
}

class MetreView extends StatefulWidget {
  const MetreView({super.key, required this.session, required this.onPick});
  final EditorSession session;
  final void Function(TextBlock block, int from, int to) onPick;

  @override
  State<MetreView> createState() => _MetreViewState();
}

class _MetreViewState extends State<MetreView> {
  late final List<_StanzaLine> _lines = _stanzaAt(widget.session);
  late final MetreCheck? _check = _lines.isEmpty ? null : checkStanza(_lines.map((l) => l.text).toList());
  late bool _marks = _marksOn(widget.session);

  void _pick(int lineIdx, int start, int end) {
    final l = _lines[lineIdx];
    final lead = l.text.length - l.text.trimLeft().length;
    widget.onPick(l.block, l.offset + lead + start, l.offset + lead + end);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final check = _check;
    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      children: [
        Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(context.t('metre.panel'), style: Theme.of(context).textTheme.titleMedium)),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _marks,
          onChanged: (v) {
            setState(() => _marks = v);
            widget.session.updateSettings({'showMetre': v});
          },
          title: Text(context.t('metre.marks')),
        ),
        if (check == null)
          Padding(padding: const EdgeInsets.only(top: 12), child: Text(context.t('metre.empty'), style: TextStyle(color: c.muted)))
        else ...[
          const SizedBox(height: 8),
          Row(children: [
            Container(width: 7, height: 7, decoration: BoxDecoration(color: c.tintViolet, shape: BoxShape.circle)),
            const SizedBox(width: 8),
            Text(context.t('metre.following'), style: Theme.of(context).textTheme.labelLarge?.copyWith(color: c.muted)),
          ]),
          const SizedBox(height: 10),
          _Summary(check: check),
          const SizedBox(height: 14),
          Text('${context.t('metre.legend')} · ${context.t('metre.hint')}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted)),
          const SizedBox(height: 8),
          for (var i = 0; i < check.lines.length; i++) _Line(line: check.lines[i], onPick: (s, e) => _pick(i, s, e)),
        ],
      ],
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.check});
  final MetreCheck check;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final m = check.metre;
    final good = check.fit == 'exact' || check.fit == 'likely';
    final bg = good ? c.accentSoft : (check.fit == 'none' ? c.subtle : c.highlightSoft);
    final edge = good ? c.accent.withValues(alpha: 0.4) : (check.fit == 'none' ? c.line : c.highlight.withValues(alpha: 0.4));
    final small = Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted);
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(color: bg, border: Border.all(color: edge), borderRadius: BorderRadius.circular(LitmaRadius.md)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (m != null) ...[
            Text.rich(TextSpan(children: [
              TextSpan(text: m.ml, style: _ml.copyWith(fontSize: 17, fontWeight: FontWeight.w700, color: c.ink)),
              TextSpan(text: '   ${m.en} · ${context.t('metre.kind.${m.kind}')}', style: small),
            ])),
            const SizedBox(height: 4),
            Text(_ruleOf(context, check), style: small?.merge(_ml)),
            const SizedBox(height: 8),
          ],
          Text(context.t('metre.fit.${check.fit}'), style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.ink)),
        ]),
      ),
    );
  }
}

const _metreNames = {'indravajra': 'ഇന്ദ്രവജ്ര', 'upendravajra': 'ഉപേന്ദ്രവജ്ര', 'vamsastham': 'വംശസ്ഥം', 'indravamsa': 'ഇന്ദ്രവംശ'};

String _ruleOf(BuildContext context, MetreCheck check) {
  final m = check.metre!;
  switch (m.kind) {
    case 'sama':
      return context.t('metre.rule.ganas', {'ganas': ganaNames(m.ganas!), 'n': patternOf(m).length});
    case 'ardhasama':
      return context.t('metre.rule.ardha', {
        'odd': '${ganaNames(m.ganas!)} (${patternOf(m, odd: true).length})',
        'even': '${ganaNames(m.even!)} (${patternOf(m, odd: false).length})',
      });
    case 'upajati':
      return context.t('metre.rule.upajati', {'a': _metreNames[m.of![0]] ?? m.of![0], 'b': _metreNames[m.of![1]] ?? m.of![1]});
    case 'anushtup':
      return context.t('metre.rule.anushtup');
    default:
      if (m.id == 'tharangini') return context.t('metre.rule.tharangini');
      final first = m.counts![0].join('/');
      final second = m.counts![1].join('/');
      final groups = (m.groups ?? const []).join(' ');
      return first == second ? context.t('metre.rule.same', {'a': first, 'groups': groups}) : context.t('metre.rule.pair', {'a': first, 'b': second, 'groups': groups});
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.line, required this.onPick});
  final LineCheck line;
  final void Function(int start, int end) onPick;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // syllables by gana group, with a little space between groups; with no metre (free verse)
    // every syllable stands alone so the line wraps anywhere; an uncounted ് stays with the one before
    final groups = <(int, List<CheckedSyllable>)>[];
    for (final s in line.syllables) {
      final joins = groups.isNotEmpty && (s.counted ? s.group >= 0 && groups.last.$1 == s.group : true);
      if (joins) {
        groups.last.$2.add(s);
      } else {
        groups.add((s.counted ? s.group : -1, [s]));
      }
    }
    final off = line.expected != null && line.expected != line.count;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
      decoration: BoxDecoration(
        border: Border.all(color: line.ok ? c.line : c.highlight.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(LitmaRadius.md),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: groups.any((g) => g.$1 >= 0) ? 8 : 2, runSpacing: 6, children: [
          for (final g in groups)
            Wrap(spacing: 0, runSpacing: 6, children: [for (final s in g.$2) _Chip(s: s, onTap: () => onPick(s.start, s.end))]),
        ]),
        const SizedBox(height: 6),
        Text.rich(TextSpan(children: [
          TextSpan(text: context.t('metre.line', {'count': line.count, 'matras': line.matras})),
          if (off) TextSpan(text: '   ${context.t('metre.needs', {'n': line.expected})}', style: TextStyle(color: c.highlight, fontWeight: FontWeight.w600)),
        ]), style: Theme.of(context).textTheme.labelSmall?.copyWith(color: c.muted)),
      ]),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.s, required this.onTap});
  final CheckedSyllable s;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final mark = s.counted ? (s.weight == 'G' ? '–' : '∪') : '·';
    final hint = s.wrong
        ? context.t(s.weight == 'L' ? 'metre.wantGuru' : 'metre.wantLaghu')
        : !s.counted
            ? context.t('metre.uncounted')
            : context.t(s.weight == 'G' ? 'metre.guru' : 'metre.laghu');
    return Semantics(
      button: true,
      attributedLabel: mlLabel(s.text),
      hint: hint,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Opacity(
          opacity: s.counted || s.wrong ? 1 : 0.45,
          child: Container(
            constraints: const BoxConstraints(minWidth: 28, minHeight: 40),
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
            decoration: s.wrong ? BoxDecoration(color: c.highlightSoft, border: Border.all(color: c.highlight.withValues(alpha: 0.5)), borderRadius: BorderRadius.circular(6)) : null,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(s.text, style: _ml.copyWith(fontSize: 15, height: 1.2, color: s.wrong ? c.highlight : c.ink)),
              Text(mark, style: TextStyle(fontSize: 11, height: 1, color: s.wrong ? c.highlight : c.muted)),
            ]),
          ),
        ),
      ),
    );
  }
}
