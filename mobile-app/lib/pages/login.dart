import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'dart:ui'; 
import 'package:google_fonts/google_fonts.dart';

// Import your pages
import 'register.dart';
import 'forgot_password.dart';
import 'biometrics.dart';
import 'dashboard.dart'; // FIXED: Added import for Dashboard
import '../services/api_service.dart';
import '../models/user_session.dart';
import 'otp.dart';

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
    final result = await ApiService.post(
      '/auth/login',
      requiresAuth: false,
      body: {
        'username': _usernameCtrl.text.trim(),
        'password': _passwordCtrl.text,
      },
    );
    setState(() => _isLoading = false);

    if (!mounted) return;

    if (result['success'] == true && result['token'] != null && result['user'] != null) {
      final session = UserSession.fromJson(
        result['user'] as Map<String, dynamic>,
        result['token'] as String,
      );
      await SessionManager.saveSession(session);
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const DashboardScreen()),
      );
      return;
    }

    if (result['requiresOtp'] == true && result['user_id'] != null && result['email'] != null) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => OTPVerificationPage(
            userId: result['user_id'] as int,
            email: result['email'].toString(),
          ),
        ),
      );
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result['message']?.toString() ?? 'Login failed')),
    );
  }

  Future<void> _loginWithBiometrics() async {
    final authenticated = await _biometricService.authenticate(
      reason: 'Scan your fingerprint to log in',
    );

    if (!mounted) return;

    if (authenticated) {
      // FIXED: Navigate to Dashboard on successful biometric scan
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const DashboardScreen()),
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
        child: const ForgotPasswordEmailPage(),
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
              Center(
                child: Column(
                  children: [
                    Image.asset('assets/images/WELCOME.png', height: 80),
                    const SizedBox(height: 8),
                    const Text(
                      'Your partner in patient care.',
                      style: TextStyle(
                        fontFamily: 'AlbertSans',
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                        color: Colors.black,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
              Text(
                'Log In',
                style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              const Text(
                'Enter your details to continue.',
                style: TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black),
              ),
              const SizedBox(height: 24),
              Form(
                key: _formKey,
                child: Column(
                  children: [
                    _buildInput(
                      controller: _usernameCtrl,
                      hint: 'Username',
                      validator: (v) => (v == null || v.isEmpty) ? "" : null,
                    ),
                    const SizedBox(height: 12),
                    _buildInput(
                      controller: _passwordCtrl,
                      hint: 'Password',
                      obscure: true,
                      validator: (v) => (v == null || v.isEmpty) ? "" : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Center(
                child: GestureDetector(
                  onTap: _showForgotPasswordDialog,
                  child: Text(
                    'Forgot your username or password?',
                    style: GoogleFonts.albertSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Colors.black,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 200,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _login,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF5FA9A9),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
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
                    child: Image.asset('assets/images/fingerprint.png', height: 42),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              Center(
                child: RichText(
                  text: TextSpan(
                    text: "Don't have an account yet? ",
                    style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black),
                    children: [
                      TextSpan(
                        text: 'Register.',
                        style: const TextStyle(fontFamily: 'AlbertSans', fontWeight: FontWeight.w800, color: Colors.black),
                        recognizer: TapGestureRecognizer()
                          ..onTap = () {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(builder: (_) => const RegisterPage()),
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
      style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontFamily: 'AlbertSans', color: Colors.black38),
        labelText: hint,
        labelStyle: const TextStyle(fontFamily: 'AlbertSans', color: Colors.black38, fontSize: 14),
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