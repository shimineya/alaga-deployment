import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Import the API service and registration data model
import '../models/registration_data.dart';
import '../services/api_service.dart';
import 'otp.dart';
import 'login.dart'; 

class CreateCredentialsPage extends StatefulWidget {
  // [OWASP A01] RegistrationData is required -- contains personal info and role
  // from the previous steps in the registration flow.
  final RegistrationData registrationData;

  const CreateCredentialsPage({super.key, required this.registrationData});

  @override
  State<CreateCredentialsPage> createState() => _CreateCredentialsPageState();
}

class _CreateCredentialsPageState extends State<CreateCredentialsPage> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _usernameCtrl = TextEditingController();
  final TextEditingController _passwordCtrl = TextEditingController();
  final TextEditingController _confirmPasswordCtrl = TextEditingController();

  bool _isPasswordVisible = false;
  bool _isConfirmPasswordVisible = false;
  bool _isLoading = false;
  bool _submitted = false;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    super.dispose();
  }

  // UI Helper for Password Requirements
  Widget _buildPasswordRequirements(String password) {
    bool hasMinLength = password.length >= 12;
    bool hasUpperAndLower = password.contains(RegExp(r'[A-Z]')) && password.contains(RegExp(r'[a-z]'));
    bool hasNumberAndSymbol = password.contains(RegExp(r'[0-9]')) && password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;/]'));

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFEAEAE4),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Password Requirements:',
            style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.black87),
          ),
          const SizedBox(height: 8),
          _buildRequirementRow('Minimum of 12 characters long', hasMinLength),
          const SizedBox(height: 4),
          _buildRequirementRow('At least one uppercase and lowercase letter', hasUpperAndLower),
          const SizedBox(height: 4),
          _buildRequirementRow('At least one number and one symbol', hasNumberAndSymbol),
        ],
      ),
    );
  }

  Widget _buildRequirementRow(String text, bool isMet) {
    return Row(
      children: [
        isMet
            ? const Icon(Icons.check_circle, color: Color(0xFF4CAF50), size: 16)
            : Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.black38, width: 1.5),
                ),
              ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: GoogleFonts.albertSans(
              fontSize: 12,
              fontWeight: isMet ? FontWeight.w600 : FontWeight.w400,
              color: isMet ? const Color(0xFF4CAF50) : Colors.black54,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInput({
    required TextEditingController controller,
    required String hint,
    required bool isRequired,
    bool obscureText = false,
    Widget? suffixIcon,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      validator: validator,
      style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black87),
      decoration: InputDecoration(
        suffixIcon: suffixIcon,
        errorStyle: const TextStyle(height: 0, fontSize: 0),
        label: RichText(
          text: TextSpan(
            text: hint,
            style: const TextStyle(fontFamily: 'AlbertSans', color: Colors.black38, fontSize: 14),
            children: [
              if (isRequired)
                const TextSpan(text: ' *', style: TextStyle(color: Colors.red)),
            ],
          ),
        ),
        filled: true,
        fillColor: const Color(0xFFF5F5F0),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.black54, width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2.0),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF5FA9A9),
      body: Column(
        children: [
          SafeArea(
            bottom: false,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.only(top: 20, bottom: 25),
              child: Column(
                children: [
                  Image.asset('assets/images/alagahead.png', height: 90),
                  const SizedBox(height: 8),
                  Text(
                    'ALAGA',
                    style: GoogleFonts.poppins(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
                  ),
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
          ),
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Color(0xFFF5F5F0),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(30),
                  topRight: Radius.circular(30),
                ),
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const SizedBox(height: 30),
                    Text('Register', style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w600, color: Colors.black87)),
                    const SizedBox(height: 4),
                    const Text('Complete all fields to continue.', style: TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black)),
                    const SizedBox(height: 24),
                    Form(
                      key: _formKey,
                      autovalidateMode: _submitted ? AutovalidateMode.onUserInteraction : AutovalidateMode.disabled,
                      child: Column(
                        children: [
                          _buildInput(
                            controller: _usernameCtrl,
                            hint: 'Username',
                            isRequired: true,
                            validator: (v) => v!.isEmpty ? "" : null,
                          ),
                          const SizedBox(height: 12),
                          _buildInput(
                            controller: _passwordCtrl,
                            hint: 'Password',
                            isRequired: true,
                            obscureText: !_isPasswordVisible,
                            suffixIcon: IconButton(
                              icon: Icon(_isPasswordVisible ? Icons.visibility : Icons.visibility_off, color: Colors.black45),
                              onPressed: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty || v.length < 12) return "";
                              if (!v.contains(RegExp(r'[A-Z]')) || !v.contains(RegExp(r'[a-z]'))) return "";
                              if (!v.contains(RegExp(r'[0-9]')) || !v.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;/]'))) return "";
                              return null;
                            },
                          ),
                          const SizedBox(height: 10),
                          ValueListenableBuilder<TextEditingValue>(
                            valueListenable: _passwordCtrl,
                            builder: (context, value, _) => _buildPasswordRequirements(value.text),
                          ),
                          const SizedBox(height: 12),
                          _buildInput(
                            controller: _confirmPasswordCtrl,
                            hint: 'Confirm Password',
                            isRequired: true,
                            obscureText: !_isConfirmPasswordVisible,
                            suffixIcon: IconButton(
                              icon: Icon(_isConfirmPasswordVisible ? Icons.visibility : Icons.visibility_off, color: Colors.black45),
                              onPressed: () => setState(() => _isConfirmPasswordVisible = !_isConfirmPasswordVisible),
                            ),
                            validator: (v) => v != _passwordCtrl.text ? "" : null,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),
                    SizedBox(
                      width: 200,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF5FA9A9),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                        ),
                        child: _isLoading
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                            : Text('Sign Up', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.black)),
                      ),
                    ),
                    const SizedBox(height: 24),
                    // RESTORED LOGIN NAVIGATION
                    RichText(
                      text: TextSpan(
                        text: 'Registered already? ',
                        style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black),
                        children: [
                          TextSpan(
                            text: 'Log in',
                            style: const TextStyle(
                              fontFamily: 'AlbertSans', 
                              fontWeight: FontWeight.w800, 
                              color: Colors.black,
                            ),
                            recognizer: TapGestureRecognizer()
                              ..onTap = () {
                                Navigator.pushAndRemoveUntil(
                                  context,
                                  MaterialPageRoute(builder: (context) => const LoginPage()),
                                  (route) => false,
                                );
                              },
                          ),
                          const TextSpan(text: ' instead.'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // [INTEGRATION] Sends the complete registration payload to POST /api/auth/register.
  // On success, navigates to the OTP verification page.
  // On failure, displays the backend's error message in a SnackBar.
  Future<void> _submit() async {
    setState(() => _submitted = true);
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    // Populate credentials into the RegistrationData model
    widget.registrationData.username = _usernameCtrl.text;
    widget.registrationData.password = _passwordCtrl.text;

    // [OWASP A05] Send the complete registration payload via parameterized API service.
    // requiresAuth: false -- no JWT needed for registration.
    final result = await ApiService.post(
      '/auth/register',
      body: widget.registrationData.toJson(),
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result['success'] == true) {
      // Backend returns { requiresOtp: true, user_id: ..., email: ... }
      // Navigate to OTP verification page with the returned identifiers.
      Navigator.of(context).pushReplacement(
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ?? 'Registration failed. Please try again.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}