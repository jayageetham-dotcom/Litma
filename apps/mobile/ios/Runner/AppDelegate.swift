import AVFoundation
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "LitmaSpeech") {
      LitmaSpeech.register(with: registrar)
    }
  }
}

/// Read aloud (`lib/core/speech.dart`): the phone's own voices through AVSpeechSynthesizer.
/// Kept here, not in a plugin, so the app needs no CocoaPods.
final class LitmaSpeech: NSObject, FlutterPlugin, AVSpeechSynthesizerDelegate {
  private let synth = AVSpeechSynthesizer()
  private var channel: FlutterMethodChannel?
  private var current: AVSpeechUtterance?
  private var pending: FlutterResult?
  // "Save as an audio file": a separate synthesizer writes to a file
  private var writer: AVSpeechSynthesizer?
  private var writing: FlutterResult?
  private var writeId = 0

  static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(name: "in.getlitma/speech", binaryMessenger: registrar.messenger())
    let instance = LitmaSpeech()
    instance.channel = channel
    instance.synth.delegate = instance
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  private func prefix(_ language: String) -> String {
    (language.lowercased().components(separatedBy: CharacterSet(charactersIn: "-_")).first ?? language).lowercased()
  }

  private func installed(_ language: String) -> [AVSpeechSynthesisVoice] {
    let p = prefix(language)
    return AVSpeechSynthesisVoice.speechVoices()
      .filter { prefix($0.language) == p }
      .sorted { $0.quality.rawValue > $1.quality.rawValue }
  }

  private func voice(id: String?, language: String) -> AVSpeechSynthesisVoice? {
    if let id = id, !id.isEmpty, let v = AVSpeechSynthesisVoice(identifier: id) { return v }
    let all = installed(language)
    let tag = language.lowercased().replacingOccurrences(of: "_", with: "-")
    return all.first { $0.language.lowercased() == tag } ?? all.first
  }

  private func utterance(_ args: [String: Any], voice v: AVSpeechSynthesisVoice) -> AVSpeechUtterance {
    let u = AVSpeechUtterance(string: args["text"] as? String ?? "")
    u.voice = v
    // 1.0 from Dart is the voice's normal speed (AVSpeechUtteranceDefaultSpeechRate)
    let rate = (args["rate"] as? NSNumber)?.floatValue ?? 1
    u.rate = min(max(AVSpeechUtteranceDefaultSpeechRate * rate, AVSpeechUtteranceMinimumSpeechRate), AVSpeechUtteranceMaximumSpeechRate)
    u.pitchMultiplier = min(max((args["pitch"] as? NSNumber)?.floatValue ?? 1, 0.5), 2)
    u.volume = min(max((args["volume"] as? NSNumber)?.floatValue ?? 1, 0), 1)
    return u
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    let language = args["language"] as? String ?? "ml"
    switch call.method {
    case "hasVoice":
      result(!installed(language).isEmpty)
    case "voices":
      result(installed(language).map { ["id": $0.identifier, "name": $0.name, "language": $0.language, "network": false] })
    case "speak":
      let text = args["text"] as? String ?? ""
      finish(false)
      if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
      guard !text.isEmpty, let v = voice(id: args["voice"] as? String, language: language) else {
        result(false)
        return
      }
      let session = AVAudioSession.sharedInstance()
      try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
      try? session.setActive(true)
      let u = utterance(args, voice: v)
      current = u
      pending = result
      synth.speak(u)
    case "synthesize":
      synthesize(args, language: language, result: result)
    case "stop":
      finish(false)
      synth.stopSpeaking(at: .immediate)
      stopWriting()
      release()
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func synthesize(_ args: [String: Any], language: String, result: @escaping FlutterResult) {
    stopWriting()
    let text = args["text"] as? String ?? ""
    guard !text.isEmpty, let path = args["path"] as? String, let v = voice(id: args["voice"] as? String, language: language) else {
      result(false)
      return
    }
    let url = URL(fileURLWithPath: path)
    try? FileManager.default.removeItem(at: url)
    let w = AVSpeechSynthesizer()
    writer = w
    writing = result
    writeId += 1
    let id = writeId
    var file: AVAudioFile?
    var failed = false
    w.write(utterance(args, voice: v)) { [weak self] buffer in
      guard let pcm = buffer as? AVAudioPCMBuffer else { return }
      if pcm.frameLength == 0 {
        // the last, empty buffer: the file is complete once it is closed
        file = nil
        DispatchQueue.main.async { self?.doneWriting(id, ok: !failed && FileManager.default.fileExists(atPath: path)) }
        return
      }
      if failed { return }
      do {
        if file == nil {
          // WAV (from the .wav extension) in the voice's own format
          file = try AVAudioFile(forWriting: url, settings: pcm.format.settings, commonFormat: pcm.format.commonFormat, interleaved: pcm.format.isInterleaved)
        }
        try file?.write(from: pcm)
      } catch {
        failed = true
        file = nil
        DispatchQueue.main.async { self?.doneWriting(id, ok: false) }
      }
    }
  }

  private func doneWriting(_ id: Int, ok: Bool) {
    guard id == writeId, let r = writing else { return }
    writing = nil
    writer = nil
    r(ok)
  }

  private func stopWriting() {
    writer?.stopSpeaking(at: .immediate)
    writer = nil
    writeId += 1
    let r = writing
    writing = nil
    r?(false)
  }

  private func finish(_ done: Bool) {
    let r = pending
    pending = nil
    current = nil
    r?(done)
  }

  private func release() {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString characterRange: NSRange, utterance: AVSpeechUtterance) {
    DispatchQueue.main.async {
      guard utterance === self.current, characterRange.location != NSNotFound, characterRange.length > 0 else { return }
      // UTF-16 offsets, the same as Dart strings
      self.channel?.invokeMethod("word", arguments: ["start": characterRange.location, "end": characterRange.location + characterRange.length])
    }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    DispatchQueue.main.async {
      guard utterance === self.current else { return }
      self.finish(true)
      // The next sentence follows at once; only let other audio back when nothing is queued.
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
        if !self.synth.isSpeaking && self.pending == nil { self.release() }
      }
    }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    DispatchQueue.main.async {
      guard utterance === self.current else { return }
      self.finish(false)
    }
  }
}
