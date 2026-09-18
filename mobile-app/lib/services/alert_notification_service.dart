import 'dart:async';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_service.dart';
import '../models/user_session.dart';

/// Clinical Alert & Push Notification Service for ALAGA Mobile App.
///
/// Features:
/// 1. Polls active clinical telemetry alerts and pending careteam invites.
/// 2. Dispatches real Android system heads-up notifications.
/// 3. Plays audible alert sounds configured in Settings.
/// 4. Vibrates device for critical thresholds (tachycardia, hypoxemia, fever).
/// 5. Deduplicates delivered notifications using encrypted local storage.
class AlertNotificationService {
  static const MethodChannel _notifChannel = MethodChannel('alaga/notifications');
  static const MethodChannel _reminderChannel = MethodChannel('alaga/schedule_reminders');
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _storageKey = 'alaga_delivered_alert_ids';
  static Set<String> _deliveredIds = {};
  static Timer? _pollingTimer;
  static bool _isChecking = false;
  static bool _initialized = false;

  /// Initialize the notification service and load delivered alert history
  static Future<void> initialize() async {
    if (_initialized) return;
    try {
      final saved = await _storage.read(key: _storageKey);
      if (saved != null && saved.isNotEmpty) {
        final List<dynamic> list = jsonDecode(saved);
        _deliveredIds = list.map((e) => e.toString()).toSet();
      }
    } catch (_) {
      _deliveredIds = {};
    }

    // Request notification permissions on Android 13+ if not yet granted
    try {
      await _reminderChannel.invokeMethod('requestPermission');
    } catch (_) {}

    _initialized = true;
  }

  /// Start periodic monitoring (every 15 seconds by default)
  static void startMonitoring({Duration interval = const Duration(seconds: 15)}) {
    _pollingTimer?.cancel();
    // Run initial check after 2 seconds
    Future.delayed(const Duration(seconds: 2), () => checkAlerts());
    _pollingTimer = Timer.periodic(interval, (_) => checkAlerts());
  }

  /// Stop polling
  static void stopMonitoring() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  /// Query the backend for active clinical alerts and pending invites
  static Future<void> checkAlerts() async {
    if (_isChecking) return;
    if (UserSession.current == null) return;

    _isChecking = true;
    try {
      await _checkClinicalAlerts();
      await _checkPendingInvitations();
    } catch (_) {
      // Network or silent error
    } finally {
      _isChecking = false;
    }
  }

  /// Check /api/alerts/clinical for un-notified anomalies
  static Future<void> _checkClinicalAlerts() async {
    final res = await ApiService.get('/api/alerts/clinical');
    if (res['success'] != true || res['data'] == null) return;

    final List<dynamic> alerts = res['data'] is List ? res['data'] : [];
    bool stateChanged = false;

    for (final raw in alerts) {
      if (raw is! Map) continue;
      final alert = Map<String, dynamic>.from(raw);
      final alertId = alert['alert_id']?.toString();
      if (alertId == null || alertId.isEmpty) continue;

      final key = 'clinical_$alertId';
      if (_deliveredIds.contains(key)) continue;

      // Status check: don't notify if already resolved or archived
      final status = (alert['status'] ?? '').toString().toLowerCase();
      if (status == 'resolved' || status == 'archived') continue;

      final severity = (alert['severity'] ?? 'Warning').toString();
      final patientName = alert['patient_name'] ?? 'Patient';
      final rawMsg = alert['message'] ?? 'Abnormal reading detected.';
      final anomalyType = (alert['anomaly_type'] ?? '').toString().toLowerCase();

      String title;
      if (severity.toLowerCase() == 'critical') {
        title = '🚨 CRITICAL ALERT: $patientName';
      } else if (anomalyType.contains('moisture') || rawMsg.toLowerCase().contains('moisture') || rawMsg.toLowerCase().contains('wet')) {
        title = '💧 DIAPER ALERT: $patientName';
      } else {
        title = '⚠️ CLINICAL ALERT: $patientName';
      }

      final numericId = int.tryParse(alertId) ?? (DateTime.now().millisecondsSinceEpoch % 100000);

      await showSystemNotification(
        id: numericId,
        title: title,
        message: rawMsg.toString(),
        severity: severity,
        category: 'Clinical',
        playSound: true,
      );

      _deliveredIds.add(key);
      stateChanged = true;
    }

    if (stateChanged) {
      await _persistDeliveredIds();
    }
  }

  /// Check /api/assignments/pending for un-notified team invitations
  static Future<void> _checkPendingInvitations() async {
    final res = await ApiService.get('/api/assignments/pending');
    if (res['success'] != true || res['data'] == null) return;

    final List<dynamic> invites = res['data'] is List ? res['data'] : [];
    bool stateChanged = false;

    for (final raw in invites) {
      if (raw is! Map) continue;
      final inv = Map<String, dynamic>.from(raw);
      final accessId = inv['access_id']?.toString();
      if (accessId == null || accessId.isEmpty) continue;

      final key = 'invite_$accessId';
      if (_deliveredIds.contains(key)) continue;

      final patientName = inv['patient_name'] ?? 'Assigned Patient';
      final inviter = inv['invited_by_name'] ?? 'Care Coordinator';
      final role = inv['role'] ?? 'Caregiver';

      final title = '👥 CARE TEAM INVITATION';
      final message = '$inviter invited you to join the Care Team for $patientName as $role.';
      final numericId = int.tryParse(accessId) ?? (DateTime.now().millisecondsSinceEpoch % 100000);

      await showSystemNotification(
        id: numericId + 50000,
        title: title,
        message: message,
        severity: 'Info',
        category: 'CareTeam',
        playSound: true,
      );

      _deliveredIds.add(key);
      stateChanged = true;
    }

    if (stateChanged) {
      await _persistDeliveredIds();
    }
  }

  /// Post a real Android system notification with sound & vibration
  static Future<bool> showSystemNotification({
    required int id,
    required String title,
    required String message,
    String severity = 'Warning',
    String category = 'Clinical',
    bool playSound = true,
  }) async {
    try {
      final res = await _notifChannel.invokeMethod('showNotification', {
        'id': id,
        'title': title,
        'message': message,
        'severity': severity,
        'category': category,
        'playSound': playSound,
      });
      return res == true;
    } catch (_) {
      return false;
    }
  }

  /// Play the alert sound tone directly
  static Future<bool> playAlertSound() async {
    try {
      final res = await _notifChannel.invokeMethod('playAlertSound');
      return res == true;
    } catch (_) {
      return false;
    }
  }

  /// Check if Android notifications are granted and channels are open
  static Future<bool> areNotificationsEnabled() async {
    try {
      final res = await _notifChannel.invokeMethod('areNotificationsEnabled');
      return res == true;
    } catch (_) {
      return false;
    }
  }

  /// Send a live test notification with sound to verify immediately on the device
  static Future<bool> testNotification({
    String severity = 'Critical',
    String? customTitle,
    String? customMessage,
  }) async {
    final title = customTitle ?? (severity == 'Critical'
        ? '🚨 TEST CRITICAL ALERT: Maria Santos'
        : '💧 TEST DIAPER ALERT: Baby Emma');
    final message = customMessage ?? (severity == 'Critical'
        ? 'Heart rate spiked to 132 BPM (Threshold: 100 BPM). Audible alarm active.'
        : 'Smart diaper moisture detected (Level: 88%). Change recommended.');

    return await showSystemNotification(
      id: 9999,
      title: title,
      message: message,
      severity: severity,
      category: 'Clinical',
      playSound: true,
    );
  }

  /// Save delivered ID set to prevent duplicate popups across launches
  static Future<void> _persistDeliveredIds() async {
    try {
      // Keep at most 200 most recent IDs to prevent unbounded growth
      final list = _deliveredIds.toList();
      final trimmed = list.length > 200 ? list.sublist(list.length - 200) : list;
      await _storage.write(key: _storageKey, value: jsonEncode(trimmed));
    } catch (_) {}
  }
}
