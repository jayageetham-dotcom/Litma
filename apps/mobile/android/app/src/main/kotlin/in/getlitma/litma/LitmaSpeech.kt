package `in`.getlitma.litma

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.util.Locale
import java.util.UUID

/**
 * Read aloud (`lib/core/speech.dart`): the phone's own voices through Android's TextToSpeech.
 * Kept in the app, not a plugin, matching the iOS side in AppDelegate.swift.
 */
class LitmaSpeech(context: Context, messenger: BinaryMessenger) {
    private val main = Handler(Looper.getMainLooper())
    private val channel = MethodChannel(messenger, "in.getlitma/speech")
    /** utterances being spoken */
    private val pending = mutableMapOf<String, MethodChannel.Result>()
    /** files being written ("Save as an audio file") */
    private val writing = mutableMapOf<String, Pair<MethodChannel.Result, File>>()
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
            // Android 8+: the part about to be spoken (UTF-16 offsets, as in Dart strings)
            override fun onRangeStart(utteranceId: String?, start: Int, end: Int, frame: Int) {
                if (utteranceId == null || end <= start) return
                main.post {
                    if (pending.containsKey(utteranceId)) channel.invokeMethod("word", mapOf("start" to start, "end" to end))
                }
            }
        })
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "hasVoice" -> whenReady { ok ->
                    result.success(ok && hasVoice(call.argument<String>("language") ?: "ml"))
                }
                "voices" -> whenReady { ok ->
                    result.success(if (ok) voices(call.argument<String>("language") ?: "ml") else emptyList<Map<String, Any>>())
                }
                "speak" -> whenReady { ok ->
                    val text = call.argument<String>("text") ?: ""
                    if (!ok || text.isEmpty()) result.success(false) else speak(call, text, result)
                }
                "synthesize" -> whenReady { ok ->
                    val text = call.argument<String>("text") ?: ""
                    val path = call.argument<String>("path")
                    if (!ok || text.isEmpty() || path == null) result.success(false) else synthesize(call, text, File(path), result)
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

    private fun prefix(language: String) = language.split('-', '_').first().lowercase()

    private fun installed(language: String): List<Voice> {
        val p = prefix(language)
        val all = try { tts.voices } catch (e: Exception) { null } ?: return emptyList()
        return all
            .filter { it.locale.language.lowercase() == p && !it.features.orEmpty().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) }
            .sortedWith(compareBy<Voice>({ it.isNetworkConnectionRequired }, { -it.quality }, { it.name }))
    }

    private fun voices(language: String): List<Map<String, Any>> =
        installed(language).map {
            mapOf("id" to it.name, "name" to it.name, "language" to it.locale.toLanguageTag(), "network" to it.isNetworkConnectionRequired)
        }

    private fun hasVoice(language: String): Boolean {
        val available = try {
            tts.isLanguageAvailable(locale(language)) >= TextToSpeech.LANG_AVAILABLE
        } catch (e: Exception) {
            false
        }
        return available || installed(language).isNotEmpty()
    }

    /** Voice (or language), speed and pitch for the next utterance; 1.0 is normal on both. */
    private fun apply(call: MethodCall) {
        val language = call.argument<String>("language") ?: "ml-IN"
        val id = call.argument<String>("voice")
        val voice = if (id.isNullOrEmpty()) null else try { tts.voices?.firstOrNull { it.name == id } } catch (e: Exception) { null }
        if (voice == null || tts.setVoice(voice) != TextToSpeech.SUCCESS) tts.setLanguage(locale(language))
        tts.setSpeechRate((call.argument<Double>("rate") ?: 1.0).toFloat().coerceIn(0.1f, 2.0f))
        tts.setPitch((call.argument<Double>("pitch") ?: 1.0).toFloat().coerceIn(0.5f, 2.0f))
    }

    private fun speak(call: MethodCall, text: String, result: MethodChannel.Result) {
        finishSpeaking()
        apply(call)
        val params = Bundle().apply {
            putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, (call.argument<Double>("volume") ?: 1.0).toFloat().coerceIn(0f, 1f))
        }
        val id = UUID.randomUUID().toString()
        pending[id] = result
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, id) != TextToSpeech.SUCCESS) {
            complete(id, false)
        }
    }

    private fun synthesize(call: MethodCall, text: String, file: File, result: MethodChannel.Result) {
        apply(call)
        file.delete()
        val id = UUID.randomUUID().toString()
        writing[id] = result to file
        if (tts.synthesizeToFile(text, Bundle(), file, id) != TextToSpeech.SUCCESS) {
            complete(id, false)
        }
    }

    private fun complete(id: String?, done: Boolean) {
        if (id == null) return
        main.post {
            pending.remove(id)?.success(done)
            writing.remove(id)?.let { (r, f) -> r.success(done && f.exists() && f.length() > 44) }
        }
    }

    private fun finishSpeaking() {
        val all = pending.values.toList()
        pending.clear()
        all.forEach { it.success(false) }
    }

    private fun finishAll() {
        finishSpeaking()
        val files = writing.values.toList()
        writing.clear()
        files.forEach { it.first.success(false) }
    }

    fun dispose() {
        channel.setMethodCallHandler(null)
        finishAll()
        tts.stop()
        tts.shutdown()
    }
}
