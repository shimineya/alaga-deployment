import 'dart:convert';
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
  // [OWASP A02] Base URL sourced from environment file — never hard-coded.
  // Change your _baseUrl getter to this:
  static String get _baseUrl {
    final url = dotenv.env['API_BASE_URL'];
    if (url != null && url.isNotEmpty) {
      return url;
    }
    // Fallback to PC IP if .env is missing/empty
    return 'http://192.168.0.188:3000'; 
  }

  /// Public accessor for constructing full API URLs.
  /// Avoids hard-coding the server address in UI code (OWASP A02).
  static String get baseUrl => _baseUrl;

  /// Returns the server origin (scheme + host + port) WITHOUT the /api path.
  /// Used to construct URLs for static assets served by Express (e.g. /uploads/...).
  /// Example: 'http://192.168.254.124:3000/api' -> 'http://192.168.254.124:3000'
  static String get serverOrigin {
    final uri = Uri.parse(_baseUrl);
    return '${uri.scheme}://${uri.host}:${uri.port}';
  }

  // ────────────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ────────────────────────────────────────────────────────────────────────────

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
        'statusCode': response.statusCode,
      };
    } catch (_) {
      // Safety fallback for malformed JSON from the server.
      return {
        'success': false,
        'message': 'Server returned an unreadable response.',
        'statusCode': response.statusCode,
      };
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PUBLIC HTTP METHODS
  // ────────────────────────────────────────────────────────────────────────────

  /// Sends an authenticated GET request.
  ///
  /// [endpoint] — relative path after the base URL (e.g. '/caregiver/patients').
  /// [queryParams] — optional URL query parameters.
  static Future<Map<String, dynamic>> get(
    String endpoint, {
    Map<String, String>? queryParams,
    bool requiresAuth = true,
  }) async {
    try {
      var uri = Uri.parse('$_baseUrl$endpoint');
      if (queryParams != null && queryParams.isNotEmpty) {
        uri = uri.replace(queryParameters: queryParams);
      }

      final response = await http
          .get(uri, headers: _buildHeaders(requiresAuth: requiresAuth))
          .timeout(const Duration(seconds: 15));

      return _parseResponse(response);
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error. Cannot reach the server. Check your connection.',
      };
    }
  }

  /// Sends an authenticated POST request with a JSON body.
  ///
  /// [timeoutSeconds] — override the default 15s timeout for endpoints that
  /// involve slow server-side operations (e.g., registration involves DNS MX
  /// lookup + bcrypt hashing before any DB write).
  static Future<Map<String, dynamic>> post(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requiresAuth = true,
    int timeoutSeconds = 15,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');

      final response = await http
          .post(
            uri,
            headers: _buildHeaders(requiresAuth: requiresAuth),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(Duration(seconds: timeoutSeconds));

      return _parseResponse(response);
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error. Cannot reach the server. Check your connection.',
      };
    }
  }

  /// Sends an authenticated PUT request with a JSON body.
  static Future<Map<String, dynamic>> put(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requiresAuth = true,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');

      final response = await http
          .put(
            uri,
            headers: _buildHeaders(requiresAuth: requiresAuth),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(const Duration(seconds: 15));

      return _parseResponse(response);
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error. Cannot reach the server. Check your connection.',
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
      final uri = Uri.parse('$_baseUrl$endpoint');

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
        'message': 'Network error. Cannot reach the server. Check your connection.',
      };
    }
  }

  /// Sends an authenticated DELETE request.
  /// [body] is optional but supported for routes that require a JSON payload
  /// (e.g., DELETE /assignments/caregiver/revoke which needs patient_id + target_user_id).
  static Future<Map<String, dynamic>> delete(
    String endpoint, {
    bool requiresAuth = true,
    Map<String, dynamic>? body,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');

      final response = await http
          .delete(
            uri,
            headers: _buildHeaders(requiresAuth: requiresAuth),
            // [OWASP A05] Body is JSON-encoded; never concatenated into a URL.
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(const Duration(seconds: 15));

      return _parseResponse(response);
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error. Cannot reach the server. Check your connection.',
      };
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MULTIPART FILE UPLOAD
  // ────────────────────────────────────────────────────────────────────────────

  /// Sends a multipart PUT request to upload a file along with optional fields.
  /// Used for profile picture uploads (OWASP A04 -- file is validated server-side).
  ///
  /// [endpoint]  -- relative path (e.g. '/user/profile').
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
      final uri = Uri.parse('$_baseUrl$endpoint');
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
      final mimeType = ext == 'png'
          ? MediaType('image', 'png')
          : MediaType('image', 'jpeg');

      // [OWASP A04] File size is enforced server-side (2 MB limit via multer).
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
        'message': 'Failed to upload file. Check your connection.',
      };
    }
  }
}
