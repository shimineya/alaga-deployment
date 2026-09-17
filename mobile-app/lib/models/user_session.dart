import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';
import '../services/schedule_reminder_service.dart';

class UserSession {
  final int id;
  final String username;
  final String email;
  final String role;
  final String name;
  final String token;
  // [INTEGRATION] Persisted so the dashboard avatar survives app restarts
  // without a round-trip to the server. Nullable — not all users have a picture.
  final String? profilePictureUrl;

  UserSession({
    required this.id,
    required this.username,
    required this.email,
    required this.role,
    required this.name,
    required this.token,
    this.profilePictureUrl,
  });

  // [OWASP A01] Single source of truth for role-based UI visibility.
  // The parent (admin/parent) account can register devices and enroll patients.
  // Caregivers can only monitor patients and devices assigned to them.
  // Reading this getter is preferred over comparing role strings directly
  // in widget code — it prevents the 'admin' or 'parent' magic strings from scattering.
  bool get isParent => role == 'admin' || role == 'parent';

  // Global static referencing instance for Prototype session tracking constraints
  static UserSession? current;

  factory UserSession.fromJson(Map<String, dynamic> json, String token) {
    return UserSession(
      id: json['id'] ?? 0,
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'caregiver',
      name: json['name'] ?? '',
      token: token,
      // [FIX] The backend login route sends the field as camelCase
      // ('profilePictureUrl'). The profile route returns snake_case
      // ('profile_picture_url'). Check both so the session is always
      // hydrated correctly regardless of which endpoint produced the JSON.
      profilePictureUrl: json['profilePictureUrl'] ?? json['profile_picture_url'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'role': role,
      'name': name,
      'token': token,
      'profilePictureUrl': profilePictureUrl,
    };
  }

  UserSession copyWith({
    String? username,
    String? role,
    String? name,
    String? token,
    String? profilePictureUrl,
    // Pass the sentinel value _clearPicture to explicitly null-out the picture.
    bool clearProfilePicture = false,
  }) {
    return UserSession(
      id: id,
      username: username ?? this.username,
      email: email,
      role: role ?? this.role,
      name: name ?? this.name,
      token: token ?? this.token,
      profilePictureUrl: clearProfilePicture
          ? null
          : (profilePictureUrl ?? this.profilePictureUrl),
    );
  }
}

class SessionManager {
  // [OWASP A04 / HIPAA] Use AES-encrypted SharedPreferences on Android.
  // encryptedSharedPreferences was removed in flutter_secure_storage v11 —
  // the library now handles encryption automatically via custom ciphers.
  // Data is migrated transparently on first access.
  static const _storage = FlutterSecureStorage();
  static const _sessionKey = 'ALAGA_USER_SESSION';

  // Legacy single-account keys, read only to migrate existing enrollment.
  static const _biometricEnabledKey = 'ALAGA_BIOMETRIC_ENABLED';

  // New enrollments use the account map below and survive normal logout.
  static const _biometricSessionKey = 'ALAGA_BIOMETRIC_SESSION';

  // [OWASP A07] Mitigation: securely flush tokens directly to encrypted on-device storage.
  static Future<void> saveSession(UserSession session) async {
    UserSession.current = session;
    await _storage.write(key: _sessionKey, value: jsonEncode(session.toJson()));
    await ScheduleReminderService.setAccount(session.id);

    final sessions = await _readBiometricAccounts();
    if (sessions.containsKey(session.id.toString())) {
      sessions[session.id.toString()] = session.toJson();
      await _writeBiometricAccounts(sessions);
    }
  }

  static Future<UserSession?> loadSession() async {
    final sessionString = await _storage.read(key: _sessionKey);
    if (sessionString != null) {
      try {
        final json = jsonDecode(sessionString);
        UserSession.current = UserSession(
          id: json['id'],
          username: json['username'],
          email: json['email'],
          role: json['role'],
          name: json['name'],
          token: json['token'],
          profilePictureUrl: json['profilePictureUrl'],
        );
        await ScheduleReminderService.setAccount(UserSession.current!.id);
        return UserSession.current;
      } catch (e) {
        // Fallback protocol: destroy corrupted state
        await clearSession();
        return null;
      }
    }
    return null;
  }

  static Future<void> clearSession() async {
    await ScheduleReminderService.setAccount(null);
    UserSession.current = null;
    await _storage.delete(key: _sessionKey);
  }

  // ─── Biometric Preference ────────────────────────────────────────────────

  static const _biometricAccountsKey = 'ALAGA_BIOMETRIC_ACCOUNTS';

  static Future<Map<String, dynamic>> _readBiometricAccounts() async {
    final raw = await _storage.read(key: _biometricAccountsKey);
    Map<String, dynamic> accounts = {};
    if (raw != null) {
      try {
        accounts = Map<String, dynamic>.from(jsonDecode(raw));
      } catch (_) {
        await _storage.delete(key: _biometricAccountsKey);
      }
    }
    // Migrate the previous single-account enrollment without enrolling anyone else.
    if (await _storage.read(key: _biometricEnabledKey) == 'true') {
      final legacy = await _storage.read(key: _biometricSessionKey);
      if (legacy != null) {
        try {
          final data = Map<String, dynamic>.from(jsonDecode(legacy));
          accounts.putIfAbsent(data['id'].toString(), () => data);
          await _writeBiometricAccounts(accounts);
        } catch (_) {
          // A corrupt legacy enrollment must be set up again.
        }
      }
      await _storage.delete(key: _biometricEnabledKey);
      await _storage.delete(key: _biometricSessionKey);
    }
    return accounts;
  }

  static Future<void> _writeBiometricAccounts(Map<String, dynamic> accounts) =>
      _storage.write(key: _biometricAccountsKey, value: jsonEncode(accounts));

  static Future<bool> isBiometricEnabled() async {
    final accounts = await _readBiometricAccounts();
    final current = UserSession.current;
    return current == null ? accounts.isNotEmpty : accounts.containsKey(current.id.toString());
  }

  static Future<void> enableBiometrics() async {
    final current = UserSession.current;
    if (current == null) return;
    final accounts = await _readBiometricAccounts();
    accounts[current.id.toString()] = current.toJson();
    await _writeBiometricAccounts(accounts);
  }

  static Future<void> disableBiometrics() async {
    final current = UserSession.current;
    if (current == null) return;
    final accounts = await _readBiometricAccounts();
    accounts.remove(current.id.toString());
    await _writeBiometricAccounts(accounts);
  }

  static Future<List<UserSession>> loadBiometricSessions() async {
    final accounts = await _readBiometricAccounts();
    final sessions = <UserSession>[];
    for (final value in accounts.values) {
      try {
        final data = Map<String, dynamic>.from(value);
        sessions.add(UserSession.fromJson(data, data['token'] as String));
      } catch (_) {
        // Ignore a corrupt account without affecting other enrollments.
      }
    }
    return sessions;
  }
}
