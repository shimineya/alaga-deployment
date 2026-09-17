package com.example.alaga

import android.app.*
import android.content.*
import android.os.Build
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

object ScheduleReminders {
    const val CHANNEL = "alaga_schedule_reminders"
    private fun prefs(c: Context) = c.getSharedPreferences("schedule_reminders", Context.MODE_PRIVATE)
    private fun manager(c: Context) = c.getSystemService(NotificationManager::class.java)
    private fun alarm(c: Context) = c.getSystemService(AlarmManager::class.java)

    fun initialize(c: Context) {
        if (Build.VERSION.SDK_INT >= 26) {
            manager(c).createNotificationChannel(NotificationChannel(CHANNEL, "Schedule reminders", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Reminders for appointments saved in your ALAGA dashboard"
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            })
        }
    }

    fun allowed(c: Context): Boolean {
        initialize(c)
        return (Build.VERSION.SDK_INT < 24 || manager(c).areNotificationsEnabled()) &&
            (Build.VERSION.SDK_INT < 26 || manager(c).getNotificationChannel(CHANNEL).importance != NotificationManager.IMPORTANCE_NONE)
    }

    fun exactAllowed(c: Context) = Build.VERSION.SDK_INT < 31 || alarm(c).canScheduleExactAlarms()

    private fun intent(c: Context, id: Int, action: String) = PendingIntent.getBroadcast(
        c, id, Intent(c, ScheduleReminderReceiver::class.java).setAction(action).putExtra("id", id),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    fun add(c: Context, owner: Int, at: Long, title: String): Int {
        check(at > System.currentTimeMillis()) { "Choose a future reminder time." }
        check(allowed(c)) { "Enable ALAGA notifications in phone Settings." }
        check(exactAllowed(c)) { "Allow Alarms & reminders for ALAGA." }
        val p = prefs(c)
        val id = p.getInt("next_id", 1000) + 1
        val record = JSONObject().put("owner", owner).put("at", at).put("ack", false).put("delivered", false).put("title", title.take(80))
        check(p.edit().putInt("next_id", id).putString("event_$id", record.toString()).commit())
        try { schedule(c, id, record) } catch (e: Exception) { p.edit().remove("event_$id").commit(); throw e }
        return id
    }

    private fun schedule(c: Context, id: Int, record: JSONObject) {
        if (record.getBoolean("ack") || record.getInt("owner") != prefs(c).getInt("active_owner", -1)) return
        if (record.getLong("at") <= System.currentTimeMillis()) {
            if (!record.optBoolean("delivered")) show(c, id)
        } else if (exactAllowed(c)) {
            alarm(c).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, record.getLong("at"), intent(c, id, "DUE"))
        } else {
            // A permission revoked after saving must not silently discard reminders.
            alarm(c).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, record.getLong("at"), intent(c, id, "DUE"))
        }
    }

    fun setOwner(c: Context, owner: Int) {
        val p = prefs(c)
        if (owner != p.getInt("active_owner", -1)) {
            p.all.keys.filter { it.startsWith("event_") }.forEach {
                val id = it.removePrefix("event_").toInt()
                alarm(c).cancel(intent(c, id, "DUE"))
                manager(c).cancel(id)
                val record = JSONObject(p.getString(it, "{}")!!)
                record.put("delivered", false)
                p.edit().putString(it, record.toString()).commit()
            }
            p.edit().putInt("active_owner", owner).commit()
        }
        restore(c, false)
    }

    fun restore(c: Context, afterBoot: Boolean) {
        initialize(c)
        prefs(c).all.filterKeys { it.startsWith("event_") }.forEach { (key, value) ->
            val id = key.removePrefix("event_").toInt()
            val record = JSONObject(value as String)
            if (afterBoot && !record.getBoolean("ack")) {
                record.put("delivered", false)
                prefs(c).edit().putString(key, record.toString()).commit()
            }
            schedule(c, id, record)
        }
    }

    fun show(c: Context, id: Int) {
        val raw = prefs(c).getString("event_$id", null) ?: return
        val record = JSONObject(raw)
        if (record.getBoolean("ack") || record.getInt("owner") != prefs(c).getInt("active_owner", -1) || !allowed(c)) return
        val open = PendingIntent.getActivity(c, id, Intent(c, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(c, CHANNEL) else Notification.Builder(c)
        val scheduled = Calendar.getInstance().apply { timeInMillis = record.getLong("at") }
        val now = Calendar.getInstance()
        val isToday = scheduled.get(Calendar.YEAR) == now.get(Calendar.YEAR) &&
            scheduled.get(Calendar.DAY_OF_YEAR) == now.get(Calendar.DAY_OF_YEAR)
        val time = SimpleDateFormat("h:mm a", Locale.ENGLISH).format(scheduled.time)
        val date = if (isToday) "today" else "on " + SimpleDateFormat("MMMM d, yyyy", Locale.ENGLISH).format(scheduled.time)
        val type = record.optString("title", "Care task").ifBlank { "Care task" }
        val message = "You have $type scheduled at $time $date. Open ALAGA to view your calendar. Tap Got It to acknowledge this reminder."
        val notification = builder.setSmallIcon(R.drawable.ic_schedule_notification)
            .setContentTitle("ALAGA: ${record.optString("title", "Schedule reminder")}")
            .setWhen(record.getLong("at")).setShowWhen(true)
            .setContentText(message)
            .setStyle(Notification.BigTextStyle().bigText(message))
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setCategory(Notification.CATEGORY_REMINDER)
            .setPriority(Notification.PRIORITY_HIGH)
            .setOngoing(true).setAutoCancel(false).setOnlyAlertOnce(true)
            .setContentIntent(open)
            .addAction(Notification.Action.Builder(null, "Got It", intent(c, id, "ACK")).build())
            .build()
        manager(c).notify(id, notification)
        record.put("delivered", true)
        prefs(c).edit().putString("event_$id", record.toString()).commit()
    }

    fun acknowledge(c: Context, id: Int) {
        val raw = prefs(c).getString("event_$id", null) ?: return
        val record = JSONObject(raw)
        record.put("ack", true)
        prefs(c).edit().putString("event_$id", record.toString()).commit()
        manager(c).cancel(id)
        alarm(c).cancel(intent(c, id, "DUE"))
    }

    fun remove(c: Context, id: Int) {
        alarm(c).cancel(intent(c, id, "DUE"))
        manager(c).cancel(id)
        prefs(c).edit().remove("event_$id").commit()
    }
}

class ScheduleReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            "DUE" -> ScheduleReminders.show(context, intent.getIntExtra("id", -1))
            "ACK" -> ScheduleReminders.acknowledge(context, intent.getIntExtra("id", -1))
        }
    }
}

class ScheduleBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        ScheduleReminders.restore(context, intent.action == Intent.ACTION_BOOT_COMPLETED)
    }
}
