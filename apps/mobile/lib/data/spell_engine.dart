import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config.dart';
import 'auth.dart';
import 'spell.dart';

/// Client for the litma-spell Edge Function (SMC's mlmorph morphology engine), like the web's
/// lib/spell-engine.ts: the spelling marks ask it about each line's words. Answers are cached for
/// the visit, requests from many lines are sent together, and when the server can't be reached
/// (offline, signed out, an error) it rests for a minute and the check goes on with its own rules.
class SpellEngineClient {
  SpellEngineClient(this.auth, {http.Client? client}) : _client = client ?? http.Client();
  final AuthGateway auth;
  final http.Client _client;

  final _cache = <String, EngineVerdict>{};
  DateTime _pausedUntil = DateTime.fromMillisecondsSinceEpoch(0);
  final _queue = <(List<String>, Completer<bool>)>[];
  Timer? _timer;
  static const _maxWords = 600;

  /// Verdicts for [words], or null when the engine can't be reached.
  Future<Map<String, EngineVerdict>?> call(List<String> words) async {
    final missing = words.where((w) => !_cache.containsKey(w)).toList();
    if (missing.isNotEmpty) {
      if (DateTime.now().isBefore(_pausedUntil)) return null;
      final done = Completer<bool>();
      _queue.add((missing, done));
      _timer ??= Timer(const Duration(milliseconds: 120), _flush);
      if (!await done.future) return null;
    }
    return {for (final w in words) w: _cache[w] ?? const EngineVerdict('ok')};
  }

  Future<void> _flush() async {
    _timer = null;
    final batch = List.of(_queue);
    _queue.clear();
    final words = {for (final b in batch) ...b.$1}.where((w) => !_cache.containsKey(w)).toList();
    var ok = true;
    for (var i = 0; i < words.length && ok; i += _maxWords) {
      ok = await _send(words.sublist(i, i + _maxWords < words.length ? i + _maxWords : words.length));
    }
    if (!ok) _pausedUntil = DateTime.now().add(const Duration(minutes: 1));
    for (final b in batch) {
      b.$2.complete(ok);
    }
  }

  Future<bool> _send(List<String> words) async {
    try {
      final token = await auth.accessToken();
      if (token == null) return false;
      final r = await _client
          .post(
            Uri.parse('${AppConfig.functionsUrl}/litma-spell'),
            headers: {'content-type': 'application/json', 'authorization': 'Bearer $token', 'apikey': AppConfig.supabaseAnonKey},
            body: jsonEncode({'words': words}),
          )
          .timeout(const Duration(seconds: 12));
      if (r.statusCode != 200) return false;
      final body = jsonDecode(r.body);
      final verdicts = body is Map ? body['verdicts'] : null;
      if (verdicts is Map) {
        verdicts.forEach((w, v) {
          if (v is Map) _cache['$w'] = EngineVerdict('${v['k']}', [for (final f in (v['fix'] as List?) ?? const []) '$f']);
        });
      }
      // words the server skipped (too long, not Malayalam) count as fine, so they aren't asked again
      for (final w in words) {
        _cache.putIfAbsent(w, () => const EngineVerdict('ok'));
      }
      return true;
    } catch (_) {
      return false;
    }
  }
}
