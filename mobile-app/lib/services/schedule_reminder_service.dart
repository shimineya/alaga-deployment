import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ScheduleReminderService {
  static const _channel = MethodChannel('alaga/schedule_reminders');
  static const _storage = FlutterSecureStorage();
  static bool get supported => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

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

  static Future<void> delete(int owner, String date, String id) async {
    if (supported) await _channel.invokeMethod<void>('cancel', {'id': int.parse(id)});
    final events = await load(owner);
    events[date]?.removeWhere((event) => event['id'] == id);
    if (events[date]?.isEmpty == true) events.remove(date);
    await _persist(owner, events);
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
