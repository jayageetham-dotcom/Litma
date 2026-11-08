import 'package:flutter_test/flutter_test.dart';
import 'package:litma/editor/pages.dart';

void main() {
  test('a short work is one page', () {
    final f = flowPages([40, 40, 40], [false, false, false], 500);
    expect(f.pages, 1);
    expect(f.gapBefore, isEmpty);
    expect(f.lastFill, 380);
  });

  test('a line that does not fit moves to the next page', () {
    final f = flowPages([200, 200, 200], [false, false, false], 500);
    expect(f.pages, 2);
    expect(f.gapBefore, {2: 100.0});
    expect(f.lastFill, 300);
  });

  test('an inserted page break starts a new page', () {
    // line, break, blank line, break, line: the inserted page holds the blank line
    final f = flowPages([100, 0, 30, 0, 100], [false, true, false, true, false], 500);
    expect(f.pages, 3);
    expect(f.gapBefore, {1: 400.0, 3: 470.0});
    expect(f.lastFill, 400);
  });

  test('a line taller than a page gets a page of its own', () {
    final f = flowPages([100, 900, 50], [false, false, false], 500);
    expect(f.pages, 3);
    expect(f.gapBefore, {1: 400.0, 2: 0.0});
  });

  test('a phone page holds about as much text as a printed page', () {
    // A4 with 25 mm margins: 160 × 247 mm of writing
    const w = 346.0;
    final h = phonePageHeight({'pageSize': 'A4', 'margins': {'top': 25, 'bottom': 25, 'left': 25, 'right': 25}}, w);
    const mm = 96 / 25.4;
    expect(h * w, closeTo(160 * mm * 247 * mm, 1));
    expect(phonePageHeight({'pageSize': 'A5'}, w), lessThan(h));
    expect(phonePageHeight(const {}, w), closeTo(h, 0.001), reason: 'A4 and 25 mm margins by default');
  });
}
