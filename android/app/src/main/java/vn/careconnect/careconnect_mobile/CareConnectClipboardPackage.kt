package vn.careconnect.careconnect_mobile

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.PersistableBundle
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class CareConnectClipboardModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "CareConnectClipboard"

  @ReactMethod
  fun setText(value: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val activity = reactApplicationContext.currentActivity
        if (value.isBlank() || activity == null || activity.isFinishing) {
          promise.reject("CLIPBOARD_UNAVAILABLE", "Clipboard unavailable")
          return@runOnUiThread
        }
        val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("", value)
        // Avoid showing the care address in the Android clipboard preview.
        clip.description.extras = PersistableBundle().apply {
          putBoolean("android.content.extra.IS_SENSITIVE", true)
        }
        clipboard.setPrimaryClip(clip)
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("CLIPBOARD_UNAVAILABLE", "Clipboard unavailable")
      }
    }
  }
}

class CareConnectClipboardPackage : BaseReactPackage() {
  override fun getModule(name: String, context: ReactApplicationContext): NativeModule? =
    if (name == "CareConnectClipboard") CareConnectClipboardModule(context) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf("CareConnectClipboard" to ReactModuleInfo(
      "CareConnectClipboard", CareConnectClipboardModule::class.java.name,
      false, false, false, false
    ))
  }

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
