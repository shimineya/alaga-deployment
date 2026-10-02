import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/user_session.dart';

/// Interactive Onboarding & Feature Tutorial for ALAGA Mobile App.
/// Offers dedicated, tailored walkthroughs for both Caregivers and Parents.
void showInteractiveTutorial(BuildContext context, {String? initialRole, bool force = false}) {
  showDialog(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => InteractiveTutorialDialog(initialRole: initialRole),
  );
}

class InteractiveTutorialDialog extends StatefulWidget {
  final String? initialRole;

  const InteractiveTutorialDialog({super.key, this.initialRole});

  @override
  State<InteractiveTutorialDialog> createState() => _InteractiveTutorialDialogState();
}

class _InteractiveTutorialDialogState extends State<InteractiveTutorialDialog> {
  late String _currentRole;
  int _currentStep = 0;
  final PageController _pageController = PageController();

  @override
  void initState() {
    super.initState();
    final bool isParent = (widget.initialRole != null)
        ? (widget.initialRole!.toLowerCase() == 'parent')
        : (UserSession.current?.isParent ?? true);
    _currentRole = isParent ? 'Parent' : 'Caregiver';
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _caregiverSteps => [
    {
      'title': 'Welcome to ALAGA Clinical Care',
      'subtitle': 'Real-Time Biometric & Hygiene Telemetry Platform',
      'icon': Icons.local_hospital_rounded,
      'color': const Color(0xFF00796B),
      'badge': 'CLINICAL OVERVIEW',
      'description':
          'ALAGA equips healthcare professionals and caregivers with real-time biometric streaming, automated threshold detection, and instant diaper hygiene tracking for continuous patient safety.',
      'highlights': [
        'Multi-patient roster monitoring at a glance',
        'Direct synchronization with bedside MAX30102 & ADC sensors',
        'Clinical-grade anomaly triage and alert response',
      ],
    },
    {
      'title': 'Patient Priority Cards & Statuses',
      'subtitle': 'Instant Triage & Sensor Health Monitoring',
      'icon': Icons.monitor_heart_rounded,
      'color': const Color(0xFFEF4444),
      'badge': 'ROSTER TRIAGE',
      'description':
          'Each patient card streams live Heart Rate (BPM), Body Temperature (°C), Oxygen Saturation (SpO2), and Diaper Wetness (%).',
      'highlights': [
        'DETACHED badge warns immediately if a sensor uncouples from skin',
        'Color-coded borders alert you to emergency clinical breaches',
        'Tap any card to view detailed clinical profiles and trend charts',
      ],
    },
    {
      'title': 'Smart Diaper Sensor & Hygiene Alerts',
      'subtitle': 'Automated Wetness Level Detection',
      'icon': Icons.opacity_rounded,
      'color': const Color(0xFF0D9488),
      'badge': 'DIAPER MONITORING',
      'description':
          'The non-invasive smart diaper hygiene sensor monitors wetness levels in real-time, preventing prolonged moisture exposure and skin breakdown.',
      'highlights': [
        '< 30%: Dry & Clean — optimal hygiene state',
        '30% - 69%: Damp — prepare for upcoming change',
        '≥ 70%: Wet / Change Diaper — prompt care required',
      ],
    },
    {
      'title': 'Clinical Alerts & Acknowledgment',
      'subtitle': 'Rapid Anomaly Response & Triage Workflow',
      'icon': Icons.warning_amber_rounded,
      'color': const Color(0xFFDC2626),
      'badge': 'SAFETY NET',
      'description':
          'When vital thresholds or wetness limits are breached, clinical alerts trigger immediately on your mobile device with sound and visual badges.',
      'highlights': [
        'Tap "Clinical Alerts" to review unacknowledged events',
        'Acknowledge alerts to log your clinical review in the audit trail',
        'Emergency thresholds are calibrated to prevent false alarms',
      ],
    },
    {
      'title': 'Vital Statistics History & Trends',
      'subtitle': 'Day, Week, and Month Trend Analysis',
      'icon': Icons.show_chart_rounded,
      'color': const Color(0xFF3B82F6),
      'badge': 'HISTORICAL TELEMETRY',
      'description':
          'Access chronological trend lines directly in the patient profile and patient list to evaluate recovery trajectories and response to treatment.',
      'highlights': [
        'Toggle between 24-Hour, 7-Day, and 30-Day timeframes',
        'Review heart rate variability, temperature curves, and SpO2 dips',
        'Analyze diaper wetness cycles to plan optimal change schedules',
      ],
    },
    {
      'title': 'Hardware Sensor Pairing & Management',
      'subtitle': 'Zero-Touch Connection & Battery Tracking',
      'icon': Icons.devices_other_rounded,
      'color': const Color(0xFF004D40),
      'badge': 'HARDWARE MANAGEMENT',
      'description':
          'Manage your device inventory in "Device Management". Verify battery levels and WiFi signal before commencing each care shift.',
      'highlights': [
        'Pair vital signs sensors (VS-) and diaper sensors (SD-)',
        'Monitor live battery percentages and signal strengths',
        'Standby mode protects sensors between patient assignments',
      ],
    },
  ];

  List<Map<String, dynamic>> get _parentSteps => [
    {
      'title': 'Welcome to ALAGA Family Care',
      'subtitle': 'Peace of Mind for Your Loved Ones',
      'icon': Icons.family_restroom_rounded,
      'color': const Color(0xFF00796B),
      'badge': 'FAMILY GUARDIAN',
      'description':
          'ALAGA keeps you continuously connected to your child, infant, or elderly family member. Monitor their vital signs and diaper comfort from home or work.',
      'highlights': [
        'Live continuous health updates on your mobile phone',
        'Smart diaper comfort alerts when a change is needed',
        'Direct connection to assigned hospital or home caregivers',
      ],
    },
    {
      'title': 'Understanding Vital Signs',
      'subtitle': 'Simple, Color-Coded Health Indicators',
      'icon': Icons.favorite_rounded,
      'color': const Color(0xFFEF4444),
      'badge': 'VITALS GUIDE',
      'description':
          'Your loved one’s dashboard displays four vital metrics with intuitive color codes:',
      'highlights': [
        'Heart Rate (BPM): Normal range is 60–100 bpm (faster for infants)',
        'Body Temperature (°C): Normal range is 36.5°C–37.5°C',
        'Blood Oxygen (SpO2): Ideal range is 95%–100%',
        'Detached Warning: Alerting if the band slips off during sleep',
      ],
    },
    {
      'title': 'Smart Diaper Comfort System',
      'subtitle': 'Gentle Skin Protection & Hygiene Alerts',
      'icon': Icons.baby_changing_station_rounded,
      'color': const Color(0xFF0D9488),
      'badge': 'HYGIENE CARE',
      'description':
          'Never worry about diaper rash or missed changes. The sensor gently measures wetness and informs you exactly when care is required.',
      'highlights': [
        'Green (Dry): Comfortable, clean, and resting happily',
        'Amber (Damp): Getting damp, check on them when convenient',
        'Red (Wet): Time for a fresh diaper to protect delicate skin',
      ],
    },
    {
      'title': 'Personalized Safety Net & Alerts',
      'subtitle': 'Custom Notification Thresholds',
      'icon': Icons.notifications_active_rounded,
      'color': const Color(0xFFF59E0B),
      'badge': 'NOTIFICATIONS',
      'description':
          'Customize safety limits in Settings to match your family doctor’s recommendations. ALAGA notifies you the moment something needs attention.',
      'highlights': [
        'Receive instant notifications for fever or irregular pulse',
        'Audible chime options tailored to your preference',
        'Review clinical emergency contacts stored directly on the card',
      ],
    },
    {
      'title': 'Care Schedules & Daily Reminders',
      'subtitle': 'Medications, Visits & Repositioning',
      'icon': Icons.event_note_rounded,
      'color': const Color(0xFF2563EB),
      'badge': 'DAILY ROUTINE',
      'description':
          'Organize daily prescriptions, feeding schedules, doctor visits, and repositioning intervals in the Medication & Routine tracker.',
      'highlights': [
        'Receive proactive reminders so doses are never missed',
        'Track completed care activities throughout the day',
        'Synchronize notes with visiting nurses and caregivers',
      ],
    },
    {
      'title': 'Privacy & Family Control',
      'subtitle': 'Your Data, Your Protection',
      'icon': Icons.security_rounded,
      'color': const Color(0xFF004D40),
      'badge': 'DATA SECURITY',
      'description':
          'ALAGA safeguards your family’s medical records with healthcare-grade encryption and privacy controls.',
      'highlights': [
        'Role-scoped access ensures only authorized family and doctors see data',
        'Full control to edit clinical information or request record deletion',
        'Biometric fingerprint/face unlock for fast, secure access',
      ],
    },
  ];

  List<Map<String, dynamic>> get _currentSteps =>
      _currentRole == 'Caregiver' ? _caregiverSteps : _parentSteps;

  @override
  Widget build(BuildContext context) {
    final steps = _currentSteps;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480, maxHeight: 620),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          children: [
            // Top Bar: Role Selector & Close
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 14),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0F2F1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.school_rounded, color: Color(0xFF00796B), size: 18),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _currentRole == 'Parent' ? 'FAMILY & PARENT GUIDE' : 'CLINICAL CAREGIVER GUIDE',
                          style: GoogleFonts.poppins(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF00796B),
                            letterSpacing: 0.8,
                          ),
                        ),
                        Text(
                          _currentRole == 'Parent' ? 'Parent App Walkthrough' : 'Caregiver Clinical Walkthrough',
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Dedicated Role Badge (Strictly role-scoped, no cross-switching)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
                    decoration: BoxDecoration(
                      color: _currentRole == 'Parent' ? const Color(0xFFEFF6FF) : const Color(0xFFE0F2F1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _currentRole == 'Parent' ? const Color(0xFFBFDBFE) : const Color(0xFF80CBC4),
                      ),
                    ),
                    child: Text(
                      _currentRole == 'Parent' ? 'Parent' : 'Caregiver',
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: _currentRole == 'Parent' ? const Color(0xFF1D4ED8) : const Color(0xFF004D40),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    icon: const Icon(Icons.close, color: Color(0xFF64748B), size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // Step Progress Bar
            LinearProgressIndicator(
              value: (_currentStep + 1) / steps.length,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF0D9488)),
              minHeight: 3.5,
            ),

            // Content Area
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: steps.length,
                itemBuilder: (context, index) {
                  final cur = steps[index];
                  final color = cur['color'] as Color;
                  return SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Icon + Badge
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              width: 52,
                              height: 52,
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: color.withValues(alpha: 0.2)),
                              ),
                              child: Icon(cur['icon'] as IconData, color: color, size: 28),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: color.withValues(alpha: 0.2)),
                              ),
                              child: Text(
                                cur['badge'] as String,
                                style: GoogleFonts.poppins(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: color,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Title & Subtitle
                        Text(
                          cur['title'] as String,
                          style: GoogleFonts.poppins(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF0F172A),
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          cur['subtitle'] as String,
                          style: GoogleFonts.albertSans(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF0D9488),
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Description
                        Text(
                          cur['description'] as String,
                          style: GoogleFonts.albertSans(
                            fontSize: 13,
                            color: const Color(0xFF334155),
                            height: 1.45,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Highlights
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: (cur['highlights'] as List<String>).map((h) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 8.0),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2.0),
                                      child: Icon(Icons.check_circle_rounded, size: 15, color: color),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        h,
                                        style: GoogleFonts.albertSans(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: const Color(0xFF1E293B),
                                          height: 1.35,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Bottom Navigation Controls
            Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
                border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Step Indicator Dots
                  Row(
                    children: List.generate(steps.length, (i) {
                      final isCurrent = i == _currentStep;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(horizontal: 2.5),
                        width: isCurrent ? 18 : 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: isCurrent ? const Color(0xFF00796B) : const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      );
                    }),
                  ),

                  // Buttons
                  Row(
                    children: [
                      if (_currentStep > 0)
                        TextButton(
                          onPressed: () {
                            setState(() => _currentStep--);
                            _pageController.previousPage(
                              duration: const Duration(milliseconds: 250),
                              curve: Curves.easeOutCubic,
                            );
                          },
                          child: Text(
                            'Back',
                            style: GoogleFonts.poppins(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ),
                      const SizedBox(width: 6),
                      ElevatedButton(
                        onPressed: () {
                          if (_currentStep < steps.length - 1) {
                            setState(() => _currentStep++);
                            _pageController.nextPage(
                              duration: const Duration(milliseconds: 250),
                              curve: Curves.easeOutCubic,
                            );
                          } else {
                            Navigator.pop(context);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00796B),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 0,
                        ),
                        child: Text(
                          _currentStep < steps.length - 1 ? 'Next' : 'Got It!',
                          style: GoogleFonts.poppins(fontSize: 12.5, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
