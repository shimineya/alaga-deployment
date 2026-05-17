import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// ==================== STEP 1: Enter Email ====================
class ForgotPasswordEmailPage extends StatefulWidget {
  const ForgotPasswordEmailPage({super.key});

  @override
  State<ForgotPasswordEmailPage> createState() => _ForgotPasswordEmailPageState();
}

class _ForgotPasswordEmailPageState extends State<ForgotPasswordEmailPage> {
  final TextEditingController _emailCtrl = TextEditingController();
  bool _isLoading = false;

  Future<void> _sendCode() async {
    if (!_emailCtrl.text.contains('@')) return;
    setState(() => _isLoading = true);
    await Future.delayed(const Duration(seconds: 2));
    setState(() => _isLoading = false);
    if (!mounted) return;

    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        opaque: false,
        pageBuilder: (_, __, ___) => ForgotPasswordOTPPage(email: _emailCtrl.text),
      ),
    );
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
  const ForgotPasswordOTPPage({super.key, required this.email});

  @override
  State<ForgotPasswordOTPPage> createState() => _ForgotPasswordOTPPageState();
}

class _ForgotPasswordOTPPageState extends State<ForgotPasswordOTPPage> {
  final List<TextEditingController> _controllers = List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(4, (_) => FocusNode());
  bool _isLoading = false;

  @override
  void dispose() {
    for (var c in _controllers) c.dispose();
    for (var f in _focusNodes) f.dispose();
    super.dispose();
  }

  void _onChanged(int index, String value) {
    if (value.length == 1 && index < 3) {
      _focusNodes[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  Future<void> _verify() async {
    setState(() => _isLoading = true);
    await Future.delayed(const Duration(seconds: 2));
    setState(() => _isLoading = false);
    if (!mounted) return;

    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        opaque: false,
        pageBuilder: (_, __, ___) => const ForgotPasswordResetPage(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _BlurredBackground(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Forgot Your Password?', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Text(
            'Enter the code sent to your email address',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(fontSize: 13, color: Colors.black),
          ),
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (i) => _buildOtpBox(i)),
          ),
          const SizedBox(height: 32),
          _buildButton('Continue', _isLoading ? null : _verify, _isLoading),
        ],
      ),
    );
  }

  Widget _buildOtpBox(int i) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8),
      width: 56,
      height: 56,
      child: TextField(
        controller: _controllers[i],
        focusNode: _focusNodes[i],
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        maxLength: 1,
        style: const TextStyle(fontSize: 24, color: Colors.black),
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(
          counterText: '',
          filled: true,
          fillColor: const Color(0xFFF5F5F0), // Dirty White
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Colors.black54, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2),
          ),
        ),
        onChanged: (v) => _onChanged(i, v),
      ),
    );
  }
}

// ==================== STEP 3: Reset Password ====================
class ForgotPasswordResetPage extends StatefulWidget {
  const ForgotPasswordResetPage({super.key});

  @override
  State<ForgotPasswordResetPage> createState() => _ForgotPasswordResetPageState();
}

class _ForgotPasswordResetPageState extends State<ForgotPasswordResetPage> {
  bool _isObscure = true;
  final TextEditingController _passCtrl = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return _BlurredBackground(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Welcome Back!', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Change your password to continue', style: GoogleFonts.poppins(fontSize: 13, color: Colors.black)),
          const SizedBox(height: 24),
          _buildTextField(
            _passCtrl,
            'New Password',
            isObscure: _isObscure,
            suffix: IconButton(
              icon: Icon(_isObscure ? Icons.visibility_off : Icons.visibility, size: 20, color: Colors.black38),
              onPressed: () => setState(() => _isObscure = !_isObscure),
            ),
          ),
          const SizedBox(height: 32),
          _buildButton('Continue', () => Navigator.of(context).popUntil((r) => r.isFirst), false),
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
              backgroundColor: const Color(0xFFF5F5F0), // Dialog Card Color
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

Widget _buildTextField(TextEditingController ctrl, String hint, {bool isObscure = false, Widget? suffix}) {
  return TextField(
    controller: ctrl,
    obscureText: isObscure,
    style: const TextStyle(fontSize: 14, color: Colors.black),
    decoration: InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: const Color(0xFFF5F5F0), // Dirty White
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
          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
          : Text(text, style: GoogleFonts.poppins(color: Colors.black, fontWeight: FontWeight.w600, fontSize: 16)),
    ),
  );
}