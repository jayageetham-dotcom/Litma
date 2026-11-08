import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../data/notifications.dart';

/// The writing timer (a sprint), as the web's lib/timer.ts: pick 10–60 minutes, write, and at the end
/// a sound, a notification (it rings with the app in the background too) and how many words came.
class WritingTimer extends ChangeNotifier {
  WritingTimer._();
  static final instance = WritingTimer._();

  int minutes = 25;
  DateTime? endsAt;
  Duration? _left;
  String? docId;
  int startWords = 0;
  int _words = 0;
  bool done = false;
  Timer? _tick;

  /// Called when time is up, with the words written (the editor shows a card).
  void Function(int words, int minutes)? onDone;

  bool get active => (endsAt != null || _left != null) && !done;
  bool get running => endsAt != null && !done;
  int get written => (_words - startWords).clamp(0, 1 << 30);
  Duration get left {
    if (endsAt != null) {
      final d = endsAt!.difference(DateTime.now());
      return d.isNegative ? Duration.zero : d;
    }
    return _left ?? Duration.zero;
  }

  String get clock {
    final s = (left.inMilliseconds / 1000).ceil();
    return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
  }

  void start(int mins, String doc, int words, {required String title, required String body}) {
    minutes = mins;
    docId = doc;
    startWords = words;
    _words = words;
    done = false;
    _left = null;
    endsAt = DateTime.now().add(Duration(minutes: mins));
    _notifyAt(title, body);
    _run();
  }

  String _title = '', _body = '';
  void _notifyAt(String title, String body) {
    _title = title;
    _body = body;
    unawaited(Notifications.at(Notifications.timerId, endsAt!, title, body));
  }

  void pause() {
    if (endsAt == null) return;
    _left = left;
    endsAt = null;
    _tick?.cancel();
    unawaited(Notifications.cancel(Notifications.timerId));
    notifyListeners();
  }

  void resume() {
    if (_left == null || done) return;
    endsAt = DateTime.now().add(_left!);
    _left = null;
    _notifyAt(_title, _body);
    _run();
  }

  void stop() {
    _tick?.cancel();
    endsAt = null;
    _left = null;
    done = false;
    unawaited(Notifications.cancel(Notifications.timerId));
    notifyListeners();
  }

  /// The editor reports the work's word count.
  void words(String doc, int n) {
    if (doc == docId && active) _words = n;
  }

  void _run() {
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (endsAt != null && !DateTime.now().isBefore(endsAt!)) {
        _tick?.cancel();
        endsAt = null;
        done = true;
        // the scheduled notification rings in the background; in the app a sound and a card
        unawaited(Notifications.cancel(Notifications.timerId));
        unawaited(SystemSound.play(SystemSoundType.alert));
        unawaited(HapticFeedback.mediumImpact());
        onDone?.call(written, minutes);
      }
      notifyListeners();
    });
    notifyListeners();
  }
}
