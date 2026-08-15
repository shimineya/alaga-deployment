import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/gestures.dart';
import 'package:google_fonts/google_fonts.dart';

// [OWASP A01] Import the RegistrationData model for structured data passing
import '../models/registration_data.dart';
import 'role.dart';
import 'login.dart';

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
  bool _submitted = false;

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
      backgroundColor: const Color(0xFF5FA9A9),
      body: Column(
        children: [
          // HEADER SECTION - Logo size increased
          SafeArea(
            bottom: false,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.only(top: 20, bottom: 25),
              child: Column(
                children: [
                  Image.asset('assets/images/alagahead.png', height: 90), // Restored size
                  const SizedBox(height: 8),
                  Text(
                    'ALAGA',
                    style: GoogleFonts.poppins(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
                  ),
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
                    const SizedBox(height: 30),
                    Text('Register', style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    const Text('Complete all fields to continue.', style: TextStyle(fontFamily: 'AlbertSans', fontSize: 14)),
                    const SizedBox(height: 20),
                    Form(
                      key: _formKey,
                      autovalidateMode: _submitted ? AutovalidateMode.onUserInteraction : AutovalidateMode.disabled,
                      child: Column(
                        children: [
                          // NEW SIDE-BY-SIDE LAYOUT
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
                          const SizedBox(height: 8),
                          const Text(
                            'This will be used for account backup and Multi-factor Authentication.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontFamily: 'AlbertSans', fontSize: 10, color: Colors.black54, fontStyle: FontStyle.italic),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),
                    SizedBox(
                      width: 200,
                      child: ElevatedButton(
                        onPressed: _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF5FA9A9),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                        ),
                        child: Text('Sign Up', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.black)),
                      ),
                    ),
                    const SizedBox(height: 24),
                    RichText(
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
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ],
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
        label: RichText(
          overflow: TextOverflow.ellipsis,
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
      ),
    );
  }

  // [INTEGRATION] Accumulate form data into RegistrationData model and pass to RoleScreen.
  // No API call is made here -- the actual registration happens on the credentials page
  // after the user selects a role and enters username/password.
  void _submit() {
    setState(() => _submitted = true);
    if (!_formKey.currentState!.validate()) return;

    // Build the RegistrationData object with all personal info fields
    final registrationData = RegistrationData(
      firstName: _firstNameCtrl.text,
      lastName: _lastNameCtrl.text,
      middleInitial: _middleCtrl.text,
      email: _emailCtrl.text,
      mobileNumber: "$_selectedCountryCode${_phoneCtrl.text}",
    );

    // Navigate to role selection, passing accumulated data forward
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => RoleScreen(registrationData: registrationData),
      ),
    );
  }
}