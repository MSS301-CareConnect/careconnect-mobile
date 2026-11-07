package vn.careconnect.careconnect_mobile

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.util.Base64
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.RandomAccessFile
import java.net.URI
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection
import kotlin.math.roundToInt

private const val MODULE = "CareConnectCertificatePdf"
private const val MAX_BYTES = 10 * 1024 * 1024
private const val MAX_PAGE_EDGE = 1800
private const val TIMEOUT_MS = 15000

class CareConnectCertificatePdfModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {
  private val worker = Executors.newSingleThreadExecutor()
  private val documents = mutableMapOf<Int, PdfRenderer>()
  private var nextId = 0

  override fun getName() = MODULE

  @ReactMethod
  fun open(url: String, promise: Promise) {
    worker.execute {
      try {
        val renderer = openRenderer(url)
        val pages = renderer.pageCount
        if (pages < 1) {
          renderer.close()
          error("Empty PDF")
        }
        val id = ++nextId
        documents[id] = renderer
        promise.resolve(Arguments.createMap().apply {
          putInt("id", id)
          putInt("pages", pages)
        })
      } catch (_: Exception) {
        promise.reject("CERTIFICATE_PDF_OPEN", "Unable to open certificate PDF")
      }
    }
  }

  @ReactMethod
  fun render(id: Int, index: Int, promise: Promise) {
    worker.execute {
      try {
        val renderer = checkNotNull(documents[id])
        renderer.openPage(index).use { page ->
          val scale = MAX_PAGE_EDGE.toDouble() / maxOf(page.width, page.height)
          val width = (page.width * scale).roundToInt().coerceAtLeast(1)
          val height = (page.height * scale).roundToInt().coerceAtLeast(1)
          val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
          try {
            bitmap.eraseColor(Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            val bytes = ByteArrayOutputStream()
            check(bitmap.compress(Bitmap.CompressFormat.JPEG, 92, bytes))
            promise.resolve("data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP))
          } finally {
            bitmap.recycle()
          }
        }
      } catch (_: Exception) {
        promise.reject("CERTIFICATE_PDF_PAGE", "Unable to render certificate page")
      }
    }
  }

  @ReactMethod
  fun close(id: Int) {
    worker.execute { documents.remove(id)?.close() }
  }

  override fun invalidate() {
    worker.execute {
      documents.values.forEach { it.close() }
      documents.clear()
    }
    worker.shutdown()
    super.invalidate()
  }

  private fun openRenderer(url: String): PdfRenderer {
    val uri = URI(url)
    require(uri.scheme == "https" && !uri.host.isNullOrEmpty() && uri.userInfo == null)
    val connection = uri.toURL().openConnection() as HttpsURLConnection
    connection.instanceFollowRedirects = false
    connection.useCaches = false
    connection.connectTimeout = TIMEOUT_MS
    connection.readTimeout = TIMEOUT_MS
    connection.setRequestProperty("Cache-Control", "no-store")
    try {
      check(connection.responseCode == 200 && connection.contentLengthLong <= MAX_BYTES)
      val file = File.createTempFile("certificate-", ".pdf", reactApplicationContext.cacheDir)
      try {
        RandomAccessFile(file, "rw").use { contents ->
          // Keep only the open descriptor so no downloaded certificate remains in the cache directory.
          check(file.delete())
          val deadline = SystemClock.elapsedRealtime() + TIMEOUT_MS
          connection.inputStream.use { input ->
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
              val count = input.read(buffer)
              if (count == -1) break
              total += count
              check(total <= MAX_BYTES && SystemClock.elapsedRealtime() <= deadline)
              contents.write(buffer, 0, count)
            }
          }
          contents.seek(0)
          val descriptor = ParcelFileDescriptor.dup(contents.fd)
          try {
            return PdfRenderer(descriptor)
          } catch (error: Exception) {
            descriptor.close()
            throw error
          }
        }
      } finally {
        file.delete()
      }
    } finally {
      connection.disconnect()
    }
  }
}

class CareConnectCertificatePdfPackage : BaseReactPackage() {
  override fun getModule(name: String, context: ReactApplicationContext): NativeModule? =
    if (name == MODULE) CareConnectCertificatePdfModule(context) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(MODULE to ReactModuleInfo(MODULE, CareConnectCertificatePdfModule::class.java.name, false, false, false, false))
  }

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
