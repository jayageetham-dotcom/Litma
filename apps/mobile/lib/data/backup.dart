import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/zip.dart';
import '../editor/docx.dart';
import 'store.dart';

/// Backups on the phone, in the same format as the web's lib/backup.ts:
///   litma-backup.json   every work (full text) with its Story World, books, saved words
///   works/*.docx        each work as a Word file, readable anywhere
/// Saved into the app's own folder (the last 14 kept) and handed to the share sheet, where the writer
/// picks Google Drive, Files or any app. Restoring a backup is done on the website or desktop app
/// (Settings → Backup); the phone reads the same works back from the server.
abstract final class Backup {
  static const lastKey = 'litma:backup-last';
  static const dailyKey = 'litma:backup-daily';
  static const keep = 14;

  static String _pad(int n) => n.toString().padLeft(2, '0');
  static String name([DateTime? d]) {
    final x = d ?? DateTime.now();
    return 'Litma backup ${x.year}-${_pad(x.month)}-${_pad(x.day)}.zip';
  }

  static String _safe(String t) {
    final s = t.replaceAll(RegExp(r'[\\/:*?"<>|]+'), ' ').trim();
    return s.isEmpty ? 'litma' : s;
  }

  /// Build the zip and keep it in the app's backups folder. Returns the file and how many works.
  static Future<({File file, int works})> make(Store store, SharedPreferences prefs, {String appVersion = ''}) async {
    final listed = [...await store.listDocs(), ...await store.listDocs(trash: true).catchError((_) => <Never>[])];
    final works = <Map<String, dynamic>>[];
    final files = <(String, List<int>)>[];
    final used = <String>{};
    for (final d in listed) {
      final full = await store.getDoc(d.id).catchError((_) => null);
      if (full == null || full.pristine) continue;
      final story = await store.listStory(d.id).catchError((_) => <Map<String, dynamic>>[]);
      works.add({...full.toRow()..remove('plain_text'), 'story': story});
      var n = _safe(full.title);
      for (var i = 2; used.contains(n); i++) {
        n = '${_safe(full.title)} ($i)';
      }
      used.add(n);
      try {
        files.add(('works/$n.docx', workDocx(title: full.title, kind: full.kind, settings: full.settings, content: full.content)));
      } catch (_) {
        /* the JSON copy still has it */
      }
    }
    final data = {
      'format': 'litma-backup',
      'version': 1,
      'made': DateTime.now().toUtc().toIso8601String(),
      'app': appVersion,
      'works': works,
      'books': [for (final b in await store.listBooks().catchError((_) => <Never>[])) b.row],
      'savedWords': await store.listBookmarks(),
    };
    final readme = [
      'Litma backup',
      '',
      'Made ${DateTime.now()} with ${works.length} works.',
      '',
      'works/ has each work as a Word file you can open anywhere.',
      'litma-backup.json has everything (full text, Story World, books, saved words).',
      'To bring works back into Litma: on the website or the desktop app, Settings, Backup, Restore from a backup file.',
      '',
    ].join('\n');
    final bytes = zip([('README.txt', utf8.encode(readme)), ('litma-backup.json', utf8.encode(jsonEncode(data))), ...files]);
    final dir = Directory('${(await getApplicationDocumentsDirectory()).path}/backups');
    await dir.create(recursive: true);
    final file = File('${dir.path}/${name()}');
    await file.writeAsBytes(bytes, flush: true);
    // keep the newest [keep]
    final mine = dir.listSync().whereType<File>().where((f) => RegExp(r'Litma backup .*\.zip$').hasMatch(f.path)).toList()..sort((a, b) => b.path.compareTo(a.path));
    for (final old in mine.skip(keep)) {
      try {
        old.deleteSync();
      } catch (_) {
        /* in use */
      }
    }
    await prefs.setInt(lastKey, DateTime.now().millisecondsSinceEpoch);
    return (file: file, works: works.length);
  }

  static DateTime? last(SharedPreferences prefs) {
    final t = prefs.getInt(lastKey);
    return t == null ? null : DateTime.fromMillisecondsSinceEpoch(t);
  }

  static bool due(SharedPreferences prefs) {
    if (prefs.getBool(dailyKey) != true) return false;
    final l = last(prefs);
    return l == null || DateTime.now().difference(l) > const Duration(hours: 22);
  }
}
