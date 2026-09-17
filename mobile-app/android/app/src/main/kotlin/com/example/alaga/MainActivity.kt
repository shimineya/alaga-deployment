package com.example.alaga

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.os.Build
import android.content.Intent
import android.net.Uri
import android.provider.Settings

class MainActivity : FlutterFragmentActivity() {
    private var permissionResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        ScheduleReminders.initialize(this)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "alaga/schedule_reminders").setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "requestPermission" -> {
                        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                            if (permissionResult != null) result.error("BUSY", "Permission request already open", null)
                            else {
                                permissionResult = result
                                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 402)
                            }
                        } else result.success(ScheduleReminders.allowed(this))
                    }
                    "exactAllowed" -> result.success(ScheduleReminders.exactAllowed(this))
                    "openExactSettings" -> {
                        if (Build.VERSION.SDK_INT >= 31) startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName")))
                        result.success(null)
                    }
                    "setOwner" -> { ScheduleReminders.setOwner(this, call.argument<Int>("owner") ?: -1); result.success(null) }
                    "configureAlertSound" -> {
                        ScheduleReminders.configureAlertSound(
                            this,
                            call.argument<String>("tone") ?: "System Default",
                            call.argument<String>("uri") ?: "",
                            call.argument<Number>("volume")?.toFloat() ?: 1f
                        )
                        result.success(null)
                    }
                    "getPhoneTones" -> result.success(ScheduleReminders.getPhoneTones(this))
                    "previewAlertSound" -> {
                        ScheduleReminders.previewAlertSound(
                            this,
                            call.argument<String>("uri") ?: "",
                            call.argument<Number>("volume")?.toFloat() ?: 1f
                        )
                        result.success(null)
                    }
                    "schedule" -> result.success(ScheduleReminders.add(this, call.argument<Int>("owner")!!, call.argument<Number>("at")!!.toLong(), call.argument<String>("title") ?: "Schedule reminder"))
                    "cancel" -> { ScheduleReminders.remove(this, call.argument<Int>("id")!!); result.success(null) }
                    else -> result.notImplemented()
                }
            } catch (e: Exception) { result.error("REMINDER_ERROR", e.message, null) }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 402) {
            permissionResult?.success(ScheduleReminders.allowed(this))
            permissionResult = null
        }
    }
}
