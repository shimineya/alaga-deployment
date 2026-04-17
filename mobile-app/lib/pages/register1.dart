import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:local_auth/local_auth.dart';
import 'role.dart'; 
import '../models/registration_data.dart';

class BiometricService {
  final LocalAuthentication _localAuth = LocalAuthentication();

  Future<bool> canCheckBiometrics() async {
    try {
      return await _localAuth.canCheckBiometrics;
    } catch (_) { return false; }
  }

  Future<bool> isDeviceSupported() async {
    try {
      return await _localAuth.isDeviceSupported();
    } catch (_) { return false; }
  }

  Future<bool> authenticate({required String reason}) async {
    try {
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
          useErrorDialogs: true,
        ),
      );
    } catch (e) {
      debugPrint("Auth Error: $e");
      return false;
    }
  }
}

class CreateCredentialsPage extends StatefulWidget {
  final RegistrationData registrationData;

  const CreateCredentialsPage({super.key, required this.registrationData});

  @override
  State<CreateCredentialsPage> createState() => _CreateCredentialsPageState();
}

class _CreateCredentialsPageState extends State<CreateCredentialsPage> {
  final _formKey = GlobalKey<FormState>();
  final BiometricService _biometricService = BiometricService();

  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmPasswordCtrl = TextEditingController();

  bool _isPasswordVisible = false;
  bool _isConfirmPasswordVisible = false;
  bool _isLoading = false;
  // 🔹 Logic to delay validation until Sign Up is pressed
  bool _submitted = false;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    super.dispose();
  }

  void _goToRoleSelection() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => RoleScreen(registrationData: widget.registrationData)),
        (route) => false,
      );
    });
  }

  Future<bool?> _showBiometricPrompt() {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Enable biometrics for easier log in?',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(dialogContext, true),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF5FA9A9)),
                  child: const Text('Enable', style: TextStyle(color: Colors.black)),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Skip', style: TextStyle(color: Colors.black54)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    // 🔹 Trigger validation visibility
    setState(() => _submitted = true);

    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    // Simulated registration step
    await Future.delayed(const Duration(seconds: 1));
    setState(() => _isLoading = false);

    if (!mounted) return;

    final canUseBiometrics = await _biometricService.canCheckBiometrics();
    
    if (canUseBiometrics) {
      bool? userChoice = await _showBiometricPrompt();
      if (userChoice == true) {
        try {
          await _biometricService.authenticate(
            reason: 'Scan to enable biometric login',
          ).timeout(const Duration(seconds: 10)); 
        } catch (e) {
          debugPrint("Biometric scan timeout: $e");
        }
      }
    }

    widget.registrationData.username = _usernameCtrl.text;
    widget.registrationData.password = _passwordCtrl.text;

    _goToRoleSelection();
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
              
              // Logo
              Center(
                child: Column(
                  children: [
                    Image.asset('assets/images/WELCOME.png', height: 80),
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
                'Register',
                style: GoogleFonts.poppins(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                ),
              ),
              
              const SizedBox(height: 4),
              
              const Text(
                'Complete all fields to continue.',
                style: TextStyle(
                  fontFamily: 'AlbertSans',
                  fontSize: 14,
                  color: Colors.black54,
                ),
              ),
              
              const SizedBox(height: 24),
              
              Form(
                key: _formKey,
                // 🔹 Match the interaction behavior from the previous page
                autovalidateMode: _submitted 
                    ? AutovalidateMode.onUserInteraction 
                    : AutovalidateMode.disabled,
                child: Column(
                  children: [
                    _buildInput(
                      controller: _usernameCtrl,
                      hint: 'Username',
                      isRequired: true,
                      validator: (v) => v!.isEmpty ? "" : null,
                    ),
                    const SizedBox(height: 12),
                    _buildPasswordInput(
                      controller: _passwordCtrl, 
                      hint: 'Password',
                      isRequired: true,
                      isVisible: _isPasswordVisible,
                      onToggle: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
                      validator: (v) => v!.length < 6 ? "" : null,
                    ),
                    const SizedBox(height: 12),
                    _buildPasswordInput(
                      controller: _confirmPasswordCtrl, 
                      hint: 'Confirm Password',
                      isRequired: true,
                      isVisible: _isConfirmPasswordVisible,
                      onToggle: () => setState(() => _isConfirmPasswordVisible = !_isConfirmPasswordVisible),
                      validator: (v) {
                        if (v!.isEmpty) return "";
                        if (v != _passwordCtrl.text) return "";
                        return null;
                      },
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 40),
              
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
              
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  // Common Decoration logic extracted to reuse design
  InputDecoration _getInputDecoration(String hint, bool isRequired, {Widget? suffix}) {
    return InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontFamily: 'AlbertSans', color: Colors.black38),
        errorStyle: const TextStyle(height: 0, fontSize: 0),
        suffixIcon: suffix,
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
                    TextSpan(text: ' *', style: TextStyle(color: Colors.red)),
                  ],
                ),
              )
            : null,
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
      );
  }

  Widget _buildInput({
    required TextEditingController controller,
    required String hint,
    required bool isRequired,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14),
      decoration: _getInputDecoration(hint, isRequired),
      validator: validator,
    );
  }

  Widget _buildPasswordInput({
    required TextEditingController controller,
    required String hint,
    required bool isRequired,
    required bool isVisible,
    required VoidCallback onToggle,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: !isVisible,
      style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14),
      decoration: _getInputDecoration(
        hint, 
        isRequired, 
        suffix: IconButton(
          icon: Icon(isVisible ? Icons.visibility : Icons.visibility_off, color: Colors.black54),
          onPressed: onToggle,
        ),
      ),
      validator: validator,
    );
  }
}