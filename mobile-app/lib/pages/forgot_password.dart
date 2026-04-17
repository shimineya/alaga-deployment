import 'dart:ui';
import 'package:flutter/material.dart';
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
            'Enter your email address so we can send instructions',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(fontSize: 13, color: Colors.black54),
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
  bool _isLoading = false;

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
          Text('Enter the code sent to your email address',
              textAlign: TextAlign.center, style: GoogleFonts.poppins(fontSize: 13, color: Colors.black54)),
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: List.generate(4, (i) => _buildOtpBox(i)),
          ),
          const SizedBox(height: 32),
          _buildButton('Continue', _isLoading ? null : _verify, _isLoading),
        ],
      ),
    );
  }

  Widget _buildOtpBox(int i) {
    return SizedBox(
      width: 50, height: 50,
      child: TextField(
        controller: _controllers[i],
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        maxLength: 1,
        // Using Albert Sans for the numbers as well
        style: GoogleFonts.albertSans(fontSize: 20, fontWeight: FontWeight.w600, color: Colors.black),
        decoration: InputDecoration(
          counterText: '', filled: true, fillColor: Colors.white,
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.black12)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2)),
        ),
        onChanged: (v) => (v.isNotEmpty && i < 3) ? FocusScope.of(context).nextFocus() : null,
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

  @override
  Widget build(BuildContext context) {
    return _BlurredBackground(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Welcome Back!', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Change your password to continue', style: GoogleFonts.poppins(fontSize: 13, color: Colors.black54)),
          const SizedBox(height: 24),
          _buildTextField(
            TextEditingController(), 
            'Password', 
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

Widget _buildTextField(TextEditingController ctrl, String hint, {bool isObscure = false, Widget? suffix}) {
  return TextField(
    controller: ctrl,
    obscureText: isObscure,
    style: GoogleFonts.albertSans(fontSize: 14, color: Colors.black),
    decoration: InputDecoration(
      hintText: hint, 
      filled: true, 
      fillColor: Colors.white,
      hintStyle: GoogleFonts.albertSans(fontSize: 13, color: Colors.black38),
      suffixIcon: suffix,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.black12)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2)),
    ),
  );
}

Widget _buildButton(String text, VoidCallback? action, bool loading) {
  return SizedBox(
    width: 200, height: 50,
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