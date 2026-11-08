import 'package:flutter_test/flutter_test.dart';
import 'package:litma/data/goals.dart';

// Same cases as the web's goals checks (packages/shared/src/goals.ts).
void main() {
  const t = '2026-11-08';
  List<WritingDay> days(List<(int, int)> list) => [for (final (o, w) in list) WritingDay(addDays(t, -o), w)];

  test('streak counts consecutive writing days', () {
    final s = streak(days([(0, 10), (1, 5), (2, 5), (4, 9)]), today: t);
    expect(s.current, 3);
    expect(s.today, true);
  });
  test('a rest day keeps the streak', () {
    expect(streak(days([(0, 10), (1, 5), (2, 5), (4, 9)]), today: t, restDays: 1).current, 4);
  });
  test('today without words does not end it', () {
    final s = streak(days([(1, 5), (2, 5)]), today: t);
    expect(s.current, 2);
    expect(s.today, false);
  });
  test('more rest than allowed ends it', () {
    expect(streak(days([(0, 1), (3, 1), (6, 1)]), today: t, restDays: 2).current, 2);
  });
  test('best streak looks back', () {
    expect(streak(days([(0, 1), (10, 1), (11, 1), (12, 1), (13, 1)]), today: t).best, 4);
  });
  test('weeks start on Monday', () {
    expect(weekStart(t), '2026-11-02');
    expect(wordsThisWeek(days([(0, 10), (1, 5), (7, 100)]), t), 15);
  });
  test('deadline pace', () {
    final p = deadlinePace(1000, 5000, '2026-11-17', t)!;
    expect(p.left, 4000);
    expect(p.daysLeft, 10);
    expect(p.perDay, 400);
  });
  test('best hour', () {
    final h = List<int>.filled(24, 0)..[20] = 50;
    expect(summarise([WritingDay(t, 50, minutes: 10, hours: h)], 7, t).bestHour, 20);
  });
}
