import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'biometrics.dart'; // changed from biometrics/role
import '../services/api_service.dart';
import '../models/user_session.dart';

class OTPVerificationPage extends StatefulWidget {
  final int userId;
  final String email;

  const OTPVerificationPage({
    super.key,
    required this.userId,
    required this.email,
  });

  @override
  State<OTPVerificationPage> createState() => _OTPVerificationPageState();
}

class _OTPVerificationPageState extends State<OTPVerificationPage> {
  final List<TextEditingController> _controllers = List.generate(6, (index) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (index) => FocusNode());

  bool _isLoading = false;

  @override
  void dispose() {
    for (var controller in _controllers) controller.dispose();
    for (var node in _focusNodes) node.dispose();
    super.dispose();
  }

  void _onCodeChanged(int index, String value) {
    if (value.length == 1 && index < 5) {
      _focusNodes[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  Future<void> _verifyOTP() async {
    bool allFilled = _controllers.every((c) => c.text.isNotEmpty);

    if (!allFilled) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter the complete code')),
      );
      return;
    }

    setState(() => _isLoading = true);
    final otp = _controllers.map((c) => c.text).join();
    final result = await ApiService.post(
      '/auth/verify-otp',
      requiresAuth: false,
      body: {
        'user_id': widget.userId,
        'email': widget.email,
        'otp': otp,
        'purpose': 'REGISTER_VERIFY',
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
        MaterialPageRoute(builder: (context) => const RegistrationSuccessPage()),
      );
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result['message']?.toString() ?? 'Invalid OTP')),
    );
  }

  Future<void> _resendCode() async {
    final result = await ApiService.post(
      '/auth/resend-otp',
      requiresAuth: false,
      body: {
        'user_id': widget.userId,
        'email': widget.email,
        'purpose': 'REGISTER_VERIFY',
      },
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result['message']?.toString() ?? 'Unable to resend OTP')),
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
                'OTP Verification',
                style: GoogleFonts.poppins(fontSize: 24, fontWeight: FontWeight.w600, color: Colors.black),
              ),
              const SizedBox(height: 4),
              const Text(
                'Enter the code sent to your email address.',
                textAlign: TextAlign.center,
                style: TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black),
              ),
              const SizedBox(height: 8),
              Text(
                widget.email,
                textAlign: TextAlign.center,
                style: GoogleFonts.albertSans(fontSize: 12, color: Colors.black54),
              ),
              const SizedBox(height: 40),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(6, (index) {
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: 44,
                    height: 56,
                    child: TextField(
                      controller: _controllers[index],
                      focusNode: _focusNodes[index],
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      maxLength: 1,
                      style: GoogleFonts.poppins(fontSize: 24, fontWeight: FontWeight.w400, color: Colors.black),
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: InputDecoration(
                        counterText: '',
                        filled: true,
                        fillColor: const Color(0xFFF5F5F0),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Colors.black54, width: 1.5),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2),
                        ),
                      ),
                      onChanged: (value) => _onCodeChanged(index, value),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 40),
              Center(
                child: SizedBox(
                  width: 200,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _verifyOTP,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF5FA9A9),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                    ),
                    child: _isLoading
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                        : Text('Verify', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.black)),
                  ),
                ),
              ),
              const SizedBox(height: 40),
              Center(
                child: GestureDetector(
                  onTap: _resendCode,
                  child: RichText(
                    text: TextSpan(
                      text: 'Didn\'t get the code? ',
                      style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black),
                      children: [
                        TextSpan(
                          text: 'Resend.',
                          style: const TextStyle(fontFamily: 'AlbertSans', fontWeight: FontWeight.w800, color: Colors.black),
                        ),
                      ],
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
}