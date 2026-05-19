import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Import API service and session management
import '../services/api_service.dart';
import '../models/user_session.dart';
import 'biometrics.dart';

class OTPVerificationPage extends StatefulWidget {
  // [OWASP A01] These fields are required for the API call to verify-otp.
  // They come from the registration or login response.
  final int userId;
  final String email;
  final String purpose;

  const OTPVerificationPage({
    super.key,
    required this.userId,
    required this.email,
    this.purpose = 'REGISTER_VERIFY',
  });

  @override
  State<OTPVerificationPage> createState() => _OTPVerificationPageState();
}

class _OTPVerificationPageState extends State<OTPVerificationPage> {
  static const int _otpLength = 6;

  final List<TextEditingController> _controllers =
      List.generate(_otpLength, (index) => TextEditingController());
  final List<FocusNode> _focusNodes =
      List.generate(_otpLength, (index) => FocusNode());

  bool _isLoading = false;
  bool _isResending = false;
  bool _isEmailSelected = true;

  @override
  void dispose() {
    for (var controller in _controllers) controller.dispose();
    for (var node in _focusNodes) node.dispose();
    super.dispose();
  }

  void _onCodeChanged(int index, String value) {
    if (value.length == 1 && index < _otpLength - 1) {
      _focusNodes[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  // [INTEGRATION] Calls POST /api/auth/verify-otp with the entered OTP code.
  // On success, saves the returned JWT session and navigates to the success page.
  Future<void> _verifyOTP() async {
    bool allFilled = _controllers.every((c) => c.text.isNotEmpty);

    if (!allFilled) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please enter the complete code.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.orangeAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    // Concatenate the 6 individual OTP digits into a single string
    final otpCode = _controllers.map((c) => c.text).join();

    // [OWASP A05] Parameterized API call -- no string concatenation in the request.
    final result = await ApiService.post(
      '/auth/verify-otp',
      body: {
        'user_id': widget.userId,
        'email': widget.email,
        'otp': otpCode,
        'purpose': widget.purpose,
      },
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result['success'] == true) {
      // [OWASP A07] Persist the JWT session securely
      if (result['token'] != null && result['user'] != null) {
        final session = UserSession.fromJson(result['user'], result['token']);
        await SessionManager.saveSession(session);
      }

      if (!mounted) return;

      // Navigate to the registration success page
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const RegistrationSuccessPage()),
      );
    } else {
      // [OWASP A10] Display the backend's error message.
      // Possible messages: "Invalid OTP code.", "OTP has expired.", "Too many invalid OTP attempts."
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ?? 'Verification failed. Please try again.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // [INTEGRATION] Calls POST /api/auth/resend-otp to request a new OTP code.
  // Handles rate-limiting (429) with a user-friendly cooldown message.
  Future<void> _resendCode() async {
    setState(() => _isResending = true);

    final result = await ApiService.post(
      '/auth/resend-otp',
      body: {
        'user_id': widget.userId,
        'email': widget.email,
        'purpose': widget.purpose,
      },
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isResending = false);

    // Clear the OTP boxes for the new code
    for (var controller in _controllers) {
      controller.clear();
    }
    if (_focusNodes.isNotEmpty) {
      _focusNodes[0].requestFocus();
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result['success'] == true
              ? 'A new verification code has been sent to your email.'
              : (result['message'] ?? 'Failed to resend code. Please try again.'),
          style: GoogleFonts.albertSans(),
        ),
        backgroundColor: result['success'] == true ? const Color(0xFF5FA9A9) : Colors.redAccent,
        behavior: SnackBarBehavior.floating,
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
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    _buildFolderTab("Email", true),
                    _buildFolderTab("Phone", false),
                  ],
                ),
                Expanded(
                  child: Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F5F0),
                      borderRadius: BorderRadius.only(
                        topLeft: _isEmailSelected
                            ? Radius.zero
                            : const Radius.circular(30),
                        topRight: _isEmailSelected
                            ? const Radius.circular(30)
                            : Radius.zero,
                      ),
                    ),
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        children: [
                          const SizedBox(height: 40),
                          Text(
                            'OTP Verification',
                            style: GoogleFonts.poppins(
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                              color: Colors.black,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _isEmailSelected
                                ? 'Enter the code sent to ${widget.email}.'
                                : 'Enter the code sent to your contact number.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontFamily: 'AlbertSans',
                              fontSize: 14,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 40),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: List.generate(
                                _otpLength, (index) => _buildOTPBox(index)),
                          ),
                          const SizedBox(height: 60),
                          SizedBox(
                            width: 220,
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _verifyOTP,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF5FA9A9),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(25)),
                                elevation: 2,
                              ),
                              child: _isLoading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2, color: Colors.black),
                                    )
                                  : Text(
                                      'Verify',
                                      style: GoogleFonts.poppins(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.black,
                                      ),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 30),
                          GestureDetector(
                            onTap: _isResending ? null : _resendCode,
                            child: _isResending
                                ? const SizedBox(
                                    height: 16,
                                    width: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.black54,
                                    ),
                                  )
                                : const Text.rich(
                                    TextSpan(
                                      text: "Didn't get the code? ",
                                      style: TextStyle(
                                        fontFamily: 'AlbertSans',
                                        fontSize: 14,
                                        color: Colors.black,
                                      ),
                                      children: [
                                        TextSpan(
                                          text: 'Resend.',
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            decoration: TextDecoration.underline,
                                          ),
                                        ),
                                      ],
                                    ),
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
          ),
        ],
      ),
    );
  }

  Widget _buildFolderTab(String label, bool isEmailTab) {
    bool isActive =
        (isEmailTab && _isEmailSelected) || (!isEmailTab && !_isEmailSelected);
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _isEmailSelected = isEmailTab),
        child: Container(
          height: 55,
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFFF5F5F0) : Colors.transparent,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(25),
              topRight: Radius.circular(25),
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 18,
              fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
              color: isActive ? Colors.black : Colors.white,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOTPBox(int index) {
    return SizedBox(
      width: 48,
      height: 48,
      child: TextField(
        controller: _controllers[index],
        focusNode: _focusNodes[index],
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        maxLength: 1,
        style: GoogleFonts.poppins(
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(
          counterText: '',
          filled: true,
          fillColor: const Color(0xFFF5F5F0),
          contentPadding: EdgeInsets.zero,
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(50),
            borderSide: const BorderSide(color: Colors.black54, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(50),
            borderSide: const BorderSide(color: Colors.black54, width: 2),
          ),
        ),
        onChanged: (v) => _onCodeChanged(index, v),
      ),
    );
  }
}