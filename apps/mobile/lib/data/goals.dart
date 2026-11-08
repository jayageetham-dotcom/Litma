/// Writing goals, streaks and statistics from the writer's writing days.
/// A port of packages/shared/src/goals.ts: keep the two in step (same cases in test/goals_test.dart).
///
/// Days are the writer's own calendar days ("YYYY-MM-DD" in their time zone). The server keeps 90
/// days of rows, so the best streak is also remembered in the profile (preferences.goals.bestStreak).
library;

import 'dart:math' as math;

class WritingDay {
  const WritingDay(this.day, this.words, {this.minutes = 0, this.hours});
  final String day;
  final int words;
  final int minutes;

  /// words per hour of the day, index 0 = 00:00
  final List<int>? hours;

  factory WritingDay.fromRow(Map<String, dynamic> r) => WritingDay(
        '${r['day']}',
        (r['words'] as num?)?.toInt() ?? 0,
        minutes: (r['minutes'] as num?)?.toInt() ?? 0,
        hours: (r['hours'] as List?)?.map((e) => (e as num?)?.toInt() ?? 0).toList(),
      );
  Map<String, dynamic> toRow() => {'day': day, 'words': words, 'minutes': minutes, if (hours != null) 'hours': hours};
}

class ReminderPrefs {
  const ReminderPrefs({this.on = false, this.time = '19:30', this.days = const [0, 1, 2, 3, 4, 5, 6]});
  final bool on;

  /// "HH:MM", the writer's local time
  final String time;

  /// days of the week it may ring, 0 = Sunday
  final List<int> days;

  factory ReminderPrefs.from(Object? j) {
    if (j is! Map) return const ReminderPrefs();
    return ReminderPrefs(
      on: j['on'] == true,
      time: (j['time'] as String?) ?? '19:30',
      days: (j['days'] as List?)?.map((e) => (e as num).toInt()).toList() ?? const [0, 1, 2, 3, 4, 5, 6],
    );
  }
  Map<String, dynamic> toJson() => {'on': on, 'time': time, 'days': days};
  ReminderPrefs copyWith({bool? on, String? time, List<int>? days}) => ReminderPrefs(on: on ?? this.on, time: time ?? this.time, days: days ?? this.days);
  int get hour => int.tryParse(time.split(':').first) ?? 19;
  int get minute => int.tryParse(time.split(':').last) ?? 30;
}

/// preferences.goals in the profile (the daily goal is the profile's daily_goal).
class GoalPrefs {
  const GoalPrefs({this.weekly = 0, this.restDays = 0, this.reminder = const ReminderPrefs(), this.timer = 25, this.bestStreak = 0});
  final int weekly;
  final int restDays;
  final ReminderPrefs reminder;
  final int timer;
  final int bestStreak;

  factory GoalPrefs.from(Object? j) {
    if (j is! Map) return const GoalPrefs();
    return GoalPrefs(
      weekly: (j['weekly'] as num?)?.toInt() ?? 0,
      restDays: (j['restDays'] as num?)?.toInt() ?? 0,
      reminder: ReminderPrefs.from(j['reminder']),
      timer: (j['timer'] as num?)?.toInt() ?? 25,
      bestStreak: (j['bestStreak'] as num?)?.toInt() ?? 0,
    );
  }
  Map<String, dynamic> toJson() => {'weekly': weekly, 'restDays': restDays, 'reminder': reminder.toJson(), 'timer': timer, 'bestStreak': bestStreak};
  GoalPrefs copyWith({int? weekly, int? restDays, ReminderPrefs? reminder, int? timer, int? bestStreak}) => GoalPrefs(
        weekly: weekly ?? this.weekly,
        restDays: restDays ?? this.restDays,
        reminder: reminder ?? this.reminder,
        timer: timer ?? this.timer,
        bestStreak: bestStreak ?? this.bestStreak,
      );
}

const timerChoices = [10, 15, 25, 45, 60];
const keepDays = 90;

String _pad(int n) => n.toString().padLeft(2, '0');

/// The local calendar day of a date, "YYYY-MM-DD".
String localDay([DateTime? d]) {
  final x = d ?? DateTime.now();
  return '${x.year}-${_pad(x.month)}-${_pad(x.day)}';
}

DateTime parseDay(String s) {
  final p = s.split('-').map(int.parse).toList();
  return DateTime(p[0], p[1], p[2]);
}

String addDays(String day, int n) {
  final d = parseDay(day);
  return localDay(DateTime(d.year, d.month, d.day + n));
}

/// Whole days from a to b (b later is positive). Counted on UTC dates so clock changes don't matter.
int daysBetween(String a, String b) {
  DateTime u(String s) {
    final d = parseDay(s);
    return DateTime.utc(d.year, d.month, d.day);
  }

  return u(b).difference(u(a)).inDays;
}

class Streak {
  const Streak(this.current, this.best, this.today);
  final int current;
  final int best;
  final bool today;
}

/// Walk back from [today]: a day with words adds to the streak; a day without may be a rest day if no
/// more than [restDays] such days fall in any seven-day stretch; otherwise the streak ends. Today
/// without words yet doesn't end it.
Streak streak(List<WritingDay> days, {String? today, int restDays = 0, int remembered = 0}) {
  final t = today ?? localDay();
  final wrote = {for (final d in days) if (d.words > 0) d.day};
  final rest = restDays.clamp(0, 2);
  int run(String from, [String? stopBefore]) {
    var n = 0;
    final misses = <int>[];
    var d = from;
    for (var i = 0; i < 400; i++) {
      if (stopBefore != null && d.compareTo(stopBefore) < 0) break;
      if (wrote.contains(d)) {
        n++;
      } else {
        misses.add(i);
        while (misses.isNotEmpty && misses.first <= i - 7) {
          misses.removeAt(0);
        }
        if (misses.length > rest) break;
      }
      d = addDays(d, -1);
    }
    return n;
  }

  final hasToday = wrote.contains(t);
  final current = run(hasToday ? t : addDays(t, -1));
  var best = math.max(current, remembered);
  final oldest = days.fold<String>(t, (m, d) => d.day.compareTo(m) < 0 ? d.day : m);
  for (final d in wrote) {
    if (!wrote.contains(addDays(d, 1))) best = math.max(best, run(d, oldest));
  }
  return Streak(current, best, hasToday);
}

int wordsOn(List<WritingDay> days, String day) => days.where((d) => d.day == day).fold(0, (n, d) => n + d.words);

/// Monday of the week a day falls in.
String weekStart(String day) => addDays(day, -((parseDay(day).weekday + 6) % 7));

int wordsThisWeek(List<WritingDay> days, [String? today]) {
  final t = today ?? localDay();
  final from = weekStart(t);
  return days.where((d) => d.day.compareTo(from) >= 0 && d.day.compareTo(t) <= 0).fold(0, (n, d) => n + d.words);
}

/// Words still to write and how many a day that needs, counting today. Null without a goal or date.
({int left, int daysLeft, int perDay})? deadlinePace(int words, int goal, String? deadline, [String? today]) {
  if (goal <= 0 || deadline == null || deadline.isEmpty) return null;
  final left = math.max(0, goal - words);
  final daysLeft = daysBetween(today ?? localDay(), deadline) + 1;
  if (daysLeft <= 0) return (left: left, daysLeft: 0, perDay: left);
  return (left: left, daysLeft: daysLeft, perDay: (left / daysLeft).ceil());
}

class Summary {
  const Summary({required this.words, required this.minutes, required this.writingDays, required this.perWritingDay, required this.hours, this.bestHour, this.bestDay});
  final int words;
  final int minutes;
  final int writingDays;
  final int perWritingDay;
  final List<int> hours;
  final int? bestHour;
  final WritingDay? bestDay;
}

/// Totals for the last [span] days, today included.
Summary summarise(List<WritingDay> days, int span, [String? today]) {
  final t = today ?? localDay();
  final from = addDays(t, -(span - 1));
  final hours = List<int>.filled(24, 0);
  var words = 0, minutes = 0, writing = 0;
  WritingDay? best;
  for (final d in days) {
    if (d.day.compareTo(from) < 0 || d.day.compareTo(t) > 0) continue;
    words += d.words;
    minutes += d.minutes;
    if (d.words > 0) writing++;
    if (best == null || d.words > best.words) best = d;
    final h = d.hours;
    if (h != null) {
      for (var i = 0; i < math.min(24, h.length); i++) {
        hours[i] += h[i];
      }
    }
  }
  final top = hours.reduce(math.max);
  return Summary(
    words: words,
    minutes: minutes,
    writingDays: writing,
    perWritingDay: writing > 0 ? (words / writing).round() : 0,
    hours: hours,
    bestHour: top > 0 ? hours.indexOf(top) : null,
    bestDay: best != null && best.words > 0 ? best : null,
  );
}
