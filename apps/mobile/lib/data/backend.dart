import 'dart:async';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'forms.dart' show Json;

/// The server couldn't be reached (no network, no internet on the Wi-Fi, DNS, server down).
class OfflineException implements Exception {
  const OfflineException();
  @override
  String toString() => 'Offline';
}

/// The server answered with an error.
class ServerException implements Exception {
  ServerException(this.message, {this.code, this.status});
  final String message;
  final String? code;
  final int? status;

  /// Worth trying again later (expired session, rate limit, server trouble) rather than giving up.
  bool get retryable {
    final s = status ?? int.tryParse(code ?? '') ?? 0;
    return s == 401 || s == 408 || s == 429 || s >= 500 || code == 'PGRST301' || code == 'PGRST303';
  }

  @override
  String toString() => message;
}

bool isNetworkError(Object e) =>
    e is OfflineException ||
    e is SocketException ||
    e is TimeoutException ||
    e is HandshakeException ||
    e is http.ClientException ||
    e is AuthRetryableFetchException ||
    (e is AuthException && (e.statusCode == null || e.statusCode == '0')) ||
    RegExp(r'failed host lookup|connection (refused|reset|closed|failed)|network is unreachable|software caused connection abort', caseSensitive: false).hasMatch('$e');

/// What the app needs from the server. Supabase in the app; an in-memory server in tests and
/// design previews. Every method throws [OfflineException] when the server can't be reached.
abstract class Backend {
  Future<List<Json>> select(
    String table, {
    String columns = '*',
    Map<String, Object> eq = const {},
    String? inColumn,
    List<String>? inValues,
    String? order,
    bool ascending = false,
    int? limit,
  });
  Future<Json?> selectOne(String table, {String columns = '*', required Map<String, Object> eq});
  Future<Json> insert(String table, Json row, {String columns = '*'});
  Future<Json?> update(String table, String id, Json patch, {String columns = 'updated_at'});
  Future<void> upsert(String table, Json row, {String? onConflict});
  Future<void> delete(String table, {String? id, Map<String, Object>? match});
  Future<void> rpc(String fn, Json args);
}

/// Supabase (same tables and RLS as the web app).
class SupabaseBackend implements Backend {
  SupabaseBackend(this.client);
  final SupabaseClient client;

  Future<T> _run<T>(Future<T> Function() f) async {
    try {
      return await f();
    } on PostgrestException catch (e) {
      throw ServerException(e.message, code: e.code, status: int.tryParse(e.code ?? ''));
    } catch (e) {
      if (isNetworkError(e)) throw const OfflineException();
      rethrow;
    }
  }

  @override
  Future<List<Json>> select(String table,
      {String columns = '*', Map<String, Object> eq = const {}, String? inColumn, List<String>? inValues, String? order, bool ascending = false, int? limit}) {
    return _run(() async {
      PostgrestFilterBuilder<List<Json>> q = client.from(table).select(columns);
      eq.forEach((k, v) => q = q.eq(k, v));
      if (inColumn != null && inValues != null) q = q.inFilter(inColumn, inValues);
      PostgrestTransformBuilder<List<Json>> t = q;
      if (order != null) t = t.order(order, ascending: ascending);
      if (limit != null) t = t.limit(limit);
      return (await t).cast<Json>();
    });
  }

  @override
  Future<Json?> selectOne(String table, {String columns = '*', required Map<String, Object> eq}) {
    return _run(() async {
      PostgrestFilterBuilder<List<Json>> q = client.from(table).select(columns);
      eq.forEach((k, v) => q = q.eq(k, v));
      return await q.maybeSingle();
    });
  }

  @override
  Future<Json> insert(String table, Json row, {String columns = '*'}) => _run(() => client.from(table).insert(row).select(columns).single());

  @override
  Future<Json?> update(String table, String id, Json patch, {String columns = 'updated_at'}) =>
      _run(() => client.from(table).update(patch).eq('id', id).select(columns).maybeSingle());

  @override
  Future<void> upsert(String table, Json row, {String? onConflict}) => _run(() => client.from(table).upsert(row, onConflict: onConflict));

  @override
  Future<void> delete(String table, {String? id, Map<String, Object>? match}) => _run(() async {
        if (id != null) {
          await client.from(table).delete().eq('id', id);
        } else if (match != null) {
          await client.from(table).delete().match(match);
        }
      });

  @override
  Future<void> rpc(String fn, Json args) => _run(() => client.rpc(fn, params: args));
}
