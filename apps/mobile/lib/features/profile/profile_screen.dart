import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/forms.dart';
import '../../data/models.dart';
import '../../widgets/avatar.dart';
import '../settings/settings_screen.dart';
import 'edit_profile_screen.dart';

/// Works and words-per-day for the profile's statistics.
final profileStatsProvider = FutureProvider.autoDispose<({List<LitmaDoc> docs, List<({String day, int words})> days})>((ref) async {
  ref.watch(profileProvider);
  final store = ref.read(servicesProvider).store;
  final docs = await store.listDocs().catchError((_) => <LitmaDoc>[]);
  final days = await store.wordsByDay();
  return (docs: docs, days: days);
});

/// The writer's profile, as on the web: picture, names, details, and how much they write.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  static Route<void> route() => MaterialPageRoute(builder: (_) => const ProfileScreen());

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final writer = ref.watch(writerProvider).value;
    final p = ref.watch(profileProvider).value;
    final stats = ref.watch(profileStatsProvider).value;
    final name = p?.name ?? writer?.email ?? '';
    var i = 0;
    Widget item(Widget w) => FadeSlideIn(index: i++, child: w);

    return Scaffold(
      appBar: AppBar(
        title: Text(context.t('nav.profile')),
        actions: [
          IconButton(tooltip: context.t('app.settings.title'), icon: const Icon(LucideIcons.settings, size: 21), onPressed: () => Navigator.of(context).push(SettingsScreen.route())),
        ],
      ),
      body: RefreshIndicator(
        color: c.accent,
        onRefresh: () async => ref.invalidate(profileProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
          children: [
            item(Column(children: [
              Hero(tag: 'avatar', child: ProfileAvatar(profile: p, fallbackName: name, size: 104)),
              const SizedBox(height: 14),
              Text(name, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
              if (p?.penName != null && p?.displayName != null && p!.penName!.trim() != p.displayName!.trim())
                Padding(padding: const EdgeInsets.only(top: 2), child: Text(p.displayName!, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted))),
              if (p?.username?.isNotEmpty ?? false)
                Padding(padding: const EdgeInsets.only(top: 2), child: Text('@${p!.username}', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.accent, fontWeight: FontWeight.w600))),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: p == null ? null : () => Navigator.of(context).push(EditProfileScreen.route(p)),
                icon: const Icon(LucideIcons.pencil, size: 17),
                label: Text(context.t('app.profile.edit')),
              ),
            ])),
            const SizedBox(height: 20),
            if ((p?.bio?.trim().isNotEmpty ?? false))
              item(_Card(children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(p!.bio!.trim(), style: TextStyle(fontFamily: LitmaFonts.sans, fontSize: 15.5, height: 1.6, color: c.ink)),
                ),
              ])),
            item(_Card(children: [
              _Detail(icon: LucideIcons.mail, label: context.t('app.auth.email'), value: writer?.email ?? p?.email),
              _Detail(icon: LucideIcons.feather, label: context.t('app.profile.penName'), value: p?.penName),
              _Detail(icon: LucideIcons.user, label: context.t('app.profile.name'), value: p?.displayName),
              _Detail(icon: LucideIcons.atSign, label: context.t('app.profile.username'), value: p?.username),
              _Detail(icon: LucideIcons.mapPin, label: context.t('app.profile.location'), value: p?.location),
              _Detail(icon: LucideIcons.globe, label: context.t('app.profile.website'), value: p?.website),
              _Detail(icon: LucideIcons.target, label: context.t('app.profile.dailyGoal'), value: p == null ? null : context.t('common.words', {'count': p.dailyGoal}), last: true),
            ])),
            if (stats != null) ...[
              item(_Heading(context.t('app.profile.writing'))),
              item(_Stats(docs: stats.docs, days: stats.days, goal: p?.dailyGoal ?? 0)),
              item(_Heading(context.t('app.profile.lastWeeks'))),
              item(_Card(children: [Padding(padding: const EdgeInsets.all(16), child: _Heatmap(days: stats.days))])),
              if (stats.docs.isNotEmpty) ...[
                item(_Heading(context.t('app.profile.byType'))),
                item(_ByKind(docs: stats.docs)),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(6, 22, 6, 8),
        child: Row(children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: context.c.accent)),
          const SizedBox(width: 8),
          Text(text, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: context.c.muted)),
        ]),
      );
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(color: context.c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: context.c.line)),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
      );
}

class _Detail extends StatelessWidget {
  const _Detail({required this.icon, required this.label, this.value, this.last = false});
  final IconData icon;
  final String label;
  final String? value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final v = value?.trim();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      decoration: BoxDecoration(border: last ? null : Border(bottom: BorderSide(color: c.line))),
      child: Row(children: [
        Icon(icon, size: 18, color: c.muted),
        const SizedBox(width: 12),
        Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted)),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            v == null || v.isEmpty ? '—' : v,
            textAlign: TextAlign.right,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: v == null || v.isEmpty ? c.muted : c.ink),
          ),
        ),
      ]),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.docs, required this.days, required this.goal});
  final List<LitmaDoc> docs;
  final List<({String day, int words})> days;
  final int goal;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final map = {for (final d in days) d.day: d.words};
    String key(DateTime d) => d.toIso8601String().substring(0, 10);
    final today = map[key(DateTime.now())] ?? 0;
    var d = DateTime.now();
    if ((map[key(d)] ?? 0) == 0) d = d.subtract(const Duration(days: 1));
    var streak = 0;
    while ((map[key(d)] ?? 0) > 0) {
      streak++;
      d = d.subtract(const Duration(days: 1));
    }
    final best = days.fold<int>(0, (a, x) => x.words > a ? x.words : a);
    final words = docs.fold<int>(0, (a, x) => a + x.wordCount);
    Widget tile(String label, String value, IconData icon, Color tint) => Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.md), border: Border.all(color: c.line)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, size: 17, color: tint),
              const SizedBox(height: 8),
              Text(value, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
              Text(label, style: Theme.of(context).textTheme.labelSmall),
            ]),
          ),
        );
    return Column(children: [
      Row(children: [
        tile(context.t('desk.tabs.works'), groupIndian(docs.length), LucideIcons.fileText, c.tintViolet),
        const SizedBox(width: 10),
        tile(context.t('app.profile.words'), groupIndian(words), LucideIcons.pen, c.tintSky),
      ]),
      const SizedBox(height: 10),
      Row(children: [
        tile(context.t('app.profile.streak'), context.t('app.profile.days', {'n': streak}), LucideIcons.flame, c.tintTangerine),
        const SizedBox(width: 10),
        tile(context.t('app.profile.best'), groupIndian(best), LucideIcons.trophy, c.tintLime),
      ]),
      const SizedBox(height: 10),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.md), border: Border.all(color: c.line)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(context.t('app.profile.today'), style: Theme.of(context).textTheme.labelLarge),
            const Spacer(),
            Text(goal > 0 ? '${groupIndian(today)} / ${groupIndian(goal)}' : groupIndian(today), style: Theme.of(context).textTheme.labelLarge),
          ]),
          if (goal > 0) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: (today / goal).clamp(0, 1).toDouble()),
                duration: Motion.of(context, Motion.slow * 2),
                curve: Motion.emphasized,
                builder: (context, v, _) => LinearProgressIndicator(value: v, minHeight: 7, color: c.highlight, backgroundColor: c.subtle),
              ),
            ),
          ],
        ]),
      ),
    ]);
  }
}

/// Words per day for the last 20 weeks (the web's heatmap), in accent shades.
class _Heatmap extends StatelessWidget {
  const _Heatmap({required this.days});
  final List<({String day, int words})> days;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    const weeks = 20;
    final map = {for (final d in days) d.day: d.words};
    final end = DateTime.now();
    final start = end.subtract(Duration(days: weeks * 7 - 1 + end.weekday % 7));
    final cells = <({String date, int words})>[];
    for (var d = start; !d.isAfter(end); d = d.add(const Duration(days: 1))) {
      final k = d.toIso8601String().substring(0, 10);
      cells.add((date: k, words: map[k] ?? 0));
    }
    final max = cells.fold<int>(1, (a, x) => x.words > a ? x.words : a);
    Color shade(int w) {
      if (w == 0) return c.subtle;
      final level = (w / max * 4).ceil().clamp(1, 4);
      return Color.lerp(c.paper, c.accent, [0.3, 0.55, 0.78, 1.0][level - 1])!;
    }

    final columns = <List<({String date, int words})>>[];
    for (var i = 0; i < cells.length; i += 7) {
      columns.add(cells.sublist(i, (i + 7).clamp(0, cells.length)));
    }
    return Semantics(
      label: 'Words written per day over the last $weeks weeks',
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        reverse: true,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final col in columns)
              Padding(
                padding: const EdgeInsets.only(right: 3),
                child: Column(children: [
                  for (final cell in col)
                    Tooltip(
                      message: '${cell.date}: ${cell.words}',
                      child: Container(width: 12, height: 12, margin: const EdgeInsets.only(bottom: 3), decoration: BoxDecoration(color: shade(cell.words), borderRadius: BorderRadius.circular(3))),
                    ),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}

class _ByKind extends StatelessWidget {
  const _ByKind({required this.docs});
  final List<LitmaDoc> docs;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final counts = <DocKind, int>{};
    for (final d in docs) {
      counts[d.kind] = (counts[d.kind] ?? 0) + 1;
    }
    final list = counts.entries.toList()..sort((a, b) => b.value - a.value);
    final max = list.first.value;
    return _Card(children: [
      for (final (i, e) in list.indexed)
        Padding(
          padding: EdgeInsets.fromLTRB(16, i == 0 ? 14 : 6, 16, i == list.length - 1 ? 14 : 6),
          child: Row(children: [
            SizedBox(width: 92, child: Text(kindNames[e.key]!.ml, style: TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w600, color: c.ink))),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: e.value / max),
                  duration: Motion.of(context, Motion.slow),
                  curve: Motion.emphasized,
                  builder: (context, v, _) => LinearProgressIndicator(value: v, minHeight: 6, color: c.accent, backgroundColor: c.subtle),
                ),
              ),
            ),
            SizedBox(width: 32, child: Text('${e.value}', textAlign: TextAlign.right, style: Theme.of(context).textTheme.labelMedium)),
          ]),
        ),
    ]);
  }
}
