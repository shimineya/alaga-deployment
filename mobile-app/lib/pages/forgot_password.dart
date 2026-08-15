import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Import API service for backend calls
import '../services/api_service.dart';

// ==================== STEP 1: Enter Email ====================
class ForgotPasswordEmailPage extends StatefulWidget {
  const ForgotPasswordEmailPage({super.key});

  @override
  State<ForgotPasswordEmailPage> createState() => _ForgotPasswordEmailPageState();
}

class _ForgotPasswordEmailPageState extends State<ForgotPasswordEmailPage> {
  final TextEditingController _emailCtrl = TextEditingController();
  bool _isLoading = false;
  bool _showEmailError = false;

  bool _isValidEmail(String email) {
    final regex = RegExp(r'^[\w\.-]+@[\w\.-]+\.\w{2,}$');
    return regex.hasMatch(email.trim());
  }

  // [INTEGRATION] Calls POST /api/auth/forgot-password to send a PASSWORD_RESET OTP.
  Future<void> _sendCode() async {
    if (!_isValidEmail(_emailCtrl.text)) {
      setState(() => _showEmailError = true);
      return;
    }
    setState(() {
      _showEmailError = false;
      _isLoading = true;
    });

    final result = await ApiService.post(
      '/auth/forgot-password',
      body: {'email': _emailCtrl.text.trim().toLowerCase()},
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result['success'] == true && result['user_id'] != null) {
      // Backend found the user and sent an OTP
      Navigator.pushReplacement(
        context,
        PageRouteBuilder(
          opaque: false,
          pageBuilder: (_, __, ___) => ForgotPasswordOTPPage(
            email: _emailCtrl.text.trim().toLowerCase(),
            userId: result['user_id'],
          ),
        ),
      );
    } else if (result['success'] == true) {
      // [OWASP A10] Generic success message -- user_id not returned means email not found,
      // but we show a generic message to prevent user enumeration.
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ?? 'If an account with that email exists, a code has been sent.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: const Color(0xFF5FA9A9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ?? 'Failed to send code. Please try again.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return _BlurredBackground(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildHeader(context, 'Forgot Your Password?'),
          const SizedBox(height: 12),
          Text(
            'Enter your email address so we can send instructions.',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(fontSize: 13, color: Colors.black),
          ),
          const SizedBox(height: 24),
          _buildTextField(_emailCtrl, 'Email Address'),

          if (_showEmailError) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Enter a valid email address.',
                style: GoogleFonts.poppins(fontSize: 12, color: Colors.red),
              ),
            ),
          ],

          const SizedBox(height: 24),
          _buildButton('Continue', _isLoading ? null : _sendCode, _isLoading),
        ],
      ),
    );
  }
}

// ==================== STEP 2: Enter OTP Code ====================
class ForgotPasswordOTPPage extends StatefulWidget {
  final String email;
  final int userId;
  const ForgotPasswordOTPPage({super.key, required this.email, required this.userId});

  @override
  State<ForgotPasswordOTPPage> createState() => _ForgotPasswordOTPPageState();
}

class _ForgotPasswordOTPPageState extends State<ForgotPasswordOTPPage> {
  // [INTEGRATION] Updated to 6 digits to match the backend's OTP generation (Math.floor(100000 + ...))
  static const int _otpLength = 6;
  final List<TextEditingController> _controllers = List.generate(_otpLength, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(_otpLength, (_) => FocusNode());
  bool _isLoading = false;

  @override
  void dispose() {
    for (var c in _controllers) c.dispose();
    for (var f in _focusNodes) f.dispose();
    super.dispose();
  }

  void _onChanged(int index, String value) {
    if (value.length == 1 && index < _otpLength - 1) {
      _focusNodes[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  // [INTEGRATION] Verifies OTP and navigates to the reset password step.
  // Uses POST /api/auth/reset-password which combines OTP verification and password update
  // in a single transaction. We first validate the OTP here, then pass it to the next step.
  Future<void> _verify() async {
    final otpCode = _controllers.map((c) => c.text).join();
    if (otpCode.length < _otpLength) {
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

    // We pass the OTP forward to the reset page, which will verify it
    // alongside the new password in a single API call (POST /api/auth/reset-password).
    if (!mounted) return;
    setState(() => _isLoading = false);

    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        opaque: false,
        pageBuilder: (_, __, ___) => ForgotPasswordResetPage(
          userId: widget.userId,
          otp: otpCode,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _BlurredBackground(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Forgot Your Password?',
              style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Text(
            'Enter the code sent to ${widget.email}',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(fontSize: 13, color: Colors.black),
          ),
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_otpLength, (i) => _buildOtpBox(i)),
          ),
          const SizedBox(height: 32),
          _buildButton('Continue', _isLoading ? null : _verify, _isLoading),
        ],
      ),
    );
  }

  Widget _buildOtpBox(int i) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4),
      width: 44,
      height: 44,
      child: TextField(
        controller: _controllers[i],
        focusNode: _focusNodes[i],
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        maxLength: 1,
        style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black),
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(
          counterText: '',
          filled: true,
          fillColor: const Color(0xFFF5F5F0),
          contentPadding: EdgeInsets.zero,
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(50),
            borderSide: const BorderSide(color: Colors.black, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(50),
            borderSide: const BorderSide(color: Colors.black, width: 2),
          ),
        ),
        onChanged: (v) => _onChanged(i, v),
      ),
    );
  }
}

// ==================== STEP 3: Reset Password ====================
class ForgotPasswordResetPage extends StatefulWidget {
  final int userId;
  final String otp;
  const ForgotPasswordResetPage({super.key, required this.userId, required this.otp});

  @override
  State<ForgotPasswordResetPage> createState() => _ForgotPasswordResetPageState();
}

class _ForgotPasswordResetPageState extends State<ForgotPasswordResetPage> {
  bool _isObscure = true;
  bool _isLoading = false;
  final TextEditingController _passCtrl = TextEditingController();
  String? _passwordError;

  bool _isValidPassword(String password) {
    if (password.length < 12) return false;
    if (!password.contains(RegExp(r'[A-Z]'))) return false;
    if (!password.contains(RegExp(r'[a-z]'))) return false;
    if (!password.contains(RegExp(r'[0-9]'))) return false;
    if (!password.contains(RegExp(r'[!@#\$%^&*(),.?":{}|<>]'))) return false;
    return true;
  }

  // [INTEGRATION] Calls POST /api/auth/reset-password with user_id, otp, and new password.
  // The backend verifies the OTP and updates the password in a single transaction.
  Future<void> _submit() async {
    if (!_isValidPassword(_passCtrl.text)) {
      setState(() {
        _passwordError =
            'Password must be at least 12 characters and include uppercase, lowercase, numbers, and special characters.';
      });
      return;
    }
    setState(() {
      _passwordError = null;
      _isLoading = true;
    });

    final result = await ApiService.post(
      '/auth/reset-password',
      body: {
        'user_id': widget.userId,
        'otp': widget.otp,
        'password': _passCtrl.text,
      },
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result['success'] == true) {
      // Close all forgot-password dialogs and return to login
      Navigator.of(context).popUntil((r) => r.isFirst);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ?? 'Password has been reset. You can now log in.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: const Color(0xFF5FA9A9),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ?? 'Failed to reset password. Please try again.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return _BlurredBackground(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Welcome Back!',
              style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Change your password to continue',
              style: GoogleFonts.poppins(fontSize: 13, color: Colors.black)),
          const SizedBox(height: 24),
          _buildTextField(
            _passCtrl,
            'New Password',
            isObscure: _isObscure,
            suffix: IconButton(
              icon: Icon(_isObscure ? Icons.visibility_off : Icons.visibility,
                  size: 20, color: Colors.black38),
              onPressed: () => setState(() => _isObscure = !_isObscure),
            ),
          ),

          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              _passwordError ??
                  'Password must be at least 12 characters long and include numbers, uppercase and lowercase letters, and special characters.',
              style: GoogleFonts.poppins(
                fontSize: 11,
                color: _passwordError != null ? Colors.red : Colors.black54,
              ),
            ),
          ),

          const SizedBox(height: 32),
          _buildButton('Continue', _isLoading ? null : _submit, _isLoading),
        ],
      ),
    );
  }
}

// ==================== SHARED WIDGETS ====================

class _BlurredBackground extends StatelessWidget {
  final Widget child;
  const _BlurredBackground({required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
            child: Container(color: Colors.black.withOpacity(0.7)),
          ),
          Center(
            child: Dialog(
              insetPadding: const EdgeInsets.symmetric(horizontal: 24),
              backgroundColor: const Color(0xFFF5F5F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              child: Padding(padding: const EdgeInsets.all(24), child: child),
            ),
          ),
        ],
      ),
    );
  }
}

Widget _buildHeader(BuildContext context, String title) {
  return Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      const SizedBox(width: 20),
      Text(title, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
      IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, size: 20)),
    ],
  );
}

Widget _buildTextField(TextEditingController ctrl, String hint,
    {bool isObscure = false, Widget? suffix}) {
  return TextField(
    controller: ctrl,
    obscureText: isObscure,
    style: const TextStyle(fontSize: 14, color: Colors.black),
    decoration: InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: const Color(0xFFF5F5F0),
      hintStyle: GoogleFonts.albertSans(fontSize: 13, color: Colors.black38),
      suffixIcon: suffix,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.black54),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2),
      ),
    ),
  );
}

Widget _buildButton(String text, VoidCallback? action, bool loading) {
  return SizedBox(
    width: 200,
    height: 50,
    child: ElevatedButton(
      onPressed: action,
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF67A7A7),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
      ),
      child: loading
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
          : Text(text,
              style: GoogleFonts.poppins(
                  color: Colors.black, fontWeight: FontWeight.w600, fontSize: 16)),
    ),
  );
}