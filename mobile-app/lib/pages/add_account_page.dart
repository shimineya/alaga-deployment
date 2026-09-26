import 'package:flutter/material.dart';
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

  static const Color _teal = Color(0xFF0D9488);
  static const Color _tealLight = Color(0xFFE6FFFA);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
    super.dispose();
  }

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
      // Transport user back to their current profile page
      Navigator.pop(context, true);
    } else {
      setState(() {
        _loginError = result['message'] ?? 'Login failed. Please check your credentials.';
      });
    }
  }

  Future<void> _handleRegister() async {
    if (!_regFormKey.currentState!.validate()) return;
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
      // If user row is returned directly or OTP is needed
      if (result['requiresOtp'] == true || result['token'] == null) {
        // Now try logging in with the credentials to obtain the session token
        final loginRes = await ApiService.post(
          '/auth/login',
          body: {
            'username': _regEmailCtrl.text.trim(),
            'password': _regPassCtrl.text,
          },
          requiresAuth: false,
        );
        if (loginRes['success'] == true && loginRes['user'] != null && loginRes['token'] != null) {
          final newSession = UserSession.fromJson(loginRes['user'], loginRes['token']);
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
          return;
        }
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
        return;
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ?? 'Registration successful! Please log in to add this account.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: _teal,
          behavior: SnackBarBehavior.floating,
        ),
      );
      // Switch tab to login
      _loginUserCtrl.text = _regEmailCtrl.text.trim();
      _loginPassCtrl.text = _regPassCtrl.text;
      _tabController.animateTo(0);
    } else {
      setState(() {
        _regError = result['message'] ?? 'Registration failed. Please check inputs.';
      });
    }
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
          onPressed: () => Navigator.pop(context, false),
        ),
        title: Text(
          "Add Another Account",
          style: GoogleFonts.poppins(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF1E293B),
          ),
        ),
        bottom: TabBar(
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
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildLoginForm(),
          _buildRegisterForm(),
        ],
      ),
    );
  }

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
                border: Border.all(color: _teal.withOpacity(0.3)),
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

  Widget _buildRegisterForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
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
                border: Border.all(color: _teal.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.person_add_alt, color: _teal, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "Create a new profile. Once registered, it will be added to your switch account list.",
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
                hintText: "At least 12 chars (upper, lower, num, sym)",
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
              validator: (v) => (v == null || v.length < 8) ? 'Password must be at least 8 characters' : null,
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
                  _isRegistering ? "Registering..." : "Sign Up & Link Account",
                  style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
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
