import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Role selection is Step 1 of the registration flow.
// It allows users to pick their account type (Parent or Caregiver) and
// verify facility affiliation before filling out personal details.
import '../models/registration_data.dart';
import '../services/api_service.dart';
import 'register.dart';
import 'login.dart';

class RoleScreen extends StatefulWidget {
  final RegistrationData? registrationData;

  const RoleScreen({super.key, this.registrationData});

  @override
  State<RoleScreen> createState() => _RoleScreenState();
}

class _RoleScreenState extends State<RoleScreen> {
  late RegistrationData _data;
  String? selectedRole;

  // Facility affiliation state
  bool _isAffiliatedWithFacility = false;
  final TextEditingController _tokenCtrl = TextEditingController();
  bool _isVerifyingToken = false;
  String? _verifiedFacilityName;
  String? _verifiedRole;
  String? _tokenError;

  @override
  void initState() {
    super.initState();
    _data = widget.registrationData ?? RegistrationData();
    if (_data.role.isNotEmpty) {
      if (_data.role.toLowerCase() == 'parent') {
        selectedRole = 'PARENT';
      } else {
        selectedRole = 'CAREGIVER';
      }
    }
    if (_data.inviteToken.isNotEmpty) {
      _tokenCtrl.text = _data.inviteToken;
      _isAffiliatedWithFacility = true;
      if (_data.facilityName.isNotEmpty) {
        _verifiedFacilityName = _data.facilityName;
      }
      if (_data.role.isNotEmpty) {
        _verifiedRole = _data.role;
      }
    }
  }

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
    final raw = _tokenCtrl.text;
    final token = raw
        .replaceAll(RegExp(r'[\u200B-\u200D\uFEFF\u00A0\s\r\n]'), '')
        .replaceAll(RegExp(r'[^a-zA-Z0-9\-]'), '')
        .toUpperCase();

    if (token.isEmpty) {
      setState(() => _tokenError = 'Please enter your invitation token.');
      return;
    }

    _tokenCtrl.text = token;
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
      final designatedRole = (res['role'] as String?)?.trim().toLowerCase();

      // [ROLE ENFORCEMENT] The mobile application strictly supports Caregivers and Parents.
      // Medical staff accounts must use the web portal.
      if (designatedRole != 'caregiver') {
        setState(() {
          _verifiedFacilityName = null;
          _verifiedRole = null;
          _data.inviteToken = '';
          _data.facilityName = '';
          _tokenError = 'Medical Staff tokens are not permitted on mobile. Please provide a Caregiver invitation token.';
        });

        if (!mounted) return;
        await _showIncompatibleRoleWarning(
          facilityName: res['facility_name'] ?? 'Healthcare Facility',
          role: res['role'] ?? 'medical_staff',
        );
        return;
      }

      setState(() {
        _verifiedFacilityName = res['facility_name'];
        _verifiedRole = res['role'];
        _tokenError = null;
        _data.inviteToken = token;
        _data.facilityName = res['facility_name'] ?? '';
        _data.caregiverType = 'facility';
        _data.role = 'caregiver';
        if (res['email'] != null && (res['email'] as String).isNotEmpty) {
          _data.email = (res['email'] as String).trim();
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Verified: Affiliated with ${res['facility_name']} as Caregiver!'),
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

  Future<void> _showIncompatibleRoleWarning({
    required String facilityName,
    required String role,
  }) async {
    final roleDisplay = role.replaceAll('_', ' ').toUpperCase();
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.warning_amber_rounded,
                color: Color(0xFFD97706),
                size: 26,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Incompatible Role',
                style: GoogleFonts.poppins(
                  fontWeight: FontWeight.w700,
                  fontSize: 17,
                  color: const Color(0xFF1E293B),
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This invitation token is designated for a $roleDisplay account at $facilityName.',
              style: GoogleFonts.albertSans(
                fontSize: 14,
                color: const Color(0xFF334155),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.block, color: Color(0xFFDC2626), size: 16),
                      const SizedBox(width: 6),
                      Text(
                        'Mobile App Access Restricted',
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFFB91C1C),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'The Alaga Mobile App is exclusively for Caregivers and Parents.\n\nMedical Staff must register and access clinical ward dashboards using the Alaga Web Application.',
                    style: GoogleFonts.albertSans(
                      fontSize: 12,
                      color: const Color(0xFF7F1D1D),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'You cannot proceed in the mobile app with a Medical Staff token. Please enter a valid Caregiver invitation token or use the web app.',
              style: GoogleFonts.albertSans(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: const Color(0xFFDC2626),
              ),
            ),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00796B),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                'Understand & Enter Caregiver Token',
                style: GoogleFonts.poppins(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool get _canProceed {
    if (selectedRole == null) return false;
    if (selectedRole == 'CAREGIVER' && _isAffiliatedWithFacility) {
      return _verifiedFacilityName != null &&
          _verifiedRole != null &&
          _verifiedRole!.trim().toLowerCase() == 'caregiver';
    }
    return true;
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
      if (_verifiedRole != null && _verifiedRole!.trim().toLowerCase() != 'caregiver') {
        setState(() => _tokenError = 'Medical Staff tokens are not allowed. A Caregiver token is required.');
        await _showIncompatibleRoleWarning(
          facilityName: _verifiedFacilityName ?? 'Healthcare Facility',
          role: _verifiedRole!,
        );
        return;
      }
    } else {
      _data.inviteToken = '';
      _data.caregiverType = selectedRole == 'CAREGIVER' ? 'freelance' : '';
      _data.facilityName = '';
    }

    _data.role = _verifiedRole ?? _mapRoleToBackend(selectedRole!);

    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => RegisterPage(
          registrationData: _data,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            } else {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const LoginPage()),
              );
            }
          },
        ),
        centerTitle: true,
        title: Text(
          "Step 1 of 2: Account Type",
          style: GoogleFonts.poppins(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF004D40),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 12),

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

              const SizedBox(height: 6),

              // Subtitle
              Text(
                "How would you use the app?",
                textAlign: TextAlign.center,
                style: GoogleFonts.albertSans(
                  fontSize: 14,
                  color: Colors.black87,
                ),
              ),

              const SizedBox(height: 28),

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
                        _data.caregiverType = '';
                        _data.facilityName = '';
                        _data.inviteToken = '';
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
                        _data.caregiverType = 'freelance';
                        _data.facilityName = '';
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
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Radio Selection
                      Row(
                        children: [
                          Expanded(
                            child: _facilityRadioOption(
                              label: "Freelance",
                              sublabel: "Independent caregiver",
                              icon: Icons.person_outline_rounded,
                              isSelected: !_isAffiliatedWithFacility,
                              onTap: () => setState(() {
                                _isAffiliatedWithFacility = false;
                                _tokenCtrl.clear();
                                _verifiedFacilityName = null;
                                _verifiedRole = null;
                                _tokenError = null;
                                _data.inviteToken = '';
                                _data.caregiverType = 'freelance';
                                _data.facilityName = '';
                              }),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _facilityRadioOption(
                              label: "Facility Staff",
                              sublabel: "Has invitation token",
                              icon: Icons.local_hospital_outlined,
                              isSelected: _isAffiliatedWithFacility,
                              onTap: () => setState(() {
                                _isAffiliatedWithFacility = true;
                                _data.caregiverType = 'facility';
                              }),
                            ),
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
                width: 220,
                child: ElevatedButton(
                  onPressed: !_canProceed ? null : _handleContinue,
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
                    "Continue to Details",
                    style: GoogleFonts.poppins(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: !_canProceed ? Colors.grey.shade600 : Colors.black,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Link to log in
              GestureDetector(
                onTap: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginPage()),
                  );
                },
                child: RichText(
                  text: TextSpan(
                    text: 'Already registered? ',
                    style: GoogleFonts.albertSans(fontSize: 13, color: Colors.black87),
                    children: [
                      TextSpan(
                        text: 'Log in',
                        style: GoogleFonts.albertSans(
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF00796B),
                          decoration: TextDecoration.underline,
                        ),
                      ),
                      const TextSpan(text: ' instead.'),
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

  Widget _facilityRadioOption({
    required String label,
    required String sublabel,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFE0F2F1) : const Color(0xFFF5F5F0),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? const Color(0xFF00796B) : Colors.grey.shade300,
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  icon,
                  size: 16,
                  color: isSelected ? const Color(0xFF00796B) : Colors.grey.shade600,
                ),
                const Spacer(),
                Icon(
                  isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                  size: 16,
                  color: isSelected ? const Color(0xFF00796B) : Colors.grey.shade400,
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isSelected ? const Color(0xFF004D40) : Colors.black87,
              ),
            ),
            Text(
              sublabel,
              style: GoogleFonts.albertSans(
                fontSize: 9.5,
                color: Colors.grey.shade600,
              ),
            ),
          ],
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
