import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'api_service.dart';
import '../models/user_session.dart';

/// Clinical Alert & Push Notification Service for ALAGA Mobile App.
///
/// Features:
/// 1. Real-time SSE (Server-Sent Events) synchronization with Web App and backend.
/// 2. Dispatches real Android system heads-up notifications with sound & vibration.
/// 3. Plays audible alert sounds in sync with Web App.
/// 4. Cancels notification tray items immediately when acknowledged on Web App or Mobile.
/// 5. Synchronizes mute/unmute audio state across all logged-in devices.
/// 6. Fallback periodic polling (every 15s) for deep-sleep network recovery.
class AlertNotificationService {
  static const MethodChannel _notifChannel = MethodChannel('alaga/notifications');
  static const MethodChannel _reminderChannel = MethodChannel('alaga/schedule_reminders');
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _storageKey = 'alaga_delivered_alert_ids';
  static Set<String> _deliveredIds = {};
  static Timer? _pollingTimer;
  static bool _isChecking = false;
  static bool _initialized = false;

  // Real-time SSE Client and State
  static http.Client? _sseClient;
  static bool _isSseConnected = false;
  static Timer? _sseReconnectTimer;
  static bool _isMuted = false;

  // Stream controller to notify in-app screens (NotificationScreen, Dashboard, etc.)
  static final StreamController<Map<String, dynamic>> _alertStreamController =
      StreamController<Map<String, dynamic>>.broadcast();

  /// Stream of real-time alert events for UI components to listen to
  static Stream<Map<String, dynamic>> get onAlertUpdate =>
      _alertStreamController.stream;

  /// Whether alert audio is currently muted
  static bool get isMuted => _isMuted;

  /// Whether real-time SSE stream is actively connected
  static bool get isSseConnected => _isSseConnected;

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

  /// Start real-time monitoring and fallback polling
  static void startMonitoring({Duration interval = const Duration(seconds: 15)}) {
    _pollingTimer?.cancel();
    // 1. Connect real-time SSE stream
    _connectRealtimeStream();

    // 2. Initial check after 2 seconds
    Future.delayed(const Duration(seconds: 2), () => checkAlerts());

    // 3. Fallback polling interval (in case SSE drops or OS pauses background sockets)
    _pollingTimer = Timer.periodic(interval, (_) => checkAlerts());
  }

  /// Stop real-time monitoring and polling
  static void stopMonitoring() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
    _sseReconnectTimer?.cancel();
    _sseReconnectTimer = null;
    _sseClient?.close();
    _sseClient = null;
    _isSseConnected = false;
  }

  /// Connect to the backend Server-Sent Events (SSE) stream for instant real-time synchronization
  static void _connectRealtimeStream() {
    final token = UserSession.current?.token;
    if (token == null || token.isEmpty) return;

    _sseReconnectTimer?.cancel();
    _sseClient?.close();

    final client = http.Client();
    _sseClient = client;

    final origin = ApiService.serverOrigin;
    final uri = Uri.parse('$origin/api/alerts/events?token=${Uri.encodeComponent(token)}');

    final request = http.Request('GET', uri);
    request.headers['Accept'] = 'text/event-stream';
    request.headers['Cache-Control'] = 'no-cache';

    client.send(request).then((response) {
      if (response.statusCode == 200) {
        _isSseConnected = true;
        debugPrint('[AlertNotificationService] SSE Real-time Connected to $uri');

        String currentEvent = 'message';
        response.stream
            .transform(utf8.decoder)
            .transform(const LineSplitter())
            .listen(
          (line) {
            final trimmed = line.trim();
            if (trimmed.isEmpty) return;

            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('data:')) {
              final rawData = trimmed.substring(5).trim();
              try {
                final Map<String, dynamic> data = jsonDecode(rawData);
                _handleRealtimeEvent(currentEvent, data);
              } catch (e) {
                debugPrint('[AlertNotificationService] SSE JSON parse error: $e');
              }
            }
          },
          onError: (err) {
            debugPrint('[AlertNotificationService] SSE stream error: $err');
            _isSseConnected = false;
            _scheduleSseReconnect();
          },
          onDone: () {
            debugPrint('[AlertNotificationService] SSE stream closed by server');
            _isSseConnected = false;
            _scheduleSseReconnect();
          },
          cancelOnError: true,
        );
      } else {
        _isSseConnected = false;
        _scheduleSseReconnect();
      }
    }).catchError((err) {
      _isSseConnected = false;
      _scheduleSseReconnect();
    });
  }

  static void _scheduleSseReconnect() {
    _sseReconnectTimer?.cancel();
    _sseReconnectTimer = Timer(const Duration(seconds: 4), () {
      if (UserSession.current != null) {
        _connectRealtimeStream();
      }
    });
  }

  /// Process incoming real-time SSE event from backend
  static Future<void> _handleRealtimeEvent(String eventName, Map<String, dynamic> payload) async {
    final eventType = payload['type']?.toString() ?? eventName;
    debugPrint('[AlertNotificationService] Incoming Real-time Event: $eventType');

    // Notify UI components via stream
    _alertStreamController.add({'event': eventType, 'data': payload});

    // 1. Initial connection or mute sync
    if (eventName == 'connected') {
      if (payload['isMuted'] is bool) {
        _isMuted = payload['isMuted'] == true;
      }
      return;
    }

    // 2. Mute audio synchronization
    if (eventType == 'alert_sound_mute') {
      final currentUserId = UserSession.current?.id;
      final targetUserId = payload['userId'];
      if (targetUserId == null || currentUserId == null || targetUserId.toString() == currentUserId.toString()) {
        _isMuted = payload['isMuted'] == true;
      }
      return;
    }

    // 3. New Clinical Alert or Anomaly
    if (eventType == 'new_alert' || eventType == 'new_clinical_alert') {
      final alertId = payload['alert_id']?.toString() ?? payload['alertId']?.toString();
      final key = alertId != null ? 'clinical_$alertId' : null;
      if (key != null && _deliveredIds.contains(key)) return;

      final severity = (payload['severity'] ?? 'Warning').toString();
      final patientName = payload['patient_name'] ?? payload['patientName'] ?? 'Patient';
      final msg = payload['message'] ?? 'Abnormal reading detected.';
      final anomalyType = (payload['anomaly_type'] ?? payload['anomalyType'] ?? '').toString().toLowerCase();

      String title;
      if (severity.toLowerCase() == 'critical') {
        title = '🚨 CRITICAL ALERT: $patientName';
      } else if (anomalyType.contains('moisture') || msg.toLowerCase().contains('moisture') || msg.toLowerCase().contains('wet')) {
        title = '💧 DIAPER ALERT: $patientName';
      } else {
        title = '⚠️ CLINICAL ALERT: $patientName';
      }

      final numericId = (alertId != null ? int.tryParse(alertId) : null) ?? (DateTime.now().millisecondsSinceEpoch % 100000);

      final shouldPlaySound = !_isMuted && payload['playSound'] != false;

      await showSystemNotification(
        id: numericId,
        title: title,
        message: msg.toString(),
        severity: severity,
        category: 'Clinical',
        playSound: shouldPlaySound,
      );

      if (shouldPlaySound) {
        await playAlertSound();
      }

      if (key != null) {
        _deliveredIds.add(key);
        await _persistDeliveredIds();
      }
      return;
    }

    // 4. Alert Acknowledged on Web App or another phone
    if (eventType == 'alert_acknowledged') {
      final rawAlertId = payload['alertId'] ?? payload['alert_id'];
      if (rawAlertId != null) {
        final alertId = int.tryParse(rawAlertId.toString());
        if (alertId != null) {
          // Immediately dismiss notification from Android system tray
          await cancelNotification(alertId);
        }
      }
      return;
    }

    // 5. Alert Archived on Web App or another phone
    if (eventType == 'alert_archived' || eventType == 'alert_archived_bulk') {
      final alertIds = payload['alertIds'] ?? payload['clinicalIds'] ?? payload['ids'];
      if (alertIds is List) {
        for (final item in alertIds) {
          final id = int.tryParse(item.toString().replaceAll(RegExp(r'[^0-9]'), ''));
          if (id != null) {
            await cancelNotification(id);
          }
        }
      }
      return;
    }

    // 6. Care team assignment update
    if (eventType == 'assignment_update') {
      await checkAlerts();
    }
  }

  /// Toggle mute state and synchronize across Web and Mobile
  static Future<bool> toggleMute({int durationMinutes = 15}) async {
    final newMuted = !_isMuted;
    _isMuted = newMuted;

    try {
      final res = await ApiService.post(
        '/alerts/sync-mute',
        body: {'isMuted': newMuted, 'durationMinutes': durationMinutes},
      );
      if (res['success'] == true) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  /// Query the backend for active clinical alerts and pending invites (Resilient Fallback)
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
    final res = await ApiService.get('/alerts/clinical');
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

      // Status check: don't notify if already resolved, acknowledged, or archived
      final status = (alert['status'] ?? '').toString().toLowerCase();
      if (status == 'resolved' || status == 'archived' || status == 'acknowledged') continue;

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

      final playSound = !_isMuted;

      await showSystemNotification(
        id: numericId,
        title: title,
        message: rawMsg.toString(),
        severity: severity,
        category: 'Clinical',
        playSound: playSound,
      );

      if (playSound) {
        await playAlertSound();
      }

      _deliveredIds.add(key);
      stateChanged = true;
    }

    if (stateChanged) {
      await _persistDeliveredIds();
    }
  }

  /// Check /api/assignments/pending for un-notified team invitations
  static Future<void> _checkPendingInvitations() async {
    final res = await ApiService.get('/assignments/pending');
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
        playSound: !_isMuted,
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

  /// Cancel an active notification by ID from the Android system tray
  static Future<void> cancelNotification(int id) async {
    try {
      await _notifChannel.invokeMethod('cancelNotification', {'id': id});
    } catch (_) {}
  }

  /// Cancel all active notifications from the Android system tray
  static Future<void> cancelAllNotifications() async {
    try {
      await _notifChannel.invokeMethod('cancelAllNotifications');
    } catch (_) {}
  }

  /// Play the alert sound tone directly
  static Future<bool> playAlertSound() async {
    if (_isMuted) return false;
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

    final res = await showSystemNotification(
      id: 9999,
      title: title,
      message: message,
      severity: severity,
      category: 'Clinical',
      playSound: !_isMuted,
    );
    if (!_isMuted) {
      await playAlertSound();
    }
    return res;
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
