import 'dart:async';

import 'package:flutter/services.dart';

/// A voice the phone can read with.
class SpeechVoice {
  const SpeechVoice({required this.id, required this.name, required this.language, this.network = false});

  /// The platform's own id (iOS identifier, Android voice name).
  final String id;
  final String name;
  final String language;

  /// Android voices that only work online.
  final bool network;
}

/// The word being spoken, as UTF-16 offsets into the text passed to [Speech.speak].
class SpokenWord {
  const SpokenWord(this.start, this.end);
  final int start;
  final int end;
}

/// Read aloud with the phone's own voices: AVSpeechSynthesizer on iOS, TextToSpeech on Android.
/// Litma's own small channel (`ios/Runner/AppDelegate.swift`, `android/.../LitmaSpeech.kt`)
/// instead of a plugin, so iOS needs no CocoaPods. Use one at a time and [dispose] it.
class Speech {
  Speech() {
    _active = this;
    _channel.setMethodCallHandler(_onCall);
  }

  static Speech? _active;

  static const _channel = MethodChannel('in.getlitma/speech');
  final _words = StreamController<SpokenWord>.broadcast();

  /// Words as they are spoken, when the voice reports them (many do; some don't).
  Stream<SpokenWord> get words => _words.stream;

  Future<dynamic> _onCall(MethodCall call) async {
    if (call.method == 'word' && call.arguments is Map) {
      final a = call.arguments as Map;
      final s = a['start'], e = a['end'];
      if (s is int && e is int && e > s && !_words.isClosed) _words.add(SpokenWord(s, e));
    }
    return null;
  }

  Future<T?> _call<T>(String method, [Map<String, Object?>? args]) async {
    try {
      return await _channel.invokeMethod<T>(method, args);
    } on PlatformException {
      return null;
    } on MissingPluginException {
      return null;
    }
  }

  /// Whether the phone has a voice for [language] (a prefix such as `ml`).
  Future<bool> hasVoice(String language) async => await _call<bool>('hasVoice', {'language': language}) ?? false;

  /// The installed voices for [language] (a prefix such as `ml`), best first.
  Future<List<SpeechVoice>> voices(String language) async {
    final list = await _call<List<Object?>>('voices', {'language': language}) ?? const [];
    return [
      for (final v in list)
        if (v is Map && v['id'] is String)
          SpeechVoice(id: v['id'] as String, name: '${v['name'] ?? v['id']}', language: '${v['language'] ?? language}', network: v['network'] == true),
    ];
  }

  Map<String, Object?> _args(String text, String language, String? voice, double rate, double pitch, double volume) =>
      {'text': text, 'language': language, 'voice': voice, 'rate': rate, 'pitch': pitch, 'volume': volume};

  /// Speaks [text] and completes when it has been read (true) or was stopped or failed (false).
  /// [rate] and [pitch] 1.0 are the voice's normal speed and pitch on both platforms; [volume] 0–1.
  Future<bool> speak(String text, {required String language, String? voice, double rate = 1, double pitch = 1, double volume = 1}) async =>
      await _call<bool>('speak', _args(text, language, voice, rate, pitch, volume)) ?? false;

  /// Writes [text] spoken to a WAV file at [path]; true when the file was made.
  Future<bool> synthesizeToFile(String text, String path, {required String language, String? voice, double rate = 1, double pitch = 1}) async =>
      await _call<bool>('synthesize', {..._args(text, language, voice, rate, pitch, 1), 'path': path}) ?? false;

  /// Stops speaking and any file being made.
  Future<void> stop() => _call<void>('stop');

  void dispose() {
    _words.close();
    // a newer Speech (the sheet opened again) owns the channel now
    if (!identical(_active, this)) return;
    _active = null;
    stop();
    _channel.setMethodCallHandler(null);
  }
}
