import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import 'forms.dart' show Json;

/// One change waiting in the outbox.
class QueuedOp {
  QueuedOp(this.key, this.uid, this.op);
  final int key;
  final String uid;
  final Json op;
}

/// What the offline layer needs from storage on the phone: rows by key, and an ordered outbox.
abstract class LocalDb {
  Future<Json?> get(String key);
  Future<void> put(String key, Json value);
  Future<void> remove(String key);

  /// Every row whose key starts with [prefix].
  Future<List<Json>> withPrefix(String prefix);

  Future<List<QueuedOp>> ops(String uid);
  Future<void> addOp(String uid, Json op);
  Future<void> putOp(int key, Json op);
  Future<void> removeOp(int key);
}

/// SQLite on the phone (works offline, survives restarts, no size limit like web storage).
class SqliteDb implements LocalDb {
  SqliteDb._(this._db);
  final Database _db;

  static Future<SqliteDb> open() async {
    final dir = await getDatabasesPath();
    final db = await openDatabase(
      p.join(dir, 'litma-offline.db'),
      version: 1,
      onCreate: (db, _) async {
        await db.execute('CREATE TABLE rows (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
        await db.execute('CREATE TABLE outbox (key INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, v TEXT NOT NULL)');
      },
    );
    return SqliteDb._(db);
  }

  @override
  Future<Json?> get(String key) async {
    final r = await _db.query('rows', columns: ['v'], where: 'k = ?', whereArgs: [key], limit: 1);
    return r.isEmpty ? null : jsonDecode(r.first['v'] as String) as Json;
  }

  @override
  Future<void> put(String key, Json value) => _db.insert('rows', {'k': key, 'v': jsonEncode(value)}, conflictAlgorithm: ConflictAlgorithm.replace);

  @override
  Future<void> remove(String key) => _db.delete('rows', where: 'k = ?', whereArgs: [key]);

  @override
  Future<List<Json>> withPrefix(String prefix) async {
    final r = await _db.query('rows', columns: ['v'], where: 'k >= ? AND k < ?', whereArgs: [prefix, '$prefix￿']);
    return [for (final row in r) jsonDecode(row['v'] as String) as Json];
  }

  @override
  Future<List<QueuedOp>> ops(String uid) async {
    final r = await _db.query('outbox', where: 'uid = ?', whereArgs: [uid], orderBy: 'key');
    return [for (final row in r) QueuedOp(row['key'] as int, uid, jsonDecode(row['v'] as String) as Json)];
  }

  @override
  Future<void> addOp(String uid, Json op) => _db.insert('outbox', {'uid': uid, 'v': jsonEncode(op)});

  @override
  Future<void> putOp(int key, Json op) => _db.update('outbox', {'v': jsonEncode(op)}, where: 'key = ?', whereArgs: [key]);

  @override
  Future<void> removeOp(int key) => _db.delete('outbox', where: 'key = ?', whereArgs: [key]);
}

/// In memory (tests and design previews).
class MemoryDb implements LocalDb {
  final _rows = <String, String>{};
  final _ops = <int, (String, String)>{};
  int _next = 1;

  @override
  Future<Json?> get(String key) async => _rows[key] == null ? null : jsonDecode(_rows[key]!) as Json;
  @override
  Future<void> put(String key, Json value) async => _rows[key] = jsonEncode(value);
  @override
  Future<void> remove(String key) async => _rows.remove(key);
  @override
  Future<List<Json>> withPrefix(String prefix) async =>
      [for (final e in _rows.entries) if (e.key.startsWith(prefix)) jsonDecode(e.value) as Json];
  @override
  Future<List<QueuedOp>> ops(String uid) async {
    final keys = _ops.keys.where((k) => _ops[k]!.$1 == uid).toList()..sort();
    return [for (final k in keys) QueuedOp(k, uid, jsonDecode(_ops[k]!.$2) as Json)];
  }

  @override
  Future<void> addOp(String uid, Json op) async => _ops[_next++] = (uid, jsonEncode(op));
  @override
  Future<void> putOp(int key, Json op) async {
    final cur = _ops[key];
    if (cur != null) _ops[key] = (cur.$1, jsonEncode(op));
  }

  @override
  Future<void> removeOp(int key) async => _ops.remove(key);
}
