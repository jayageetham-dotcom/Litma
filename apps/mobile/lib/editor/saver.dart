import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../data/forms.dart' show Json;
import '../data/offline.dart';

/// saved · dirty (typing, kept on the phone) · saving · local (kept on the phone, will sync)
/// · failed (the save was refused or failed; retrying).
enum SaveStatus { saved, dirty, saving, local, failed }

/// Autosave, the same design as the web's DocSaver (apps/web/src/lib/autosave.ts):
///  1. every change goes to a journal on the phone right away (at most every 200 ms);
///  2. the work is saved 0.9 s after typing pauses, and at least every 5 s while typing goes on;
///  3. failed saves retry with back-off (2 s → 60 s);
///  4. a journal newer than the saved copy is restored when the work opens again.
class DocSaver {
  DocSaver({required this.id, required this.offline, required this.snapshot, required this.save});

  final String id;
  final OfflineLayer offline;

  /// The current text to journal and save.
  final Json Function() snapshot;

  /// Save it; resolves true when the save waits on the phone (offline). Throws on failure.
  final Future<bool> Function(Json snap) save;

  final status = ValueNotifier(SaveStatus.saved);

  int _version = 0;
  int _savedVersion = 0;
  Timer? _debounce, _maxWait, _journal, _retry;
  Duration _retryDelay = Duration.zero;
  Future<void>? _inflight;
  bool _again = false;
  bool _disposed = false;
  bool _local = false;

  bool get unsaved => _version != _savedVersion;

  void start() => offline.state.addListener(_onSync);

  /// Call on every edit.
  void touch() {
    _version++;
    status.value = SaveStatus.dirty;
    if (_journal == null) {
      writeJournal();
      _journal = Timer(const Duration(milliseconds: 200), () {
        _journal = null;
        if (unsaved) writeJournal();
      });
    }
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 900), flush);
    _maxWait ??= Timer(const Duration(seconds: 5), flush);
  }

  Future<void> writeJournal() => offline.put('journal', id, {'doc': snapshot(), 'at': DateTime.now().toUtc().toIso8601String()});

  Future<void> clearJournal() => offline.remove('journal', id);

  /// Save now (nothing happens when nothing changed).
  Future<void> flush() async {
    _debounce?.cancel();
    _maxWait?.cancel();
    _debounce = _maxWait = null;
    if (_inflight != null) {
      _again = true;
      return _inflight;
    }
    if (!unsaved) return;
    final target = _version;
    final snap = snapshot();
    status.value = SaveStatus.saving;
    final run = () async {
      try {
        _local = await save(snap);
        _savedVersion = math.max(_savedVersion, target);
        _retryDelay = Duration.zero;
        _retry?.cancel();
        if (!unsaved) {
          await clearJournal();
          status.value = _local ? SaveStatus.local : SaveStatus.saved;
        }
      } catch (_) {
        await writeJournal();
        status.value = SaveStatus.failed;
        final ms = math.min(60000, math.max(2000, _retryDelay.inMilliseconds * 2));
        _retryDelay = Duration(milliseconds: ms);
        _retry?.cancel();
        if (!_disposed) _retry = Timer(_retryDelay, flush);
      }
    }();
    _inflight = run;
    try {
      await run;
    } finally {
      _inflight = null;
      if (_again) {
        _again = false;
        if (unsaved) await flush();
      }
    }
  }

  void _onSync() {
    if (_local && offline.state.value.pending == 0 && !unsaved && _inflight == null) {
      _local = false;
      status.value = SaveStatus.saved;
    }
  }

  /// Opened with changes still waiting to sync (made offline): say so until they arrive.
  void markLocal() {
    _local = true;
    if (status.value == SaveStatus.saved) status.value = SaveStatus.local;
  }

  void dispose() {
    _disposed = true;
    offline.state.removeListener(_onSync);
    _debounce?.cancel();
    _maxWait?.cancel();
    _journal?.cancel();
    _retry?.cancel();
  }
}
