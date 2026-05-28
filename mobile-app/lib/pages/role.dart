import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Role selection is now part of the registration flow.
// It receives RegistrationData from register.dart and passes it to register1.dart.
import '../models/registration_data.dart';
import 'register1.dart';

class RoleScreen extends StatefulWidget {
  // [OWASP A01] RegistrationData is required -- the user must provide personal info
  // before selecting a role. This enforces the intended sequential flow.
  final RegistrationData registrationData;

  const RoleScreen({super.key, required this.registrationData});

  @override
  State<RoleScreen> createState() => _RoleScreenState();
}

class _RoleScreenState extends State<RoleScreen> {
  String? selectedRole;

  String get _roleDescription {
    if (selectedRole == 'PARENT') {
      return 'I would like to watch over the well being of my child.';
    } else if (selectedRole == 'CAREGIVER') {
      return 'I would like to make my job easier by providing efficient service.';
    }
    return '';
  }

  // Maps the UI-friendly role label to the backend's expected role string.
  // [OWASP A01] Caregivers receive the 'caregiver' role so they ONLY see patients
  // explicitly assigned to them in the patient_access table.
  // Parents receive the 'parent' role which gives them admin-level privileges
  // to register devices and enroll patients.
  // The 'medical_staff' role is an elevated privilege granted by an
  // admin AFTER account creation -- it must NOT be self-assignable at signup.
  String _mapRoleToBackend(String uiRole) {
    switch (uiRole) {
      case 'PARENT':
        return 'parent';
      case 'CAREGIVER':
        // [FIX] Was incorrectly 'medical_staff' which has admin-level patient
        // visibility (bypasses patient_access filter). New users must start as
        // 'caregiver' until an admin promotes them via User Management.
        return 'caregiver';
      default:
        return 'caregiver';
    }
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 20),

              // Title
              Text(
                "Welcome to ALAGA!",
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  color: Colors.black,
                ),
              ),

              const SizedBox(height: 8),

              // Subtitle
              Text(
                "How would you use the app?",
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'AlbertSans',
                  fontSize: 14,
                  color: Colors.black,
                ),
              ),

              const SizedBox(height: 50),

              // Role cards side by side
              Row(
                children: [
                  Expanded(
                    child: _roleCard(
                      role: 'PARENT',
                      imagePath: 'assets/images/parent.png',
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _roleCard(
                      role: 'CAREGIVER',
                      imagePath: 'assets/images/med staff.png',
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Description box
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: selectedRole == null
                    ? const SizedBox(height: 56, key: ValueKey('empty'))
                    : Container(
                        key: ValueKey(selectedRole),
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF5FA9A9).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.3)),
                        ),
                        child: Text(
                          _roleDescription,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.albertSans(
                            fontSize: 13,
                            color: Colors.black,
                            height: 1.5,
                          ),
                        ),
                      ),
              ),

              const SizedBox(height: 50),
              // Continue button
              SizedBox(
                width: 200,
                child: ElevatedButton(
                  onPressed: selectedRole == null
                      ? null
                      : () {
                          // [INTEGRATION] Set the role on the RegistrationData model
                          // and navigate to the credentials page.
                          widget.registrationData.role = _mapRoleToBackend(selectedRole!);

                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => CreateCredentialsPage(
                                registrationData: widget.registrationData,
                              ),
                            ),
                          );
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF5FA9A9),
                    disabledBackgroundColor: Colors.grey.shade300,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
                    "Continue",
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: selectedRole == null ? Colors.grey.shade600 : Colors.black,
                    ),
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

  Widget _roleCard({
    required String role,
    required String imagePath,
  }) {
    final bool isSelected = selectedRole == role;

    return GestureDetector(
      onTap: () => setState(() => selectedRole = role),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF5FA9A9) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF5FA9A9) : Colors.grey.shade300,
            width: 2,
          ),
          boxShadow: [
            if (isSelected)
              BoxShadow(
                color: const Color(0xFF5FA9A9).withOpacity(0.3),
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              imagePath,
              height: 80,
              width: 80,
              fit: BoxFit.contain,
            ),
            const SizedBox(height: 12),
            Text(
              role,
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: isSelected ? Colors.white : Colors.black,
              ),
            ),
          ],
        ),
      ),
    );
  }
}