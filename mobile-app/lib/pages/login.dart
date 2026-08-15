import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'dart:ui';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Import API service and session management
import '../services/api_service.dart';
import '../models/user_session.dart';

// Import your pages
import 'register.dart';
import 'forgot_password.dart';
import 'biometrics.dart';
import 'dashboard.dart';
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

  // [INTEGRATION] Calls POST /api/auth/login with username/email and password.
  // On success, persists the JWT session and navigates to the dashboard.
  // On specific error codes, provides contextual feedback or redirects.
  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    // [OWASP A05] Credentials are sent via the ApiService's parameterized JSON body.
    // requiresAuth: false -- no JWT needed for login.
    final result = await ApiService.post(
      '/auth/login',
      body: {
        'username': _usernameCtrl.text.trim(),
        'password': _passwordCtrl.text,
      },
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result['success'] == true) {
      // [OWASP A07] Persist the session securely using encrypted SharedPreferences.
      final session = UserSession.fromJson(result['user'], result['token']);
      await SessionManager.saveSession(session);

      if (!mounted) return;

      // Navigate to dashboard, clearing the navigation stack
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const DashboardScreen()),
        (route) => false,
      );
    } else if (result['requiresOtp'] == true) {
      // Account exists but email is not yet verified -- redirect to OTP page
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => OTPVerificationPage(
            userId: result['user_id'],
            email: result['email'],
            purpose: result['otpPurpose'] ?? 'REGISTER_VERIFY',
          ),
        ),
      );
    } else {
      // [OWASP A10] Display the backend's generic error message.
      // The backend already handles specific cases:
      // - 404: "User not found. Please register."
      // - 401: "Incorrect password. Please try again."
      // - 403: "Account is locked. Contact Admin."
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ?? 'Login failed. Please try again.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _loginWithBiometrics() async {
    // [OWASP A07] Step 1: Confirm the user explicitly opted in during registration
    // or via Settings. Do NOT trigger the OS biometric dialog if they never enabled it.
    final isEnabled = await SessionManager.isBiometricEnabled();

    if (!mounted) return;

    if (!isEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Biometric login is not set up. Please log in with your credentials first, then enable it in Settings.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.orangeAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // Step 2: Load the biometric session snapshot BEFORE prompting the OS dialog.
    // We need the stored username to validate against the typed field.
    final biometricSession = await SessionManager.loadBiometricSession();

    if (!mounted) return;

    if (biometricSession == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'No saved session found. Please log in with your credentials first.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.orangeAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // Step 3: Account ownership check.
    // [OWASP A01] Silently logging in as a different person when a mismatched
    // username is typed is a Broken Access Control violation in a clinical system.
    //
    // - If the field is empty: auto-fill the stored account's username and proceed.
    // - If the field matches the stored account: proceed normally.
    // - If the field contains a DIFFERENT username: block and require password login
    //   for that account. This prevents one user from using another's biometric token.
    final typedUsername = _usernameCtrl.text.trim();

    if (typedUsername.isEmpty) {
      // Auto-fill the stored account's username so the user knows whose
      // account they are about to log into via biometrics.
      setState(() => _usernameCtrl.text = biometricSession.username);
    } else if (typedUsername.toLowerCase() != biometricSession.username.toLowerCase()) {
      // The typed username does not match the account registered for biometric login.
      // Do NOT trigger the OS prompt — doing so and silently logging in as the
      // wrong person would be a patient data access violation.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Biometric login is set up for "${biometricSession.username}". '
            'To use biometrics for a different account, please log in with '
            'your password first, then enable biometrics in Settings.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 6),
        ),
      );
      return;
    }

    // Step 4: Ownership confirmed. Prompt the OS biometric dialog.
    final authenticated = await _biometricService.authenticate(
      reason: 'Scan your fingerprint to log in as ${biometricSession.username}',
    );

    if (!mounted) return;

    if (authenticated) {
      // [TECHNICAL DEBT] The biometric scan unlocks the biometric session snapshot
      // stored in ALAGA_BIOMETRIC_SESSION. This key is intentionally preserved
      // across logout so biometrics work after the user signs out.
      // In production, this token must be sent to POST /auth/validate-token
      // to confirm it has not been revoked server-side before granting access.
      // This is documented in the Recommendations chapter as a future upgrade.
      await SessionManager.saveSession(biometricSession);
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const DashboardScreen()),
        );
      }
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
      backgroundColor: const Color(0xFF5FA9A9), // Teal header background
      body: Column(
        children: [
          // Header Section
          SafeArea(
            bottom: false,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 30),
              child: Column(
                children: [
                  Image.asset('assets/images/alagahead.png', height: 90),
                  const SizedBox(height: 12),
                  Text(
                    'ALAGA',
                    style: GoogleFonts.poppins(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
                  ),
                  const Text(
                    'Your partner in patient care.',
                    style: TextStyle(
                      fontFamily: 'AlbertSans',
                      fontSize: 13,
                      fontStyle: FontStyle.italic,
                      color: Colors.black,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Content Area
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Color(0xFFF5F5F0), // Matching registration page color
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(35),
                  topRight: Radius.circular(35),
                ),
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const SizedBox(height: 40),
                    Text(
                      'Log In',
                      style: GoogleFonts.poppins(
                        fontSize: 28, 
                        fontWeight: FontWeight.w600, 
                        color: Colors.black87
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Enter your details to continue.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black),
                    ),
                    const SizedBox(height: 30),

                    // Login Form
                    Form(
                      key: _formKey,
                      child: Column(
                        children: [
                          _buildInput(
                            controller: _usernameCtrl,
                            hint: 'Username',
                            validator: (v) => (v == null || v.isEmpty) ? "" : null,
                          ),
                          const SizedBox(height: 16),
                          _buildInput(
                            controller: _passwordCtrl,
                            hint: 'Password',
                            obscure: true,
                            validator: (v) => (v == null || v.isEmpty) ? "" : null,
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Forgot Password
                    GestureDetector(
                      onTap: _showForgotPasswordDialog,
                      child: Text(
                        'Forgot your username or password?',
                        style: GoogleFonts.albertSans(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.black,
                        ),
                      ),
                    ),

                    const SizedBox(height: 40),

                    // Buttons
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
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(25),
                              ),
                              elevation: 2,
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
                                      fontSize: 18,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.black,
                                    ),
                                  ),
                          ),
                        ),
                        const SizedBox(width: 15),
                        GestureDetector(
                          onTap: _loginWithBiometrics,
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.1),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                )
                              ],
                            ),
                            child: Image.asset('assets/images/fingerprint.png', height: 40),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 30),

                    // Navigation to Register
                    RichText(
                      text: TextSpan(
                        text: "Don't have an account yet? ",
                        style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black),
                        children: [
                          TextSpan(
                            text: 'Register.',
                            style: const TextStyle(
                              fontFamily: 'AlbertSans',
                              fontWeight: FontWeight.bold,
                              color: Colors.black,
                              decoration: TextDecoration.underline,
                            ),
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
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // UPDATED: Helper exactly matching the Registration Page styling
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
      style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black87),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontFamily: 'AlbertSans', color: Colors.black38),
        filled: true,
        fillColor: const Color(0xFFF5F5F0), // Matches container for seamless look
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.black54, width: 1.2), // The correct gray outline
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2.0),
        ),
        errorStyle: const TextStyle(height: 0, fontSize: 0),
      ),
    );
  }
}