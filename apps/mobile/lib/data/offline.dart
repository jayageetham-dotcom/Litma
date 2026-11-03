import 'dart:async';

import 'package:flutter/foundation.dart';

import 'backend.dart';
import 'forms.dart' show Json;
import 'local_db.dart';

/// How many changes wait, whether they are being sent, whether the app is offline.
@immutable
class SyncState {
  const SyncState({this.pending = 0, this.syncing = false, this.offline = false});
  final int pending;
  final bool syncing;
  final bool offline;

  @override
  bool operator ==(Object other) => other is SyncState && other.pending == pending && other.syncing == syncing && other.offline == offline;
  @override
  int get hashCode => Object.hash(pending, syncing, offline);
}

/// Label of the version that keeps the server's text when offline changes save over newer text.
const conflictLabel = 'Before offline changes';

/// The offline layer, the same design as the web's apps/web/src/lib/offline.ts:
///  - a copy of the writer's rows on the phone, refreshed whenever the server answers;
///  - an outbox of changes made while the server can't be reached, merged per row and sent in
///    order when it answers again (on reconnect, app resume, and every 30 s while anything waits);
///  - offline text saved over a work changed elsewhere keeps the server's copy as a version first.
class OfflineLayer {
  OfflineLayer({required this.db, required this.backend, required this.uid});

  final LocalDb db;
  final Backend backend;

  /// The signed-in writer's id (rows and changes are kept per account).
  final String? Function() uid;

  final state = ValueNotifier(const SyncState());

  /// The server stopped answering; app requests use the device copy until the sync loop gets through.
  bool _serverDown = false;

  /// The phone reports no network at all.
  bool deviceOffline = false;

  bool get offline => deviceOffline || _serverDown;

  /// Time limit for one request: a refresh of an expired session can hang while the server is unreachable.
  static const timeLimit = Duration(seconds: 8);

  // ── requests ──

  /// Run a request against the server. Throws [OfflineException] at once when the app already
  /// knows it is offline (unless [probe]: the sync loop checking whether the server is back).
  Future<T> remote<T>(Future<T> Function(Backend b) request, {bool probe = false}) async {
    if (deviceOffline || (_serverDown && !probe)) throw const OfflineException();
    try {
      final r = await request(backend).timeout(timeLimit);
      _setServerDown(false);
      return r;
    } on ServerException {
      _setServerDown(false);
      rethrow;
    } catch (e) {
      if (isNetworkError(e)) {
        _setServerDown(true);
        throw const OfflineException();
      }
      rethrow;
    }
  }

  void _setServerDown(bool down) {
    if (_serverDown == down) return;
    _serverDown = down;
    _emit();
  }

  // ── rows kept on the phone ──

  String _key(String u, String table, String id) => '$u|$table|$id';

  Future<Json?> get(String table, String id) async {
    final u = uid();
    return u == null ? null : db.get(_key(u, table, id));
  }

  Future<void> put(String table, String id, Json row) async {
    final u = uid();
    if (u != null) await db.put(_key(u, table, id), row);
  }

  Future<Json> merge(String table, String id, Json patch) async {
    final row = {...?await get(table, id), ...patch};
    await put(table, id, row);
    return row;
  }

  Future<void> remove(String table, String id) async {
    final u = uid();
    if (u != null) await db.remove(_key(u, table, id));
  }

  Future<List<Json>> all(String table) async {
    final u = uid();
    return u == null ? [] : db.withPrefix(_key(u, table, ''));
  }

  // ── outbox ──

  int? _inflight;

  bool _sameRow(Json o, String table, String? id) => id != null && o['table'] == table && o['id'] == id;

  /// Put a change in the outbox, merged into an earlier waiting change to the same row when possible.
  Future<void> enqueue(Json op) async {
    final u = uid();
    if (u == null) throw const OfflineException();
    final list = (await db.ops(u)).where((q) => q.key != _inflight).toList();
    final kind = op['kind'];
    final table = op['table'] as String?;
    final id = op['id'] as String?;

    if (kind == 'update') {
      final last = list.lastWhereOrNull((q) => _sameRow(q.op, table!, id));
      if (last != null && (last.op['kind'] == 'insert' || last.op['kind'] == 'upsert')) {
        await db.putOp(last.key, {...last.op, 'row': {...(last.op['row'] as Map), ...(op['patch'] as Map)}});
        return _queued();
      }
      if (last != null && last.op['kind'] == 'update') {
        await db.putOp(last.key, {...last.op, 'patch': {...(last.op['patch'] as Map), ...(op['patch'] as Map)}});
        return _queued();
      }
    } else if (kind == 'delete' && id != null) {
      final mine = list.where((q) => _sameRow(q.op, table!, id)).toList();
      for (final q in mine) {
        await db.removeOp(q.key);
      }
      // made offline and never sent: nothing to delete on the server
      if (mine.any((q) => q.op['kind'] == 'insert')) return _queued();
    } else if (kind == 'rpc') {
      final same = list.firstWhereOrNull((q) => q.op['kind'] == 'rpc' && q.op['fn'] == op['fn']);
      if (same != null) {
        final args = Map<String, dynamic>.from(same.op['args'] as Map);
        (op['args'] as Map).forEach((k, v) => args[k as String] = ((args[k] as num?) ?? 0) + (v as num));
        await db.putOp(same.key, {...same.op, 'args': args});
        return _queued();
      }
    }
    await db.addOp(u, {...op, 'at': DateTime.now().toUtc().toIso8601String()});
    _queued();
  }

  Future<int> pendingCount() async {
    final u = uid();
    return u == null ? 0 : (await db.ops(u)).length;
  }

  Future<bool> hasPending(String table, String id) async {
    final u = uid();
    return u != null && (await db.ops(u)).any((q) => _sameRow(q.op, table, id));
  }

  Timer? _soon;

  /// A change was queued: tell the app, and try to send it shortly (it may only have been a dropped request).
  void _queued() {
    _emit();
    _soon ??= Timer(const Duration(milliseconds: 1500), () {
      _soon = null;
      sync();
    });
  }

  Future<void> _emit() async {
    final pending = await pendingCount();
    state.value = SyncState(pending: pending, syncing: _syncing != null, offline: offline);
  }

  // ── sync ──

  Future<bool>? _syncing;
  DateTime _syncStarted = DateTime.fromMillisecondsSinceEpoch(0);

  /// Send the outbox. Resolves true when nothing is left waiting.
  Future<bool> sync() {
    final running = _syncing;
    if (running != null) return running;
    _syncStarted = DateTime.now();
    final f = _sync().catchError((Object _) => false).whenComplete(() {
      _syncing = null;
      _emit();
    });
    _syncing = f;
    _emit();
    return f;
  }

  Future<bool> _sync() async {
    final u = uid();
    if (u == null) return true;
    if (deviceOffline) return (await db.ops(u)).isEmpty;
    while (true) {
      final ops = await db.ops(u);
      if (ops.isEmpty) {
        // nothing to send: still find out whether the server answers again
        if (_serverDown) await remote((b) => b.select('profiles', columns: 'id', limit: 1), probe: true).then((_) {}, onError: (_) {});
        return !_serverDown;
      }
      final q = ops.first;
      _inflight = q.key;
      try {
        await _send(q.op);
        await db.removeOp(q.key);
      } catch (e) {
        final retry = e is OfflineException || (e is ServerException && e.retryable);
        if (retry) return false;
        // the server refused this change: keep it on the phone (never thrown away) and move on
        debugPrint('Litma: a change could not be synced: $e');
        final tries = ((q.op['tries'] as num?) ?? 0) + 1;
        if (tries < 3) {
          await db.putOp(q.key, {...q.op, 'tries': tries});
          return false;
        }
        await put('failed', '${q.key}', {...q.op, 'error': '$e'});
        await db.removeOp(q.key);
      } finally {
        _inflight = null;
      }
    }
  }

  Future<void> _send(Json op) async {
    final table = op['table'] as String?;
    final id = op['id'] as String?;
    switch (op['kind']) {
      case 'insert':
        try {
          await remote((b) => b.insert(table!, Map<String, dynamic>.from(op['row'] as Map), columns: 'id'), probe: true);
        } on ServerException catch (e) {
          // already there (an earlier attempt arrived but its answer was lost)
          if (e.code != '23505') rethrow;
          final rest = Map<String, dynamic>.from(op['row'] as Map)..remove('id');
          await remote((b) => b.update(table!, id!, rest), probe: true);
        }
        if (table == 'documents') await markServer(id!, withContent: true, probe: true);
      case 'update':
        final patch = Map<String, dynamic>.from(op['patch'] as Map);
        if (table == 'documents' && patch.containsKey('content') && op['base'] != null) {
          await _keepNewerServerCopy(id!, op['base'] as String);
        }
        final row = await remote((b) => b.update(table!, id!, patch), probe: true);
        if (table == 'documents') {
          await markServer(id!, withContent: patch.containsKey('content'), updatedAt: row?['updated_at'] as String?, probe: true);
        }
      case 'upsert':
        await remote((b) => b.upsert(table!, Map<String, dynamic>.from(op['row'] as Map), onConflict: op['onConflict'] as String?), probe: true);
      case 'delete':
        await remote((b) => b.delete(table!, id: id, match: (op['match'] as Map?)?.cast<String, Object>()), probe: true);
      case 'rpc':
        await remote((b) => b.rpc(op['fn'] as String, Map<String, dynamic>.from(op['args'] as Map)), probe: true);
    }
  }

  /// The work changed elsewhere after this phone last saw it: keep that text as a version first.
  Future<void> _keepNewerServerCopy(String id, String base) async {
    final row = await remote((b) => b.selectOne('documents', columns: 'updated_at,content,word_count', eq: {'id': id}), probe: true);
    if (row == null) return;
    final server = DateTime.tryParse('${row['updated_at']}');
    final mine = DateTime.tryParse(base);
    if (server == null || mine == null || !server.isAfter(mine)) return;
    await remote(
      (b) => b.insert('document_versions', {'document_id': id, 'content': row['content'], 'word_count': row['word_count'], 'label': conflictLabel}, columns: 'id'),
      probe: true,
    );
  }

  /// Note the server's updated_at for a work after a save (`_content_at` when the save carried the text).
  Future<void> markServer(String id, {required bool withContent, String? updatedAt, bool probe = false}) async {
    try {
      final at = updatedAt ?? (await remote((b) => b.selectOne('documents', columns: 'updated_at', eq: {'id': id}), probe: probe))?['updated_at'] as String?;
      if (at == null || await get('documents', id) == null) return;
      await merge('documents', id, {'_server_at': at, 'updated_at': at, if (withContent) '_content_at': at});
    } catch (_) {
      /* only bookkeeping */
    }
  }

  /// Send what waits before reading from the server; true when the server is up to date with
  /// this phone. Never holds the app up for more than 3 s: past that it reads the device copy.
  Future<bool> syncFirst() async {
    if (deviceOffline) return false;
    if (_serverDown) {
      unawaited(sync());
      return false;
    }
    if (await pendingCount() == 0) return true;
    final running = sync();
    final left = const Duration(seconds: 3) - DateTime.now().difference(_syncStarted);
    if (left <= Duration.zero) return false;
    return Future.any([running, Future.delayed(left, () => false)]);
  }

  Timer? _ticker;

  /// Keep syncing in the background: every 30 s while changes wait or the server is down.
  void start() {
    _ticker ??= Timer.periodic(const Duration(seconds: 30), (_) async {
      if (_serverDown || await pendingCount() > 0) unawaited(sync());
    });
    unawaited(sync());
  }

  /// The phone's network came back (or went away).
  void setDeviceOffline(bool value) {
    if (deviceOffline == value) return;
    deviceOffline = value;
    _emit();
    if (!value) unawaited(sync());
  }

  void dispose() {
    _ticker?.cancel();
    _soon?.cancel();
  }
}

extension<T> on Iterable<T> {
  T? firstWhereOrNull(bool Function(T) test) {
    for (final e in this) {
      if (test(e)) return e;
    }
    return null;
  }

  T? lastWhereOrNull(bool Function(T) test) {
    T? found;
    for (final e in this) {
      if (test(e)) found = e;
    }
    return found;
  }
}
