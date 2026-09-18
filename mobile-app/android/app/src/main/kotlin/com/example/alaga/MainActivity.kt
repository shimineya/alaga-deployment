package com.example.alaga

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.os.Build
import android.os.Environment
import android.content.ContentValues
import android.content.Context
import android.app.DownloadManager
import android.provider.MediaStore
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import java.io.File

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
                    "showNotification" -> {
                        val id = call.argument<Int>("id") ?: -1
                        val title = call.argument<String>("title") ?: "ALAGA Notification"
                        val message = call.argument<String>("message") ?: ""
                        val severity = call.argument<String>("severity") ?: "Warning"
                        val category = call.argument<String>("category") ?: "Clinical"
                        val playSound = call.argument<Boolean>("playSound") ?: true
                        ScheduleReminders.postAlert(this, id, title, message, severity, category, playSound)
                        result.success(true)
                    }
                    "playAlertSound" -> {
                        ScheduleReminders.playAlertSound(this)
                        result.success(true)
                    }
                    "areNotificationsEnabled" -> {
                        result.success(ScheduleReminders.allowed(this))
                    }
                    else -> result.notImplemented()
                }
            } catch (e: Exception) { result.error("REMINDER_ERROR", e.message, null) }
        }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "alaga/notifications").setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "showNotification" -> {
                        val id = call.argument<Int>("id") ?: -1
                        val title = call.argument<String>("title") ?: "ALAGA Notification"
                        val message = call.argument<String>("message") ?: ""
                        val severity = call.argument<String>("severity") ?: "Warning"
                        val category = call.argument<String>("category") ?: "Clinical"
                        val playSound = call.argument<Boolean>("playSound") ?: true
                        ScheduleReminders.postAlert(this, id, title, message, severity, category, playSound)
                        result.success(true)
                    }
                    "playAlertSound" -> {
                        ScheduleReminders.playAlertSound(this)
                        result.success(true)
                    }
                    "areNotificationsEnabled" -> {
                        result.success(ScheduleReminders.allowed(this))
                    }
                    else -> result.notImplemented()
                }
            } catch (e: Exception) { result.error("NOTIFICATION_ERROR", e.message, null) }
        }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "alaga/downloads").setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "saveToDownloads" -> {
                        val fileName = call.argument<String>("fileName") ?: "ALAGA_Report.pdf"
                        val bytes = call.argument<ByteArray>("bytes")
                        val content = call.argument<String>("content") ?: ""
                        val mimeType = call.argument<String>("mimeType") ?: "application/pdf"
                        val dataToWrite = bytes ?: content.toByteArray(Charsets.UTF_8)
                        var savedPath = ""
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            val contentValues = ContentValues().apply {
                                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                                put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                            }
                            val resolver = contentResolver
                            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                            if (uri != null) {
                                resolver.openOutputStream(uri)?.use { stream ->
                                    stream.write(dataToWrite)
                                }
                                savedPath = "Downloads/$fileName"
                            } else {
                                throw Exception("Could not create entry in MediaStore Downloads")
                            }
                        } else {
                            val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                            if (!downloadDir.exists()) downloadDir.mkdirs()
                            val file = File(downloadDir, fileName)
                            file.writeBytes(dataToWrite)
                            savedPath = file.absolutePath
                            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                            dm.addCompletedDownload(
                                file.name, file.name, true, mimeType,
                                file.absolutePath, file.length(), true
                            )
                        }
                        result.success(mapOf("success" to true, "path" to savedPath))
                    }
                    "shareReport" -> {
                        val title = call.argument<String>("title") ?: "ALAGA Health Report"
                        val bytes = call.argument<ByteArray>("bytes")
                        val content = call.argument<String>("content") ?: ""
                        val fileName = call.argument<String>("fileName") ?: "ALAGA_Report.pdf"
                        val mimeType = call.argument<String>("mimeType") ?: (if (bytes != null) "application/pdf" else "text/plain")
                        
                        val sendIntent = Intent().apply {
                            action = Intent.ACTION_SEND
                            putExtra(Intent.EXTRA_TITLE, title)
                            putExtra(Intent.EXTRA_SUBJECT, title)
                            if (bytes != null) {
                                val cacheFile = File(cacheDir, fileName)
                                cacheFile.writeBytes(bytes)
                                val uri = androidx.core.content.FileProvider.getUriForFile(this@MainActivity, "${applicationContext.packageName}.fileprovider", cacheFile)
                                putExtra(Intent.EXTRA_STREAM, uri)
                                type = mimeType
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            } else {
                                putExtra(Intent.EXTRA_TEXT, content)
                                type = mimeType
                            }
                        }
                        val shareIntent = Intent.createChooser(sendIntent, "Share Report")
                        shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(shareIntent)
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            } catch (e: Exception) {
                result.error("DOWNLOAD_ERROR", e.message, null)
            }
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
