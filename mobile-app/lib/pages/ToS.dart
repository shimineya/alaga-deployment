import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'PrivacyPolicy.dart';

class ToSScreen extends StatefulWidget {
  final String selectedRole;

  const ToSScreen({super.key, required this.selectedRole});

  @override
  State<ToSScreen> createState() => _ToSScreenState();
}

class _ToSScreenState extends State<ToSScreen> {
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

              // Title Section: ALAGA is larger, ToS is smaller and not bold
              Column(
                children: [
                  Text(
                    "ALAGA",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 24, // Slightly larger
                      fontWeight: FontWeight.w600,
                      color: Colors.black,
                    ),
                  ),
                  Text(
                    "Terms of Service",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 18, // Smaller than ALAGA
                      fontWeight: FontWeight.w400, // Normal weight
                      color: Colors.black,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Scrollable ToS container
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
                      _termsOfServiceText,
                      style: const TextStyle(
                        fontFamily: 'AlbertSans', // Actual terms in Albert Sans
                        fontSize: 12,
                        height: 1.6,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Buttons Section
              Row(
                children: [
                  // Decline Button - Outlined
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
                  
                  // Accept Button - Restored to Teal
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const PrivacyPolicyScreen(),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF5FA9A9), // Back to Teal
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
// TERMS OF SERVICE CONTENT
// =======================

const String _termsOfServiceText = """
Last Updated: February 2026

Welcome to ALAGA, an IoT-powered mobile application developed to support patient care through bed-wetting detection and vital sign monitoring. These Terms of Service ("Terms") govern your access to and use of the ALAGA mobile application, devices, and related services.

If you do not agree with these Terms, please do not use the Service.

1. Definitions
ALAGA refers to the mobile application, IoT devices, software, and services provided by Pulsera Innovations.
User refers to caregivers, healthcare staff, patients, administrators, or any individual who uses the Service.
Device refers to ALAGA-supported hardware used for monitoring.

2. Eligibility
You must be at least 18 years old or have the consent of a legal guardian to use ALAGA.

3. Account Registration and Security
You are responsible for maintaining the confidentiality of your login credentials and all activities under your account.

4. Use of the Service
You agree not to misuse the Service, attempt unauthorized access, or interfere with system operations.

5. Medical Disclaimer
ALAGA is not a medical device and does not provide medical diagnoses or professional healthcare advice.

6. Data Collection and Privacy
Your use of ALAGA is subject to our Privacy Policy and applicable data protection laws in the Philippines.

7. Device Usage and Limitations
Device performance may vary due to environmental factors or connectivity issues.

8. Intellectual Property
All content, software, and designs related to ALAGA are the property of Pulsera Innovations.

9. Suspension and Termination
We may suspend or terminate access if these Terms are violated.

10. Limitation of Liability
Pulsera Innovations shall not be liable for indirect or consequential damages.

11. Indemnification
You agree to indemnify Pulsera Innovations from claims arising from misuse.

12. Modifications
Terms may be updated from time to time. Continued use constitutes acceptance.

13. Governing Law
These Terms are governed by the laws of the Republic of the Philippines.

14. Contact Information
Email: support@alaga-app.com

By using ALAGA, you acknowledge that you have read, understood, and agreed to these Terms of Service.
""";
