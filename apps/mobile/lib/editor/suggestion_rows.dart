// LocaleStringAttribute comes from dart:ui; newer Flutter also re-exports it from material
// ignore: unnecessary_import
import 'dart:ui' show LocaleStringAttribute;

import 'package:flutter/material.dart';

import '../core/i18n.dart';
import '../core/motion.dart';
import '../core/theme.dart';
import '../data/spell.dart';

/// A screen-reader label marked as Malayalam, so TalkBack and VoiceOver read it with a Malayalam
/// voice instead of spelling it out with the English one.
AttributedString mlLabel(String text) => AttributedString(text, attributes: [
      LocaleStringAttribute(range: TextRange(start: 0, end: text.length), locale: const Locale('ml')),
    ]);

/// One button for screen readers: its own label (and hint), the tap, nothing doubled from the
/// text inside. [Pressable] alone would read its label and the text under it.
class _Button extends StatelessWidget {
  const _Button({super.key, required this.onTap, required this.child, this.label, this.ml, this.hint, this.selected});
  final VoidCallback onTap;
  final Widget child;
  final String? label;
  final String? ml;
  final String? hint;
  final bool? selected;

  @override
  Widget build(BuildContext context) => Semantics(
        container: true,
        button: true,
        selected: selected,
        label: ml == null ? label : null,
        attributedLabel: ml == null ? null : mlLabel(ml!),
        hint: hint,
        onTap: onTap,
        excludeSemantics: true,
        child: Pressable(onTap: onTap, child: child),
      );
}

/// Malayalam spellings for the word being typed in Manglish, laid out like a phone keyboard's
/// suggestion row: the word as typed in quotes (keeps English), then every spelling, best one
/// marked (a space takes it, so screen readers hear it as selected), in a row that scrolls
/// sideways. A new word starts the row at the beginning.
class ManglishRow extends StatelessWidget {
  const ManglishRow({super.key, required this.word, required this.candidates, required this.onKeepEnglish, required this.onPick});
  final String word;
  final List<String> candidates;
  final VoidCallback onKeepEnglish;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final w = word;
    return Row(children: [
      _Button(
        key: const ValueKey('manglish-keep'),
        label: context.t('manglish.keepEnglishAria', {'word': w}),
        onTap: onKeepEnglish,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.3),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            alignment: Alignment.center,
            child: Text('“$w”', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15.5, color: c.muted)),
          ),
        ),
      ),
      Expanded(
        child: ListView.builder(
          // a fresh list (scrolled to the start) for every new word
          key: ValueKey('strip/$w'),
          scrollDirection: Axis.horizontal,
          itemCount: candidates.length,
          itemBuilder: (context, i) {
            final cand = candidates[i];
            return FadeSlideIn(
              key: ValueKey('$w/$cand'),
              index: i < 4 ? i : 4,
              offset: 4,
              duration: Motion.medium,
              child: _Button(
                key: ValueKey('manglish-$i'),
                ml: cand,
                selected: i == 0,
                onTap: () => onPick(cand),
                child: AnimatedContainer(
                  duration: Motion.of(context, Motion.fast),
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: i == 0 ? c.accentSoft : Colors.transparent, borderRadius: BorderRadius.circular(9)),
                  child: Text(cand, maxLines: 1, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 17, fontWeight: i == 0 ? FontWeight.w600 : FontWeight.w500, color: i == 0 ? c.optionSelectedInk : c.ink)),
                ),
              ),
            );
          },
        ),
      ),
    ]);
  }
}

/// Spellings for a marked word the cursor is in (tapped, selected, or just edited and checked
/// again), in the same row as the Manglish suggestions: pick one, or Ignore (left as written for
/// this visit) or Keep (never marked again on this device; [onKeep] null hides it). Typing on
/// simply goes on: dialect and regional words are often "unknown", and leaving them is the
/// writer's choice. Screen readers hear what is marked when the row appears (a live region).
class SpellRow extends StatelessWidget {
  const SpellRow({super.key, required this.issue, required this.onFix, required this.onIgnore, this.onKeep});
  final SpellIssue issue;
  final ValueChanged<String> onFix;
  final VoidCallback onIgnore;
  final VoidCallback? onKeep;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final fixes = issue.fix.take(6).toList();
    final kind = context.t('check.kind.${issue.kind.name}');
    Widget action(Key key, String label, String hint, VoidCallback onTap) => _Button(
          key: key,
          label: label,
          hint: hint,
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            alignment: Alignment.center,
            child: Text(label, style: TextStyle(fontSize: 13.5, color: c.muted)),
          ),
        );
    return Semantics(
      key: const ValueKey('spell-row'),
      container: true,
      liveRegion: true,
      label: context.t('check.announceTouch', {'kind': kind, 'word': issue.text}),
      child: Container(
        key: ValueKey('spell/${issue.from}/${issue.text}'),
        height: 46,
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(6, 4, 6, 4),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line))),
        child: Row(children: [
          Expanded(
            child: fixes.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      // already said by the row's own label
                      child: ExcludeSemantics(child: Text(kind, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, color: c.muted))),
                    ),
                  )
                : ListView.builder(
                    key: ValueKey('spellstrip/${issue.text}'),
                    scrollDirection: Axis.horizontal,
                    itemCount: fixes.length,
                    itemBuilder: (context, i) => FadeSlideIn(
                      key: ValueKey('${issue.text}/${fixes[i]}'),
                      index: i < 4 ? i : 4,
                      offset: 4,
                      duration: Motion.medium,
                      child: _Button(
                        key: ValueKey('spell-fix-$i'),
                        ml: fixes[i],
                        onTap: () => onFix(fixes[i]),
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 2),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: i == 0 ? c.accentSoft : Colors.transparent, borderRadius: BorderRadius.circular(9)),
                          child: Text(fixes[i], maxLines: 1, style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 17, fontWeight: i == 0 ? FontWeight.w600 : FontWeight.w500, color: i == 0 ? c.optionSelectedInk : c.ink)),
                        ),
                      ),
                    ),
                  ),
          ),
          action(const ValueKey('spell-ignore'), context.t('check.ignore'), context.t('check.ignoreHint'), onIgnore),
          if (onKeep != null) action(const ValueKey('spell-keep'), context.t('check.keep'), context.t('check.keepHint'), onKeep!),
        ]),
      ),
    );
  }
}
