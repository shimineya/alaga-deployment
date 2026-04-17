import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'login.dart';
import '../models/registration_data.dart';

class PrivacyPolicyScreen extends StatefulWidget {
  final RegistrationData registrationData;

  const PrivacyPolicyScreen({super.key, required this.registrationData});

  @override
  State<PrivacyPolicyScreen> createState() => _PrivacyPolicyScreenState();
}

class _PrivacyPolicyScreenState extends State<PrivacyPolicyScreen> {
  bool _isLoading = false;

  Future<void> _submitRegistration() async {
    setState(() => _isLoading = true);

    try {
      final String baseUrl = dotenv.env['API_BASE_URL'] ?? '';
      final Uri registerUri = Uri.parse('$baseUrl/auth/register');

      final response = await http.post(
        registerUri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode(widget.registrationData.toJson()),
      ).timeout(const Duration(seconds: 10));

      if (!mounted) return;

      final responseData = jsonDecode(response.body);

      if (response.statusCode == 201 || response.statusCode == 200) {
        // Force relogin per operational requirements
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Registration Successful. Please log in.')),
        );
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const LoginPage()),
          (route) => false,
        );
      } else {
        // [OWASP A10] Mishandling of Exceptional Conditions Mitigation
        debugPrint('Validation/Rejection from Backend: \${response.statusCode} - \${response.body}');
        _showErrorDialog(responseData['message'] ?? 'Registration failed.');
      }
    } catch (e) {
      if (!mounted) return;
      debugPrint('Registration Network Exception: \$e');
      _showErrorDialog('Network error. Cannot reach the server to complete registration.');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Registration Failed'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const SizedBox(height: 10),

              // Logo
              SizedBox(
                height: 70,
                child: Image.asset(
                  'assets/images/WELCOME.png',
                  fit: BoxFit.contain,
                ),
              ),

              const SizedBox(height: 15),

              // Title Section: Matches ToS Hierarchy
              Column(
                children: [
                  Text(
                    "ALAGA",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 24, // Matches ToS
                      fontWeight: FontWeight.w600,
                      color: Colors.black,
                    ),
                  ),
                  Text(
                    "Privacy Policy",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 18, // Smaller than ALAGA
                      fontWeight: FontWeight.w400, // Not bold
                      color: Colors.black,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Scrollable Privacy Policy container
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: SingleChildScrollView(
                    child: Text(
                      _privacyPolicyText,
                      style: const TextStyle(
                        fontFamily: 'AlbertSans', // Font changed to Albert Sans
                        fontSize: 12,
                        height: 1.6,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Buttons
              Row(
                children: [
                  // Decline Button
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isLoading
                          ? null
                          : () {
                              debugPrint("❌ Privacy Policy declined");
                              Navigator.pop(context);
                            },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30),
                        ),
                        side: BorderSide(color: Colors.grey.shade400),
                      ),
                      child: Text(
                        "Decline",
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  
                  // Accept Button - Teal Background restored
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _submitRegistration,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF5FA9A9),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30),
                        ),
                        elevation: 0,
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              "Accept",
                              style: GoogleFonts.poppins(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

const String _privacyPolicyText = """
Last Updated: February 2026

Pulsera Innovations ("We," "Us," or "Our") values your privacy and is committed to protecting your personal data. This Privacy Policy explains how ALAGA, an IoT-powered mobile application for patient care, collects, uses, discloses, and safeguards information when you use our mobile application, devices, and related services.

By using ALAGA, you agree to the collection and use of information in accordance with this Privacy Policy.

1. Information We Collect

1.1 Personal Information
• Full name
• Email address
• Contact information
• User role
• Login credentials (including biometric authentication data)

Note: Biometric data is processed locally on your device and is not stored by ALAGA.

1.2 Patient-Related Information
• Age range and care-related details
• Bed-wetting or moisture detection events
• Vital sign data, depending on enabled features

1.3 Device and Technical Information
• Device identifiers
• Sensor readings
• App usage data
• Log files and crash reports

2. How We Use Your Information
We use collected data to operate and improve the Service, generate alerts, authenticate users, and comply with legal obligations.

3. Legal Basis for Processing
• User consent
• Contract performance
• Legal compliance
• Legitimate interests

4. Data Sharing and Disclosure
We do not sell personal data. Data may be shared only with authorized parties, service providers, or when required by law.

5. Data Storage and Security
We implement reasonable safeguards but cannot guarantee absolute security.

6. Data Retention
Data is retained only as long as necessary or as required by law.

7. User Rights
Users may request access, correction, deletion, or withdrawal of consent.

8. Children's Privacy
ALAGA is not intended for direct use by children.

9. Third-Party Services
We are not responsible for third-party privacy practices.

10. Changes to This Privacy Policy
Updates will be communicated within the application.

11. Compliance with Philippine Data Privacy Laws
ALAGA complies with the Data Privacy Act of 2012 (RA 10173).

12. Contact Information
Email: support@alaga-app.com

By using ALAGA, you acknowledge that you have read and understood this Privacy Policy.
""";