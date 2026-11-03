import 'dart:async';

import 'auth.dart';
import 'backend.dart';
import 'forms.dart' show Json;

/// An in-memory Litma server for tests and design previews. `online = false` makes every request
/// fail like a dropped connection, so the offline layer can be exercised end to end.
class FakeBackend implements Backend {
  FakeBackend({Map<String, List<Json>>? tables}) : tables = tables ?? {};

  final Map<String, List<Json>> tables;
  bool online = true;
  final log = <String>[];
  int _clock = 0;

  /// Strictly increasing timestamps, so "changed after" checks are reliable in tests.
  String _now() {
    _clock++;
    return DateTime.utc(2026, 11, 3, 9).add(Duration(seconds: _clock)).toIso8601String();
  }

  List<Json> _t(String table) => tables.putIfAbsent(table, () => []);

  void _check(String what) {
    log.add(what);
    if (!online) throw const OfflineException();
  }

  bool _matches(Json r, Map<String, Object> eq) => eq.entries.every((e) => r[e.key] == e.value);

  Json _pick(Json r, String columns) =>
      columns == '*' ? {...r} : {for (final c in columns.split(',')) if (r.containsKey(c.trim())) c.trim(): r[c.trim()]};

  @override
  Future<List<Json>> select(String table,
      {String columns = '*', Map<String, Object> eq = const {}, String? inColumn, List<String>? inValues, String? order, bool ascending = false, int? limit}) async {
    _check('select $table');
    var rows = _t(table).where((r) => _matches(r, eq) && (inColumn == null || inValues!.contains(r[inColumn]))).toList();
    if (order != null) {
      rows.sort((a, b) => '${a[order]}'.compareTo('${b[order]}') * (ascending ? 1 : -1));
    }
    if (limit != null) rows = rows.take(limit).toList();
    return [for (final r in rows) _pick(r, columns)];
  }

  @override
  Future<Json?> selectOne(String table, {String columns = '*', required Map<String, Object> eq}) async {
    _check('selectOne $table');
    final r = _t(table).where((r) => _matches(r, eq)).firstOrNull;
    return r == null ? null : _pick(r, columns);
  }

  @override
  Future<Json> insert(String table, Json row, {String columns = '*'}) async {
    _check('insert $table');
    if (row['id'] != null && _t(table).any((r) => r['id'] == row['id'])) throw ServerException('duplicate key', code: '23505', status: 409);
    final at = _now();
    final full = {'archived': false, 'is_public': false, 'share_id': null, 'created_at': at, 'updated_at': at, ...row};
    _t(table).add(full);
    return _pick(full, columns);
  }

  @override
  Future<Json?> update(String table, String id, Json patch, {String columns = 'updated_at'}) async {
    _check('update $table');
    final r = _t(table).where((r) => r['id'] == id).firstOrNull;
    if (r == null) return null;
    r
      ..addAll(patch)
      ..['updated_at'] = _now();
    return _pick(r, columns);
  }

  @override
  Future<void> upsert(String table, Json row, {String? onConflict}) async {
    _check('upsert $table');
    final keys = (onConflict ?? 'id').split(',').where((k) => k != 'user_id');
    final r = _t(table).where((r) => keys.every((k) => r[k] == row[k])).firstOrNull;
    if (r != null) {
      r.addAll(row);
    } else {
      _t(table).add({...row});
    }
  }

  @override
  Future<void> delete(String table, {String? id, Map<String, Object>? match}) async {
    _check('delete $table');
    _t(table).removeWhere((r) => id != null ? r['id'] == id : _matches(r, match ?? const {}));
  }

  @override
  Future<void> rpc(String fn, Json args) async {
    _check('rpc $fn');
    if (fn == 'add_words_today') {
      final day = DateTime.now().toIso8601String().substring(0, 10);
      final r = _t('writing_days').where((r) => r['day'] == day).firstOrNull;
      if (r != null) {
        r['words'] = (r['words'] as num) + (args['n'] as num);
      } else {
        _t('writing_days').add({'day': day, 'words': args['n']});
      }
    }
  }
}

/// Signed in as one writer (or signed out), for tests and design previews.
class FakeAuth implements AuthGateway {
  FakeAuth([this._writer]);
  Writer? _writer;
  final _changes = StreamController<Writer?>.broadcast();

  @override
  Writer? get writer => _writer;
  @override
  Stream<Writer?> get changes => _changes.stream;
  @override
  bool get appleAvailable => true;

  void _set(Writer? w) {
    _writer = w;
    _changes.add(w);
  }

  @override
  Future<void> signIn(String email, String password) async => _set(Writer(id: 'writer-1', email: email));
  @override
  Future<bool> signUp(String email, String password, {String? name}) async => true;
  @override
  Future<void> resetPassword(String email) async {}
  @override
  Future<void> signInWithGoogle() async => _set(const Writer(id: 'writer-1', email: 'writer@example.com'));
  @override
  Future<void> signInWithApple() async => _set(const Writer(id: 'writer-1', email: 'writer@example.com'));
  @override
  Future<void> updatePassword(String password) async {}
  @override
  Future<String?> accessToken() async => null;
  @override
  Future<void> signOut() async => _set(null);
}
