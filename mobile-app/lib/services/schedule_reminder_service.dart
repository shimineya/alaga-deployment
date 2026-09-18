import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ScheduleReminderService {
  static const _channel = MethodChannel('alaga/schedule_reminders');
  static const _storage = FlutterSecureStorage();
  static bool get supported => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  static Future<List<Map<String, String>>> getPhoneTones() async {
    if (!supported) return const [{'title': 'System Default', 'uri': ''}];
    final result = await _channel.invokeMethod<List<dynamic>>('getPhoneTones');
    return (result ?? const [])
        .map((item) => Map<String, String>.from(item as Map))
        .toList();
  }

  static Future<void> previewAlertSound(String uri, double volume) async {
    if (!supported) return;
    await _channel.invokeMethod<void>('previewAlertSound', {
      'uri': uri,
      'volume': volume.clamp(0.0, 1.0),
    });
  }

  static Future<void> configureAlertSound(
      String tone, String uri, double volume) async {
    if (!supported) return;
    await _channel.invokeMethod<void>('configureAlertSound', {
      'tone': tone,
      'uri': uri,
      'volume': volume.clamp(0.0, 1.0),
    });
  }

  static Future<void> setAccount(int? owner) async {
    if (supported) await _channel.invokeMethod<void>('setOwner', {'owner': owner ?? -1});
  }

  static Future<Map<String, List<Map<String, String>>>> load(int owner) async {
    final raw = await _storage.read(key: 'ALAGA_SCHEDULES_$owner');
    if (raw == null) return {};
    final decoded = Map<String, dynamic>.from(jsonDecode(raw));
    return decoded.map((date, events) => MapEntry(date,
        (events as List).map((event) => Map<String, String>.from(event)).toList()));
  }

  static Future<void> _persist(int owner, Map<String, List<Map<String, String>>> events) =>
      _storage.write(key: 'ALAGA_SCHEDULES_$owner', value: jsonEncode(events));

  static Future<Map<String, String>> save(int owner, String date, DateTime at, Map<String, String> event) async {
    if (!at.isAfter(DateTime.now())) throw StateError('Choose a time in the future.');
    if (supported) {
      final allowed = await _channel.invokeMethod<bool>('requestPermission') ?? false;
      if (!allowed) throw StateError('Allow ALAGA notifications in your phone Settings, then save again.');
      if (await _channel.invokeMethod<bool>('exactAllowed') != true) {
        await _channel.invokeMethod<void>('openExactSettings');
        throw StateError('Allow Alarms & reminders for ALAGA, then return and save again.');
      }
      await setAccount(owner);
    }
    final events = await load(owner);
    final id = supported
        ? (await _channel.invokeMethod<int>('schedule', {'owner': owner, 'at': at.millisecondsSinceEpoch, 'title': event['type'] ?? 'Care task'}))!
        : DateTime.now().microsecondsSinceEpoch;
    final saved = {...event, 'id': id.toString(), 'scheduledAt': at.toIso8601String()};
    events.putIfAbsent(date, () => []).add(saved);
    try {
      await _persist(owner, events);
    } catch (_) {
      if (supported) await _channel.invokeMethod<void>('cancel', {'id': id});
      rethrow;
    }
    return saved;
  }

  /// Generate future occurrences for recurring schedules:
  /// - Daily (30 occurrences)
  /// - Weekly (12 occurrences)
  /// - Monthly (12 occurrences)
  /// - 6 Months (6 occurrences, spanning 3 years)
  /// - Annually (5 occurrences, spanning 5 years)
  static List<DateTime> generateOccurrences(DateTime firstAt, String recurrence, {int? maxCount}) {
    final List<DateTime> occurrences = [];
    final rec = recurrence.toLowerCase();

    if (rec.contains('daily')) {
      final count = maxCount ?? 30;
      for (int i = 0; i < count; i++) {
        occurrences.add(firstAt.add(Duration(days: i)));
      }
    } else if (rec.contains('weekly')) {
      final count = maxCount ?? 12;
      for (int i = 0; i < count; i++) {
        occurrences.add(firstAt.add(Duration(days: i * 7)));
      }
    } else if (rec.contains('monthly')) {
      final count = maxCount ?? 12;
      for (int i = 0; i < count; i++) {
        final totalMonths = (firstAt.month - 1) + i;
        final targetYear = firstAt.year + (totalMonths ~/ 12);
        final targetMonth = (totalMonths % 12) + 1;
        final daysInTargetMonth = DateTime(targetYear, targetMonth + 1, 0).day;
        final targetDay = firstAt.day > daysInTargetMonth ? daysInTargetMonth : firstAt.day;
        occurrences.add(DateTime(targetYear, targetMonth, targetDay, firstAt.hour, firstAt.minute));
      }
    } else if (rec.contains('6 month') || rec.contains('semi') || rec.contains('half')) {
      final count = maxCount ?? 6;
      for (int i = 0; i < count; i++) {
        final totalMonths = (firstAt.month - 1) + (i * 6);
        final targetYear = firstAt.year + (totalMonths ~/ 12);
        final targetMonth = (totalMonths % 12) + 1;
        final daysInTargetMonth = DateTime(targetYear, targetMonth + 1, 0).day;
        final targetDay = firstAt.day > daysInTargetMonth ? daysInTargetMonth : firstAt.day;
        occurrences.add(DateTime(targetYear, targetMonth, targetDay, firstAt.hour, firstAt.minute));
      }
    } else if (rec.contains('annual') || rec.contains('year')) {
      final count = maxCount ?? 5;
      for (int i = 0; i < count; i++) {
        final targetYear = firstAt.year + i;
        final targetMonth = firstAt.month;
        final daysInTargetMonth = DateTime(targetYear, targetMonth + 1, 0).day;
        final targetDay = firstAt.day > daysInTargetMonth ? daysInTargetMonth : firstAt.day;
        occurrences.add(DateTime(targetYear, targetMonth, targetDay, firstAt.hour, firstAt.minute));
      }
    } else {
      occurrences.add(firstAt);
    }
    return occurrences;
  }

  /// Save recurring series or single appointment
  static Future<List<Map<String, String>>> saveAppointmentSeries(
    int owner,
    DateTime firstAt,
    Map<String, String> baseEvent,
    String recurrence, {
    int? maxCount,
  }) async {
    if (!firstAt.isAfter(DateTime.now())) throw StateError('Choose a time in the future.');

    if (supported) {
      final allowed = await _channel.invokeMethod<bool>('requestPermission') ?? false;
      if (!allowed) throw StateError('Allow ALAGA notifications in your phone Settings, then save again.');
      if (await _channel.invokeMethod<bool>('exactAllowed') != true) {
        await _channel.invokeMethod<void>('openExactSettings');
        throw StateError('Allow Alarms & reminders for ALAGA, then return and save again.');
      }
      await setAccount(owner);
    }

    final occurrences = generateOccurrences(firstAt, recurrence, maxCount: maxCount);
    final events = await load(owner);
    final String seriesId = DateTime.now().millisecondsSinceEpoch.toString();
    final List<Map<String, String>> savedList = [];

    for (int i = 0; i < occurrences.length; i++) {
      final at = occurrences[i];
      final dateKey = '${at.year}-${at.month.toString().padLeft(2, '0')}-${at.day.toString().padLeft(2, '0')}';
      int notifId;
      if (supported) {
        try {
          notifId = (await _channel.invokeMethod<int>('schedule', {
            'owner': owner,
            'at': at.millisecondsSinceEpoch,
            'title': baseEvent['type'] ?? 'Care task',
          })) ?? DateTime.now().microsecondsSinceEpoch;
        } catch (_) {
          notifId = DateTime.now().microsecondsSinceEpoch + i;
        }
      } else {
        notifId = DateTime.now().microsecondsSinceEpoch + i;
      }

      final item = {
        ...baseEvent,
        'id': notifId.toString(),
        'scheduledAt': at.toIso8601String(),
        'recurrence': recurrence,
        'seriesId': seriesId,
        'occurrenceIndex': (i + 1).toString(),
        'totalOccurrences': occurrences.length.toString(),
      };

      events.putIfAbsent(dateKey, () => []).add(item);
      savedList.add(item);
    }

    await _persist(owner, events);
    return savedList;
  }

  static Future<void> delete(int owner, String date, String id) async {
    if (supported) {
      try {
        await _channel.invokeMethod<void>('cancel', {'id': int.parse(id)});
      } catch (_) {}
    }
    final events = await load(owner);
    events[date]?.removeWhere((event) => event['id'] == id);
    if (events[date]?.isEmpty == true) events.remove(date);
    await _persist(owner, events);
  }

  /// Delete all occurrences in a recurring series
  static Future<int> deleteSeries(int owner, String seriesId) async {
    final events = await load(owner);
    int removedCount = 0;

    for (final dayKey in events.keys.toList()) {
      final dayList = events[dayKey] ?? [];
      final toRemove = dayList.where((e) => e['seriesId'] == seriesId).toList();
      for (final e in toRemove) {
        final idStr = e['id'];
        if (idStr != null && supported) {
          try {
            await _channel.invokeMethod<void>('cancel', {'id': int.parse(idStr)});
          } catch (_) {}
        }
      }
      dayList.removeWhere((e) => e['seriesId'] == seriesId);
      removedCount += toRemove.length;
      if (dayList.isEmpty) {
        events.remove(dayKey);
      }
    }

    await _persist(owner, events);
    return removedCount;
  }

  static Future<void> ignore(int owner, String id) async {
    final events = await load(owner);
    for (final day in events.values) {
      for (final event in day) {
        if (event['id'] == id) event['ignored'] = 'true';
      }
    }
    await _persist(owner, events);
  }
}
