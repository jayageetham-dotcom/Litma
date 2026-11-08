package `in`.getlitma.litma

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import java.util.Locale
import java.util.UUID

/**
 * Read aloud (`lib/core/speech.dart`): the phone's own voices through Android's TextToSpeech.
 * Kept in the app, not a plugin, matching the iOS side in AppDelegate.swift.
 */
class LitmaSpeech(context: Context, messenger: BinaryMessenger) {
    private val main = Handler(Looper.getMainLooper())
    private val channel = MethodChannel(messenger, "in.getlitma/speech")
    private val pending = mutableMapOf<String, MethodChannel.Result>()
    private val waiting = mutableListOf<(Boolean) -> Unit>()
    private var ready: Boolean? = null
    private val tts: TextToSpeech

    init {
        tts = TextToSpeech(context) { status ->
            main.post {
                ready = status == TextToSpeech.SUCCESS
                val run = waiting.toList()
                waiting.clear()
                run.forEach { it(ready == true) }
            }
        }
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) = complete(utteranceId, true)
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) = complete(utteranceId, false)
            override fun onError(utteranceId: String?, errorCode: Int) = complete(utteranceId, false)
            override fun onStop(utteranceId: String?, interrupted: Boolean) = complete(utteranceId, false)
        })
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "hasVoice" -> whenReady { ok ->
                    result.success(ok && hasVoice(call.argument<String>("language") ?: "ml"))
                }
                "speak" -> whenReady { ok ->
                    val text = call.argument<String>("text") ?: ""
                    val language = call.argument<String>("language") ?: "ml-IN"
                    val rate = call.argument<Double>("rate") ?: 1.0
                    if (!ok || text.isEmpty()) {
                        result.success(false)
                    } else {
                        speak(text, language, rate.toFloat(), result)
                    }
                }
                "stop" -> {
                    if (ready == true) tts.stop()
                    finishAll()
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun whenReady(action: (Boolean) -> Unit) {
        val r = ready
        if (r == null) waiting.add(action) else action(r)
    }

    private fun locale(language: String): Locale = Locale.forLanguageTag(language.replace('_', '-'))

    private fun hasVoice(language: String): Boolean {
        val prefix = language.split('-', '_').first().lowercase()
        val available = try {
            tts.isLanguageAvailable(locale(language)) >= TextToSpeech.LANG_AVAILABLE
        } catch (_: Exception) {
            false
        }
        if (available) return true
        val voices = try { tts.voices } catch (_: Exception) { null } ?: return false
        return voices.any { it.locale.language.lowercase() == prefix }
    }

    private fun speak(text: String, language: String, rate: Float, result: MethodChannel.Result) {
        finishAll()
        tts.language = locale(language)
        tts.setSpeechRate(rate.coerceIn(0.1f, 2.0f))
        val id = UUID.randomUUID().toString()
        pending[id] = result
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) {
            complete(id, false)
        }
    }

    private fun complete(id: String?, done: Boolean) {
        if (id == null) return
        main.post { pending.remove(id)?.success(done) }
    }

    private fun finishAll() {
        val all = pending.values.toList()
        pending.clear()
        all.forEach { it.success(false) }
    }

    fun dispose() {
        channel.setMethodCallHandler(null)
        finishAll()
        tts.stop()
        tts.shutdown()
    }
}
