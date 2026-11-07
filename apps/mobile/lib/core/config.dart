import 'dart:convert';

import 'package:http/http.dart' as http;

import 'manglish.dart';

/// Supabase project (the same as the website and the desktop app). The publishable key is meant
/// to be public; both can be overridden at build time:
///   flutter run --dart-define=SUPABASE_URL=… --dart-define=SUPABASE_ANON_KEY=…
abstract final class AppConfig {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: 'https://jdexadomaxjtxlvgtldu.supabase.co');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: 'sb_publishable_XH6LhcIvUP_ENNbZFrmj7g_Z-YjUzP4');
  static const site = 'https://getlitma.in';
  static String get functionsUrl => '$supabaseUrl/functions/v1';

  /// Release feed (desktop and phone): `mobile` holds version, minimumVersion and store links.
  static const latestJson = '$site/downloads/latest.json';
  static const latestJsonFallback = 'https://github.com/jayageetham-dotcom/litma-releases/releases/latest/download/latest.json';
}

/// Malayalam candidates for a Manglish word: the offline engine first, Google Input Tools (through
/// the litma-transliterate Edge Function) when reachable. Same service as the web's transliterate().
class Transliterator {
  Transliterator({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;
  final _cache = <String, List<String>>{};

  /// How many spellings the writer is offered, best first (same as the web's MAX_CANDIDATES).
  /// The strip above the keyboard scrolls sideways to show them all.
  static const maxCandidates = 18;

  /// Offline candidate, immediately.
  List<String> offline(String word) => [manglishWord(word)];

  Future<List<String>> candidates(String word, {int num = maxCandidates}) async {
    final hit = _cache['$num/$word'];
    if (hit != null) return hit;
    final local = manglishWord(word);
    try {
      final r = await _client
          .get(Uri.parse('${AppConfig.functionsUrl}/litma-transliterate?text=${Uri.encodeQueryComponent(word)}&num=$num'), headers: {'apikey': AppConfig.supabaseAnonKey})
          .timeout(const Duration(seconds: 3));
      if (r.statusCode != 200) return [local];
      final j = jsonDecode(r.body) as Map<String, dynamic>;
      final list = ((j['candidates'] as List?) ?? const []).cast<String>();
      // Google's ranking first; the offline guess only fills a gap, never more than [num]
      final out = <String>{...list.map((e) => e.trim()).where((e) => e.isNotEmpty), local}.take(num).toList();
      if (_cache.length > 400) _cache.clear();
      return _cache['$num/$word'] = out;
    } catch (_) {
      return [local];
    }
  }
}
