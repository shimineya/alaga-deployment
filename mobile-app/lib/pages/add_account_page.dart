import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';

class AddAccountPage extends StatefulWidget {
  const AddAccountPage({super.key});

  @override
  State<AddAccountPage> createState() => _AddAccountPageState();
}

class _AddAccountPageState extends State<AddAccountPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Login Form
  final _loginFormKey = GlobalKey<FormState>();
  final _loginUserCtrl = TextEditingController();
  final _loginPassCtrl = TextEditingController();
  bool _obscureLoginPass = true;
  bool _isLoggingIn = false;
  String? _loginError;

  // Register Form
  final _regFormKey = GlobalKey<FormState>();
  final _regFirstNameCtrl = TextEditingController();
  final _regLastNameCtrl = TextEditingController();
  final _regEmailCtrl = TextEditingController();
  final _regUsernameCtrl = TextEditingController();
  final _regPhoneCtrl = TextEditingController();
  final _regPassCtrl = TextEditingController();
  bool _obscureRegPass = true;
  bool _isRegistering = false;
  String? _regError;
  String _selectedRole = 'caregiver'; // 'caregiver' or 'parent'

  // OTP Verification Mode
  bool _isVerifyingOtp = false;
  int? _otpUserId;
  String _otpEmail = '';
  String _otpPurpose = 'REGISTER_VERIFY';
  final TextEditingController _otpCtrl = TextEditingController();
  bool _isSubmittingOtp = false;
  bool _isResendingOtp = false;
  String? _otpError;

  static const Color _teal = Color(0xFF0D9488);
  static const Color _tealLight = Color(0xFFE6FFFA);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _regPassCtrl.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginUserCtrl.dispose();
    _loginPassCtrl.dispose();
    _regFirstNameCtrl.dispose();
    _regLastNameCtrl.dispose();
    _regEmailCtrl.dispose();
    _regUsernameCtrl.dispose();
    _regPhoneCtrl.dispose();
    _regPassCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  // --- Password Criteria Helpers ---
  bool get _hasMinLength => _regPassCtrl.text.length >= 12;
  bool get _hasUpper => RegExp(r'[A-Z]').hasMatch(_regPassCtrl.text);
  bool get _hasLower => RegExp(r'[a-z]').hasMatch(_regPassCtrl.text);
  bool get _hasNumber => RegExp(r'[0-9]').hasMatch(_regPassCtrl.text);
  bool get _hasSymbol => RegExp(r'[^A-Za-z0-9]').hasMatch(_regPassCtrl.text);
  bool get _isPasswordValid =>
      _hasMinLength && _hasUpper && _hasLower && _hasNumber && _hasSymbol;

  Future<void> _handleLogin() async {
    if (!_loginFormKey.currentState!.validate()) return;
    setState(() {
      _isLoggingIn = true;
      _loginError = null;
    });

    final username = _loginUserCtrl.text.trim();
    final password = _loginPassCtrl.text;

    final result = await ApiService.post(
      '/auth/login',
      body: {'username': username, 'password': password},
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isLoggingIn = false);

    if (result['success'] == true && result['user'] != null && result['token'] != null) {
      final newSession = UserSession.fromJson(result['user'], result['token']);
      await SessionManager.addSavedAccount(newSession);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Account @${newSession.username} added to device!',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: _teal,
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.pop(context, true);
    } else if (result['requiresOtp'] == true && result['user_id'] != null) {
      // User registered previously but hasn't verified email
      setState(() {
        _isVerifyingOtp = true;
        _otpUserId = result['user_id'];
        _otpEmail = result['email'] ?? username;
        _otpPurpose = result['otpPurpose'] ?? 'REGISTER_VERIFY';
        _otpError = null;
      });
    } else {
      setState(() {
        _loginError = result['message'] ?? 'Login failed. Please check your credentials.';
      });
    }
  }

  Future<void> _handleRegister() async {
    if (!_regFormKey.currentState!.validate()) return;

    if (!_isPasswordValid) {
      setState(() {
        _regError = 'Password does not meet all required criteria.';
      });
      return;
    }

    setState(() {
      _isRegistering = true;
      _regError = null;
    });

    final body = {
      'first_name': _regFirstNameCtrl.text.trim(),
      'last_name': _regLastNameCtrl.text.trim(),
      'email': _regEmailCtrl.text.trim().toLowerCase(),
      'username': _regUsernameCtrl.text.trim().isNotEmpty
          ? _regUsernameCtrl.text.trim()
          : _regEmailCtrl.text.trim().split('@')[0],
      'mobile_number': _regPhoneCtrl.text.trim(),
      'password': _regPassCtrl.text,
      'role': _selectedRole,
      'has_facility': false,
    };

    final result = await ApiService.post(
      '/auth/register',
      body: body,
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isRegistering = false);

    if (result['success'] == true) {
      // Backend sent OTP email and requires OTP verification
      if (result['requiresOtp'] == true || result['user_id'] != null) {
        setState(() {
          _isVerifyingOtp = true;
          _otpUserId = result['user_id'];
          _otpEmail = result['email'] ?? _regEmailCtrl.text.trim();
          _otpPurpose = result['otpPurpose'] ?? 'REGISTER_VERIFY';
          _otpError = null;
        });
      } else if (result['user'] != null && result['token'] != null) {
        final newSession = UserSession.fromJson(result['user'], result['token']);
        await SessionManager.addSavedAccount(newSession);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'New account @${newSession.username} registered and linked!',
              style: GoogleFonts.albertSans(),
            ),
            backgroundColor: _teal,
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.pop(context, true);
      }
    } else {
      setState(() {
        _regError = result['message'] ?? 'Registration failed. Please check inputs.';
      });
    }
  }

  Future<void> _handleVerifyOtp() async {
    final otp = _otpCtrl.text.trim();
    if (otp.length < 6) {
      setState(() => _otpError = 'Please enter the complete 6-digit code.');
      return;
    }

    setState(() {
      _isSubmittingOtp = true;
      _otpError = null;
    });

    final result = await ApiService.post(
      '/auth/verify-otp',
      body: {
        'user_id': _otpUserId,
        'email': _otpEmail,
        'otp': otp,
        'purpose': _otpPurpose,
      },
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isSubmittingOtp = false);

    if (result['success'] == true && result['user'] != null && result['token'] != null) {
      final newSession = UserSession.fromJson(result['user'], result['token']);
      await SessionManager.addSavedAccount(newSession);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Account @${newSession.username} verified & added to device!',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: _teal,
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.pop(context, true);
    } else {
      setState(() {
        _otpError = result['message'] ?? 'Invalid verification code. Please try again.';
      });
    }
  }

  Future<void> _handleResendOtp() async {
    if (_otpUserId == null) return;
    setState(() {
      _isResendingOtp = true;
      _otpError = null;
    });

    final result = await ApiService.post(
      '/auth/resend-otp',
      body: {
        'user_id': _otpUserId,
        'email': _otpEmail,
        'purpose': _otpPurpose,
      },
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isResendingOtp = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result['message'] ?? 'A new verification code has been sent.',
          style: GoogleFonts.albertSans(),
        ),
        backgroundColor: result['success'] == true ? _teal : Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1E293B)),
          onPressed: () {
            if (_isVerifyingOtp) {
              setState(() => _isVerifyingOtp = false);
            } else {
              Navigator.pop(context, false);
            }
          },
        ),
        title: Text(
          _isVerifyingOtp ? "Verify Email" : "Add Another Account",
          style: GoogleFonts.poppins(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF1E293B),
          ),
        ),
        bottom: _isVerifyingOtp
            ? null
            : TabBar(
                controller: _tabController,
                labelColor: _teal,
                unselectedLabelColor: const Color(0xFF64748B),
                indicatorColor: _teal,
                indicatorWeight: 3,
                labelStyle: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600),
                tabs: const [
                  Tab(text: "Log In"),
                  Tab(text: "Sign Up"),
                ],
              ),
      ),
      body: _isVerifyingOtp
          ? _buildOtpVerificationView()
          : TabBarView(
              controller: _tabController,
              children: [
                _buildLoginForm(),
                _buildRegisterForm(),
              ],
            ),
    );
  }

  // --- OTP Verification View ---
  Widget _buildOtpVerificationView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 56),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: _teal.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.mark_email_read_outlined, size: 32, color: _teal),
          ),
          const SizedBox(height: 16),
          Text(
            "Verify Your Email",
            style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: const Color(0xFF1E293B)),
          ),
          const SizedBox(height: 6),
          Text(
            "We have sent a 6-digit verification code to:\n$_otpEmail",
            textAlign: TextAlign.center,
            style: GoogleFonts.albertSans(fontSize: 13, color: const Color(0xFF64748B), height: 1.4),
          ),
          const SizedBox(height: 24),

          if (_otpError != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFF87171)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _otpError!,
                      style: GoogleFonts.albertSans(color: Colors.red.shade900, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // OTP Code Textbox
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _teal, width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: _teal.withValues(alpha: 0.08),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: TextField(
              controller: _otpCtrl,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              maxLength: 6,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: GoogleFonts.spaceMono(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: 14,
                color: const Color(0xFF0F172A),
              ),
              decoration: const InputDecoration(
                hintText: "••••••",
                hintStyle: TextStyle(letterSpacing: 14, color: Colors.black26),
                border: InputBorder.none,
                counterText: "",
              ),
            ),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _isSubmittingOtp ? null : _handleVerifyOtp,
              style: ElevatedButton.styleFrom(
                backgroundColor: _teal,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 1,
              ),
              child: _isSubmittingOtp
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text("Verify & Link Account", style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600)),
            ),
          ),
          const SizedBox(height: 12),

          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                "Didn't receive the code? ",
                style: GoogleFonts.albertSans(fontSize: 12, color: const Color(0xFF64748B)),
              ),
              TextButton(
                onPressed: _isResendingOtp ? null : _handleResendOtp,
                child: Text(
                  _isResendingOtp ? "Sending..." : "Resend Code",
                  style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: _teal),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          TextButton.icon(
            onPressed: () => setState(() => _isVerifyingOtp = false),
            icon: const Icon(Icons.arrow_back, size: 16, color: Color(0xFF64748B)),
            label: Text("Back to Sign Up", style: GoogleFonts.albertSans(fontSize: 12, color: const Color(0xFF64748B))),
          ),
        ],
      ),
    );
  }

  // --- Login Form ---
  Widget _buildLoginForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: _loginFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _tealLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _teal.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, color: _teal, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "Log in with another account. You will remain logged into your current account and can switch anytime.",
                      style: GoogleFonts.albertSans(fontSize: 12, color: const Color(0xFF0F766E)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            if (_loginError != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFF87171)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _loginError!,
                        style: GoogleFonts.albertSans(color: Colors.red.shade900, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            Text("Username or Email", style: GoogleFonts.albertSans(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _loginUserCtrl,
              decoration: InputDecoration(
                hintText: "Enter username or email",
                prefixIcon: const Icon(Icons.person_outline, size: 20, color: _teal),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _teal, width: 2)),
              ),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter username or email' : null,
            ),
            const SizedBox(height: 16),

            Text("Password", style: GoogleFonts.albertSans(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _loginPassCtrl,
              obscureText: _obscureLoginPass,
              decoration: InputDecoration(
                hintText: "Enter password",
                prefixIcon: const Icon(Icons.lock_outline, size: 20, color: _teal),
                suffixIcon: IconButton(
                  icon: Icon(_obscureLoginPass ? Icons.visibility_off : Icons.visibility, size: 20, color: Colors.grey),
                  onPressed: () => setState(() => _obscureLoginPass = !_obscureLoginPass),
                ),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _teal, width: 2)),
              ),
              validator: (v) => (v == null || v.isEmpty) ? 'Please enter your password' : null,
            ),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: _isLoggingIn ? null : _handleLogin,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _teal,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 1,
                ),
                icon: _isLoggingIn
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.person_add_alt_1, size: 18),
                label: Text(
                  _isLoggingIn ? "Adding Account..." : "Log In & Add Account",
                  style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- Register Form ---
  Widget _buildRegisterForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 56),
      child: Form(
        key: _regFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _tealLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _teal.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.person_add_alt, color: _teal, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "Create a new profile. An email OTP verification code will be sent to confirm and link this account.",
                      style: GoogleFonts.albertSans(fontSize: 12, color: const Color(0xFF0F766E)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            if (_regError != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFF87171)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _regError!,
                        style: GoogleFonts.albertSans(color: Colors.red.shade900, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Role Selector
            Text("Select Account Role", style: GoogleFonts.albertSans(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _selectedRole = 'caregiver'),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                      decoration: BoxDecoration(
                        color: _selectedRole == 'caregiver' ? _tealLight : Colors.white,
                        border: Border.all(
                          color: _selectedRole == 'caregiver' ? _teal : const Color(0xFFE2E8F0),
                          width: _selectedRole == 'caregiver' ? 2 : 1,
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        children: [
                          Icon(Icons.healing, color: _selectedRole == 'caregiver' ? _teal : Colors.grey, size: 22),
                          const SizedBox(height: 4),
                          Text("Caregiver", style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: _selectedRole == 'caregiver' ? _teal : Colors.grey.shade700)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _selectedRole = 'parent'),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                      decoration: BoxDecoration(
                        color: _selectedRole == 'parent' ? _tealLight : Colors.white,
                        border: Border.all(
                          color: _selectedRole == 'parent' ? _teal : const Color(0xFFE2E8F0),
                          width: _selectedRole == 'parent' ? 2 : 1,
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        children: [
                          Icon(Icons.family_restroom, color: _selectedRole == 'parent' ? _teal : Colors.grey, size: 22),
                          const SizedBox(height: 4),
                          Text("Parent / Guardian", style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: _selectedRole == 'parent' ? _teal : Colors.grey.shade700)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // First & Last Name
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("First Name", style: GoogleFonts.albertSans(fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      TextFormField(
                        controller: _regFirstNameCtrl,
                        decoration: _inputDeco("First name"),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Last Name", style: GoogleFonts.albertSans(fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      TextFormField(
                        controller: _regLastNameCtrl,
                        decoration: _inputDeco("Last name"),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            Text("Email", style: GoogleFonts.albertSans(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            TextFormField(
              controller: _regEmailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: _inputDeco("Enter email", icon: Icons.email_outlined),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Email is required';
                if (!v.contains('@')) return 'Enter a valid email';
                return null;
              },
            ),
            const SizedBox(height: 14),

            Text("Username", style: GoogleFonts.albertSans(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            TextFormField(
              controller: _regUsernameCtrl,
              decoration: _inputDeco("Desired username", icon: Icons.alternate_email),
            ),
            const SizedBox(height: 14),

            Text("Mobile Number", style: GoogleFonts.albertSans(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            TextFormField(
              controller: _regPhoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: _inputDeco("+63 912 345 6789", icon: Icons.phone_outlined),
            ),
            const SizedBox(height: 14),

            Text("Password", style: GoogleFonts.albertSans(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            TextFormField(
              controller: _regPassCtrl,
              obscureText: _obscureRegPass,
              decoration: InputDecoration(
                hintText: "Enter password",
                prefixIcon: const Icon(Icons.lock_outline, size: 20, color: _teal),
                suffixIcon: IconButton(
                  icon: Icon(_obscureRegPass ? Icons.visibility_off : Icons.visibility, size: 20, color: Colors.grey),
                  onPressed: () => setState(() => _obscureRegPass = !_obscureRegPass),
                ),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _teal, width: 2)),
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Password is required';
                if (!_isPasswordValid) return 'Password does not meet all criteria';
                return null;
              },
            ),

            // --- Password Criteria Validation Box (Fully Visible, Not Cropped) ---
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: _isPasswordValid ? Colors.green.shade300 : const Color(0xFFCBD5E1),
                  width: 1,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "Password Requirements",
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF334155),
                        ),
                      ),
                      Text(
                        _isPasswordValid ? "Meets Criteria" : "Required",
                        style: GoogleFonts.albertSans(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: _isPasswordValid ? Colors.green.shade700 : const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _buildCriteriaItem("At least 12 characters", _hasMinLength),
                  const SizedBox(height: 4),
                  _buildCriteriaItem("At least 1 uppercase letter (A-Z)", _hasUpper),
                  const SizedBox(height: 4),
                  _buildCriteriaItem("At least 1 lowercase letter (a-z)", _hasLower),
                  const SizedBox(height: 4),
                  _buildCriteriaItem("At least 1 number (0-9)", _hasNumber),
                  const SizedBox(height: 4),
                  _buildCriteriaItem("At least 1 special symbol (!@#\$%^&*)", _hasSymbol),
                ],
              ),
            ),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: _isRegistering ? null : _handleRegister,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _teal,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 1,
                ),
                icon: _isRegistering
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.person_add, size: 18),
                label: Text(
                  _isRegistering ? "Creating Account..." : "Sign Up & Verify Email",
                  style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCriteriaItem(String label, bool isMet) {
    return Row(
      children: [
        Icon(
          isMet ? Icons.check_circle : Icons.radio_button_unchecked,
          size: 15,
          color: isMet ? Colors.green.shade600 : const Color(0xFF94A3B8),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: GoogleFonts.albertSans(
              fontSize: 11,
              fontWeight: isMet ? FontWeight.w600 : FontWeight.normal,
              color: isMet ? Colors.green.shade800 : const Color(0xFF475569),
            ),
          ),
        ),
      ],
    );
  }

  InputDecoration _inputDeco(String hint, {IconData? icon}) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: icon != null ? Icon(icon, size: 20, color: _teal) : null,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _teal, width: 2)),
    );
  }
}
