import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:http/http.dart' as http;

import '../core/config.dart';
import 'forms.dart' show Json;
import 'offline.dart';
import 'analytics.dart';

/// Dictionary and thesaurus: a port of packages/shared/src/dict.ts (keep the two in step). The data
/// is the website's /dict shards (Olam open datasets); each shard is kept on the phone once used,
/// so words looked up before work offline.
class LookupResult {
  LookupResult({required this.lang, required this.query});
  final String lang;
  final String query;
  String? head;
  final meanings = <({String pos, List<String> defs})>[];
  var synonyms = <String>[];
  var translations = <String>[];

  bool get found => head != null;
}

final RegExp _ml = RegExp('[ഀ-ൿ]');
bool isMalayalam(String s) => _ml.hasMatch(s);

const _enStems = <(String, String)>[
  (r'ies$', 'y'),
  (r'ves$', 'f'),
  (r'(ss|sh|ch|x|z)es$', r'$1'),
  (r's$', ''),
  (r'ied$', 'y'),
  (r'(.)\1ed$', r'$1'),
  (r'ed$', 'e'),
  (r'ed$', ''),
  (r'(.)\1ing$', r'$1'),
  (r'ing$', 'e'),
  (r'ing$', ''),
  (r'ly$', ''),
];
const _mlSuffixes = ['ുടെ', 'ിന്റെ', 'ിൻ്റെ', 'ന്റെ', 'യുടെ', 'ിൽ', 'ത്തിൽ', 'ത്തിന്റെ', 'ക്ക്', 'ിന്', 'ോട്', 'ുകൾ', 'ങ്ങൾ', 'കൾ', 'ും', 'ോ', 'േ', 'ാണ്', 'ായി', 'മായ', 'ുന്നു', 'ുന്ന', 'ിച്ചു', 'ി'];

String _replaceRe(String s, String re, String rep) => s.replaceFirstMapped(RegExp(re), (m) => rep.replaceAllMapped(RegExp(r'\$(\d)'), (g) => m.group(int.parse(g[1]!)) ?? ''));

class Dictionary {
  Dictionary(this.offline, {http.Client? client}) : _client = client ?? http.Client();
  final OfflineLayer offline;
  final http.Client _client;
  final _cache = <String, Future<Object?>>{};

  /// Fetch a shard from the website (the same files the web app reads), keeping it on the phone.
  Future<Object?> _get(String path) => _cache.putIfAbsent(path, () async {
        try {
          final r = await _client.get(Uri.parse('${AppConfig.site}/dict/$path.json')).timeout(const Duration(seconds: 12));
          if (r.statusCode == 200) {
            final j = jsonDecode(utf8.decode(r.bodyBytes));
            unawaited(offline.put('dict', path, {'v': j}).catchError((_) {}));
            return j;
          }
        } catch (_) {
          /* offline: the copy on the phone */
        }
        final kept = await offline.get('dict', path).catchError((_) => null);
        if (kept == null) _cache.remove(path); // try the network again next time
        return kept?['v'];
      });

  Future<Json?> index() async => (await _get('index') as Map?)?.cast<String, dynamic>();

  String _hex(String ch) => ch.runes.first.toRadixString(16);

  Future<String> _enShard(String k) async {
    final idx = await index();
    final f = k.isNotEmpty && RegExp('[a-z]').hasMatch(k[0]) ? k[0] : '_';
    final s = k.length > 1 && RegExp('[a-z]').hasMatch(k[1]) ? k[1] : '_';
    if (idx?['format'] == null) return 'en/$f$s';
    return ((idx!['enSplit'] as List?) ?? const []).contains(f) ? 'en/$f-$s' : 'en/$f';
  }

  Future<String> _mlShard(String k) async {
    final idx = await index();
    final chars = k.runes.map(String.fromCharCode).toList();
    final f = chars.isNotEmpty ? _hex(chars[0]) : '_';
    if (!((idx?['mlSplit'] as List?) ?? const []).contains(f)) return 'ml/$f';
    return 'ml/$f-${chars.length > 1 ? _hex(chars[1]) : '_'}';
  }

  Future<Json?> getEn(String word) async {
    final k = word.toLowerCase().trim();
    if (k.isEmpty) return null;
    final shard = await _get(await _enShard(k)) as Map?;
    return (shard?[k] as Map?)?.cast<String, dynamic>();
  }

  Future<Json?> getMl(String word) async {
    final k = word.trim();
    if (k.isEmpty) return null;
    final shard = await _get(await _mlShard(k)) as Map?;
    return (shard?[k] as Map?)?.cast<String, dynamic>();
  }

  Future<List<String>> suggest(String prefix, {int max = 10}) async {
    final p = prefix.trim();
    if (p.isEmpty) return [];
    final ml = isMalayalam(p);
    final key = ml ? p : p.toLowerCase();
    final shard = await _get(ml ? await _mlShard(key) : await _enShard(key)) as Map?;
    if (shard == null) return [];
    final out = <String>[];
    for (final k in shard.keys.cast<String>()) {
      if (k.startsWith(key)) {
        out.add(ml ? k : ((shard[k] as Map?)?['h'] as String? ?? k));
        if (out.length >= max * 4) break;
      }
    }
    out.sort((a, b) => a.length - b.length);
    return out.take(max).toList();
  }

  Future<LookupResult> lookup(String raw) async {
    if (raw.trim().isNotEmpty) Analytics.track('dictionary_lookup', {'script': RegExp('[\u0D00-\u0D7F]').hasMatch(raw) ? 'ml' : 'en'});
    final query = raw.trim();
    final lang = isMalayalam(query) ? 'ml' : 'en';
    final res = LookupResult(lang: lang, query: query);
    if (query.isEmpty) return res;

    if (lang == 'en') {
      var head = query.toLowerCase();
      var e = await getEn(head);
      if (e == null) {
        for (final (re, rep) in _enStems) {
          if (!RegExp(re).hasMatch(head)) continue;
          final cand = _replaceRe(head, re, rep);
          if (cand.length > 1 && (e = await getEn(cand)) != null) {
            head = cand;
            break;
          }
        }
      }
      if (e == null) return res;
      res.head = e['h'] as String? ?? head;
      final ml = <String>{};
      final d = (e['d'] as Map?)?.cast<String, dynamic>() ?? {};
      d.forEach((p, defs) {
        final list = (defs as List).cast<String>();
        res.meanings.add((pos: p, defs: list));
        ml.addAll(list);
      });
      final syn = <String>{};
      for (final s in ((e['s'] as List?) ?? const []).cast<Map>()) {
        for (final set in (s['en'] as List).cast<List>()) {
          for (final w in set.cast<String>()) {
            if (w.toLowerCase() != head) syn.add(w);
          }
        }
        final mlSets = (s['ml'] as List).cast<List>();
        for (final set in mlSets) {
          ml.addAll(set.cast<String>());
        }
        if (d.isEmpty) res.meanings.add((pos: s['p'] as String, defs: [for (final set in mlSets) set.cast<String>().take(6).join(', ')]));
      }
      res.synonyms = syn.take(40).toList();
      res.translations = ml.take(40).toList();
      return res;
    }

    var head = query;
    var m = await getMl(head);
    if (m == null) {
      outer:
      for (final suf in _mlSuffixes) {
        if (!head.endsWith(suf) || head.length - suf.length < 2) continue;
        final base = head.substring(0, head.length - suf.length);
        for (final cand in [base, '$baseം', '$base്', '$baseു']) {
          if ((m = await getMl(cand)) != null) {
            head = cand;
            break outer;
          }
        }
      }
    }
    if (m == null) return res;
    res.head = head;
    final score = <String, ({double s, int order})>{};
    var order = 0;
    void add(String w, double weight) {
      if (w.isEmpty || w == head) return;
      final cur = score[w];
      score[w] = cur == null ? (s: weight, order: order++) : (s: cur.s + weight, order: cur.order);
    }

    ((m['d'] as Map?)?.cast<String, dynamic>() ?? {}).forEach((p, defs) {
      final list = (defs as List).cast<String>();
      res.meanings.add((pos: p, defs: list));
      if (p.startsWith('പ്ര')) return;
      for (var di = 0; di < list.length; di++) {
        for (final x in list[di].split(RegExp('[,;]')).map((x) => x.trim())) {
          if (x.isNotEmpty && !x.contains(RegExp(r'\s')) && x.runes.length <= 18) add(x, 0.5 / (1 + di));
        }
      }
    });
    final en = ((m['e'] as List?) ?? const []).cast<String>();
    final enRank = {for (var i = 0; i < en.length; i++) en[i].toLowerCase(): i};
    final refs = ((m['r'] as List?) ?? const []).cast<List>().toList()
      ..sort((a, b) => (enRank['${a[0]}'.toLowerCase()] ?? 99) - (enRank['${b[0]}'.toLowerCase()] ?? 99));
    for (final r in refs) {
      final e = await getEn('${r[0]}');
      final senses = (e?['s'] as List?) ?? const [];
      final si = (r[1] as num).toInt(), ji = (r[2] as num).toInt();
      if (si >= senses.length) continue;
      final mlSets = ((senses[si] as Map)['ml'] as List?) ?? const [];
      if (ji >= mlSets.length) continue;
      final set = (mlSets[ji] as List).cast<String>();
      final rank = enRank['${r[0]}'.toLowerCase()] ?? 20;
      final w = 1 / math.pow(1 + rank, 1.5);
      final damp = set.length > 60 ? 0.5 : 1.0;
      for (var i = 0; i < set.length; i++) {
        add(set[i], w * damp * (i < 12 ? 1 : 0.5));
      }
    }
    int words(String w) => w.split(RegExp(r'\s+')).length;
    final ranked = score.entries.toList()
      ..sort((a, b) {
        final pa = words(a.key) > 1 ? 1 : 0, pb = words(b.key) > 1 ? 1 : 0;
        if (pa != pb) return pa - pb;
        if ((b.value.s - a.value.s).abs() > 1e-9) return b.value.s > a.value.s ? 1 : -1;
        final la = a.key.runes.length, lb = b.key.runes.length;
        if (la != lb) return la - lb;
        return a.value.order - b.value.order;
      });
    res.synonyms = ranked.map((e) => e.key).take(40).toList();
    res.translations = {for (final w in en) w.replaceAll(RegExp(r'-\d+$'), '')}.take(15).toList();
    return res;
  }

}
