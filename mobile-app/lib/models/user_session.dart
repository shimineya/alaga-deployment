import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';

class UserSession {
  final int id;
  final String username;
  final String email;
  final String role;
  final String name;
  final String token;

  UserSession({
    required this.id,
    required this.username,
    required this.email,
    required this.role,
    required this.name,
    required this.token,
  });

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
    };
  }
}

class SessionManager {
  // [OWASP A04 / HIPAA] Use AES-encrypted SharedPreferences on Android.
  // The legacy RSA Keystore path (default) causes a deadlock on many physical
  // devices when write() is called from an async login handler, exhausting the
  // Android SurfaceView buffer. encryptedSharedPreferences uses AES-256 GCM
  // and is supported from Android API 23+ (which we already require in build.gradle.kts).
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
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
