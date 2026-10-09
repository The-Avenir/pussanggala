package com.pusanggala.app

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Stream verified private model files off the JS/UI threads with bounded memory. */
class PusangModelHashModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val worker = Executors.newSingleThreadExecutor()
  private val jobs = ConcurrentHashMap<String, AtomicBoolean>()
  override fun getName() = "PusangModelHash"

  @ReactMethod
  fun hashModel(uriText: String, jobId: String, promise: Promise) {
    val cancelled = AtomicBoolean(false)
    if (jobs.putIfAbsent(jobId, cancelled) != null) {
      promise.reject("HASH_BUSY", "Duplicate hash operation.")
      return
    }
    worker.execute {
      try {
        val uri = Uri.parse(uriText)
        require(uri.scheme == "file" && uri.authority.isNullOrEmpty()) { "A private local model file is required." }
        val file = File(requireNotNull(uri.path)).canonicalFile
        val directory = File(context.filesDir, "models").canonicalFile
        require(file.parentFile == directory && file.name in listOf(
          "qwen2.5-0.5b-instruct-q4_k_m.gguf", "qwen2.5-0.5b-instruct-q4_k_m.gguf.part"
        )) { "Only the app's private model files can be hashed." }
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(1024 * 1024)
        file.inputStream().use { stream ->
          while (true) {
            check(!cancelled.get()) { "Model verification cancelled." }
            val count = stream.read(buffer)
            if (count < 0) break
            digest.update(buffer, 0, count)
          }
        }
        check(!cancelled.get()) { "Model verification cancelled." }
        promise.resolve(digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) })
      } catch (error: Exception) { promise.reject("MODEL_HASH_FAILED", error.message, error) }
      finally { jobs.remove(jobId) }
    }
  }

  @ReactMethod
  fun cancel(jobId: String) { jobs[jobId]?.set(true) }

  override fun invalidate() {
    jobs.values.forEach { it.set(true) }
    worker.shutdown()
    super.invalidate()
  }
}
