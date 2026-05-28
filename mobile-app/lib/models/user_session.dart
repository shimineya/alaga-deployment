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
      profilePictureUrl: json['profilePictureUrl'],
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

  // [OWASP A07] Mitigation: securely flush tokens directly to encrypted on-device storage.
  static Future<void> saveSession(UserSession session) async {
    UserSession.current = session;
    await _storage.write(key: _sessionKey, value: jsonEncode(session.toJson()));
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
}
