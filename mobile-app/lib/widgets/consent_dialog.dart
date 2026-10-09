import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../theme/alaga_theme.dart';
import '../models/user_session.dart';

/// Shows the mandatory Clinical Governance & Legal Consent Dialog.
/// Enforces scroll-to-bottom verification before allowing the user to accept.
Future<bool?> showConsentAgreementDialog(
  BuildContext context, {
  int? userId,
  String? userRole,
  bool isReadOnly = false,
}) {
  return showDialog<bool>(
    context: context,
    barrierDismissible: isReadOnly,
    builder: (ctx) => ConsentAgreementDialog(
      userId: userId,
      userRole: userRole,
      isReadOnly: isReadOnly,
    ),
  );
}

class ConsentAgreementDialog extends StatefulWidget {
  final int? userId;
  final String? userRole;
  final bool isReadOnly;

  const ConsentAgreementDialog({
    super.key,
    this.userId,
    this.userRole,
    this.isReadOnly = false,
  });

  @override
  State<ConsentAgreementDialog> createState() => _ConsentAgreementDialogState();
}

class _ConsentAgreementDialogState extends State<ConsentAgreementDialog> {
  final ScrollController _scrollController = ScrollController();
  List<Map<String, dynamic>> _forms = [];
  bool _isLoading = true;
  int _currentFormIndex = 0;
  final Map<String, bool> _hasScrolled = {};
  final Map<String, bool> _checked = {};
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadForms();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients || _forms.isEmpty) return;
    final currentForm = _forms[_currentFormIndex];
    final id = currentForm['id'] as String;

    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 24) {
      if (!(_hasScrolled[id] ?? false)) {
        setState(() {
          _hasScrolled[id] = true;
        });
      }
    }
  }

  Future<void> _loadForms() async {
    setState(() => _isLoading = true);
    final role = widget.userRole ?? UserSession.current?.role ?? 'all';

    try {
      final res = await ApiService.get(
        '/api/compliance/forms?role=$role',
        requiresAuth: false,
      );

      if (res['success'] == true && res['forms'] is List) {
        final list = List<Map<String, dynamic>>.from(res['forms']);
        setState(() {
          _forms = list;
          if (widget.isReadOnly) {
            for (var f in list) {
              _hasScrolled[f['id'] as String] = true;
            }
          }
        });
      } else {
        _useFallbackForms();
      }
    } catch (_) {
      _useFallbackForms();
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
        _checkIfShortContent();
      }
    }
  }

  void _useFallbackForms() {
    setState(() {
      _forms = [
        {
          'id': 'terms_and_conditions',
          'title': 'Platform Terms and Conditions',
          'category': 'Legal & Terms of Service',
          'summary': 'Governs acceptable use of the ALAGA healthcare monitoring portal, account responsibilities, system uptime, and auxiliary hardware disclaimers.',
          'content': '1. ACCEPTANCE OF TERMS\nBy accessing or using the ALAGA Healthcare Monitoring System, you agree to be bound by these Platform Terms and Conditions.\n\n2. AUXILIARY HARDWARE DISCLAIMER\nALAGA HARDWARE DEVICES ARE AUXILIARY MONITORING AIDS AND ARE NOT CERTIFIED AS LIFE-SUPPORT SYSTEMS. The system is designed to augment, not substitute, hands-on clinical observation, parental attentiveness, and professional medical supervision.\n\n3. ACCOUNT CREDENTIALS & SECURITY OBLIGATIONS\nUsers are responsible for preserving credential confidentiality. Any activity under your authenticated session is deemed authorized.\n\n4. CONNECTIVITY LIMITATIONS\nContinuous vital sign and sensor monitoring relies on Wi-Fi, battery capacity, cellular internet connectivity, and cloud backend availability. ALAGA implements automatic store-and-forward buffers during network drops.',
        },
        {
          'id': 'privacy_policy',
          'title': 'Platform Privacy Policy (RA 10173)',
          'category': 'Data Governance & Privacy',
          'summary': 'Details lawful processing of Personal Health Information (PHI) under Philippine Republic Act 10173 (Data Privacy Act of 2012).',
          'content': '1. STATUTORY COMPLIANCE\nIn accordance with Republic Act No. 10173 (Philippine Data Privacy Act of 2012), ALAGA adheres to transparency, legitimate purpose, and proportionality in collecting and processing Personal Health Information.\n\n2. INFORMATION COLLECTED\nDemographics, real-time vital signs (heart rate, SpO2, body temperature), diaper moisture percentages, sensor attachment status, and device battery and signal status.\n\n3. ENCRYPTION & DATA STORAGE\nAll vital signs and sensor data transmitted between IoT sensors, mobile devices, and backend endpoints is encrypted in transit using TLS 1.3. Database records are encrypted at rest with AES-256 standards.\n\n4. ACCESS CONTROL\nAccess to patient vital signs and health records is strictly scoped to enrolled parents or assigned clinical staff.',
        },
        {
          'id': 'telemetry_authorization',
          'title': 'Informed Health Data Consent & Continuous Monitoring Authorization',
          'category:': 'Continuous Health Monitoring Consent',
          'summary': 'Explicit authorization for continuous optical vital sign monitoring and smart diaper moisture detection.',
          'content': '1. PURPOSE OF CONTINUOUS MONITORING\nContinuous vital signs monitoring enables immediate identification of acute physiological changes, fever onset, hypoxia episodes, and wet diaper saturation.\n\n2. NATURE OF WEARABLE SENSORS\nYou authorize placement and operation of MAX30102 Optical PPG clips and conductive diaper moisture probes.\n\n3. POTENTIAL RISKS & SKIN INTEGRITY\nSensor components utilize medical-grade hypoallergenic casings. Caregivers agree to routinely inspect skin during diaper changes.',
        },
        {
          'id': 'ai_decision_support_disclaimer',
          'title': 'AI Decision-Support & Monitoring Disclaimer',
          'category': 'AI & Algorithm Disclaimer',
          'summary': 'Declares that Machine Learning anomaly algorithms serve auxiliary decision-support functions only.',
          'content': '1. ASSISTIVE NATURE OF ALGORITHMIC ANALYSIS\nALAGA employs artificial intelligence decision-support algorithms (One-Class SVM) to detect potential vital anomalies.\n\n2. NOT A DIAGNOSTIC DEVICE\nALAGA is not a diagnostic device. All machine learning predictions require confirmation by an attending physician or qualified healthcare personnel.',
        },
      ];
      if (widget.isReadOnly) {
        for (var f in _forms) {
          _hasScrolled[f['id'] as String] = true;
        }
      }
    });
  }

  void _checkIfShortContent() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients || _forms.isEmpty) return;
      final currentForm = _forms[_currentFormIndex];
      final id = currentForm['id'] as String;
      if (_scrollController.position.maxScrollExtent <= 10) {
        setState(() {
          _hasScrolled[id] = true;
        });
      }
    });
  }

  void _selectForm(int index) {
    setState(() {
      _currentFormIndex = index;
    });
    if (_scrollController.hasClients) {
      _scrollController.jumpTo(0);
    }
    _checkIfShortContent();
  }

  bool get _allFormsScrolled {
    if (_forms.isEmpty) return false;
    return _forms.every((f) => _hasScrolled[f['id'] as String] == true);
  }

  bool get _allChecked {
    if (_forms.isEmpty) return false;
    return _forms.every((f) => _checked[f['id'] as String] == true);
  }

  Future<void> _handleAcceptAll() async {
    if (widget.isReadOnly) {
      Navigator.pop(context, true);
      return;
    }

    if (!_allFormsScrolled || !_allChecked) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please read each document to the end and confirm your agreement.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.amber.shade800,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final formIds = _forms.map((f) => f['id']).toList();
      final targetUserId = widget.userId ?? UserSession.current?.id;

      final res = await ApiService.post(
        '/api/compliance/accept',
        body: {
          'user_id': targetUserId,
          'version': 'v1.0',
          'forms_accepted': formIds,
        },
        requiresAuth: UserSession.current != null,
      );

      if (res['success'] == true) {
        if (UserSession.current != null) {
          UserSession.current!.mustAcceptConsent = false;
          await SessionManager.saveSession(UserSession.current!);
        }
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Clinical compliance agreements recorded successfully.',
                style: GoogleFonts.albertSans(),
              ),
              backgroundColor: AlagaColors.statusNormal,
            ),
          );
          Navigator.pop(context, true);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                res['message'] ?? 'Failed to record consent agreements.',
                style: GoogleFonts.albertSans(),
              ),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Network error while recording agreements.',
              style: GoogleFonts.albertSans(),
            ),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentForm = _forms.isNotEmpty ? _forms[_currentFormIndex] : null;
    final currentId = currentForm != null ? currentForm['id'] as String : '';
    final isCurrentScrolled = _hasScrolled[currentId] == true;
    final isCurrentChecked = _checked[currentId] == true;

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: Colors.white,
      clipBehavior: Clip.antiAlias,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 580, maxHeight: 720),
        child: Column(
          children: [
            // Header Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: const BoxDecoration(
                gradient: AlagaGradients.hero,
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.gavel_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ALAGA Clinical Consents',
                          style: GoogleFonts.poppins(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          widget.isReadOnly
                              ? 'Active Legal Terms & Data Privacy Notices'
                              : 'Review & Read to the End to Acknowledge Terms',
                          style: GoogleFonts.albertSans(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (widget.isReadOnly)
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white70),
                      onPressed: () => Navigator.pop(context),
                    ),
                ],
              ),
            ),

            if (_isLoading)
              const Expanded(
                child: Center(
                  child: CircularProgressIndicator(color: AlagaColors.primary),
                ),
              )
            else if (_forms.isEmpty)
              Expanded(
                child: Center(
                  child: Text(
                    'No compliance documents available.',
                    style: GoogleFonts.albertSans(),
                  ),
                ),
              )
            else ...[
              // Document Tabs
              Container(
                height: 52,
                color: AlagaColors.mintUltraLight,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: _forms.length,
                  itemBuilder: (ctx, i) {
                    final f = _forms[i];
                    final fId = f['id'] as String;
                    final isSelected = i == _currentFormIndex;
                    final isRead = _hasScrolled[fId] == true;
                    final isAgreed = _checked[fId] == true;

                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: InkWell(
                        onTap: () => _selectForm(i),
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: isSelected ? Colors.white : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected
                                  ? AlagaColors.primary
                                  : Colors.transparent,
                              width: 1.5,
                            ),
                            boxShadow: isSelected
                                ? [
                                    BoxShadow(
                                      color: AlagaColors.primary.withValues(alpha: 0.08),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    )
                                  ]
                                : null,
                          ),
                          alignment: Alignment.center,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (isAgreed)
                                const Icon(Icons.check_circle_rounded,
                                    size: 14, color: AlagaColors.statusNormal)
                              else if (isRead)
                                const Icon(Icons.check_circle_outline_rounded,
                                    size: 14, color: AlagaColors.accent)
                              else
                                Icon(Icons.description_outlined,
                                    size: 14,
                                    color: isSelected
                                        ? AlagaColors.primary
                                        : AlagaColors.textMuted),
                              const SizedBox(width: 6),
                              Text(
                                f['title'] ?? '',
                                style: GoogleFonts.poppins(
                                  fontSize: 11,
                                  fontWeight: isSelected
                                      ? FontWeight.bold
                                      : FontWeight.w500,
                                  color: isSelected
                                      ? AlagaColors.textPrimary
                                      : AlagaColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),

              // Form Subheader
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(bottom: BorderSide(color: AlagaColors.cardBorder)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            currentForm?['title'] ?? '',
                            style: GoogleFonts.poppins(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: AlagaColors.textPrimary,
                            ),
                          ),
                          if (currentForm?['category'] != null)
                            Text(
                              currentForm!['category'],
                              style: GoogleFonts.albertSans(
                                fontSize: 10,
                                color: AlagaColors.textMuted,
                              ),
                            ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isCurrentScrolled
                            ? AlagaColors.statusNormalBg
                            : AlagaColors.statusWarningBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isCurrentScrolled
                              ? AlagaColors.statusNormalBorder
                              : AlagaColors.statusWarningBorder,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isCurrentScrolled
                                ? Icons.check_circle_rounded
                                : Icons.arrow_downward_rounded,
                            size: 12,
                            color: isCurrentScrolled
                                ? AlagaColors.statusNormal
                                : AlagaColors.statusWarningDark,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isCurrentScrolled ? 'Fully Reviewed' : 'Read to the End',
                            style: GoogleFonts.poppins(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: isCurrentScrolled
                                  ? AlagaColors.statusNormal
                                  : AlagaColors.statusWarningDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Scrollable Legal Text Box
              Expanded(
                child: Container(
                  color: AlagaColors.background,
                  child: Scrollbar(
                    controller: _scrollController,
                    thumbVisibility: true,
                    child: SingleChildScrollView(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(18),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AlagaColors.cardBorder),
                        ),
                        child: Text(
                          currentForm?['content'] ?? '',
                          style: GoogleFonts.albertSans(
                            fontSize: 12,
                            height: 1.6,
                            color: AlagaColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // Agreement Checkbox (Not shown in read-only mode)
              if (!widget.isReadOnly)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: Colors.white,
                  child: Row(
                    children: [
                      Checkbox(
                        value: isCurrentChecked,
                        onChanged: isCurrentScrolled
                            ? (val) {
                                setState(() {
                                  _checked[currentId] = val ?? false;
                                });
                              }
                            : null,
                        activeColor: AlagaColors.primary,
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: isCurrentScrolled
                              ? () {
                                  setState(() {
                                    _checked[currentId] = !isCurrentChecked;
                                  });
                                }
                              : null,
                          child: Text(
                            isCurrentScrolled
                                ? 'I have read and agree to ${currentForm?['title'] ?? 'this policy'}'
                                : 'Please read to the end of this document to enable agreement',
                            style: GoogleFonts.albertSans(
                              fontSize: 11,
                              fontWeight: isCurrentScrolled
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                              color: isCurrentScrolled
                                  ? AlagaColors.textPrimary
                                  : AlagaColors.textMuted,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // Bottom Actions
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: AlagaColors.cardBorder)),
                ),
                child: Row(
                  children: [
                    if (!widget.isReadOnly &&
                        _currentFormIndex < _forms.length - 1)
                      TextButton.icon(
                        onPressed: () => _selectForm(_currentFormIndex + 1),
                        icon: const Icon(Icons.arrow_forward_rounded, size: 14),
                        label: Text(
                          'Next Document',
                          style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                        style: TextButton.styleFrom(
                          foregroundColor: AlagaColors.primary,
                        ),
                      ),
                    const Spacer(),
                    if (!widget.isReadOnly)
                      ElevatedButton(
                        onPressed: (_allFormsScrolled && _allChecked && !_isSubmitting)
                            ? _handleAcceptAll
                            : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AlagaColors.primary,
                          disabledBackgroundColor: AlagaColors.divider,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.check_rounded,
                                      size: 16, color: Colors.white),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Accept All & Continue',
                                    style: GoogleFonts.poppins(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                      )
                    else
                      ElevatedButton(
                        onPressed: () => Navigator.pop(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AlagaColors.primary,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 24, vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: Text(
                          'Close Policies',
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
