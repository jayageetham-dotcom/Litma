import 'package:flutter_test/flutter_test.dart';
import 'package:litma/data/forms.dart';
import 'package:litma/data/journals.dart';
import 'package:litma/data/models.dart';
import 'package:litma/editor/document.dart';
import 'package:litma/editor/journal_export.dart' show journalsHtml;

// The shared journal dates and rules (packages/shared/src/forms.ts). The same hand-written cases as
// scripts/journal-lab/journal-check.ts, so the web and the phone give the same answers.
void main() {
  final d = DateTime(2026, 11, 28, 9, 30); // Saturday 28 Nov 2026, local time
  final now = DateTime(2026, 11, 28, 20);

  test('dates', () {
    expect(todayLine(d), '2026 നവംബർ 28, ശനിയാഴ്ച');
    expect(todayLine(DateTime(2026, 11, 29)), '2026 നവംബർ 29, ഞായറാഴ്ച');
    expect(todayLine(DateTime(2027, 1, 1)), '2027 ജനുവരി 1, വെള്ളിയാഴ്ച');
    expect(todayLine(DateTime(2026, 10, 4)), '2026 ഒക്ടോബർ 4, ഞായറാഴ്ച');
    expect(journalDay(d), (day: 28, month: 'നവം', weekday: 'ശനി'));
    expect(journalDay(DateTime(2026, 9, 2)), (day: 2, month: 'സെപ്റ്റം', weekday: 'ബുധൻ'));
    expect(shortDate(d, now), '28 നവം');
    expect(shortDate(DateTime(2025, 8, 15), now), '15 ഓഗ 2025');
    expect(shortDate(DateTime(2025, 11, 28), now), '28 നവം 2025');
    expect(monthLine(d), '2026 നവംബർ');
    expect(monthLine(DateTime(2026, 5, 1)), '2026 മേയ്');
    expect(journalTitle(d), '2026 നവംബർ 28, ശനിയാഴ്ച');
  });

  test('server times (UTC) read as the local day', () {
    expect(todayLine(d.toUtc()), todayLine(d));
    expect(sameDay(d.toUtc(), d), isTrue);
    expect(sameDay(d, DateTime(2026, 11, 27, 23, 59)), isFalse);
  });

  test('untitled journals', () {
    final created = d.toUtc();
    expect(isUntitledJournal('', created), isTrue);
    expect(isUntitledJournal('   ', created), isTrue);
    expect(isUntitledJournal(null), isTrue);
    expect(isUntitledJournal('പുതിയ ജേണൽ', created), isTrue);
    expect(isUntitledJournal('പുതിയ ഡയറി'), isTrue);
    expect(isUntitledJournal('2026 നവംബർ 28, ശനിയാഴ്ച', created), isTrue);
    expect(isUntitledJournal(' 2026 നവംബർ 28, ശനിയാഴ്ച ', created), isTrue);
    expect(isUntitledJournal('2026 നവംബർ 28, ശനിയാഴ്‌ച', created), isTrue, reason: 'ICU ZWNJ');
    expect(isUntitledJournal('28 നവം', created), isTrue);
    expect(isUntitledJournal('28 നവം 2026', created), isTrue);
    expect(isUntitledJournal('2026 നവംബർ 27, വെള്ളിയാഴ്ച', created), isFalse, reason: "another day's date");
    expect(isUntitledJournal('2026 നവംബർ 28, ശനിയാഴ്ച'), isFalse, reason: 'date without createdAt');
    expect(isUntitledJournal('ഉമ്മയുടെ പത്തിരി', created), isFalse);
  });

  test('keep rule for journals', () {
    final created = d.toUtc();
    final content = starterContent(DocKind.diary, now: d);
    expect(keepOnClose(title: journalTitle(d), kind: DocKind.diary, content: content, createdAt: created), isFalse);
    expect(keepOnClose(title: 'ബസ് സ്റ്റോപ്പിൽ', kind: DocKind.diary, content: content, createdAt: created), isTrue);
    final written = {
      ...content,
      'content': [
        ...(content['content'] as List),
        {
          'type': 'paragraph',
          'content': [
            {'type': 'text', 'text': 'അമ്മച്ചി അപ്പം ഉണ്ടാക്കി.'}
          ]
        },
      ],
    };
    expect(keepOnClose(title: journalTitle(d), kind: DocKind.diary, content: written, createdAt: created), isTrue);
    expect(keepOnClose(title: 'പുതിയ ചെറുകഥ', kind: DocKind.story, content: starterContent(DocKind.story)), isFalse);
  });

  test('date lines and card preview (journalPreview)', () {
    final created = d.toUtc();
    expect(isDateLine('2026 നവംബർ 28, ശനിയാഴ്ച'), isTrue);
    expect(isDateLine('2026, നവംബർ 3, ചൊവ്വാഴ്\u200cച'), isTrue);
    expect(isDateLine('1998-ൽ ഇക്കയുടെ കല്യാണം നവംബർ മാസത്തിലായിരുന്നു, വീട്ടിൽ എല്ലാവരും ഉണ്ടായിരുന്നു'), isFalse);
    final lines = ['', '2026 നവംബർ 28, ശനിയാഴ്ച', 'രാവിലെ ഉമ്മ പത്തിരി ചുട്ടു.', 'അയൽപക്കത്തെ കുട്ടികൾ മണം പിടിച്ച് വന്നു.'];
    expect(journalPreview(journalTitle(d), created, lines), (heading: 'രാവിലെ ഉമ്മ പത്തിരി ചുട്ടു.', body: 'അയൽപക്കത്തെ കുട്ടികൾ മണം പിടിച്ച് വന്നു.'));
    expect(journalPreview('മഴ പെയ്ത വൈകുന്നേരം', created, ['മഴ പെയ്ത വൈകുന്നേരം', '2026 നവംബർ 26, വ്യാഴാഴ്ച', 'ജോസഫ് ചേട്ടന്റെ ഓട്ടോ വന്നു.']), (heading: 'മഴ പെയ്ത വൈകുന്നേരം', body: 'ജോസഫ് ചേട്ടന്റെ ഓട്ടോ വന്നു.'));
    expect(journalPreview('പുതിയ ജേണൽ', created, ['2026 നവംബർ 28, ശനിയാഴ്ച']), (heading: null, body: ''));
    expect(journalPreview('അമ്മച്ചിയുടെ അപ്പം', created, []), (heading: 'അമ്മച്ചിയുടെ അപ്പം', body: ''));
  });

  LitmaDoc journal(String id, DateTime created, {String? title, DateTime? updated, String text = '', DocKind kind = DocKind.diary, bool archived = false}) => LitmaDoc(
        id: id,
        title: title ?? journalTitle(created),
        kind: kind,
        content: const {'type': 'doc'},
        settings: const {},
        plainText: text,
        archived: archived,
        createdAt: created.toUtc(),
        updatedAt: (updated ?? created).toUtc(),
      );

  final list = [
    journal('c', DateTime(2026, 11, 26, 18), title: 'മഴ പെയ്ത വൈകുന്നേരം'),
    journal('a', DateTime(2026, 10, 21, 8)),
    journal('e', DateTime(2026, 11, 28, 7)),
    journal('b', DateTime(2026, 11, 2, 21)),
    journal('d', DateTime(2026, 11, 26, 18)), // same time as c: ties by id
    journal('x', DateTime(2026, 11, 27), kind: DocKind.story),
    journal('t', DateTime(2026, 11, 27), archived: true),
  ];

  test('journal order and neighbours (by started date, ties by id, no trash, no other types)', () {
    expect(journalOrder(list).map((j) => j.id), ['a', 'b', 'c', 'd', 'e']);
    var n = journalNeighbours(list, 'c');
    expect((n.prev?.id, n.next?.id), ('b', 'd'));
    n = journalNeighbours(list, 'a');
    expect((n.prev?.id, n.next?.id), (null, 'b'));
    n = journalNeighbours(list, 'e');
    expect((n.prev?.id, n.next?.id), ('d', null));
    n = journalNeighbours([list[0]], 'c');
    expect((n.prev, n.next), (null, null));
  });

  test('desk list: newest first, month lines, search', () {
    final rows = journalRows(list, query: '');
    expect(rows.map((r) => r.month ?? r.doc!.id), ['2026 നവംബർ', 'e', 'd', 'c', 'b', '2026 ഒക്ടോബർ', 'a']);
    final found = journalRows(list, query: 'mazha');
    expect(found.map((r) => r.month ?? r.doc!.id), ['2026 നവംബർ', 'c']);
    expect(journalRows(list, query: 'kadal'), isEmpty);
  });

  test('card face: untitled shows its first line, text continues after it', () {
    final untitled = journal('u', d, text: '${journalTitle(d)}\n${todayLine(d)}\nരാവിലെ ഉമ്മ പത്തിരി ചുട്ടു\nഅയൽപക്കത്തെ കുട്ടികൾ വന്നു.');
    var f = journalFace(untitled);
    expect(f.title, 'രാവിലെ ഉമ്മ പത്തിരി ചുട്ടു');
    expect(f.text, 'അയൽപക്കത്തെ കുട്ടികൾ വന്നു.');
    expect(f.untitled, isTrue);
    f = journalFace(journal('n', d, title: 'ബസ് സ്റ്റോപ്പ്', text: 'ബസ് സ്റ്റോപ്പ്\n${todayLine(d)}\nഫാത്തിമ ടീച്ചറും ജോസഫ് ചേട്ടനും.'));
    expect((f.title, f.text, f.untitled), ('ബസ് സ്റ്റോപ്പ്', 'ഫാത്തിമ ടീച്ചറും ജോസഫ് ചേട്ടനും.', false));
    f = journalFace(journal('e', d, text: '${todayLine(d)}\n'));
    expect((f.title, f.text), ('', ''));
  });

  test('export selection by started date (whole days, oldest first)', () {
    final picked = journalsBetween(list, DateTime(2026, 11, 2), DateTime(2026, 11, 26));
    expect(picked.map((j) => j.id), ['b', 'c', 'd']);
    expect(journalsBetween(list, DateTime(2026, 11, 29), DateTime(2026, 12, 31)), isEmpty);
    expect(journalsBetween(list, DateTime(2026, 11, 28), DateTime(2026, 11, 1)).map((j) => j.id), ['b', 'c', 'd', 'e'], reason: 'From after To: swapped');
  });

  test('export file: Malayalam contents, oldest first, each journal on a new page', () {
    final a = DateTime(2026, 11, 2, 21), b = DateTime(2026, 11, 26, 18);
    final docA = EditorDocument.fromJson(starterContent(DocKind.diary, now: a));
    final docB = EditorDocument.fromJson(starterContent(DocKind.diary, now: b));
    final html = journalsHtml([(journal('a', a), docA), (journal('b', b, title: 'മഴ പെയ്ത വൈകുന്നേരം'), docB)]);
    expect(html, contains('<h1 class="contents">ഉള്ളടക്കം</h1>'));
    expect(html, contains('<li>${todayLine(a)}</li>'));
    expect(html, contains('<li>${todayLine(b)} · മഴ പെയ്ത വൈകുന്നേരം</li>'));
    expect(html.indexOf(todayLine(a)) < html.indexOf(todayLine(b)), isTrue);
    expect('<section class="journal"'.allMatches(html).length, 2);
    expect(html, contains('<p class="sb sb-title j-title">മഴ പെയ്ത വൈകുന്നേരം</p>'), reason: "a named journal's empty title block gets its title");
  });
}
