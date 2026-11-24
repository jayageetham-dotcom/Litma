import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'manglish.dart';
import 'manglish_rank.dart';

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

  /// How many offline spellings are offered (Google's list, when it comes, can be longer).
  static const offlineMax = 8;

  /// Where the word list behind ranked offline suggestions comes from (the website's
  /// /dict/manglish-words.txt, kept on the phone once loaded); set by Services.
  Future<String?> Function()? wordList;
  ManglishRanker? _ranker;
  Future<void>? _loading;

  /// The open work's Story World names (the writer's own words): first in suggestions when they
  /// fit, and never marked by the spelling check.
  List<String> storyWords = const [];
  void setStoryNames(Iterable<String> names) {
    storyWords = ownWordsFrom(names);
    _ranker?.setOwnWords(storyWords);
  }

  /// Where the writer's own picks are kept on this phone (SharedPreferences); set by Services.
  SharedPreferences? prefs;
  static const _picksKey = 'litma:manglish-picks';
  static const _maxPicks = 1000;
  Map<String, String>? _picks;
  Map<String, String> get _readPicks {
    if (_picks != null) return _picks!;
    try {
      final raw = prefs?.getString(_picksKey);
      _picks = raw == null ? <String, String>{} : (jsonDecode(raw) as Map).map((k, v) => MapEntry('$k', '$v'));
    } catch (_) {
      _picks = <String, String>{};
    }
    return _picks!;
  }

  /// The writer chose [choice] for the Manglish [word] (not the first spelling): offer it first next time.
  void rememberPick(String word, String choice) {
    if (word.isEmpty || !RegExp('[\u0D00-\u0D7F]').hasMatch(choice)) return;
    final p = _readPicks;
    p.remove(word); // newest last, so the oldest go first when the list is full
    p[word] = choice;
    while (p.length > _maxPicks) {
      p.remove(p.keys.first);
    }
    prefs?.setString(_picksKey, jsonEncode(p));
  }

  /// [list] with the writer's own earlier pick for [word] first (if any).
  List<String> withPick(String word, List<String> list) {
    final pick = _readPicks[word];
    return pick == null ? list : [pick, ...list.where((w) => w != pick)];
  }

  /// Start loading the word list once; until it is ready the letter readings are offered.
  void _loadWords() {
    final source = wordList;
    if (_loading != null || source == null) return;
    _loading = () async {
      try {
        final text = await source();
        if (text != null && text.isNotEmpty) {
          _ranker = await ManglishRanker.build(parseWordList(text));
          _ranker!.setOwnWords(storyWords);
          return;
        }
      } catch (_) {
        /* not reachable yet */
      }
      _loading = null; // try again next time
    }();
  }

  /// Offline candidates, immediately: real words that fit first (once the word list is loaded),
  /// then the engine's letter readings.
  List<String> offline(String word) {
    _loadWords();
    final r = _ranker;
    if (r == null) return withPick(word, manglishCandidates(word)).take(offlineMax).toList();
    try {
      return withPick(word, r.suggest(word, max: offlineMax)).take(offlineMax).toList();
    } catch (_) {
      return withPick(word, manglishCandidates(word)).take(offlineMax).toList();
    }
  }

  /// Known words that sound like a Malayalam word the dictionary doesn't know (spelling "Suggest").
  Future<List<String>> similar(String word) async {
    _loadWords();
    try {
      await _loading;
    } catch (_) {
      /* not reachable */
    }
    return _ranker?.similar(word) ?? const [];
  }

  Future<List<String>> candidates(String word, {int num = maxCandidates}) async {
    final hit = _cache['$num/$word'];
    if (hit != null) return withPick(word, hit);
    final local = manglishWord(word);
    try {
      final r = await _client
          .get(Uri.parse('${AppConfig.functionsUrl}/litma-transliterate?text=${Uri.encodeQueryComponent(word)}&num=$num'), headers: {'apikey': AppConfig.supabaseAnonKey})
          .timeout(const Duration(seconds: 3));
      if (r.statusCode != 200) return offline(word);
      final j = jsonDecode(r.body) as Map<String, dynamic>;
      final list = ((j['candidates'] as List?) ?? const []).cast<String>();
      if (j['source'] == 'offline') return offline(word); // Google didn't answer: keep the ranked list
      // Google's ranking first; the offline spellings only fill gaps, never more than [num]
      final out = <String>{...list.map((e) => e.trim()).where((e) => e.isNotEmpty), local, ...offline(word)}.take(num).toList();
      if (_cache.length > 400) _cache.clear();
      _cache['$num/$word'] = out;
      // the writer's own earlier pick beats Google's order
      return withPick(word, out);
    } catch (_) {
      return offline(word);
    }
  }
}
