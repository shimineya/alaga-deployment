import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/gestures.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Step 2 of the registration flow.
// Receives the role & facility context from RoleScreen and collects
// all personal details and account credentials in one unified, seamless screen.
import '../models/registration_data.dart';
import '../services/api_service.dart';
import 'otp.dart';
import 'login.dart';

class RegisterPage extends StatefulWidget {
  final RegistrationData registrationData;

  const RegisterPage({super.key, required this.registrationData});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _firstNameCtrl = TextEditingController();
  final TextEditingController _lastNameCtrl = TextEditingController();
  final TextEditingController _middleCtrl = TextEditingController();
  final TextEditingController _emailCtrl = TextEditingController();
  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _usernameCtrl = TextEditingController();
  final TextEditingController _passwordCtrl = TextEditingController();
  final TextEditingController _confirmPasswordCtrl = TextEditingController();

  String _selectedCountryCode = '+63';
  bool _isPasswordVisible = false;
  bool _isConfirmPasswordVisible = false;
  bool _submitted = false;
  bool _isLoading = false;

  final List<Map<String, String>> _countries = [
    {"name": "Philippines", "code": "+63", "flag": "\u{1F1F5}\u{1F1ED}"},
    {"name": "United States", "code": "+1", "flag": "\u{1F1FA}\u{1F1F8}"},
    {"name": "United Kingdom", "code": "+44", "flag": "\u{1F1EC}\u{1F1E7}"},
    {"name": "Australia", "code": "+61", "flag": "\u{1F1E6}\u{1F1FA}"},
    {"name": "Canada", "code": "+1", "flag": "\u{1F1E8}\u{1F1E6}"},
    {"name": "Japan", "code": "+81", "flag": "\u{1F1EF}\u{1F1F5}"},
    {"name": "South Korea", "code": "+82", "flag": "\u{1F1F0}\u{1F1F7}"},
    {"name": "Singapore", "code": "+65", "flag": "\u{1F1F8}\u{1F1EC}"},
    {"name": "India", "code": "+91", "flag": "\u{1F1EE}\u{1F1F3}"},
    {"name": "China", "code": "+86", "flag": "\u{1F1E8}\u{1F1F3}"},
  ];

  @override
  void initState() {
    super.initState();
    // Pre-fill email if token verification provided an invited recipient email
    if (widget.registrationData.email.isNotEmpty) {
      _emailCtrl.text = widget.registrationData.email;
    }
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _middleCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    super.dispose();
  }

  String get _roleBadgeText {
    final role = widget.registrationData.role.toLowerCase();
    if (role == 'parent') {
      return 'Account Type: Parent / Family';
    }
    if (widget.registrationData.caregiverType == 'facility' && widget.registrationData.facilityName.isNotEmpty) {
      return 'Caregiver • ${widget.registrationData.facilityName}';
    }
    return 'Account Type: Independent Caregiver';
  }

  // Password Requirements widget
  Widget _buildPasswordRequirements(String password) {
    bool hasMinLength = password.length >= 12;
    bool hasUpperAndLower = password.contains(RegExp(r'[A-Z]')) && password.contains(RegExp(r'[a-z]'));
    bool hasNumberAndSymbol = password.contains(RegExp(r'[0-9]')) && password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;/]'));

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFEAEAE4),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Password Requirements:',
            style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.black87),
          ),
          const SizedBox(height: 8),
          _buildRequirementRow('Minimum of 12 characters long', hasMinLength),
          const SizedBox(height: 4),
          _buildRequirementRow('At least one uppercase and lowercase letter', hasUpperAndLower),
          const SizedBox(height: 4),
          _buildRequirementRow('At least one number and one symbol', hasNumberAndSymbol),
        ],
      ),
    );
  }

  Widget _buildRequirementRow(String text, bool isMet) {
    return Row(
      children: [
        isMet
            ? const Icon(Icons.check_circle, color: Color(0xFF4CAF50), size: 16)
            : Container(
                width: 14,
                height: 14,
                margin: const EdgeInsets.only(right: 2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.black38, width: 1.5),
                ),
              ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontFamily: 'AlbertSans',
              fontSize: 11,
              color: isMet ? Colors.black87 : Colors.black54,
              fontWeight: isMet ? FontWeight.w500 : FontWeight.normal,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInput({
    required TextEditingController controller,
    required String hint,
    required bool isRequired,
    bool isNameField = false,
    bool obscureText = false,
    TextInputType keyboardType = TextInputType.text,
    Widget? suffixIcon,
    int? maxLength,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      maxLength: maxLength,
      style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black87),
      inputFormatters: [
        if (isNameField) FilteringTextInputFormatter.allow(RegExp(r"[a-zA-Z\s\-']")),
      ],
      validator: validator,
      decoration: InputDecoration(
        counterText: '',
        errorStyle: const TextStyle(height: 0, fontSize: 0),
        suffixIcon: suffixIcon,
        label: RichText(
          overflow: TextOverflow.ellipsis,
          text: TextSpan(
            text: hint,
            style: const TextStyle(fontFamily: 'AlbertSans', color: Colors.black45, fontSize: 14),
            children: [
              if (isRequired)
                const TextSpan(text: ' *', style: TextStyle(color: Colors.red)),
            ],
          ),
        ),
        floatingLabelBehavior: FloatingLabelBehavior.auto,
        filled: true,
        fillColor: const Color(0xFFF5F5F0),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.black54)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2.0)),
      ),
    );
  }

  Widget _buildPhoneInput() {
    return TextFormField(
      controller: _phoneCtrl,
      keyboardType: TextInputType.phone,
      style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black87),
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      validator: (v) {
        if (v == null || v.isEmpty) return "";
        if (v.length < 7 || v.length > 12) return "";
        return null;
      },
      decoration: InputDecoration(
        errorStyle: const TextStyle(height: 0, fontSize: 0),
        prefixIcon: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          margin: const EdgeInsets.only(right: 8),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _selectedCountryCode,
              dropdownColor: const Color(0xFFF5F5F0),
              icon: const Icon(Icons.arrow_drop_down, color: Colors.black54),
              items: _countries.map((country) {
                return DropdownMenuItem<String>(
                  value: country["code"],
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(country["flag"]!, style: const TextStyle(fontSize: 16)),
                      const SizedBox(width: 4),
                      Text(country["code"]!, style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 13, color: Colors.black)),
                    ],
                  ),
                );
              }).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedCountryCode = val);
              },
            ),
          ),
        ),
        label: RichText(
          overflow: TextOverflow.ellipsis,
          text: const TextSpan(
            text: 'Phone Number',
            style: TextStyle(fontFamily: 'AlbertSans', color: Colors.black45, fontSize: 14),
            children: [
              TextSpan(text: ' *', style: TextStyle(color: Colors.red)),
            ],
          ),
        ),
        filled: true,
        fillColor: const Color(0xFFF5F5F0),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.black54)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2.0)),
      ),
    );
  }

  Future<void> _submitRegistration() async {
    setState(() => _submitted = true);
    if (!_formKey.currentState!.validate()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please check all highlighted required fields.'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (_passwordCtrl.text != _confirmPasswordCtrl.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Passwords do not match. Please verify.'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // Populate registrationData with all personal and credential details
    widget.registrationData.firstName = _firstNameCtrl.text.trim();
    widget.registrationData.middleInitial = _middleCtrl.text.trim();
    widget.registrationData.lastName = _lastNameCtrl.text.trim();
    widget.registrationData.email = _emailCtrl.text.trim().toLowerCase();
    widget.registrationData.mobileNumber = "$_selectedCountryCode${_phoneCtrl.text.trim()}";
    widget.registrationData.username = _usernameCtrl.text.trim();
    widget.registrationData.password = _passwordCtrl.text;

    setState(() => _isLoading = true);

    try {
      final result = await ApiService.post(
        '/api/auth/register',
        body: widget.registrationData.toJson(),
        requiresAuth: false,
        timeoutSeconds: 45,
      );

      if (!mounted) return;
      setState(() => _isLoading = false);

      if (result['success'] == true) {
        // Direct transition to OTP verification
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => OTPVerificationPage(
              userId: result['user_id'] ?? result['userId'],
              email: result['email'] ?? widget.registrationData.email,
              purpose: result['otpPurpose'] ?? 'REGISTER_VERIFY',
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? 'Registration failed. Please try again.'),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Registration network error: $e'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF5FA9A9),
      body: Column(
        children: [
          // HEADER SECTION
          SafeArea(
            bottom: false,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.only(top: 10, bottom: 18, left: 12, right: 12),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      icon: const Icon(Icons.arrow_back, color: Colors.black87),
                      onPressed: () => Navigator.pop(context),
                      tooltip: "Back to Role Selection",
                    ),
                  ),
                  Column(
                    children: [
                      Image.asset('assets/images/alagahead.png', height: 70),
                      const SizedBox(height: 4),
                      Text(
                        'ALAGA',
                        style: GoogleFonts.poppins(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.black,
                        ),
                      ),
                      const Text(
                        'Step 2 of 2: Profile & Credentials',
                        style: TextStyle(
                          fontFamily: 'AlbertSans',
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF003830),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          
          // MAIN FORM SECTION
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Color(0xFFF5F5F0),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(30),
                  topRight: Radius.circular(30),
                ),
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const SizedBox(height: 20),

                    // Role indicator card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE0F2F1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF80CBC4)),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            widget.registrationData.role.toLowerCase() == 'parent'
                                ? Icons.family_restroom_rounded
                                : Icons.medical_services_rounded,
                            color: const Color(0xFF00695C),
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _roleBadgeText,
                              style: GoogleFonts.poppins(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF004D40),
                              ),
                            ),
                          ),
                          GestureDetector(
                            onTap: () => Navigator.pop(context),
                            child: Text(
                              'Change',
                              style: GoogleFonts.poppins(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF00796B),
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 18),
                    Text('Create Your Account', style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    const Text('Fill out all fields below to finish setup.', style: TextStyle(fontFamily: 'AlbertSans', fontSize: 13, color: Colors.black54)),
                    const SizedBox(height: 20),

                    Form(
                      key: _formKey,
                      autovalidateMode: _submitted ? AutovalidateMode.onUserInteraction : AutovalidateMode.disabled,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // SECTION: PERSONAL INFORMATION
                          Text(
                            'Personal Information',
                            style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF1B393D)),
                          ),
                          const SizedBox(height: 10),

                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                flex: 2,
                                child: _buildInput(
                                  controller: _firstNameCtrl, 
                                  hint: 'First Name', 
                                  isRequired: true, 
                                  isNameField: true, 
                                  validator: (v) => (v == null || v.isEmpty) ? "" : null
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                flex: 1,
                                child: _buildInput(
                                  controller: _middleCtrl, 
                                  hint: 'M.I.', 
                                  isRequired: false, 
                                  isNameField: true, 
                                  maxLength: 2
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _buildInput(controller: _lastNameCtrl, hint: 'Last Name', isRequired: true, isNameField: true, validator: (v) => (v == null || v.isEmpty) ? "" : null),
                          const SizedBox(height: 12),
                          _buildInput(
                            controller: _emailCtrl,
                            hint: 'Email Address',
                            isRequired: true,
                            keyboardType: TextInputType.emailAddress,
                            validator: (v) {
                              if (v == null || v.isEmpty) return "";
                              final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
                              return emailRegex.hasMatch(v) ? null : "";
                            },
                          ),
                          const SizedBox(height: 12),
                          _buildPhoneInput(),
                          const SizedBox(height: 6),
                          const Text(
                            'Used for security verification and account authentication.',
                            style: TextStyle(fontFamily: 'AlbertSans', fontSize: 10.5, color: Colors.black54, fontStyle: FontStyle.italic),
                          ),

                          const SizedBox(height: 24),

                          // SECTION: ACCOUNT CREDENTIALS
                          Text(
                            'Account Credentials',
                            style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF1B393D)),
                          ),
                          const SizedBox(height: 10),

                          _buildInput(
                            controller: _usernameCtrl,
                            hint: 'Username',
                            isRequired: true,
                            validator: (v) => (v == null || v.isEmpty) ? "" : null,
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
                            validator: (v) {
                              if (v == null || v.isEmpty || v.length < 12) return "";
                              if (!v.contains(RegExp(r'[A-Z]')) || !v.contains(RegExp(r'[a-z]'))) return "";
                              if (!v.contains(RegExp(r'[0-9]')) || !v.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;/]'))) return "";
                              return null;
                            },
                          ),
                          const SizedBox(height: 10),
                          AnimatedBuilder(
                            animation: _passwordCtrl,
                            builder: (context, _) => _buildPasswordRequirements(_passwordCtrl.text),
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
                            validator: (v) {
                              if (v == null || v.isEmpty) return "";
                              if (v != _passwordCtrl.text) return "";
                              return null;
                            },
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 28),

                    // Primary submit button
                    SizedBox(
                      width: 220,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _submitRegistration,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF5FA9A9),
                          disabledBackgroundColor: Colors.grey.shade300,
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                          elevation: 0,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2.2),
                              )
                            : Text('Create Account', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.black)),
                      ),
                    ),

                    const SizedBox(height: 20),

                    RichText(
                      text: TextSpan(
                        text: 'Registered already? ',
                        style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 13, color: Colors.black87),
                        children: [
                          TextSpan(
                            text: 'Log in',
                            style: const TextStyle(fontFamily: 'AlbertSans', fontWeight: FontWeight.w800, color: Color(0xFF00796B), decoration: TextDecoration.underline),
                            recognizer: TapGestureRecognizer()
                              ..onTap = () => Navigator.pushAndRemoveUntil(
                                    context,
                                    MaterialPageRoute(builder: (_) => const LoginPage()),
                                    (route) => false,
                                  ),
                          ),
                          const TextSpan(text: ' instead.', style: TextStyle(fontFamily: 'AlbertSans', fontSize: 13, color: Colors.black87)),
                        ],
                      ),
                    ),

                    const SizedBox(height: 36),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
