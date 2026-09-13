import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../models/registration_data.dart';
import 'terms.dart';

class PrivacyPolicyScreen extends StatefulWidget {
  final RegistrationData registrationData;

  const PrivacyPolicyScreen({super.key, required this.registrationData});

  @override
  State<PrivacyPolicyScreen> createState() => _PrivacyPolicyScreenState();
}

class _PrivacyPolicyScreenState extends State<PrivacyPolicyScreen> {
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
                  'assets/images/alagahead.png',
                  fit: BoxFit.contain,
                ),
              ),

              const SizedBox(height: 15),

              // Header
              Column(
                children: [
                  Text(
                    "ALAGA",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                      color: Colors.black,
                    ),
                  ),
                  Text(
                    "Privacy Policy",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.w400,
                      color: Colors.black,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Scrollable Text Container
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: const SingleChildScrollView(
                    child: Text(
                      _privacyPolicyText,
                      style: TextStyle(
                        fontFamily: 'AlbertSans',
                        fontSize: 12,
                        height: 1.6,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Action Buttons
              Row(
                children: [
                  // Decline Button
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.grey.shade400),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30),
                        ),
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

                  // Accept Button -> Moves to ToSScreen passing registrationData
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ToSScreen(
                              registrationData: widget.registrationData,
                            ),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF5FA9A9),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
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

// =======================
// PRIVACY POLICY CONTENT
// =======================

const String _privacyPolicyText = """
Last Updated: August 2026

Pulsera Innovations ("we," "our," or "us") is committed to protecting the privacy and personal data of our users ("you" or "User"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the ALAGA mobile application, devices, and related services.

By using ALAGA, you agree to the collection and use of information in accordance with this Privacy Policy and applicable data privacy laws, including Republic Act No. 10173 (Data Privacy Act of 2012 of the Philippines).

1. Information We Collect
We collect personal information such as name, contact details, user account credentials, patient monitoring data, and vital signs necessary for system functionality.

2. How We Use Your Information
Your information is used strictly to provide vital signs and bed-wetting monitoring, system notifications, caregiver alerts, and service improvements.

3. Data Sharing and Disclosure
We do not sell your personal data. Data may be shared only with authorized healthcare personnel, caregivers designated by you, or required legal authorities.

4. Data Security
We implement administrative, technical, and physical security measures to safeguard your personal information against unauthorized access or disclosure.

5. Your Data Privacy Rights
Under the Data Privacy Act of 2012, you have the right to be informed, access, correct, object to processing, or request erasure of your personal data.

6. Data Retention
Personal data will be retained only as long as necessary to fulfill the purposes outlined in this Privacy Policy.

7. Contact Us
For questions or concerns regarding this Privacy Policy, please contact us at pulserainnovations@gmail.com.
""";