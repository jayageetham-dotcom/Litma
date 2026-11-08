import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/analytics.dart';
import '../../data/forms.dart';
import '../../data/goals.dart';
import '../../data/models.dart';
import '../../data/notifications.dart';

/// Goals and statistics, as the web's /goals/ page: today and the streak, the writer's goals, the
/// daily reminder (scheduled on the phone, so it rings with the app closed) and 7/30/90-day
/// statistics. Litma keeps 90 days of writing statistics.
class GoalsScreen extends ConsumerStatefulWidget {
  const GoalsScreen({super.key});

  static Route<void> route() {
    Analytics.screen('/goals/');
    return MaterialPageRoute(builder: (_) => const GoalsScreen());
  }

  @override
  ConsumerState<GoalsScreen> createState() => _GoalsScreenState();
}

final _statsProvider = FutureProvider.autoDispose<({List<WritingDay> days, List<({String day, String docId, int words, int minutes})> work, List<LitmaDoc> docs})>((ref) async {
  ref.watch(writingProvider);
  final store = ref.read(servicesProvider).store;
  final days = await store.wordsByDay();
  final work = await store.workDays();
  final docs = await store.listDocs().catchError((_) => <LitmaDoc>[]);
  return (days: days, work: work, docs: docs);
});

class _GoalsScreenState extends ConsumerState<GoalsScreen> {
  var _span = 30;

  Future<void> _save(Profile p, {int? daily, GoalPrefs? goals}) async {
    final prefs = {...p.preferences, if (goals != null) 'goals': goals.toJson()};
    await ref.read(servicesProvider).store.updateProfile(p.id, {'daily_goal': ?daily, 'preferences': prefs});
    ref.invalidate(profileProvider);
    if (!mounted) return;
    unawaited(rescheduleReminders(ref, context));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final p = ref.watch(profileProvider).value;
    final data = ref.watch(_statsProvider).value;
    if (p == null || data == null) return Scaffold(appBar: AppBar(title: Text(context.t('goals.title'))), body: const Center(child: CircularProgressIndicator.adaptive()));
    final g = GoalPrefs.from(p.preferences['goals']);
    final today = localDay();
    final todayWords = wordsOn(data.days, today);
    final st = streak(data.days, restDays: g.restDays, remembered: g.bestStreak);
    if (st.best > g.bestStreak) unawaited(_save(p, goals: g.copyWith(bestStreak: st.best)));
    final week = wordsThisWeek(data.days);
    final sum = summarise(data.days, _span);
    final prefs = ref.read(servicesProvider).prefs;
    final deviceOn = prefs.getString(Notifications.deviceKey) == 'on';
    final r = g.reminder;

    Widget card(String title, Color dot, List<Widget> children) => Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(width: 7, height: 7, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text(title, style: Theme.of(context).textTheme.titleSmall),
            ]),
            const SizedBox(height: 12),
            ...children,
          ]),
        );
    Widget number(String label, String value, [String? hint]) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(color: c.muted, fontSize: 12)),
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
            if (hint != null) Text(hint, style: TextStyle(color: c.muted, fontSize: 12)),
          ]),
        );
    Widget bar(double v) => ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(value: v.clamp(0, 1).toDouble(), minHeight: 7, color: c.highlight, backgroundColor: c.subtle),
        );

    // per day for the chosen span
    final map = {for (final d in data.days) d.day: d.words};
    final series = [for (var i = _span - 1; i >= 0; i--) map[addDays(today, -i)] ?? 0];
    final from = addDays(today, -(_span - 1));
    final byWork = <String, int>{};
    for (final w in data.work) {
      if (w.day.compareTo(from) >= 0) byWork[w.docId] = (byWork[w.docId] ?? 0) + w.words;
    }
    final docs = {for (final d in data.docs) d.id: d};
    final byKind = <DocKind, int>{};
    byWork.forEach((id, n) {
      final k = docs[id]?.kind;
      if (k != null) byKind[k] = (byKind[k] ?? 0) + n;
    });
    final works = byWork.entries.where((e) => e.value > 0).toList()..sort((a, b) => b.value.compareTo(a.value));

    Widget rows(List<(String, int)> list) {
      if (list.isEmpty) return Text('—', style: TextStyle(color: c.muted));
      final max = list.map((e) => e.$2).reduce(math.max);
      return Column(children: [
        for (final (label, n) in list.take(6))
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis)), Text(groupIndian(n), style: TextStyle(color: c.muted))]),
              const SizedBox(height: 4),
              ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(value: n / max, minHeight: 6, color: c.tintViolet, backgroundColor: c.subtle)),
            ]),
          ),
      ]);
    }

    return Scaffold(
      appBar: AppBar(title: Text(context.t('goals.title'))),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
        Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 14), child: Text(context.t('goals.intro'), style: TextStyle(color: c.muted))),
        card(context.t('goals.panel.today'), c.tintTangerine, [
          Row(children: [
            number(context.t('goals.todayLabel'), groupIndian(todayWords), p.dailyGoal > 0 ? context.t('goals.ofGoal', {'n': p.dailyGoal}) : null),
            number(context.t('goals.streak'), '🔥 ${st.current}', context.t('goals.best', {'count': st.best})),
          ]),
          if (p.dailyGoal > 0) ...[const SizedBox(height: 10), bar(todayWords / p.dailyGoal)],
          const SizedBox(height: 14),
          Row(children: [Text(context.t('goals.thisWeek'), style: TextStyle(color: c.muted)), const Spacer(), Text(g.weekly > 0 ? '${groupIndian(week)} / ${groupIndian(g.weekly)}' : groupIndian(week), style: const TextStyle(fontWeight: FontWeight.w600))]),
          if (g.weekly > 0) ...[const SizedBox(height: 8), bar(week / g.weekly)],
        ]),
        card(context.t('goals.set'), c.tintViolet, [
          Row(children: [
            Expanded(child: _NumberField(label: context.t('goals.daily'), value: p.dailyGoal, onDone: (v) => _save(p, daily: v))),
            const SizedBox(width: 10),
            Expanded(child: _NumberField(label: context.t('goals.weekly'), value: g.weekly, onDone: (v) => _save(p, goals: g.copyWith(weekly: v)))),
          ]),
          const SizedBox(height: 14),
          Text(context.t('goals.restDays'), style: TextStyle(color: c.muted, fontSize: 12.5)),
          const SizedBox(height: 6),
          Wrap(spacing: 8, children: [
            for (final n in [0, 1, 2]) ChoiceChip(selected: g.restDays == n, label: Text(context.t('goals.restN', {'count': n})), onSelected: (_) => _save(p, goals: g.copyWith(restDays: n))),
          ]),
          Padding(padding: const EdgeInsets.only(top: 6), child: Text(context.t('goals.restHint'), style: TextStyle(color: c.muted, fontSize: 12))),
          const SizedBox(height: 14),
          Text(context.t('goals.timerDefault'), style: TextStyle(color: c.muted, fontSize: 12.5)),
          const SizedBox(height: 6),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final m in timerChoices) ChoiceChip(selected: g.timer == m, label: Text(context.t('goals.timer.min', {'n': m})), onSelected: (_) => _save(p, goals: g.copyWith(timer: m))),
          ]),
        ]),
        card(context.t('goals.reminder.heading'), c.tintSky, [
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: r.on && deviceOn,
            title: Text(context.t('goals.reminder.on')),
            onChanged: (v) async {
              if (v) {
                final ok = await Notifications.ask();
                await prefs.setString(Notifications.deviceKey, ok ? 'on' : 'off');
                if (!ok) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.t('app.goals.blocked'))));
                  setState(() {});
                  return;
                }
              } else {
                await prefs.setString(Notifications.deviceKey, 'off');
              }
              await _save(p, goals: g.copyWith(reminder: r.copyWith(on: v)));
            },
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            enabled: r.on && deviceOn,
            leading: Icon(LucideIcons.clock, color: c.tintSky),
            title: Text(context.t('goals.reminder.time')),
            trailing: Text(TimeOfDay(hour: r.hour, minute: r.minute).format(context), style: const TextStyle(fontWeight: FontWeight.w600)),
            onTap: () async {
              final t = await showTimePicker(context: context, initialTime: TimeOfDay(hour: r.hour, minute: r.minute));
              if (t != null) await _save(p, goals: g.copyWith(reminder: r.copyWith(time: '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}')));
            },
          ),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final d in const [1, 2, 3, 4, 5, 6, 0])
              FilterChip(
                selected: r.days.contains(d),
                showCheckmark: false,
                label: Text(context.t('goals.dow.$d')),
                onSelected: r.on && deviceOn ? (on) => _save(p, goals: g.copyWith(reminder: r.copyWith(days: on ? ([...r.days, d]..sort()) : r.days.where((x) => x != d).toList()))) : null,
              ),
          ]),
          Padding(padding: const EdgeInsets.only(top: 10), child: Text(context.t('app.goals.whereApp'), style: TextStyle(color: c.muted, fontSize: 12))),
        ]),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
          child: Row(children: [
            Text(context.t('goals.stats.title'), style: Theme.of(context).textTheme.titleMedium),
            const Spacer(),
            SegmentedButton<int>(
              showSelectedIcon: false,
              segments: [for (final n in const [7, 30, 90]) ButtonSegment(value: n, label: Text(context.t('goals.stats.days', {'n': n})))],
              selected: {_span},
              onSelectionChanged: (v) => setState(() => _span = v.first),
            ),
          ]),
        ),
        card(context.t('goals.stats.words'), c.tintTangerine, [
          Row(children: [
            number(context.t('goals.stats.words'), groupIndian(sum.words)),
            number(context.t('goals.stats.time'), sum.minutes >= 60 ? context.t('goals.stats.hm', {'h': sum.minutes ~/ 60, 'm': sum.minutes % 60}) : context.t('goals.stats.m', {'m': sum.minutes})),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            number(context.t('goals.stats.writingDays'), '${sum.writingDays} / $_span'),
            number(context.t('goals.stats.perDay'), groupIndian(sum.perWritingDay), sum.bestDay == null ? null : context.t('goals.stats.bestDay', {'n': sum.bestDay!.words})),
          ]),
          const SizedBox(height: 16),
          Text(context.t('goals.stats.perDayChart'), style: TextStyle(color: c.muted, fontSize: 12.5)),
          const SizedBox(height: 8),
          _Bars(values: series, color: c.tintViolet),
        ]),
        card(context.t('goals.stats.when'), c.tintSky, [
          if (sum.bestHour == null)
            Text(context.t('goals.stats.noHours'), style: TextStyle(color: c.muted))
          else ...[
            _Bars(values: sum.hours, color: c.tintSky),
            const SizedBox(height: 4),
            Row(children: [for (final h in const ['0:00', '6:00', '12:00', '18:00', '23:00']) ...[Text(h, style: TextStyle(color: c.muted, fontSize: 10)), if (h != '23:00') const Spacer()]]),
            const SizedBox(height: 8),
            Text(context.t('goals.stats.bestHour', {'h': '${sum.bestHour}:00'}), style: TextStyle(color: c.muted, fontSize: 12.5)),
          ],
        ]),
        card(context.t('goals.stats.byKind'), c.tintViolet, [rows([for (final e in byKind.entries) (kindNames[e.key]!.ml, e.value)]..sort((a, b) => b.$2.compareTo(a.$2)))]),
        card(context.t('goals.stats.byWork'), c.tintLime, [rows([for (final e in works) (docs[e.key]?.title ?? context.t('goals.stats.deleted'), e.value)])]),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: Text(context.t('goals.stats.kept', {'n': keepDays}), style: TextStyle(color: c.muted, fontSize: 12))),
      ]),
    );
  }
}

class _NumberField extends StatefulWidget {
  const _NumberField({required this.label, required this.value, required this.onDone});
  final String label;
  final int value;
  final void Function(int) onDone;

  @override
  State<_NumberField> createState() => _NumberFieldState();
}

class _NumberFieldState extends State<_NumberField> {
  late final _c = TextEditingController(text: '${widget.value}');

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _done() {
    final v = int.tryParse(_c.text.trim()) ?? 0;
    if (v != widget.value) widget.onDone(v);
  }

  @override
  Widget build(BuildContext context) => Focus(
        onFocusChange: (f) {
          if (!f) _done();
        },
        child: TextField(controller: _c, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: widget.label), onSubmitted: (_) => _done()),
      );
}

/// Simple bars, one per value.
class _Bars extends StatelessWidget {
  const _Bars({required this.values, required this.color});
  final List<int> values;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final max = values.isEmpty ? 1 : math.max(1, values.reduce(math.max));
    return SizedBox(
      height: 90,
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        for (final v in values)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1),
              child: FractionallySizedBox(
                heightFactor: v == 0 ? 0.02 : math.max(0.05, v / max),
                child: DecoratedBox(decoration: BoxDecoration(color: v == 0 ? context.c.subtle : color, borderRadius: const BorderRadius.vertical(top: Radius.circular(3)))),
              ),
            ),
          ),
      ]),
    );
  }
}

/// Schedule the daily reminder from the writer's settings and today's words (app start, after
/// writing, after a change). Free: the phone rings it itself.
Future<void> rescheduleReminders(WidgetRef ref, BuildContext context) async {
  final sv = ref.read(servicesProvider);
  final p = await ref.read(profileProvider.future).catchError((_) => null);
  if (p == null) return;
  final days = await sv.store.wordsByDay();
  if (!context.mounted) return;
  final title = context.t('goals.reminder.title');
  final body = context.t('goals.reminder.body');
  final strings = I18n.of(context);
  await Notifications.scheduleReminders(
    prefs: sv.prefs,
    reminder: GoalPrefs.from(p.preferences['goals']).reminder,
    dailyGoal: p.dailyGoal,
    todayWords: wordsOn(days, localDay()),
    title: title,
    body: body,
    bodyLeft: (n) => strings.t('goals.reminder.bodyLeft', {'n': n}),
  );
}
