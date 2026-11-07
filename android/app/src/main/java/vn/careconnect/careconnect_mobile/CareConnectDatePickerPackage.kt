package vn.careconnect.careconnect_mobile

import android.app.DatePickerDialog
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.Calendar
import java.util.Locale

class CareConnectDatePickerModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var open = false

  override fun getName() = "CareConnectDatePicker"

  @ReactMethod
  fun pick(initial: String, title: String, accept: String, cancel: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      val activity = reactApplicationContext.currentActivity
      if (activity == null || activity.isFinishing || open) {
        promise.reject("DATE_PICKER_UNAVAILABLE", "Date picker is unavailable")
        return@runOnUiThread
      }
      try {
        val date = Calendar.getInstance()
        val parts = initial.split("-")
        if (parts.size == 3) {
          date.isLenient = false
          date.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
          date.timeInMillis // Validate before constructing the dialog.
        }
        var settled = false
        val dialog = DatePickerDialog(activity, { _, year, month, day ->
          if (!settled) {
            settled = true
            promise.resolve(String.format(Locale.ROOT, "%04d-%02d-%02d", year, month + 1, day))
          }
        }, date.get(Calendar.YEAR), date.get(Calendar.MONTH), date.get(Calendar.DAY_OF_MONTH))
        dialog.setTitle(title)
        dialog.setButton(DatePickerDialog.BUTTON_POSITIVE, accept, dialog)
        dialog.setButton(DatePickerDialog.BUTTON_NEGATIVE, cancel, dialog)
        dialog.setOnDismissListener {
          open = false
          if (!settled) {
            settled = true
            promise.resolve(null)
          }
        }
        open = true
        dialog.show()
      } catch (error: Exception) {
        open = false
        promise.reject("DATE_PICKER_UNAVAILABLE", "Date picker is unavailable")
      }
    }
  }
}

class CareConnectDatePickerPackage : BaseReactPackage() {
  override fun getModule(name: String, context: ReactApplicationContext): NativeModule? =
    if (name == "CareConnectDatePicker") CareConnectDatePickerModule(context) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf("CareConnectDatePicker" to ReactModuleInfo(
      "CareConnectDatePicker", CareConnectDatePickerModule::class.java.name,
      false, false, false, false
    ))
  }

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
