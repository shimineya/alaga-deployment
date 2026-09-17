import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Role selection is part of the registration flow.
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
  static const _facilities = [
    'Philippine General Hospital',
    'Novaliches General Hospital',
    'St Lukes Medical Center',
  ];
  String? selectedRole;
  String? caregiverType; // 'facility' or 'freelance'
  String? facilityName;

  String get _roleDescription {
    if (selectedRole == 'PARENT') {
      return 'I would like to watch over the well being of my child.';
    } else if (selectedRole == 'CAREGIVER') {
      if (caregiverType == 'facility') {
        final fac = (facilityName != null && facilityName!.isNotEmpty)
            ? facilityName
            : 'a healthcare facility / hospital';
        return 'Caregiver (Facility Affiliated) — Providing healthcare service under $fac.';
      } else {
        return 'Caregiver (Freelance / Standalone) — Providing independent private in-home patient care.';
      }
    }
    return '';
  }

  // Maps the UI-friendly role label to the backend's expected role string.
  String _mapRoleToBackend(String uiRole) {
    switch (uiRole) {
      case 'PARENT':
        return 'parent';
      case 'CAREGIVER':
        return 'caregiver';
      default:
        return 'caregiver';
    }
  }

  /// Popup dialog shown when selecting the CAREGIVER role
  Future<void> _showCaregiverAffiliationDialog() async {
    String tempCaregiverType = caregiverType ?? 'facility';
    String? selectedFacility = _facilities.contains(facilityName) ? facilityName : null;

    final result = await showDialog<Map<String, String>>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Dialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header with Icon
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: const BoxDecoration(
                            color: Color(0xFFE8F4F4),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.health_and_safety_outlined,
                            color: Color(0xFF5FA9A9),
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "Caregiver Affiliation",
                                style: GoogleFonts.poppins(
                                  fontSize: 17,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF2D3436),
                                ),
                              ),
                              Text(
                                "Select your caregiver setup",
                                style: GoogleFonts.albertSans(fontSize: 12, color: Colors.black54),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Text(
                      "Are you under a certain healthcare facility or hospital?",
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Option 1: Yes, Facility / Hospital
                    InkWell(
                      onTap: () {
                        setModalState(() {
                          tempCaregiverType = 'facility';
                        });
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: tempCaregiverType == 'facility'
                              ? const Color(0xFFE8F4F4)
                              : Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: tempCaregiverType == 'facility'
                                ? const Color(0xFF5FA9A9)
                                : Colors.grey.shade300,
                            width: tempCaregiverType == 'facility' ? 1.8 : 1.0,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              margin: const EdgeInsets.only(top: 2, right: 10),
                              width: 18,
                              height: 18,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: tempCaregiverType == 'facility'
                                      ? const Color(0xFF5FA9A9)
                                      : Colors.grey.shade400,
                                  width: 2,
                                ),
                              ),
                              child: tempCaregiverType == 'facility'
                                  ? Center(
                                      child: Container(
                                        width: 10,
                                        height: 10,
                                        decoration: const BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: Color(0xFF5FA9A9),
                                        ),
                                      ),
                                    )
                                  : null,
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "Yes, Under a Facility / Hospital",
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black87,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    "Employed or assigned under a hospital, clinic, or healthcare facility.",
                                    style: GoogleFonts.albertSans(fontSize: 11.5, color: Colors.black54),
                                  ),
                                  if (tempCaregiverType == 'facility') ...[
                                    const SizedBox(height: 10),
                                    DropdownButtonFormField<String>(
                                      initialValue: selectedFacility,
                                      isExpanded: true,
                                      dropdownColor: const Color(0xFFF0F7F7),
                                      borderRadius: BorderRadius.circular(12),
                                      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF286464)),
                                      items: _facilities.map((name) => DropdownMenuItem(
                                        value: name,
                                        child: Text(name, style: GoogleFonts.albertSans(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF183B3B)), maxLines: 2, overflow: TextOverflow.ellipsis),
                                      )).toList(),
                                      onChanged: (value) => setModalState(() => selectedFacility = value),
                                      style: GoogleFonts.albertSans(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF183B3B)),
                                      decoration: InputDecoration(
                                        hintText: "Select your hospital",
                                        hintStyle: GoogleFonts.albertSans(fontSize: 13, color: const Color(0xFF486565)),
                                        filled: true,
                                        fillColor: const Color(0xFFE8F3F3),
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(10),
                                          borderSide: const BorderSide(color: Color(0xFF78A5A5)),
                                        ),
                                        enabledBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(10),
                                          borderSide: const BorderSide(color: Color(0xFF78A5A5)),
                                        ),
                                        focusedBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(10),
                                          borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 1.5),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      "Facility not listed? Contact your facility administrator to have it added before registering as an affiliated caregiver.",
                                      style: GoogleFonts.albertSans(fontSize: 12, color: Colors.black54),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Option 2: No, Freelance / Standalone
                    InkWell(
                      onTap: () {
                        setModalState(() {
                          tempCaregiverType = 'freelance';
                        });
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: tempCaregiverType == 'freelance'
                              ? const Color(0xFFE8F4F4)
                              : Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: tempCaregiverType == 'freelance'
                                ? const Color(0xFF5FA9A9)
                                : Colors.grey.shade300,
                            width: tempCaregiverType == 'freelance' ? 1.8 : 1.0,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              margin: const EdgeInsets.only(top: 2, right: 10),
                              width: 18,
                              height: 18,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: tempCaregiverType == 'freelance'
                                      ? const Color(0xFF5FA9A9)
                                      : Colors.grey.shade400,
                                  width: 2,
                                ),
                              ),
                              child: tempCaregiverType == 'freelance'
                                  ? Center(
                                      child: Container(
                                        width: 10,
                                        height: 10,
                                        decoration: const BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: Color(0xFF5FA9A9),
                                        ),
                                      ),
                                    )
                                  : null,
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "No, Freelance / Standalone Caregiver",
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black87,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    "Providing independent private in-home care directly for patients.",
                                    style: GoogleFonts.albertSans(fontSize: 11.5, color: Colors.black54),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Action Buttons
                    Row(
                      children: [
                        Expanded(
                          child: TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: Text(
                              "Cancel",
                              style: GoogleFonts.poppins(color: Colors.black54, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF5FA9A9),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            onPressed: tempCaregiverType == 'facility' && selectedFacility == null ? null : () {
                              Navigator.pop(context, {
                                'caregiverType': tempCaregiverType,
                                'facilityName': tempCaregiverType == 'facility' ? selectedFacility! : '',
                              });
                            },
                            child: Text(
                              "Confirm Role",
                              style: GoogleFonts.poppins(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13.5,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (result != null) {
      setState(() {
        selectedRole = 'CAREGIVER';
        caregiverType = result['caregiverType'];
        facilityName = result['facilityName'];
        widget.registrationData.caregiverType = caregiverType ?? 'freelance';
        widget.registrationData.facilityName = facilityName ?? '';
      });
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
                style: GoogleFonts.albertSans(
                  fontSize: 14,
                  color: Colors.black87,
                ),
              ),

              const SizedBox(height: 40),

              // Role cards side by side
              Row(
                children: [
                  Expanded(
                    child: _roleCard(
                      role: 'PARENT',
                      imagePath: 'assets/images/parent.png',
                      onTap: () => setState(() {
                        selectedRole = 'PARENT';
                        caregiverType = null;
                        facilityName = null;
                        widget.registrationData.caregiverType = '';
                        widget.registrationData.facilityName = '';
                      }),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _roleCard(
                      role: 'CAREGIVER',
                      imagePath: 'assets/images/med staff.png',
                      onTap: _showCaregiverAffiliationDialog,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Description box
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: selectedRole == null
                    ? const SizedBox(height: 64, key: ValueKey('empty'))
                    : InkWell(
                        onTap: selectedRole == 'CAREGIVER'
                            ? _showCaregiverAffiliationDialog
                            : null,
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          key: ValueKey("$selectedRole-$caregiverType-$facilityName"),
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF5FA9A9).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF5FA9A9).withValues(alpha: 0.3)),
                          ),
                          child: Column(
                            children: [
                              Text(
                                _roleDescription,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.albertSans(
                                  fontSize: 13,
                                  color: Colors.black,
                                  height: 1.4,
                                ),
                              ),
                              if (selectedRole == 'CAREGIVER') ...[
                                const SizedBox(height: 6),
                                Text(
                                  "(Tap to change affiliation)",
                                  style: GoogleFonts.albertSans(
                                    fontSize: 11,
                                    color: const Color(0xFF5FA9A9),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
              ),

              const SizedBox(height: 40),
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
    required VoidCallback onTap,
  }) {
    final bool isSelected = selectedRole == role;

    return GestureDetector(
      onTap: onTap,
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
                color: const Color(0xFF5FA9A9).withValues(alpha: 0.3),
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
