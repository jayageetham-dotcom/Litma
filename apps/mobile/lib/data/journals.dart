/// Journals (kind `diary`): their order, the desk list with month lines, the card face and the
/// export range. Same rules as the web (apps/web/src/app/desk, components/editor/JournalExport.tsx):
/// "started" is `created_at`, in the writer's local day; trashed journals never count.
library;

import '../core/search.dart';
import 'forms.dart';
import 'models.dart';

/// Journals oldest first, by started date (ties by id), without trashed ones or other writing types.
List<LitmaDoc> journalOrder(Iterable<LitmaDoc> docs) {
  final list = docs.where((d) => d.kind == DocKind.diary && !d.archived).toList();
  list.sort((a, b) {
    final c = a.createdAt.compareTo(b.createdAt);
    return c != 0 ? c : a.id.compareTo(b.id);
  });
  return list;
}

/// The journals started just before and just after [id] (the editor's ‹ ›).
({LitmaDoc? prev, LitmaDoc? next}) journalNeighbours(Iterable<LitmaDoc> docs, String id) {
  final list = journalOrder(docs);
  final i = list.indexWhere((d) => d.id == id);
  if (i < 0) return (prev: null, next: null);
  return (prev: i > 0 ? list[i - 1] : null, next: i < list.length - 1 ? list[i + 1] : null);
}

/// What a journal card shows: its title, or for an untitled journal its first line of text, and the
/// text after that (datelines and a repeated title are skipped, so nothing repeats). The shared
/// `journalPreview` over the journal's lines.
({String title, String text, bool untitled}) journalFace(LitmaDoc d) {
  final lines = d.hasContent
      ? [for (final b in (d.content['content'] as List).whereType<Map>()) plainTextOf(b.cast<String, dynamic>())]
      : (d.plainText ?? '').split('\n');
  final p = journalPreview(d.title, d.createdAt, lines);
  final body = p.body.length > 300 ? p.body.substring(0, 300) : p.body;
  return (title: p.heading ?? '', text: body, untitled: isUntitledJournal(d.title, d.createdAt));
}

/// One row of the Journals tab: a month line or a journal.
typedef JournalRow = ({String? month, LitmaDoc? doc});

/// The Journals tab: newest started first, a month line before each month; with a [query] only the
/// journals that match (Manglish too, `matchesSearch`) and their months.
List<JournalRow> journalRows(Iterable<LitmaDoc> docs, {String query = ''}) {
  final list = journalOrder(docs).reversed.where((d) {
    if (query.trim().isEmpty) return true;
    final f = journalFace(d);
    return matchesSearch('${d.title} ${f.title} ${f.text}', query);
  });
  final rows = <JournalRow>[];
  String? month;
  for (final d in list) {
    final m = monthLine(d.createdAt);
    if (m != month) rows.add((month: m, doc: null));
    month = m;
    rows.add((month: null, doc: d));
  }
  return rows;
}

DateTime _day(DateTime d) {
  final l = d.isUtc ? d.toLocal() : d;
  return DateTime(l.year, l.month, l.day);
}

/// Journals started between [from] and [to] (whole local days, either order), oldest first (export).
List<LitmaDoc> journalsBetween(Iterable<LitmaDoc> docs, DateTime from, DateTime to) {
  var a = _day(from), b = _day(to);
  if (a.isAfter(b)) (a, b) = (b, a);
  return journalOrder(docs).where((d) {
    final x = _day(d.createdAt);
    return !x.isBefore(a) && !x.isAfter(b);
  }).toList();
}
