import 'package:flutter/material.dart';

import 'package:flutter/gestures.dart';

import 'package:google_fonts/google_fonts.dart';

import 'package:local_auth/local_auth.dart';

import 'role.dart';



class BiometricService {

  final LocalAuthentication _localAuth = LocalAuthentication();



  Future<bool> canCheckBiometrics() async {

    try {

      return await _localAuth.canCheckBiometrics;

    } catch (e) {

      return false;

    }

  }



  Future<bool> isDeviceSupported() async {

    try {

      return await _localAuth.isDeviceSupported();

    } catch (e) {

      return false;

    }

  }



  Future<List<BiometricType>> getAvailableBiometrics() async {

    try {

      return await _localAuth.getAvailableBiometrics();

    } catch (e) {

      return [];

    }

  }



  Future<bool> authenticate({required String reason}) async {

    try {

      await Future.delayed(const Duration(milliseconds: 300));

      return await _localAuth.authenticate(

        localizedReason: reason,

        options: const AuthenticationOptions(

          stickyAuth: true,

          biometricOnly: false,

          useErrorDialogs: true,

        ),

      );

    } catch (e) {

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

  bool _submitted = false;



  @override

  void dispose() {

    _usernameCtrl.dispose();

    _passwordCtrl.dispose();

    _confirmPasswordCtrl.dispose();

    super.dispose();

  }



  // --- UPDATED INPUT BUILDER: NORMAL WEIGHT TEXT ---

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

      style: const TextStyle(

        fontFamily: 'AlbertSans',

        fontSize: 14,

        color: Colors.black87,

        fontWeight: FontWeight.w400, // Regular weight as requested

      ),

      decoration: InputDecoration(

        suffixIcon: suffixIcon,

        errorStyle: const TextStyle(height: 0, fontSize: 0),

        // This creates the "floating on border" look from your reference

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

                      style: TextStyle(color: Colors.red),

                    ),

                  ],

                ),

              )

            : Text(hint, style: const TextStyle(fontFamily: 'AlbertSans', color: Colors.black38, fontSize: 14)),

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



  Future<void> _submit() async {

    setState(() => _submitted = true);

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

        _navigateToRoleScreen();

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

            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),

            child: Padding(

              padding: const EdgeInsets.all(24.0),

              child: Column(

                mainAxisSize: MainAxisSize.min,

                children: [

                  AnimatedSwitcher(

                    duration: const Duration(milliseconds: 400),

                    child: isSuccess

                        ? const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF5FA9A9), size: 80, key: ValueKey('success'))

                        : Image.asset('assets/images/WELCOME.png', height: 80, key: const ValueKey('logo')),

                  ),

                  const SizedBox(height: 24),

                  Text(

                    isSuccess ? 'Biometrics Enabled!' : 'Enable biometrics for easier log in?',

                    textAlign: TextAlign.center,

                    style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600),

                  ),

                  const SizedBox(height: 24),

                  if (!isSuccess) ...[

                    SizedBox(

                      width: double.infinity,

                      child: ElevatedButton(

                        onPressed: () async {

                          final authenticated = await _biometricService.authenticate(

                            reason: 'Scan your fingerprint to enable biometric login',

                          );

                          if (authenticated && mounted) {

                            setDialogState(() => isSuccess = true);

                            await Future.delayed(const Duration(milliseconds: 1500));

                            if (mounted) {

                              Navigator.pop(context);

                              _navigateToRoleScreen();

                            }

                          }

                        },

                        style: ElevatedButton.styleFrom(

                          backgroundColor: const Color(0xFF5FA9A9),

                          padding: const EdgeInsets.symmetric(vertical: 14),

                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),

                        ),

                        // UPDATED: Poppins Font for pop-up button

                        child: Text('Enable', style: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: Colors.black)),

                      ),

                    ),

                    const SizedBox(height: 12),

                    TextButton(

                      onPressed: () {

                        Navigator.pop(context);

                        _navigateToRoleScreen();

                      },

                      // UPDATED: Poppins Font for Skip text

                      child: Text('Skip', style: GoogleFonts.poppins(color: Colors.black87, fontWeight: FontWeight.w500)),

                    ),

                  ]

                ],

              ),

            ),

          );

        },

      ),

    );

  }



  void _navigateToRoleScreen() {

    if (!mounted) return;

    Navigator.of(context).pushReplacement(

      MaterialPageRoute(builder: (_) => const RoleScreen()),

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

                    const Text('Your partner in patient care.',

                        style: TextStyle(fontFamily: 'AlbertSans', fontSize: 14, fontStyle: FontStyle.italic, color: Colors.black54)),

                  ],

                ),

              ),

              const SizedBox(height: 40),

              Text('Register', style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w600, color: Colors.black87)),

              const SizedBox(height: 4),

              const Text('Complete all fields to continue.', style: TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black54)),

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

                      validator: (v) => v!.length < 6 ? "" : null,

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

              const SizedBox(height: 40),

              Center(

                child: SizedBox(

                  width: 200,

                  child: ElevatedButton(

                    onPressed: _isLoading ? null : _submit,

                    style: ElevatedButton.styleFrom(

                      backgroundColor: const Color(0xFF5FA9A9),

                      padding: const EdgeInsets.symmetric(vertical: 16),

                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),

                    ),

                    child: _isLoading

                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))

                      : Text('Sign Up',

                          style: GoogleFonts.poppins(

                            fontSize: 16,

                            fontWeight: FontWeight.w700,

                            color: Colors.black

                          )),

                  ),

                ),

              ),

              const SizedBox(height: 40),

              Center(

                child: RichText(

                  text: TextSpan(

                    text: 'Registered already? ',

                    style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black54),

                    children: [

                      TextSpan(

                        text: 'Log in',

                        style: const TextStyle(fontFamily: 'AlbertSans', fontWeight: FontWeight.bold, color: Colors.black),

                        recognizer: TapGestureRecognizer()..onTap = () {

                          // Navigator logic

                        },

                      ),

                      const TextSpan(text: ' instead.'),

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

}