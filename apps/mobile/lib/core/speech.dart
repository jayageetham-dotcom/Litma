import 'package:flutter/services.dart';

/// Read aloud with the phone's own voices: AVSpeechSynthesizer on iOS, TextToSpeech on Android.
/// Litma's own small channel (`ios/Runner/AppDelegate.swift`, `android/.../LitmaSpeech.kt`)
/// instead of a plugin, so iOS needs no CocoaPods.
class Speech {
  static const _channel = MethodChannel('in.getlitma/speech');

  /// Whether the phone has a voice for [language] (a prefix such as `ml`).
  Future<bool> hasVoice(String language) async {
    try {
      return await _channel.invokeMethod<bool>('hasVoice', {'language': language}) ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// Speaks [text] and completes when it has been read (true) or was stopped or failed (false).
  /// [rate] 1.0 is the voice's normal speed on both platforms.
  Future<bool> speak(String text, {required String language, double rate = 1}) async {
    try {
      return await _channel.invokeMethod<bool>('speak', {'text': text, 'language': language, 'rate': rate}) ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  Future<void> stop() async {
    try {
      await _channel.invokeMethod<void>('stop');
    } on PlatformException {
      // nothing to stop
    } on MissingPluginException {
      // no speech on this platform
    }
  }
}
