import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/user_session.dart';
import '../widgets/interactive_tutorial.dart';

/// ALAGA System & Clinical User Manual
/// Provides comprehensive documentation, operational guidelines, and clinical protocols
/// specifically tailored for both Caregivers and Family Parents/Guardians.
class ManualScreen extends StatefulWidget {
  final String? initialRole;

  const ManualScreen({super.key, this.initialRole});

  @override
  State<ManualScreen> createState() => _ManualScreenState();
}

class _ManualScreenState extends State<ManualScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // CAREGIVER MANUAL CHAPTERS
  final List<Map<String, dynamic>> _caregiverChapters = [
    {
      'title': '1. Clinical Overview & Daily Workflow',
      'icon': Icons.local_hospital_outlined,
      'badge': 'FOUNDATION',
      'summary': 'Core responsibilities, shift initialization, and patient assignment monitoring.',
      'sections': [
        {
          'heading': 'Shift Sign-In & Care Roster',
          'content':
              'Upon logging in, review your assigned patients on the Dashboard. Verify that all patients display an active connection status (green "ACTIVE" badge). For home care scenarios, confirm with the family that the vital signs band and smart diaper are properly fitted.'
        },
        {
          'heading': 'Patient Triage Protocols',
          'content':
              'The Dashboard automatically sorts and highlights patients requiring immediate attention. Red bordered cards indicate unresolved clinical alarms (critical vitals), while amber cards signal threshold breaches (elevated temperature or wet diapers).'
        },
      ],
    },
    {
      'title': '2. Vital Signs Sensor (MAX30102 PPG)',
      'icon': Icons.favorite_outline_rounded,
      'badge': 'BIOMETRIC HARDWARE',
      'summary': 'Placement, attachment verification, detachment detection, and signal quality.',
      'sections': [
        {
          'heading': 'Sensor Placement Guide',
          'content':
              'The MAX30102 PPG sensor must rest flat against well-perfused skin (wrist or inner forearm for adults; foot sole or palm for infants). Ensure the strap is snug but not constrictive.'
        },
        {
          'heading': 'Detached State Recognition',
          'content':
              'When the PPG sensor is removed from skin, the sensor emits 0 BPM and 0% SpO2. ALAGA detects this condition instantly and displays the grey "DETACHED" badge rather than triggering false cardiac arrest alerts. Always re-attach the sensor before escalating.'
        },
        {
          'heading': 'Normal Adult & Pediatric Vital Baselines',
          'content':
              '• Heart Rate: 60 - 100 bpm (Adult), 90 - 160 bpm (Infant)\n• Body Temperature: 36.5°C - 37.5°C (Normothermia)\n• Oxygen Saturation (SpO2): 95% - 100% (Air-ambient)'
        },
      ],
    },
    {
      'title': '3. Smart Diaper Hygiene Sensor (ADC)',
      'icon': Icons.opacity_outlined,
      'badge': 'HYGIENE TELEMETRY',
      'summary': 'Conductive sensor mechanics, moisture percentages, and skin protection.',
      'sections': [
        {
          'heading': 'Moisture Reading Interpretation',
          'content':
              'The smart diaper sensor measures electrical conductance through specialized moisture-sensing strips embedded in the diaper liner:\n'
              '• < 30% (Dry & Clean): Optimal comfort. No action needed.\n'
              '• 30% - 69% (Damp): Initial void detected. Prepare clean replacement supplies.\n'
              '• ≥ 70% (Wet / Change Diaper): High void volume. Immediate change recommended to prevent dermatitis or pressure sores.'
        },
        {
          'heading': 'Sensor Attachment Protocol',
          'content':
              'Fasten the external transmitter clip to the front diaper waistband. Verify the golden pins maintain firm contact with the disposable test strip.'
        },
      ],
    },
    {
      'title': '4. Anomaly Triage & Alert Acknowledgment',
      'icon': Icons.warning_amber_rounded,
      'badge': 'CLINICAL SAFETY',
      'summary': 'Responding to critical alarms, acknowledgment procedures, and audit logging.',
      'sections': [
        {
          'heading': 'Alert Classification',
          'content':
              '• Critical Alarms: Tachycardia (>130 bpm), Bradycardia (<50 bpm), Hypoxia (SpO2 <90%), Severe Hyperthermia (>38.5°C).\n'
              '• Warning Alarms: Elevated temperature (37.6°C - 38.4°C), Prolonged diaper wetness (>45 mins without change).'
        },
        {
          'heading': 'Audit-Compliant Acknowledgment',
          'content':
              'When an alarm sounds, tap the "Clinical Alerts" button on the patient card. Review the alert details, evaluate the patient bed-side, and click "Acknowledge". This logs your user ID, timestamp, and response in the clinical history.'
        },
      ],
    },
    {
      'title': '5. Hardware Inventory & Pairing',
      'icon': Icons.devices_outlined,
      'badge': 'DEVICE OPS',
      'summary': 'Whitelisting serial numbers, pairing with patients, and battery monitoring.',
      'sections': [
        {
          'heading': 'Pairing Procedure',
          'content':
              'Navigate to "Device Management". Only devices assigned to a patient can be paired. Tap the "Pair" button on the assigned device card to activate streaming telemetry between the sensor and cloud backend.'
        },
        {
          'heading': 'Battery & Signal Health',
          'content':
              'Monitor the battery chip on each device card. Recharge devices when battery drops below 20%. WiFi signal indicates RSSI strength: "Good" or "Excellent" represents strong connectivity.'
        },
        {
          'heading': 'Unpairing & Standby Mode',
          'content':
              'When discharging a patient or replacing a sensor, choose "Unpair to Change" (maintains whitelist in STANDBY) or "Unpair Permanently" (clears assignment entirely).'
        },
      ],
    },
    {
      'title': '6. Care Tasks & Medication Administration',
      'icon': Icons.medication_outlined,
      'badge': 'CARE COORDINATION',
      'summary': 'Logging administered doses, scheduled repositioning, and doctor notes.',
      'sections': [
        {
          'heading': 'Medication Tracker Usage',
          'content':
              'Access the Medication Tracker from the side drawer. View scheduled morning, noon, and evening prescriptions. Check off administered doses to synchronize with visiting family members.'
        },
        {
          'heading': 'Repositioning Reminders',
          'content':
              'For bedridden patients, ALAGA triggers 2-hour repositioning prompts to prevent stage-1 pressure ulcers. Log turns and skin inspections in real-time.'
        },
      ],
    },
  ];

  // PARENT MANUAL CHAPTERS
  final List<Map<String, dynamic>> _parentChapters = [
    {
      'title': '1. Welcome & Family Home Care Guide',
      'icon': Icons.home_outlined,
      'badge': 'FAMILY INTRO',
      'summary': 'Getting started with ALAGA, monitoring your loved one, and daily navigation.',
      'sections': [
        {
          'heading': 'About ALAGA',
          'content':
              'ALAGA provides family guardians and parents with peace of mind. Whether your infant is resting in their crib or an elderly relative is resting in another room, you can check their vital health and diaper status from your phone at any time.'
        },
        {
          'heading': 'Your Dashboard Overview',
          'content':
              'Your main screen presents a clean status card for your loved one. It shows their live heart rate, body temperature, oxygen saturation, and whether their diaper is dry, damp, or wet.'
        },
      ],
    },
    {
      'title': '2. Understanding Your Loved One\'s Health Cards',
      'icon': Icons.monitor_heart_outlined,
      'badge': 'HEALTH METRICS',
      'summary': 'What the numbers mean and when you should take action.',
      'sections': [
        {
          'heading': 'Heart Rate (BPM)',
          'content':
              'Measures heartbeats per minute. Normal for resting adults is 60–100 bpm. For infants, heart rates are naturally higher (100–150 bpm). If the number appears in red, check on your loved one immediately.'
        },
        {
          'heading': 'Body Temperature (°C)',
          'content':
              'Comfortable body temperature is between 36.5°C and 37.5°C. A reading above 38.0°C indicates a fever. If the sensor reads "0.0°C" or "DETACHED", the band has likely slipped off and needs repositioning.'
        },
        {
          'heading': 'Blood Oxygen (SpO2 %)',
          'content':
              'Shows how effectively oxygen travels through the bloodstream. Optimal readings are 95% to 100%. Readings below 90% should be reported to your doctor or care coordinator.'
        },
      ],
    },
    {
      'title': '3. Smart Diaper Hygiene & Skin Protection',
      'icon': Icons.baby_changing_station_outlined,
      'badge': 'HYGIENE CARE',
      'summary': 'Keeping skin clean, dry, and preventing irritation or diaper rash.',
      'sections': [
        {
          'heading': 'Wetness Percentage Breakdown',
          'content':
              '• Dry & Clean (<30%): The diaper is fresh and clean. Your loved one is comfortable.\n'
              '• Damp (30% - 69%): Light moisture detected. You may finish your current task before changing.\n'
              '• Wet / Change Diaper (≥70%): Time for a fresh diaper! A prompt change keeps skin healthy.'
        },
        {
          'heading': 'Washing & Strip Replacement',
          'content':
              'The plastic sensor clip is water-resistant but should be unclipped before discarding the diaper. Snap the clip onto the new diaper strip after wiping the area clean.'
        },
      ],
    },
    {
      'title': '4. Safety Net Alerts & Emergency Contacts',
      'icon': Icons.notifications_none_rounded,
      'badge': 'SAFETY & ALERTS',
      'summary': 'Customizing alert thresholds and connecting with healthcare teams.',
      'sections': [
        {
          'heading': 'Setting Your Preferences',
          'content':
              'In Settings, you can configure minimum and maximum thresholds for Heart Rate and Temperature, as well as customize alert ringtones so you are awakened only when genuine care is needed.'
        },
        {
          'heading': 'Emergency Contacts',
          'content':
              'Ensure your emergency contact phone numbers are up to date on your profile. Hospital staff and visiting nurses can view this contact directly on the patient profile card.'
        },
      ],
    },
    {
      'title': '5. Viewing Health Trends (Day, Week, Month)',
      'icon': Icons.timeline_rounded,
      'badge': 'HEALTH PROGRESS',
      'summary': 'Tracking long-term recovery and sharing graphs with your physician.',
      'sections': [
        {
          'heading': 'Vital Statistics Graphs',
          'content':
              'Tap "Profile" on your dependent’s card to open their detailed profile. Scroll to the "Vital Statistics History" section to inspect Day (24-hour), Week (7-day), and Month (30-day) trend graphs.'
        },
        {
          'heading': 'Sharing with Your Doctor',
          'content':
              'During pediatric or geriatric check-ups, show these graphs to your doctor to demonstrate temperature trends and diaper frequency without relying on memory.'
        },
      ],
    },
    {
      'title': '6. Privacy, Security & GDPR Rights',
      'icon': Icons.shield_outlined,
      'badge': 'DATA PRIVACY',
      'summary': 'How ALAGA protects your family’s medical records and privacy.',
      'sections': [
        {
          'heading': 'Data Encryption & Secure Storage',
          'content':
              'All telemetry and identity data are protected with 256-bit AES encryption. Only authorized caregivers and family accounts can view records.'
        },
        {
          'heading': 'Right to Erasure (Patient Removal)',
          'content':
              'As a family account holder, you maintain full ownership of your records. You have the right to request deletion or remove a patient profile at any time in the Patient List.'
        },
      ],
    },
  ];

  List<Map<String, dynamic>> _filterChapters(List<Map<String, dynamic>> chapters) {
    if (_searchQuery.trim().isEmpty) return chapters;
    final q = _searchQuery.toLowerCase().trim();
    return chapters.where((c) {
      final titleMatch = (c['title'] as String).toLowerCase().contains(q);
      final summaryMatch = (c['summary'] as String).toLowerCase().contains(q);
      final badgeMatch = (c['badge'] as String).toLowerCase().contains(q);
      final sectionsMatch = (c['sections'] as List<Map<String, String>>).any((s) =>
          s['heading']!.toLowerCase().contains(q) || s['content']!.toLowerCase().contains(q));
      return titleMatch || summaryMatch || badgeMatch || sectionsMatch;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final bool isParent = (widget.initialRole != null)
        ? (widget.initialRole!.toLowerCase() == 'parent')
        : (UserSession.current?.isParent ?? true);

    final activeChapters = isParent ? _parentChapters : _caregiverChapters;
    final filtered = _filterChapters(activeChapters);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isParent ? 'FAMILY & HOME CARE GUIDE' : 'CLINICAL OPERATIONS MANUAL',
              style: GoogleFonts.poppins(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF00796B),
                letterSpacing: 0.8,
              ),
            ),
            Text(
              isParent ? 'Parent User Manual' : 'Caregiver User Manual',
              style: GoogleFonts.poppins(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF0F172A),
              ),
            ),
          ],
        ),
        actions: [
          // Quick button to launch role-scoped interactive tutorial
          Padding(
            padding: const EdgeInsets.only(right: 12.0),
            child: OutlinedButton.icon(
              onPressed: () {
                showInteractiveTutorial(context, initialRole: isParent ? 'Parent' : 'Caregiver');
              },
              icon: const Icon(Icons.play_circle_outline_rounded, size: 16),
              label: const Text('Tutorial'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF00796B),
                side: const BorderSide(color: Color(0xFF80CBC4)),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                visualDensity: VisualDensity.compact,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(58),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Container(
              height: 42,
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (v) => setState(() => _searchQuery = v),
                style: GoogleFonts.albertSans(fontSize: 13, color: const Color(0xFF0F172A)),
                decoration: InputDecoration(
                  hintText: isParent
                      ? 'Search infant/elderly vitals, diaper, fever, safe limits...'
                      : 'Search clinical triage, sensors, alerts, pairing...',
                  hintStyle: GoogleFonts.albertSans(color: const Color(0xFF94A3B8), fontSize: 12.5),
                  prefixIcon: const Icon(Icons.search, size: 18, color: Color(0xFF00796B)),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 16, color: Color(0xFF64748B)),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
                          },
                        )
                      : null,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          ),
        ),
      ),
      body: _buildChapterList(filtered, isCaregiver: !isParent),
    );
  }

  Widget _buildChapterList(List<Map<String, dynamic>> chapters, {required bool isCaregiver}) {
    if (chapters.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.search_off_rounded, size: 48, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              Text(
                'No manual entries match "$_searchQuery"',
                style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF1E293B)),
              ),
              const SizedBox(height: 4),
              Text(
                isCaregiver
                    ? 'Try searching for "sensor", "vitals", "fever", "diaper", or "pairing".'
                    : 'Try searching for "vitals", "diaper", "comfort", "fever", or "safety".',
                style: GoogleFonts.albertSans(fontSize: 12, color: const Color(0xFF64748B)),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: chapters.length,
      itemBuilder: (context, index) {
        final chapter = chapters[index];
        return _buildChapterCard(chapter, isCaregiver: isCaregiver);
      },
    );
  }

  Widget _buildChapterCard(Map<String, dynamic> chapter, {required bool isCaregiver}) {
    final title = chapter['title'] as String;
    final badge = chapter['badge'] as String;
    final summary = chapter['summary'] as String;
    final icon = chapter['icon'] as IconData;
    final sections = chapter['sections'] as List<Map<String, String>>;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xFFE0F2F1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFB2DFDB)),
          ),
          child: Icon(icon, color: const Color(0xFF00796B), size: 22),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDFA),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFFCCFBF1)),
              ),
              child: Text(
                badge,
                style: GoogleFonts.poppins(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0D9488),
                  letterSpacing: 0.5,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: GoogleFonts.poppins(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF0F172A),
              ),
            ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4.0),
          child: Text(
            summary,
            style: GoogleFonts.albertSans(fontSize: 11.5, color: const Color(0xFF64748B)),
          ),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          const Divider(color: Color(0xFFF1F5F9), height: 1),
          const SizedBox(height: 12),
          ...sections.map((sec) {
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.arrow_right_rounded, size: 18, color: Color(0xFF00796B)),
                      Expanded(
                        child: Text(
                          sec['heading'] ?? '',
                          style: GoogleFonts.poppins(
                            fontSize: 12.5,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF004D40),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Padding(
                    padding: const EdgeInsets.only(left: 6.0),
                    child: Text(
                      sec['content'] ?? '',
                      style: GoogleFonts.albertSans(
                        fontSize: 12,
                        color: const Color(0xFF334155),
                        height: 1.45,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
