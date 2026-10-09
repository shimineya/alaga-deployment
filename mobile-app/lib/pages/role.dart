import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

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
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static const int _lockoutDurationSeconds = 3600; // 1-Hour Cooldown Lockout

  late RegistrationData _data;
  String? selectedRole;

  // Facility affiliation state
  bool _isAffiliatedWithFacility = false;
  final TextEditingController _tokenCtrl = TextEditingController();
  bool _isVerifyingToken = false;
  String? _verifiedFacilityName;
  String? _verifiedRole;
  String? _tokenError;

  // Incompatible role attempt limit & cooldown
  int _incompatibleRoleAttempts = 0;
  int _cooldownSecondsRemaining = 0;
  Timer? _cooldownTimer;

  bool get _isLockedOut => _cooldownSecondsRemaining > 0;

  @override
  void initState() {
    super.initState();
    _loadCooldownState();
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

  Future<void> _loadCooldownState() async {
    try {
      final attemptsStr = await _storage.read(key: 'token_incompatible_attempts');
      if (attemptsStr != null) {
        _incompatibleRoleAttempts = int.tryParse(attemptsStr) ?? 0;
      }
      final lockoutStr = await _storage.read(key: 'token_lockout_until');
      if (lockoutStr != null) {
        final lockoutUntil = DateTime.tryParse(lockoutStr);
        if (lockoutUntil != null && lockoutUntil.isAfter(DateTime.now())) {
          final diff = lockoutUntil.difference(DateTime.now()).inSeconds;
          if (diff > 0) {
            _startCooldown(diff, persist: false);
          }
        } else {
          await _clearCooldownState();
        }
      }
    } catch (_) {}
  }

  Future<void> _clearCooldownState() async {
    try {
      await _storage.delete(key: 'token_lockout_until');
      await _storage.delete(key: 'token_incompatible_attempts');
    } catch (_) {}
  }

  String _formatDuration(int seconds) {
    if (seconds >= 3600) {
      final hours = seconds ~/ 3600;
      final mins = (seconds % 3600) ~/ 60;
      return '$hours hr${hours > 1 ? 's' : ''}${mins > 0 ? ' $mins min' : ''}';
    } else if (seconds >= 60) {
      final mins = seconds ~/ 60;
      final secs = seconds % 60;
      return '$mins min${secs > 0 ? ' $secs s' : ''}';
    }
    return '$seconds second${seconds == 1 ? '' : 's'}';
  }

  String _formatDurationShort(int seconds) {
    if (seconds >= 3600) {
      final hours = seconds ~/ 3600;
      final mins = (seconds % 3600) ~/ 60;
      return '${hours}h ${mins}m';
    } else if (seconds >= 60) {
      final mins = seconds ~/ 60;
      final secs = seconds % 60;
      return '${mins}m ${secs}s';
    }
    return '${seconds}s';
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _tokenCtrl.dispose();
    super.dispose();
  }

  void _startCooldown(int seconds, {bool persist = true}) {
    _cooldownTimer?.cancel();
    if (persist) {
      final lockoutUntil = DateTime.now().add(Duration(seconds: seconds));
      _storage.write(key: 'token_lockout_until', value: lockoutUntil.toIso8601String());
      _storage.write(key: 'token_incompatible_attempts', value: '$_incompatibleRoleAttempts');
    }

    setState(() {
      _cooldownSecondsRemaining = seconds;
    });
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_cooldownSecondsRemaining <= 1) {
        timer.cancel();
        _clearCooldownState();
        setState(() {
          _cooldownSecondsRemaining = 0;
          _incompatibleRoleAttempts = 0;
          _tokenError = null;
        });
      } else {
        setState(() {
          _cooldownSecondsRemaining--;
          _tokenError = 'Too many incompatible attempts. Please wait ${_formatDuration(_cooldownSecondsRemaining)} before trying again.';
        });
      }
    });
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
    if (_isLockedOut) {
      setState(() => _tokenError = 'Too many incompatible attempts. Please wait ${_formatDuration(_cooldownSecondsRemaining)} before trying again.');
      return;
    }

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
        _incompatibleRoleAttempts++;
        final isLocked = _incompatibleRoleAttempts >= 3;

        if (isLocked) {
          _startCooldown(_lockoutDurationSeconds);
        } else {
          _storage.write(key: 'token_incompatible_attempts', value: '$_incompatibleRoleAttempts');
        }

        setState(() {
          _verifiedFacilityName = null;
          _verifiedRole = null;
          _data.inviteToken = '';
          _data.facilityName = '';
          _tokenError = isLocked
              ? 'Maximum attempts reached (3/3). Verification locked for 1 hour.'
              : 'Medical Staff tokens are not permitted on mobile ($_incompatibleRoleAttempts/3 attempts used).';
        });

        if (!mounted) return;
        await _showIncompatibleRoleWarning(
          role: res['role'] ?? 'medical_staff',
          attemptCount: _incompatibleRoleAttempts,
          isLocked: isLocked,
        );
        return;
      }

      // Successful caregiver token: reset counter and storage
      _incompatibleRoleAttempts = 0;
      _clearCooldownState();

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
    required String role,
    required int attemptCount,
    required bool isLocked,
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
                color: isLocked ? const Color(0xFFFEE2E2) : const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                isLocked ? Icons.lock_clock_outlined : Icons.warning_amber_rounded,
                color: isLocked ? const Color(0xFFDC2626) : const Color(0xFFD97706),
                size: 26,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                isLocked ? 'Attempt Limit Reached' : 'Incompatible Role',
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
              'This invitation token is designated for a $roleDisplay account.',
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
                      fontSize: 12.5,
                      color: const Color(0xFF7F1D1D),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (isLocked) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFDA4AF)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.timer_outlined, color: Color(0xFFBE123C), size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Attempt 3 of 3: Cooldown active. Token verification is locked for 1 hour.',
                        style: GoogleFonts.albertSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF9F1239),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFCD34D)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: Color(0xFFB45309), size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Attempt $attemptCount of 3 (${3 - attemptCount} attempt${3 - attemptCount == 1 ? '' : 's'} remaining before a 1-hour cooldown).',
                        style: GoogleFonts.albertSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF92400E),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
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
                isLocked ? 'Close' : 'Understand & Enter Caregiver Token',
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
    if (selectedRole == null || _isLockedOut) return false;
    if (selectedRole == 'CAREGIVER' && _isAffiliatedWithFacility) {
      return _verifiedFacilityName != null &&
          _verifiedRole != null &&
          _verifiedRole!.trim().toLowerCase() == 'caregiver';
    }
    return true;
  }

  void _handleContinue() async {
    if (selectedRole == null || _isLockedOut) return;

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
        _incompatibleRoleAttempts++;
        final isLocked = _incompatibleRoleAttempts >= 3;
        if (isLocked) {
          _startCooldown(_lockoutDurationSeconds);
        } else {
          _storage.write(key: 'token_incompatible_attempts', value: '$_incompatibleRoleAttempts');
        }
        setState(() {
          _tokenError = isLocked
              ? 'Maximum attempts reached (3/3). Input locked for 1 hour.'
              : 'Medical Staff tokens are not allowed ($_incompatibleRoleAttempts/3 attempts used).';
        });
        await _showIncompatibleRoleWarning(
          role: _verifiedRole!,
          attemptCount: _incompatibleRoleAttempts,
          isLocked: isLocked,
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
                                enabled: !_isLockedOut,
                                textCapitalization: TextCapitalization.characters,
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.5,
                                  color: _isLockedOut ? Colors.grey : const Color(0xFF004D40),
                                ),
                                decoration: InputDecoration(
                                  hintText: _isLockedOut ? "Cooldown active (${_formatDurationShort(_cooldownSecondsRemaining)})" : "FAC-XXXXXXXX",
                                  hintStyle: GoogleFonts.poppins(
                                    fontSize: 12,
                                    letterSpacing: 1.0,
                                    color: Colors.grey.shade400,
                                    fontWeight: FontWeight.normal,
                                  ),
                                  filled: true,
                                  fillColor: _isLockedOut ? Colors.grey.shade200 : const Color(0xFFF5F5F0),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: BorderSide(color: Colors.grey.shade400),
                                  ),
                                  disabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: BorderSide(color: Colors.grey.shade300),
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
                              onPressed: (_isVerifyingToken || _isLockedOut) ? null : _verifyToken,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: _isLockedOut ? Colors.grey.shade400 : const Color(0xFF00796B),
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
                                      _isLockedOut ? _formatDurationShort(_cooldownSecondsRemaining) : "Verify",
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
