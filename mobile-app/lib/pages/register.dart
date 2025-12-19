import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'otp.dart';

/// Fake Auth Service (Option 2)
class AuthService {
  Future<bool> register({
    required String firstName,
    required String lastName,
    required String email,
  }) async {
    await Future.delayed(const Duration(seconds: 2)); // fake API delay
    return true; // always success for now
  }
}

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _authService = AuthService();

  final TextEditingController _firstNameCtrl = TextEditingController();
  final TextEditingController _lastNameCtrl = TextEditingController();
  final TextEditingController _middleCtrl = TextEditingController();
  final TextEditingController _emailCtrl = TextEditingController();

  bool _isLoading = false;

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

              // Logo + Mascot
              Center(
                child: Column(
                  children: [
                    Image.asset(
                      'assets/images/WELCOME.png',
                      height: 80,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Your partner in patient care.',
                      style: const TextStyle(
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

              // Register title
              Text(
                'Register',
                style: GoogleFonts.poppins(
                  fontSize: 28,
                  fontWeight: FontWeight.w600, // SemiBold
                  color: Colors.black,
                ),
              ),

              const SizedBox(height: 4),

              Text(
                'Complete all fields to continue.',
                style: const TextStyle(
                  fontFamily: 'AlbertSans',
                  fontSize: 14,
                  color: Colors.black54,
                ),
              ),

              const SizedBox(height: 24),

              // Form
              Form(
                key: _formKey,
                child: Column(
                  children: [
                    _buildInput(
                      controller: _firstNameCtrl,
                      hint: 'First Name',
                      isRequired: true,
                      isNameField: true,
                      validator: (v) =>
                          v!.isEmpty ? 'First name required' : null,
                    ),
                    const SizedBox(height: 12),
                    _buildInput(
                      controller: _lastNameCtrl,
                      hint: 'Last Name',
                      isRequired: true,
                      isNameField: true,
                      validator: (v) =>
                          v!.isEmpty ? 'Last name required' : null,
                    ),
                    const SizedBox(height: 12),
                    _buildInput(
                      controller: _middleCtrl,
                      hint: 'Middle Initial',
                      isRequired: false,
                      isNameField: true,
                    ),
                    const SizedBox(height: 12),
                    _buildInput(
                      controller: _emailCtrl,
                      hint: 'Email Address',
                      isRequired: true,
                      keyboardType: TextInputType.emailAddress,
                      validator: (v) =>
                          v!.contains('@') ? null : 'Enter valid email',
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 40),

              // Sign Up Button (shorter width)
              Center(
                child: SizedBox(
                  width: 200,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _submit,
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
                            'Sign Up',
                            style: GoogleFonts.poppins(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Colors.black,
                            ),
                          ),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Login text
              Center(
                child: RichText(
                  text: TextSpan(
                    text: 'Registered already? ',
                    style: const TextStyle(
                      fontFamily: 'AlbertSans',
                      fontSize: 14,
                      color: Colors.black54,
                    ),
                    children: [
                      TextSpan(
                        text: 'Log in',
                        style: const TextStyle(
                          fontFamily: 'AlbertSans',
                          fontWeight: FontWeight.w600,
                          color: Colors.black,
                        ),
                      ),
                      const TextSpan(
                        text: ' instead.',
                        style: TextStyle(
                          fontFamily: 'AlbertSans',
                          fontSize: 14,
                          color: Colors.black54,
                        ),
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
    required bool isRequired,
    bool isNameField = false,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      validator: validator,
      inputFormatters: isNameField
          ? [
              FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z\s]')),
            ]
          : null,
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
        label: isRequired
            ? RichText(
                text: TextSpan(
                  text: hint,
                  style: const TextStyle(
                    fontFamily: 'AlbertSans',
                    color: Colors.black38,
                    fontSize: 14,
                  ),
                  children: const [
                    TextSpan(
                      text: ' *',
                      style: TextStyle(
                        color: Colors.red,
                      ),
                    ),
                  ],
                ),
              )
            : null,
        filled: true,
        fillColor: const Color(0xFFF5F5F0),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.black54),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.black),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final success = await _authService.register(
      firstName: _firstNameCtrl.text,
      lastName: _lastNameCtrl.text,
      email: _emailCtrl.text,
    );

    setState(() => _isLoading = false);

    if (success && mounted) {
      // Navigate to OTP Verification page
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const OTPVerificationPage()),
      );
    }
  }
}