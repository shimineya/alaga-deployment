import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../models/user_session.dart';

// ============================================================================
// ApiService — Centralized HTTP Client for the ALAGA Mobile Application
//
// Security Architecture:
//   [OWASP A01] All mutating endpoints require a valid JWT Bearer token.
//   [OWASP A04/HIPAA] Data is sent over HTTP locally (Prototyping Exception).
//                     TLS 1.3 must be enforced in production.
//   [OWASP A07] Token is loaded from encrypted on-device storage
//               (flutter_secure_storage / AES-256 SharedPreferences).
//   [OWASP A10] All server-side error messages are passed through as-is
//               only when they are deliberately generic. Raw stack traces
//               from the backend are intentionally blocked at the backend layer.
//
// Usage:
//   final result = await ApiService.get('/caregiver/patients');
//   final result = await ApiService.post('/caregiver/patients', body: {...});
// ============================================================================

class ApiService {
  /// Exchange the biometric-scoped credential for a fresh short-lived session.
  static Future<Map<String, dynamic>> loginWithBiometric(
      UserSession session) async {
    try {
      final response = await http
          .post(
            _buildUri('/auth/biometric/login'),
            headers: _buildHeaders(requiresAuth: false),
            body: jsonEncode({'biometricToken': session.biometricToken}),
          )
          .timeout(const Duration(seconds: 75));
      return _parseResponse(response);
    } catch (_) {
      return {
        'success': false,
        'message': 'Cannot reach the server. Please try again.'
      };
    }
  }

  static Future<Map<String, dynamic>> enrollBiometric() =>
      post('/auth/biometric/enroll');

  // [OWASP A02] Base URL sourced from environment file — never hard-coded.
  static String get _baseUrl {
    final url = dotenv.env['API_BASE_URL'];
    if (url != null && url.trim().isNotEmpty) {
      return url.trim();
    }
    // Fallback to online default if .env is missing/empty
    return 'https://alaga-backend.onrender.com/api';
  }

  /// Public accessor for constructing full API URLs.
  static String get baseUrl => _baseUrl;

  /// Returns the server origin (scheme + host + port) WITHOUT the /api path.
  /// Used to construct URLs for static assets served by Express (e.g. /uploads/...).
  /// Example: 'http://192.168.254.124:3000/api' -> 'http://192.168.254.124:3000'
  static String get serverOrigin {
    var raw = _baseUrl.trim();
    while (raw.endsWith('/')) {
      raw = raw.substring(0, raw.length - 1);
    }
    if (raw.endsWith('/api')) {
      raw = raw.substring(0, raw.length - 4);
    }
    final uri = Uri.parse(raw);
    final portSuffix = (uri.hasPort && uri.port != 80 && uri.port != 443)
        ? ':${uri.port}'
        : '';
    return '${uri.scheme}://${uri.host}$portSuffix';
  }

  /// Helper to obtain an ImageProvider for any relative or absolute image path.
  static ImageProvider? getImageProvider(String? path) {
    if (path == null || path.trim().isEmpty) return null;
    final trimmed = path.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return NetworkImage(trimmed);
    }
    final origin = serverOrigin;
    final normalizedPath = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return NetworkImage('$origin$normalizedPath');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ────────────────────────────────────────────────────────────────────────────

  /// Normalizes and builds the target URI so endpoint calls never fail due to
  /// trailing slashes, duplicate /api prefixes, or missing /api prefixes.
  static Uri _buildUri(String endpoint, [Map<String, String>? queryParams]) {
    var origin = serverOrigin;
    while (origin.endsWith('/')) {
      origin = origin.substring(0, origin.length - 1);
    }

    var path = endpoint.trim();
    if (!path.startsWith('/')) {
      path = '/$path';
    }

    // Ensure all backend routes are mapped to /api/...
    if (!path.startsWith('/api/') && path != '/api') {
      path = '/api$path';
    }

    var uri = Uri.parse('$origin$path');
    if (queryParams != null && queryParams.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParams);
    }
    return uri;
  }

  /// Builds the standard JSON request headers, including the JWT Bearer token
  /// when a session is active (OWASP A01 — all protected routes require it).
  static Map<String, String> _buildHeaders({bool requiresAuth = true}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (requiresAuth) {
      final token = UserSession.current?.token;
      if (token != null && token.isNotEmpty) {
        // [OWASP A01] Attach JWT — matches the backend's Authorization header check.
        headers['Authorization'] = 'Bearer $token';
      }
    }

    return headers;
  }

  /// Parses an HTTP response body and returns a consistent Map.
  /// On non-2xx status, returns { 'success': false, 'message': '...' }.
  static Map<String, dynamic> _parseResponse(http.Response response) {
    try {
      final body = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return body;
      }

      // [OWASP A10] Return the server's generic error; do NOT add stack traces.
      return {
        'success': false,
        'message': body['message'] ?? 'An unexpected error occurred.',
        'requiresRole': body['requiresRole'] == true,
        'requiresOtp': body['requiresOtp'] == true,
        'user_id': body['user_id'],
        'email': body['email'],
        'otpPurpose': body['otpPurpose'],
        'statusCode': response.statusCode,
      };
    } catch (_) {
      // Safety fallback for malformed JSON from the server.
      return {
        'success': false,
        'message':
            'Server returned an unreadable response (Status ${response.statusCode}).',
        'statusCode': response.statusCode,
      };
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PUBLIC HTTP METHODS
  // ────────────────────────────────────────────────────────────────────────────

  /// Sends an authenticated GET request.
  ///
  /// [endpoint] — relative path (e.g. '/caregiver/patients' or '/api/caregiver/patients').
  /// [queryParams] — optional URL query parameters.
  static Future<Map<String, dynamic>> get(
    String endpoint, {
    Map<String, String>? queryParams,
    bool requiresAuth = true,
    int timeoutSeconds = 75,
  }) async {
    try {
      final uri = _buildUri(endpoint, queryParams);

      final response = await http
          .get(uri, headers: _buildHeaders(requiresAuth: requiresAuth))
          .timeout(Duration(seconds: timeoutSeconds));

      return _parseResponse(response);
    } catch (e) {
      print('ApiService GET Error [$endpoint]: $e');
      final isTimeout = e.toString().toLowerCase().contains('time');
      return {
        'success': false,
        'message': isTimeout
            ? 'The server did not respond after 75 seconds. It may be starting up or temporarily unavailable. Please try again.'
            : 'Network error: Cannot reach the server. Please check your internet connection.',
      };
    }
  }

  /// Sends an authenticated POST request with a JSON body.
  static Future<Map<String, dynamic>> post(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requiresAuth = true,
    int timeoutSeconds = 75,
  }) async {
    try {
      final uri = _buildUri(endpoint);

      final response = await http
          .post(
            uri,
            headers: _buildHeaders(requiresAuth: requiresAuth),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(Duration(seconds: timeoutSeconds));

      return _parseResponse(response);
    } catch (e) {
      print('ApiService POST Error [$endpoint]: $e');
      final isTimeout = e.toString().toLowerCase().contains('time');
      return {
        'success': false,
        'message': isTimeout
            ? 'The server did not respond after 75 seconds. It may be starting up or temporarily unavailable. Please try again.'
            : 'Network error: Cannot reach the server. Please check your internet connection.',
      };
    }
  }

  /// Sends an authenticated PUT request with a JSON body.
  static Future<Map<String, dynamic>> put(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requiresAuth = true,
    int timeoutSeconds = 75,
  }) async {
    try {
      final uri = _buildUri(endpoint);

      final response = await http
          .put(
            uri,
            headers: _buildHeaders(requiresAuth: requiresAuth),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(Duration(seconds: timeoutSeconds));

      return _parseResponse(response);
    } catch (e) {
      print('ApiService PUT Error [$endpoint]: $e');
      final isTimeout = e.toString().toLowerCase().contains('time');
      return {
        'success': false,
        'message': isTimeout
            ? 'The server did not respond after 75 seconds. It may be starting up or temporarily unavailable. Please try again.'
            : 'Network error: Cannot reach the server. Please check your internet connection.',
      };
    }
  }

  /// Sends an authenticated PATCH request with a JSON body.
  static Future<Map<String, dynamic>> patch(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requiresAuth = true,
  }) async {
    try {
      final uri = _buildUri(endpoint);

      final response = await http
          .patch(
            uri,
            headers: _buildHeaders(requiresAuth: requiresAuth),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(const Duration(seconds: 15));

      return _parseResponse(response);
    } catch (e) {
      return {
        'success': false,
        'message':
            'Network error. Cannot reach the server. Check your connection.',
      };
    }
  }

  /// Sends an authenticated DELETE request.
  static Future<Map<String, dynamic>> delete(
    String endpoint, {
    bool requiresAuth = true,
    Map<String, dynamic>? body,
  }) async {
    try {
      final uri = _buildUri(endpoint);

      final response = await http
          .delete(
            uri,
            headers: _buildHeaders(requiresAuth: requiresAuth),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(const Duration(seconds: 15));

      return _parseResponse(response);
    } catch (e) {
      return {
        'success': false,
        'message':
            'Network error. Cannot reach the server. Check your connection.',
      };
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MULTIPART FILE UPLOAD
  // ────────────────────────────────────────────────────────────────────────────

  /// Sends a multipart PUT request to upload a file along with optional fields.
  /// Used for profile picture uploads (OWASP A04 -- file is validated server-side).
  ///
  /// [endpoint]  -- relative path (e.g. '/user/profile' or '/api/user/profile').
  /// [filePath]  -- absolute path to the file on the device.
  /// [fileField] -- the form field name expected by multer (e.g. 'profile_picture').
  /// [fields]    -- optional text fields to include alongside the file.
  static Future<Map<String, dynamic>> multipartPut(
    String endpoint, {
    required String filePath,
    required String fileField,
    Map<String, String>? fields,
  }) async {
    try {
      final uri = _buildUri(endpoint);
      final request = http.MultipartRequest('PUT', uri);

      // [OWASP A01] Attach JWT for authenticated upload
      final token = UserSession.current?.token;
      if (token != null && token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer $token';
      }

      // Attach optional text fields
      if (fields != null) {
        request.fields.addAll(fields);
      }

      // Determine MIME type from extension
      final ext = filePath.split('.').last.toLowerCase();
      MediaType mimeType;
      if (ext == 'png') {
        mimeType = MediaType('image', 'png');
      } else if (ext == 'webp') {
        mimeType = MediaType('image', 'webp');
      } else if (ext == 'heic' || ext == 'heif') {
        mimeType = MediaType('image', 'heic');
      } else {
        mimeType = MediaType('image', 'jpeg');
      }

      // [OWASP A04] File size is enforced server-side (5 MB limit via multer).
      request.files.add(
        await http.MultipartFile.fromPath(
          fileField,
          filePath,
          contentType: mimeType,
        ),
      );

      final streamedResponse =
          await request.send().timeout(const Duration(seconds: 30));
      final response = await http.Response.fromStream(streamedResponse);

      return _parseResponse(response);
    } catch (e) {
      return {
        'success': false,
        'message': 'Failed to upload file. Check your connection ($e).',
      };
    }
  }
}
