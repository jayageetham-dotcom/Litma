import 'dart:async';

import 'package:uuid/uuid.dart';

import 'backend.dart';
import 'forms.dart';
import 'models.dart';
import 'offline.dart';

/// Litma's data layer on the phone: the same operations and rules as the web's store.ts in cloud
/// mode. Reads come from the server (after sending what waits) and refresh the copy on the phone;
/// offline they read that copy. Writes go to the server, or wait in the outbox.
class Store {
  Store(this.offline);
  final OfflineLayer offline;

  static const _uuid = Uuid();
  static String newId() => _uuid.v4();
  static String _now() => DateTime.now().toUtc().toIso8601String();

  static const docCols = 'id,title,kind,content,settings,word_count,is_public,share_id,archived,created_at,updated_at';
  static const listCols = 'id,title,kind,settings,word_count,is_public,share_id,archived,created_at,updated_at,plain_text';

  /// Server first; the copy on the phone when offline.
  Future<T> _read<T>(Future<T> Function() fresh, Future<T?> Function() kept) async {
    if (await offline.syncFirst()) {
      try {
        return await fresh();
      } on OfflineException {
        /* fall through to the device copy */
      }
    }
    final k = await kept();
    if (k != null) return k;
    throw const OfflineException();
  }

  /// Send a change now, or keep it in the outbox. True when it waits on the phone.
  Future<bool> _write(Json op, Future<void> Function() direct) async {
    if (await offline.syncFirst()) {
      try {
        await direct();
        return false;
      } on OfflineException {
        /* queue it */
      }
    }
    await offline.enqueue(op);
    return true;
  }

  // ── works ──

  Future<List<LitmaDoc>> listDocs({bool trash = false}) => _read(
        () async {
          final rows = await offline.remote((b) => b.select('documents', columns: listCols, eq: {'archived': trash}, order: 'updated_at'));
          final kept = {for (final k in await offline.all('documents')) k['id'] as String: k};
          final ids = rows.map((r) => r['id']).toSet();
          for (final k in kept.values) {
            if ((k['archived'] == true) == trash && !ids.contains(k['id'])) await offline.remove('documents', k['id'] as String);
          }
          for (final r in rows) {
            await offline.put('documents', r['id'] as String, {...?kept[r['id']], ...r, 'archived': r['archived'] == true, '_server_at': r['updated_at']});
          }
          if (!trash) unawaited(_prefetch(rows, kept));
          return rows.map(LitmaDoc.fromRow).toList();
        },
        () async {
          final rows = (await offline.all('documents')).where((d) => (d['archived'] == true) == trash && d['title'] != null).map(LitmaDoc.fromRow).toList();
          rows.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
          return rows;
        },
      );

  /// Keep the text of recently changed works on the phone, so they open offline too.
  bool _prefetching = false;
  Future<void> _prefetch(List<Json> rows, Map<String, Json> kept) async {
    if (_prefetching) return;
    _prefetching = true;
    try {
      final stale = rows.where((r) => kept[r['id']]?['_content_at'] != r['updated_at']).take(60).toList();
      for (var i = 0; i < stale.length; i += 10) {
        final ids = [for (final r in stale.skip(i).take(10)) r['id'] as String];
        final data = await offline.remote((b) => b.select('documents', columns: docCols, inColumn: 'id', inValues: ids));
        for (final d in data) {
          await offline.merge('documents', d['id'] as String, {...d, '_server_at': d['updated_at'], '_content_at': d['updated_at']});
        }
      }
    } catch (_) {
      /* offline again: the next listing tries again */
    } finally {
      _prefetching = false;
    }
  }

  Future<LitmaDoc?> getDoc(String id) => _read<LitmaDoc?>(
        () async {
          final row = await offline.remote((b) => b.selectOne('documents', columns: docCols, eq: {'id': id}));
          if (row == null) {
            await offline.remove('documents', id);
            return null;
          }
          await offline.merge('documents', id, {...row, '_server_at': row['updated_at'], '_content_at': row['updated_at']});
          return LitmaDoc.fromRow(row);
        },
        () async {
          final d = await offline.get('documents', id);
          return (d?['content'] as Map?)?['type'] != null ? LitmaDoc.fromRow(d!) : null;
        },
      );

  Future<LitmaDoc> createDoc(DocKind kind, {String? title, Profile? profile}) async {
    var content = starterContent(kind);
    final settings = {...newSettings(kind), 'pristine': true};
    final mode = profile?.preferences['inputMode'];
    if (mode == 'manglish' || mode == 'malayalam' || mode == 'english') settings['inputMode'] = mode;
    content = withAuthor(content, profile?.name);
    final row = <String, dynamic>{
      'id': newId(),
      'title': title ?? 'പുതിയ ${kindNames[kind]!.ml}',
      'kind': kind.name,
      'content': content,
      'settings': settings,
      'word_count': 0,
    };
    Json? made;
    await _write({'kind': 'insert', 'table': 'documents', 'id': row['id'], 'row': row}, () async {
      made = await offline.remote((b) => b.insert('documents', row, columns: docCols));
    });
    final at = _now();
    final doc = made ?? {...row, 'is_public': false, 'share_id': null, 'archived': false, 'created_at': at, 'updated_at': at};
    final serverAt = made?['updated_at'];
    await offline.put('documents', row['id'] as String, {...doc, 'archived': false, 'plain_text': '', '_server_at': serverAt, '_content_at': serverAt});
    return LitmaDoc.fromRow(doc);
  }

  /// Save changes to a work. True when they wait on the phone until the connection returns.
  Future<bool> updateDoc(String id, Json patch) async {
    final change = {...patch};
    if (patch['content'] is Map) {
      final text = plainTextOf((patch['content'] as Map).cast<String, dynamic>());
      change['plain_text'] = text.length > 200000 ? text.substring(0, 200000) : text;
    }
    final kept = await offline.get('documents', id);
    if (kept != null) await offline.put('documents', id, {...kept, ...change, 'updated_at': _now()});
    return _write({'kind': 'update', 'table': 'documents', 'id': id, 'patch': change, 'base': kept?['_content_at']}, () async {
      final row = await offline.remote((b) => b.update('documents', id, change));
      await offline.markServer(id, withContent: change.containsKey('content'), updatedAt: row?['updated_at'] as String?);
    });
  }

  Future<void> trashDoc(String id) => updateDoc(id, {'archived': true});
  Future<void> restoreDoc(String id) => updateDoc(id, {'archived': false});

  Future<void> deleteDoc(String id) async {
    await offline.remove('documents', id);
    await _write({'kind': 'delete', 'table': 'documents', 'id': id}, () => offline.remote((b) => b.delete('documents', id: id)));
  }

  Future<LitmaDoc?> duplicateDoc(String id, {Profile? profile}) async {
    final d = await getDoc(id);
    if (d == null) return null;
    final copy = await createDoc(d.kind, title: '${d.title} (പകർപ്പ്)', profile: profile);
    await updateDoc(copy.id, {'content': d.content, 'settings': d.settings, 'word_count': d.wordCount});
    return copy.copyWith(content: d.content, settings: d.settings, wordCount: d.wordCount);
  }

  Future<void> emptyTrash() async {
    for (final d in await listDocs(trash: true)) {
      await deleteDoc(d.id);
    }
  }

  /// Discard new works opened but never typed in (the editor does this on close; the desk as a safety net).
  Future<int> discardPristine({Duration olderThan = const Duration(minutes: 30)}) async {
    final cutoff = DateTime.now().subtract(olderThan);
    final stale = (await listDocs()).where((d) => d.pristine && d.updatedAt.isBefore(cutoff)).toList();
    for (final d in stale) {
      await deleteDoc(d.id);
    }
    return stale.length;
  }

  // ── versions and stats ──

  Future<void> saveVersion(String docId, Json content, int words, String? label) async {
    final row = {'id': newId(), 'document_id': docId, 'content': content, 'word_count': words, 'label': label};
    await _write({'kind': 'insert', 'table': 'document_versions', 'id': row['id'], 'row': row},
        () => offline.remote((b) => b.insert('document_versions', row, columns: 'id')));
  }

  Future<void> addWordsToday(int n) async {
    if (n <= 0) return;
    await _write({'kind': 'rpc', 'fn': 'add_words_today', 'args': {'n': n}}, () => offline.remote((b) => b.rpc('add_words_today', {'n': n})));
  }

  Future<List<({String day, int words})>> wordsByDay() async {
    final me = offline.uid() ?? 'me';
    try {
      final rows = await _read<List<Json>>(
        () async {
          final r = await offline.remote((b) => b.select('writing_days', columns: 'day,words', order: 'day', limit: 140));
          await offline.put('days', me, {'rows': r});
          return r;
        },
        () async => ((await offline.get('days', me))?['rows'] as List?)?.cast<Json>(),
      );
      return [for (final r in rows) (day: '${r['day']}', words: (r['words'] as num).toInt())];
    } catch (_) {
      return [];
    }
  }

  // ── profile ──

  Future<Profile?> getProfile(String userId, {String? email}) async {
    try {
      final row = await _read<Json?>(
        () async {
          final r = await offline.remote((b) => b.selectOne('profiles', eq: {'id': userId}));
          if (r != null) await offline.put('profile', userId, r);
          return r;
        },
        () => offline.get('profile', userId),
      );
      return Profile.fromRow(row ?? {'id': userId}, email: email);
    } on OfflineException {
      return Profile(id: userId, email: email);
    }
  }

  Future<void> updateProfile(String userId, Json patch) async {
    final row = {'id': userId, ...patch};
    await offline.merge('profile', userId, row);
    await _write({'kind': 'upsert', 'table': 'profiles', 'id': userId, 'row': row}, () => offline.remote((b) => b.upsert('profiles', row)));
  }
}
