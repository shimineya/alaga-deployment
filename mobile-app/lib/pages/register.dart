import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/gestures.dart';
import 'package:google_fonts/google_fonts.dart';

import 'register1.dart';
import 'login.dart';
import '../models/registration_data.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

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

  String _selectedCountryCode = '+63';
  
  bool _isLoading = false;
  bool _submitted = false;

  final List<Map<String, String>> _countries = [
    {"name": "Philippines", "code": "+63", "flag": "🇵🇭"},
    {"name": "United States", "code": "+1", "flag": "🇺🇸"},
    {"name": "United Kingdom", "code": "+44", "flag": "🇬🇧"},
    {"name": "Australia", "code": "+61", "flag": "🇦🇺"},
    {"name": "Canada", "code": "+1", "flag": "🇨🇦"},
    {"name": "Japan", "code": "+81", "flag": "🇯🇵"},
    {"name": "South Korea", "code": "+82", "flag": "🇰🇷"},
    {"name": "Singapore", "code": "+65", "flag": "🇸🇬"},
    {"name": "India", "code": "+91", "flag": "🇮🇳"},
    {"name": "China", "code": "+86", "flag": "🇨🇳"},
  ];

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _middleCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
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
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                        color: Colors.black,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              Text('Register', style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              const Text('Complete all fields to continue.', style: TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black)),
              const SizedBox(height: 20),
              Form(
                key: _formKey,
                autovalidateMode: _submitted ? AutovalidateMode.onUserInteraction : AutovalidateMode.disabled,
                child: Column(
                  children: [
                    _buildInput(controller: _firstNameCtrl, hint: 'First Name', isRequired: true, isNameField: true, validator: (v) => (v == null || v.isEmpty) ? "" : null),
                    const SizedBox(height: 12),
                    _buildInput(controller: _lastNameCtrl, hint: 'Last Name', isRequired: true, isNameField: true, validator: (v) => (v == null || v.isEmpty) ? "" : null),
                    const SizedBox(height: 12),
                    _buildInput(controller: _middleCtrl, hint: 'Middle Initial', isRequired: false, isNameField: true, maxLength: 2),
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
                    const Align(
                      alignment: Alignment.center,
                      child: Text(
                        ' This will be used for account backup and Multi-factor Authentication.',
                        style: TextStyle(fontFamily: 'AlbertSans', fontSize: 10, color: Colors.black, fontStyle: FontStyle.italic),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              Center(
                child: SizedBox(
                  width: 200,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF5FA9A9),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                    ),
                    child: _isLoading
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                        : Text('Next', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.black)),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Center(
                child: RichText(
                  text: TextSpan(
                    text: 'Registered already? ',
                    style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black),
                    children: [
                      TextSpan(
                        text: 'Log in',
                        style: const TextStyle(fontFamily: 'AlbertSans', fontWeight: FontWeight.w800, color: Colors.black),
                        recognizer: TapGestureRecognizer()..onTap = () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginPage())),
                      ),
                      const TextSpan(text: ' instead.', style: TextStyle(fontFamily: 'AlbertSans', fontSize: 14, color: Colors.black)),
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

  Widget _buildPhoneInput() {
    return TextFormField(
      controller: _phoneCtrl,
      keyboardType: TextInputType.phone,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      maxLength: _selectedCountryCode == '+63' ? 10 : 15,
      validator: (v) {
        if (v == null || v.isEmpty) return "";
        if (_selectedCountryCode == '+63' && v.length != 10) return "";
        return null;
      },
      style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14),
      decoration: InputDecoration(
        prefixIcon: Padding(
          padding: const EdgeInsets.only(left: 12, right: 8),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _selectedCountryCode,
              items: _countries.map((country) {
                return DropdownMenuItem<String>(
                  value: country['code'],
                  child: Text("${country['flag']} ${country['code']}"),
                );
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _selectedCountryCode = value!;
                  _phoneCtrl.clear();
                });
              },
            ),
          ),
        ),
        hintText: _selectedCountryCode == '+63' ? '9XX XXX XXXX' : 'Number',
        counterText: '',
        errorStyle: const TextStyle(height: 0, fontSize: 0),
        // FIXED: Red asterisk for phone input
        label: RichText(
          text: TextSpan(
            text: 'Contact Number',
            style: const TextStyle(fontFamily: 'AlbertSans', color: Colors.black38, fontSize: 14),
            children: const [
              TextSpan(text: ' *', style: TextStyle(color: Colors.red)),
            ],
          ),
        ),
        filled: true,
        fillColor: const Color(0xFFF5F5F0),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.black54)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2.0)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.red, width: 1.5)),
        focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.red, width: 2.0)),
      ),
    );
  }

  Widget _buildInput({required TextEditingController controller, required String hint, required bool isRequired, bool isNameField = false, TextInputType keyboardType = TextInputType.text, String? Function(String?)? validator, int? maxLength}) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      validator: validator,
      maxLength: maxLength,
      inputFormatters: isNameField ? [FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z\s]'))] : null,
      style: const TextStyle(fontFamily: 'AlbertSans', fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        counterText: '',
        errorStyle: const TextStyle(height: 0, fontSize: 0),
        // FIXED: Red asterisk using the label property with RichText
        label: RichText(
          text: TextSpan(
            text: hint,
            style: const TextStyle(fontFamily: 'AlbertSans', color: Colors.black38, fontSize: 14),
            children: [
              if (isRequired)
                const TextSpan(text: ' *', style: TextStyle(color: Colors.red)),
            ],
          ),
        ),
        floatingLabelBehavior: FloatingLabelBehavior.auto,
        filled: true,
        fillColor: const Color(0xFFF5F5F0),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.black54)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 2.0)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.red, width: 1.5)),
        focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.red, width: 2.0)),
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _submitted = true);
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    final registrationData = RegistrationData(
      firstName: _firstNameCtrl.text,
      lastName: _lastNameCtrl.text,
      middleInitial: _middleCtrl.text,
      email: _emailCtrl.text,
    );
    if (!mounted) return;
    setState(() => _isLoading = false);
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => CreateCredentialsPage(
          registrationData: registrationData,
          mobileNumber: "$_selectedCountryCode${_phoneCtrl.text}",
        ),
      ),
    );
  }
}