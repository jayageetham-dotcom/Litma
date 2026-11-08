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
  private var current: AVSpeechUtterance?
  private var pending: FlutterResult?

  static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(name: "in.getlitma/speech", binaryMessenger: registrar.messenger())
    let instance = LitmaSpeech()
    instance.synth.delegate = instance
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  private func voice(_ language: String) -> AVSpeechSynthesisVoice? {
    let prefix = language.lowercased().components(separatedBy: CharacterSet(charactersIn: "-_")).first ?? language
    let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.lowercased().hasPrefix(prefix) }
    return voices.first { $0.language.lowercased() == language.lowercased().replacingOccurrences(of: "_", with: "-") }
      ?? voices.first
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "hasVoice":
      result(voice(args["language"] as? String ?? "ml") != nil)
    case "speak":
      let text = args["text"] as? String ?? ""
      let language = args["language"] as? String ?? "ml-IN"
      let rate = (args["rate"] as? NSNumber)?.floatValue ?? 1
      finish(false)
      if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
      guard !text.isEmpty, let v = voice(language) else {
        result(false)
        return
      }
      let session = AVAudioSession.sharedInstance()
      try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
      try? session.setActive(true)
      let u = AVSpeechUtterance(string: text)
      u.voice = v
      u.rate = min(max(AVSpeechUtteranceDefaultSpeechRate * rate, AVSpeechUtteranceMinimumSpeechRate), AVSpeechUtteranceMaximumSpeechRate)
      current = u
      pending = result
      synth.speak(u)
    case "stop":
      finish(false)
      synth.stopSpeaking(at: .immediate)
      release()
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
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
