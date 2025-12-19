import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:local_auth/local_auth.dart';

class BiometricService {
  final LocalAuthentication _localAuth = LocalAuthentication();

  Future<bool> canCheckBiometrics() async {
    try {
      return await _localAuth.canCheckBiometrics;
    } catch (e) {
      print('Error checking biometrics: $e');
      return false;
    }
  }

  Future<bool> isDeviceSupported() async {
    try {
      return await _localAuth.isDeviceSupported();
    } catch (e) {
      print('Error checking device support: $e');
      return false;
    }
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } catch (e) {
      print('Error getting available biometrics: $e');
      return [];
    }
  }

  Future<bool> authenticate({required String reason}) async {
    try {
      await Future.delayed(const Duration(milliseconds: 300));

      final bool didAuthenticate = await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false,
          useErrorDialogs: true,
        ),
      );
      return didAuthenticate;
    } catch (e) {
      print('Biometric authentication error: $e');
      return false;
    }
  }
}

class CreateCredentialsPage extends StatefulWidget {
  const CreateCredentialsPage({super.key});

  @override
  State<CreateCredentialsPage> createState() => _CreateCredentialsPageState();
}

class _CreateCredentialsPageState extends State<CreateCredentialsPage> {
  final _formKey = GlobalKey<FormState>();
  final BiometricService _biometricService = BiometricService();

  final TextEditingController _usernameCtrl = TextEditingController();
  final TextEditingController _passwordCtrl = TextEditingController();
  final TextEditingController _confirmPasswordCtrl = TextEditingController();

  bool _isPasswordVisible = false;
  bool _isConfirmPasswordVisible = false;
  bool _isLoading = false;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_passwordCtrl.text != _confirmPasswordCtrl.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Passwords do not match')),
      );
      return;
    }

    setState(() => _isLoading = true);
    await Future.delayed(const Duration(seconds: 2));
    setState(() => _isLoading = false);

    if (mounted) {
      final canUseBiometrics = await _biometricService.canCheckBiometrics();
      final isSupported = await _biometricService.isDeviceSupported();
      final availableBiometrics = await _biometricService.getAvailableBiometrics();

      if (canUseBiometrics && isSupported && availableBiometrics.isNotEmpty) {
        _showBiometricPrompt();
      } else {
        _navigateToHome();
      }
    }
  }

  void _showBiometricPrompt() {
    bool isSuccess = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          return Dialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Success/Logo animation switcher
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 400),
                    child: isSuccess
                        ? const Icon(
                            Icons.check_circle_outline_rounded,
                            color: Color(0xFF5FA9A9),
                            size: 80,
                            key: ValueKey('success_icon'),
                          )
                        : Image.asset(
                            'assets/images/WELCOME.png',
                            height: 80,
                            key: const ValueKey('logo_image'),
                          ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    isSuccess 
                        ? 'Biometrics Enabled!' 
                        : 'Enable biometrics for easier log in?',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.black,
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  // Hide buttons if success is achieved
                  if (!isSuccess) ...[
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          final authenticated = await _biometricService.authenticate(
                            reason: 'Scan your fingerprint to enable biometric login',
                          );

                          if (authenticated && mounted) {
                            // Update internal dialog state to show checkmark
                            setDialogState(() => isSuccess = true);
                            
                            // Let the user see the success icon for 1.5 seconds
                            await Future.delayed(const Duration(milliseconds: 1500));
                            
                            if (mounted) {
                              Navigator.pop(context);
                              _navigateToHome();
                            }
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF5FA9A9),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          'Enable',
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.black,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton(
                        onPressed: () {
                          Navigator.pop(context);
                          _navigateToHome();
                        },
                        child: Text(
                          'Skip',
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                    ),
                  ] else ...[
                    // Small message while waiting for navigation
                    const Text(
                      'Setting up your account...',
                      style: TextStyle(color: Colors.black38, fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _navigateToHome() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Account created successfully!')),
    );
    // Navigator.pushReplacement(...)
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
                  color: Colors.black,
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
                child: Column(
                  children: [
                    _buildInput(
                      controller: _usernameCtrl,
                      hint: 'Username',
                      isRequired: true,
                      validator: (v) => v!.isEmpty ? 'Username required' : null,
                    ),
                    const SizedBox(height: 12),
                    _buildPasswordInput(
                      controller: _passwordCtrl,
                      hint: 'Password',
                      isRequired: true,
                      isVisible: _isPasswordVisible,
                      onToggleVisibility: () {
                        setState(() => _isPasswordVisible = !_isPasswordVisible);
                      },
                      validator: (v) {
                        if (v!.isEmpty) return 'Password required';
                        if (v.length < 6) return 'At least 6 characters';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    _buildPasswordInput(
                      controller: _confirmPasswordCtrl,
                      hint: 'Confirm Password',
                      isRequired: false,
                      isVisible: _isConfirmPasswordVisible,
                      onToggleVisibility: () {
                        setState(() => _isConfirmPasswordVisible = !_isConfirmPasswordVisible);
                      },
                      validator: (v) => v!.isEmpty ? 'Confirm password' : null,
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
                            height: 20, width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
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

  // Your existing helper builders
  Widget _buildInput({required TextEditingController controller, required String hint, required bool isRequired, String? Function(String?)? validator}) {
    return TextFormField(
      controller: controller,
      validator: validator,
      decoration: InputDecoration(
        hintText: hint,
        label: isRequired ? Text('$hint *') : null,
        filled: true,
        fillColor: const Color(0xFFF5F5F0),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Widget _buildPasswordInput({required TextEditingController controller, required String hint, required bool isRequired, required bool isVisible, required VoidCallback onToggleVisibility, String? Function(String?)? validator}) {
    return TextFormField(
      controller: controller,
      obscureText: !isVisible,
      validator: validator,
      decoration: InputDecoration(
        hintText: hint,
        label: Text(hint),
        filled: true,
        fillColor: const Color(0xFFF5F5F0),
        suffixIcon: IconButton(
          icon: Icon(isVisible ? Icons.visibility : Icons.visibility_off),
          onPressed: onToggleVisibility,
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}