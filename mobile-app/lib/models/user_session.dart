import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';

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

  // [INTEGRATION] Returns a new UserSession with the given fields overridden.
  // Used by the profile screen to update the in-memory session after a save
  // without mutating the immutable fields directly.
  UserSession copyWith({
    String? username,
    String? profilePictureUrl,
    // Pass the sentinel value _clearPicture to explicitly null-out the picture.
    bool clearProfilePicture = false,
  }) {
    return UserSession(
      id: id,
      username: username ?? this.username,
      email: email,
      role: role,
      name: name,
      token: token,
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

  // Stored separately from the session JSON so the preference survives logout.
  // The user sets this once; it is only cleared when they explicitly disable it
  // in Settings or when clearSession is called during an account wipe.
  static const _biometricEnabledKey = 'ALAGA_BIOMETRIC_ENABLED';

  // Stores a copy of the session JSON exclusively for biometric restoration.
  // This key is intentionally NOT deleted on logout so that biometric login
  // can reconstruct the session after the user has signed out.
  // It is only cleared when the user disables biometrics in Settings.
  static const _biometricSessionKey = 'ALAGA_BIOMETRIC_SESSION';

  // [OWASP A07] Mitigation: securely flush tokens directly to encrypted on-device storage.
  static Future<void> saveSession(UserSession session) async {
    UserSession.current = session;
    await _storage.write(key: _sessionKey, value: jsonEncode(session.toJson()));

    // Keep the biometric session in sync whenever the main session is saved,
    // but only if the user has biometrics enabled. This ensures the biometric
    // session always reflects the most recent valid credentials.
    final biometricEnabled = await isBiometricEnabled();
    if (biometricEnabled) {
      await _storage.write(
        key: _biometricSessionKey,
        value: jsonEncode(session.toJson()),
      );
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
    UserSession.current = null;
    await _storage.delete(key: _sessionKey);
  }

  // ─── Biometric Preference ────────────────────────────────────────────────

  /// Returns true if the user has previously chosen to enable biometric login.
  /// [OWASP A07] Preference is stored in AES-encrypted storage, not plain SharedPreferences.
  static Future<bool> isBiometricEnabled() async {
    final value = await _storage.read(key: _biometricEnabledKey);
    return value == 'true';
  }

  /// Persists the user's decision to use biometric login.
  /// Also writes the current session to the biometric session key so the
  /// user can immediately use biometrics after enabling — without re-logging in.
  static Future<void> enableBiometrics() async {
    await _storage.write(key: _biometricEnabledKey, value: 'true');

    // If there is an active session, mirror it to the biometric session key now.
    if (UserSession.current != null) {
      await _storage.write(
        key: _biometricSessionKey,
        value: jsonEncode(UserSession.current!.toJson()),
      );
    }
  }

  /// Removes the biometric preference and its associated session snapshot
  /// so login permanently falls back to credentials until re-enabled.
  static Future<void> disableBiometrics() async {
    await _storage.delete(key: _biometricEnabledKey);
    await _storage.delete(key: _biometricSessionKey);
  }

  // ─── Biometric Session ───────────────────────────────────────────────────

  /// Restores the session from the biometric-specific key.
  /// This survives a normal logout because [clearSession] deliberately does
  /// not delete [_biometricSessionKey].
  static Future<UserSession?> loadBiometricSession() async {
    final sessionString = await _storage.read(key: _biometricSessionKey);
    if (sessionString != null) {
      try {
        final json = jsonDecode(sessionString);
        final session = UserSession(
          id: json['id'],
          username: json['username'],
          email: json['email'],
          role: json['role'],
          name: json['name'],
          token: json['token'],
          profilePictureUrl: json['profilePictureUrl'],
        );
        return session;
      } catch (e) {
        // Biometric session snapshot is corrupted; clear both keys for safety.
        await disableBiometrics();
        return null;
      }
    }
    return null;
  }
}
