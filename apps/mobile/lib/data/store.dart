import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

import 'package:uuid/uuid.dart';

import 'backend.dart';
import 'forms.dart';
import 'models.dart';
import 'offline.dart';
import 'analytics.dart';

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
    Analytics.track('work_created', {'kind': kind.name});
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

  // ── books ──

  Future<List<Book>> listBooks() => _read(
        () async {
          final rows = await offline.remote((b) => b.select('books', order: 'updated_at'));
          final ids = rows.map((r) => r['id']).toSet();
          for (final k in await offline.all('books')) {
            if (!ids.contains(k['id'])) await offline.remove('books', k['id'] as String);
          }
          for (final r in rows) {
            await offline.put('books', r['id'] as String, r);
          }
          return rows.map(Book.fromRow).toList();
        },
        () async {
          final rows = (await offline.all('books')).where((b) => b['title'] != null).map(Book.fromRow).toList();
          rows.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
          return rows;
        },
      );

  Future<Book?> getBook(String id) => _read<Book?>(
        () async {
          final row = await offline.remote((b) => b.selectOne('books', eq: {'id': id}));
          if (row == null) {
            await offline.remove('books', id);
            return null;
          }
          await offline.put('books', id, row);
          return Book(row);
        },
        () async {
          final r = await offline.get('books', id);
          return r == null ? null : Book(r);
        },
      );

  /// A new book with the standard pages and the classic cover; the author line is the writer's name.
  Future<Book> createBook({Profile? profile}) async {
    Analytics.track('book_created');
    final row = <String, dynamic>{
      'id': newId(),
      'title': 'പുതിയ പുസ്തകം',
      'author': (profile?.avatarName.isNotEmpty ?? false) ? profile!.avatarName : null,
      'structure': defaultBookStructure(),
      'settings': {'pageSize': 'A4', 'chaptersOnRight': true, 'runningHead': true},
      'cover': classicCover,
    };
    Json? made;
    await _write({'kind': 'insert', 'table': 'books', 'id': row['id'], 'row': row}, () async {
      made = await offline.remote((b) => b.insert('books', row));
    });
    final at = _now();
    final book = made ?? {'subtitle': null, 'created_at': at, 'updated_at': at, ...row};
    await offline.put('books', row['id'] as String, book);
    return Book(book);
  }

  Future<void> updateBook(String id, Json patch) async {
    final kept = await offline.get('books', id);
    if (kept != null) await offline.put('books', id, {...kept, ...patch, 'updated_at': _now()});
    await _write({'kind': 'update', 'table': 'books', 'id': id, 'patch': patch}, () => offline.remote((b) => b.update('books', id, patch)));
  }

  Future<void> deleteBook(String id) async {
    await offline.remove('books', id);
    await _write({'kind': 'delete', 'table': 'books', 'id': id}, () => offline.remote((b) => b.delete('books', id: id)));
  }

  // ── Story World ──

  Future<List<Json>> listStory(String docId) => _read(
        () async {
          final rows = await offline.remote((b) => b.select('story_items', eq: {'document_id': docId}, order: 'position', ascending: true));
          final ids = rows.map((r) => r['id']).toSet();
          for (final k in await offline.all('story_items')) {
            if (k['document_id'] == docId && !ids.contains(k['id'])) await offline.remove('story_items', k['id'] as String);
          }
          for (final r in rows) {
            await offline.put('story_items', r['id'] as String, r);
          }
          return rows;
        },
        () async {
          final rows = (await offline.all('story_items')).where((i) => i['document_id'] == docId).toList();
          rows.sort((a, b) => ((a['position'] as num?) ?? 0).compareTo((b['position'] as num?) ?? 0));
          return rows;
        },
      );

  /// Save a card (new when it has no id yet). Returns the saved card.
  Future<Json> saveStory(Json item) async {
    final given = item['id'] as String?;
    final id = given ?? newId();
    final rest = {...item}..remove('id')..remove('created_at')..remove('updated_at');
    rest.putIfAbsent('name', () => '');
    rest.putIfAbsent('summary', () => '');
    rest.putIfAbsent('data', () => <String, dynamic>{});
    rest.putIfAbsent('image_url', () => null);
    rest.putIfAbsent('position', () => DateTime.now().millisecondsSinceEpoch % 1000000000);
    final op = given == null ? {'kind': 'insert', 'table': 'story_items', 'id': id, 'row': {...rest, 'id': id}} : {'kind': 'update', 'table': 'story_items', 'id': id, 'patch': rest};
    await _write(op, () async {
      if (given == null) {
        await offline.remote((b) => b.insert('story_items', {...rest, 'id': id}, columns: 'id'));
      } else {
        await offline.remote((b) => b.update('story_items', id, rest));
      }
    });
    final kept = await offline.get('story_items', id);
    final at = _now();
    final saved = {...?kept, ...rest, 'id': id, 'created_at': kept?['created_at'] ?? at, 'updated_at': at};
    await offline.put('story_items', id, saved);
    return saved;
  }

  Future<void> deleteStory(String id) async {
    await offline.remove('story_items', id);
    await _write({'kind': 'delete', 'table': 'story_items', 'id': id}, () => offline.remote((b) => b.delete('story_items', id: id)));
  }

  // ── saved words ──

  Future<List<Json>> listBookmarks() async {
    final me = offline.uid() ?? 'me';
    try {
      return await _read(
        () async {
          final rows = await offline.remote((b) => b.select('word_bookmarks', columns: 'id,word,lang,meaning,synonyms,note,created_at', order: 'created_at'));
          await offline.put('bookmarks', me, {'rows': rows});
          return rows;
        },
        () async => ((await offline.get('bookmarks', me))?['rows'] as List?)?.cast<Map>().map((m) => m.cast<String, dynamic>()).toList(),
      );
    } catch (_) {
      return [];
    }
  }

  Future<void> addBookmark({required String word, required String lang, String? meaning, List<String> synonyms = const []}) async {
    final me = offline.uid() ?? 'me';
    final row = {'word': word, 'lang': lang, 'meaning': meaning == null ? null : (meaning.length > 600 ? meaning.substring(0, 600) : meaning), 'synonyms': synonyms.take(12).toList()};
    final kept = ((await offline.get('bookmarks', me))?['rows'] as List?)?.cast<Map>().map((m) => m.cast<String, dynamic>()).where((x) => x['word'] != word).toList() ?? [];
    await offline.put('bookmarks', me, {
      'rows': [
        {...row, 'id': newId(), 'created_at': _now()},
        ...kept
      ]
    });
    await _write({'kind': 'upsert', 'table': 'word_bookmarks', 'id': word, 'row': row, 'onConflict': 'user_id,word'},
        () => offline.remote((b) => b.upsert('word_bookmarks', row, onConflict: 'user_id,word')));
  }

  Future<void> removeBookmark(String word) async {
    final me = offline.uid() ?? 'me';
    final kept = ((await offline.get('bookmarks', me))?['rows'] as List?)?.cast<Map>().map((m) => m.cast<String, dynamic>()).where((x) => x['word'] != word).toList() ?? [];
    await offline.put('bookmarks', me, {'rows': kept});
    await _write({'kind': 'delete', 'table': 'word_bookmarks', 'match': {'word': word}}, () => offline.remote((b) => b.delete('word_bookmarks', match: {'word': word})));
  }

  // ── assistant inbox (suggestions sent by any AI assistant through MCP) ──

  Future<List<Json>> listSuggestions(String docId) async {
    try {
      return await _read(
        () async {
          final rows = await offline.remote((b) => b.select('suggestions', eq: {'document_id': docId, 'status': 'pending'}, order: 'created_at'));
          await offline.put('suggestions', docId, {'rows': rows});
          return rows;
        },
        () async => ((await offline.get('suggestions', docId))?['rows'] as List?)?.cast<Map>().map((m) => m.cast<String, dynamic>()).toList(),
      );
    } catch (_) {
      return [];
    }
  }

  Future<void> setSuggestionStatus(String id, String status) async {
    await _write({'kind': 'update', 'table': 'suggestions', 'id': id, 'patch': {'status': status}}, () => offline.remote((b) => b.update('suggestions', id, {'status': status}, columns: 'id')));
  }

  // ── versions ──

  Future<List<Json>> listVersions(String docId) async {
    try {
      return await _read(
        () async {
          final rows = await offline.remote((b) => b.select('document_versions', columns: 'id,document_id,label,content,word_count,created_at', eq: {'document_id': docId}, order: 'created_at', limit: 100));
          await offline.put('versions', docId, {'rows': rows.take(20).toList()});
          return rows;
        },
        () async => ((await offline.get('versions', docId))?['rows'] as List?)?.cast<Map>().map((m) => m.cast<String, dynamic>()).toList(),
      );
    } catch (_) {
      return [];
    }
  }

  // ── connecting an AI assistant (MCP tokens; only SHA-256 hashes are stored) ──

  Future<List<Json>> listTokens() async {
    try {
      return await offline.remote((b) => b.select('mcp_tokens', columns: 'id,name,created_at,last_used_at', order: 'created_at'));
    } catch (_) {
      return [];
    }
  }

  /// Make a new token; returns it once (it can't be shown again).
  Future<String> createToken(String name) async {
    final rnd = Random.secure();
    final token = 'litma_${List.generate(24, (_) => rnd.nextInt(256).toRadixString(16).padLeft(2, '0')).join()}';
    final hash = sha256.convert(utf8.encode(token)).toString();
    await offline.remote((b) => b.insert('mcp_tokens', {'name': name, 'token_hash': hash}, columns: 'id'));
    return token;
  }

  Future<void> deleteToken(String id) => offline.remote((b) => b.delete('mcp_tokens', id: id));

  // ── sharing ──

  /// Turn the public reading link on or off; returns the share id when on.
  Future<String?> setPublic(String docId, bool on) async {
    final shareId = on ? newId().replaceAll('-', '').substring(0, 12) : null;
    await updateDoc(docId, {'is_public': on, 'share_id': shareId});
    return shareId;
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
