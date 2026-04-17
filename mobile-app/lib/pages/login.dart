import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'dart:ui'; // For ImageFilter
import 'package:google_fonts/google_fonts.dart';
import 'register.dart';
import 'register1.dart'; // contains BiometricService
import 'forgot_password.dart';
import 'dart:convert';
import '../models/user_session.dart';
import 'dashboard.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_dotenv/flutter_dotenv.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _biometricService = BiometricService();

  final TextEditingController _usernameCtrl = TextEditingController();
  final TextEditingController _passwordCtrl = TextEditingController();

  bool _isLoading = false;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      // Retrieve the secure base URL from the environment file
      final String baseUrl = dotenv.env['API_BASE_URL'] ?? '';
      
      // Construct the exact endpoint matching your Node.js backend
      final Uri loginUri = Uri.parse('$baseUrl/auth/login');

      // [OWASP A04/HIPAA Compliance] 
      // Note: Data is transmitted via HTTP locally (Prototyping Exception). 
      // Must enforce TLS 1.3 (HTTPS) in production to protect PHI during transit.
      final response = await http.post(
        loginUri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'username': _usernameCtrl.text.trim(),
          'password': _passwordCtrl.text,
        }),
      ).timeout(const Duration(seconds: 10));

      if (!mounted) return;

      if (response.statusCode == 200) {
        // Parse the secure token sent by the backend
        final responseData = jsonDecode(response.body);
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Authentication Successful')),
        );
        
        // Securely instantiate backend payload map to RAM/Disk for Auth retention (OWASP A07)
        final session = UserSession.fromJson(responseData['user'], responseData['token']);
        await SessionManager.saveSession(session);

        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const DashboardScreen()),
        );
        
      } else {
        // [OWASP A10] Mishandling of Exceptional Conditions: 
        final errorData = jsonDecode(response.body);
        debugPrint('Login Verification Failed: \${response.statusCode} - \${response.body}');
        _showErrorDialog(errorData['message'] ?? 'Invalid credentials. Please try again.');
      }
    } catch (e) {
      if (!mounted) return;
      debugPrint('Login Network Exception: \$e');
      _showErrorDialog('Network error. Cannot reach the server. Please check your connection.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // Helper function for user-friendly error display
  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Authentication Failed'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          )
        ],
      ),
    );
  }

  Future<void> _loginWithBiometrics() async {
    final authenticated = await _biometricService.authenticate(
      reason: 'Scan your fingerprint to log in',
    );

    if (!mounted) return;

    if (authenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Biometric login successful')),
      );
    }
  }

  void _showForgotPasswordDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withOpacity(0.3),
      builder: (context) => BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
        child: ForgotPasswordEmailPage(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 32),

              // Logo Section
              Center(
                child: Column(
                  children: [
                    Image.asset(
                      'assets/images/WELCOME.png',
                      height: 80,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Your partner in patient care.',
                      style: TextStyle(
                        fontFamily: 'AlbertSans',
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 40),

              Text(
                'Log In',
                style: GoogleFonts.poppins(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                ),
              ),

              const SizedBox(height: 4),

              const Text(
                'Enter your details to continue.',
                style: TextStyle(
                  fontFamily: 'AlbertSans',
                  fontSize: 14,
                  color: Colors.black54,
                ),
              ),

              const SizedBox(height: 24),

              Form(
                key: _formKey,
                child: Column(
                  children: [
                    _buildInput(
                      controller: _usernameCtrl,
                      hint: 'Username',
                      validator: (v) => v!.isEmpty ? "" : null,
                    ),
                    const SizedBox(height: 12),
                    _buildInput(
                      controller: _passwordCtrl,
                      hint: 'Password',
                      obscure: true,
                      validator: (v) => v!.isEmpty ? "" : null,
                    ),
                  ],
                ),
              ),

              // Spacing to push the statement lower
              const SizedBox(height: 24),

              // Centered, Bolded, Poppins Size 14 Forgot Password Link
              Center(
                child: GestureDetector(
                  onTap: _showForgotPasswordDialog,
                  child: Text(
                    'Forgot your username or password?',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 32),

              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 180,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _login,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF5FA9A9),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.black,
                              ),
                            )
                          : Text(
                              'Log In',
                              style: GoogleFonts.poppins(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Colors.black,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  GestureDetector(
                    onTap: _loginWithBiometrics,
                    child: Image.asset(
                      'assets/images/fingerprint.png',
                      height: 42,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 32),

              Center(
                child: RichText(
                  text: TextSpan(
                    text: "Don't have an account yet? ",
                    style: const TextStyle(
                      fontFamily: 'AlbertSans',
                      fontSize: 14,
                      color: Colors.black54,
                    ),
                    children: [
                      TextSpan(
                        text: 'Register.',
                        style: const TextStyle(
                          fontFamily: 'AlbertSans',
                          fontWeight: FontWeight.w600,
                          color: Colors.black,
                        ),
                        recognizer: TapGestureRecognizer()
                          ..onTap = () {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const RegisterPage(),
                              ),
                            );
                          },
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInput({
    required TextEditingController controller,
    required String hint,
    bool obscure = false,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      validator: validator,
      style: const TextStyle(
        fontFamily: 'AlbertSans',
        fontSize: 14,
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(
          fontFamily: 'AlbertSans',
          color: Colors.black38,
        ),
        labelText: hint,
        labelStyle: const TextStyle(
          fontFamily: 'AlbertSans',
          color: Colors.black38,
          fontSize: 14,
        ),
        errorStyle: const TextStyle(height: 0, fontSize: 0),
        filled: true,
        fillColor: const Color(0xFFF5F5F0),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.black54),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2.0),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.red, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.red, width: 2.0),
        ),
      ),
    );
  }
}