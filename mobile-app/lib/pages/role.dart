import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Role selection is part of the registration flow.
// It receives RegistrationData from register.dart and passes it to register1.dart.
import '../models/registration_data.dart';
import '../services/api_service.dart';
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

  // Facility affiliation state
  bool _isAffiliatedWithFacility = false;
  final TextEditingController _tokenCtrl = TextEditingController();
  bool _isVerifyingToken = false;
  String? _verifiedFacilityName;
  String? _verifiedRole;
  String? _tokenError;

  @override
  void dispose() {
    _tokenCtrl.dispose();
    super.dispose();
  }

  String get _roleDescription {
    if (selectedRole == 'PARENT') {
      return 'I would like to watch over the well being of my child.';
    } else if (selectedRole == 'CAREGIVER') {
      return 'Caregiver — Providing dedicated, compassionate patient care.';
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

  Future<void> _verifyToken() async {
    final token = _tokenCtrl.text.trim().toUpperCase();
    if (token.isEmpty) {
      setState(() => _tokenError = 'Please enter your invitation token.');
      return;
    }
    setState(() {
      _isVerifyingToken = true;
      _tokenError = null;
    });

    final res = await ApiService.post(
      '/api/auth/verify-invite-token',
      body: {'token': token},
      requiresAuth: false,
    );

    if (!mounted) return;
    setState(() => _isVerifyingToken = false);

    if (res['success'] == true && res['valid'] == true) {
      setState(() {
        _verifiedFacilityName = res['facility_name'];
        _verifiedRole = res['role'];
        _tokenError = null;
        widget.registrationData.inviteToken = token;
        widget.registrationData.facilityName = res['facility_name'] ?? '';
        widget.registrationData.caregiverType = 'facility';
        if (res['role'] != null) {
          widget.registrationData.role = res['role'];
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Verified: Affiliated with ${res['facility_name']}!'),
          backgroundColor: const Color(0xFF00796B),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      setState(() {
        _verifiedFacilityName = null;
        _verifiedRole = null;
        _tokenError = res['message'] ?? 'Invalid or expired invitation token.';
      });
    }
  }

  void _handleContinue() async {
    if (selectedRole == null) return;

    if (selectedRole == 'CAREGIVER' && _isAffiliatedWithFacility) {
      if (_verifiedFacilityName == null) {
        if (_tokenCtrl.text.trim().isEmpty) {
          setState(() => _tokenError = 'Please enter your facility invitation token.');
          return;
        }
        await _verifyToken();
        if (_verifiedFacilityName == null) return;
      }
    } else {
      widget.registrationData.inviteToken = '';
      widget.registrationData.caregiverType = selectedRole == 'CAREGIVER' ? 'freelance' : '';
      widget.registrationData.facilityName = '';
    }

    widget.registrationData.role = _verifiedRole ?? _mapRoleToBackend(selectedRole!);

    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreateCredentialsPage(
          registrationData: widget.registrationData,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: SafeArea(
        child: SingleChildScrollView(
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

              const SizedBox(height: 32),

              // Role cards side by side
              Row(
                children: [
                  Expanded(
                    child: _roleCard(
                      role: 'PARENT',
                      imagePath: 'assets/images/parent.png',
                      onTap: () => setState(() {
                        selectedRole = 'PARENT';
                        _isAffiliatedWithFacility = false;
                        _tokenCtrl.clear();
                        _verifiedFacilityName = null;
                        _verifiedRole = null;
                        _tokenError = null;
                        widget.registrationData.caregiverType = '';
                        widget.registrationData.facilityName = '';
                        widget.registrationData.inviteToken = '';
                      }),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _roleCard(
                      role: 'CAREGIVER',
                      imagePath: 'assets/images/med staff.png',
                      onTap: () => setState(() {
                        selectedRole = 'CAREGIVER';
                        widget.registrationData.caregiverType = 'freelance';
                        widget.registrationData.facilityName = '';
                      }),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: selectedRole == null
                    ? const SizedBox(height: 32, key: ValueKey('empty'))
                    : Container(
                        key: ValueKey("$selectedRole"),
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF5FA9A9).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF5FA9A9).withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          _roleDescription,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.albertSans(
                            fontSize: 13,
                            color: Colors.black,
                            height: 1.4,
                          ),
                        ),
                      ),
              ),

              // Facility Belonging Section for Caregivers
              if (selectedRole == 'CAREGIVER') ...[
                const SizedBox(height: 20),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF5FA9A9).withValues(alpha: 0.3)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.03),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.apartment_rounded, color: Color(0xFF00796B), size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "Are you affiliated with a facility?",
                                  style: GoogleFonts.poppins(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFF1B393D),
                                  ),
                                ),
                                Text(
                                  "Hospital, nursing center, or clinic",
                                  style: GoogleFonts.albertSans(
                                    fontSize: 11,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Switch(
                            value: _isAffiliatedWithFacility,
                            activeThumbColor: const Color(0xFF00796B),
                            onChanged: (val) {
                              setState(() {
                                _isAffiliatedWithFacility = val;
                                if (!val) {
                                  _tokenCtrl.clear();
                                  _verifiedFacilityName = null;
                                  _verifiedRole = null;
                                  _tokenError = null;
                                  widget.registrationData.inviteToken = '';
                                  widget.registrationData.caregiverType = 'freelance';
                                  widget.registrationData.facilityName = '';
                                }
                              });
                            },
                          ),
                        ],
                      ),

                      if (_isAffiliatedWithFacility) ...[
                        const Divider(height: 20),
                        Text(
                          "Enter Invitation Token *",
                          style: GoogleFonts.poppins(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: _tokenCtrl,
                                textCapitalization: TextCapitalization.characters,
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.5,
                                  color: const Color(0xFF004D40),
                                ),
                                decoration: InputDecoration(
                                  hintText: "FAC-XXXXXXXX",
                                  hintStyle: GoogleFonts.poppins(
                                    fontSize: 12,
                                    letterSpacing: 1.0,
                                    color: Colors.grey.shade400,
                                    fontWeight: FontWeight.normal,
                                  ),
                                  filled: true,
                                  fillColor: const Color(0xFFF5F5F0),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: BorderSide(color: Colors.grey.shade400),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(color: Color(0xFF00796B), width: 2),
                                  ),
                                ),
                                onChanged: (v) {
                                  if (_verifiedFacilityName != null) {
                                    setState(() {
                                      _verifiedFacilityName = null;
                                      _verifiedRole = null;
                                    });
                                  }
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton(
                              onPressed: _isVerifyingToken ? null : _verifyToken,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF00796B),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              child: _isVerifyingToken
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    )
                                  : Text(
                                      "Verify",
                                      style: GoogleFonts.poppins(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.white,
                                      ),
                                    ),
                            ),
                          ],
                        ),

                        if (_verifiedFacilityName != null) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE8F5E9),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFF81C784)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32), size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        "Belongs to: $_verifiedFacilityName",
                                        style: GoogleFonts.poppins(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF1B5E20),
                                        ),
                                      ),
                                      if (_verifiedRole != null)
                                        Text(
                                          "Designated Role: ${_verifiedRole!.replaceAll('_', ' ').toUpperCase()}",
                                          style: GoogleFonts.albertSans(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                            color: const Color(0xFF2E7D32),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        if (_tokenError != null) ...[
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 14),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  _tokenError!,
                                  style: GoogleFonts.albertSans(fontSize: 11, color: Colors.redAccent),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 32),

              // Continue button
              SizedBox(
                width: 200,
                child: ElevatedButton(
                  onPressed: selectedRole == null ? null : _handleContinue,
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
