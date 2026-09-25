import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

/// Displays a hospital-grade, interactive Patient Profile bottom sheet modal.
/// Accessible from both the Dashboard patient cards and the Patient List.
void showPatientProfileModal(BuildContext context, Map<String, dynamic> patient) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black54,
    builder: (ctx) => PatientProfileModal(patient: patient),
  );
}

class PatientProfileModal extends StatelessWidget {
  final Map<String, dynamic> patient;

  const PatientProfileModal({super.key, required this.patient});

  @override
  Widget build(BuildContext context) {
    // 1. Extract Telemetry & Device Data
    final telemetry = (patient['latest_telemetry'] is Map)
        ? Map<String, dynamic>.from(patient['latest_telemetry'])
        : <String, dynamic>{};

    final isDeviceActive = patient['device_status'] == 'active' ||
        patient['status'] == 'Stable' ||
        (patient['vital_device_sn'] != null && patient['vital_device_sn'] != 'None');

    // 2. Parse Birthday & Age
    final dynamic rawBday = patient['birthdate'] ??
        (patient['baseline_data'] is Map ? patient['baseline_data']['birthdate'] : null);

    DateTime? birthDate;
    String formattedBirthday = 'Not specified';
    int? calculatedAge;

    if (rawBday != null) {
      if (rawBday is DateTime) {
        birthDate = rawBday;
      } else if (rawBday is String && rawBday.trim().isNotEmpty) {
        birthDate = DateTime.tryParse(rawBday.trim());
      }
    }

    if (birthDate != null) {
      formattedBirthday = DateFormat('MMMM d, yyyy').format(birthDate);
      final now = DateTime.now();
      calculatedAge = now.year - birthDate.year;
      if (now.month < birthDate.month ||
          (now.month == birthDate.month && now.day < birthDate.day)) {
        calculatedAge--;
      }
    } else if (patient['age'] != null) {
      calculatedAge = int.tryParse(patient['age'].toString());
    }

    // 3. Clinical metadata
    final baseline = (patient['baseline_data'] is Map)
        ? Map<String, dynamic>.from(patient['baseline_data'])
        : <String, dynamic>{};

    final name = patient['name'] ?? 'Unknown Patient';
    final room = patient['room'] ?? baseline['room'] ?? 'Home Care';
    final condition = patient['condition'] ?? baseline['condition'] ?? baseline['diagnosis'] ?? 'Stable';
    final illness = patient['illness'] ?? baseline['illness'] ?? baseline['diagnosis'] ?? 'General Telemetry';
    final assignedCaregiver = patient['assigned_caregiver_name'] ??
        patient['assigned_caregiver'] ??
        'Assigned Care Team';

    final rawVsSn = patient['vital_device_sn'] ?? patient['vs_id'];
    final vsSn = (rawVsSn != null && rawVsSn.toString().trim().isNotEmpty && rawVsSn.toString().trim() != 'None')
        ? rawVsSn.toString()
        : 'Not Assigned';

    final rawSdSn = patient['diaper_device_sn'] ?? patient['sd_id'];
    final sdSn = (rawSdSn != null && rawSdSn.toString().trim().isNotEmpty && rawSdSn.toString().trim() != 'None')
        ? rawSdSn.toString()
        : 'Not Assigned';

    // Emergency Contact
    final emergency = patient['emergencyContact'] ?? baseline['emergencyContact'];
    String emergencyName = 'Not on file';
    String emergencyPhone = '';
    if (emergency != null) {
      if (emergency is Map) {
        emergencyName = emergency['name'] ?? 'Primary Contact';
        emergencyPhone = emergency['phone'] ?? '';
      } else if (emergency is String) {
        emergencyName = emergency;
      }
    }

    // Vitals readings
    final hr = telemetry['heart_rate']?.toString() ?? patient['hr']?.toString() ?? '--';
    final temp = telemetry['temperature'] != null
        ? '${telemetry['temperature']}°C'
        : patient['temp']?.toString() ?? '--';
    final spo2 = telemetry['spo2'] != null
        ? '${telemetry['spo2']}%'
        : patient['spo2']?.toString() ?? '--';
    final isWet = telemetry['moisture'] == 100 || patient['wetness'] == 'Wet';

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag Handle
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            width: 44,
            height: 4.5,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(10),
            ),
          ),

          // Header Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF4DB6AC), Color(0xFF00796B)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF00796B).withOpacity(0.25),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'P',
                          style: GoogleFonts.poppins(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: GoogleFonts.poppins(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF1E293B),
                          ),
                        ),
                        Row(
                          children: [
                            Text(
                              room,
                              style: GoogleFonts.albertSans(
                                fontSize: 13,
                                color: const Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: isDeviceActive
                                    ? const Color(0xFFDCFCE7)
                                    : const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                isDeviceActive ? 'ONLINE' : 'OFFLINE',
                                style: GoogleFonts.poppins(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  color: isDeviceActive
                                      ? const Color(0xFF16A34A)
                                      : const Color(0xFFDC2626),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Color(0xFF64748B)),
                  onPressed: () => Navigator.pop(context),
                  tooltip: 'Close Profile',
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Scrollable Content
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. AGE & BIRTHDAY PROMINENT CARD
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFE0F2F1), Color(0xFFB2DFDB)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFF80CBC4)),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF00796B).withOpacity(0.08),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        // Age Block
                        Expanded(
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(
                                  Icons.cake_outlined,
                                  color: Color(0xFF00796B),
                                  size: 24,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'AGE',
                                    style: GoogleFonts.poppins(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF004D40),
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                  Text(
                                    calculatedAge != null ? '$calculatedAge yrs' : 'N/A',
                                    style: GoogleFonts.poppins(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFF004D40),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        Container(
                          width: 1,
                          height: 38,
                          color: const Color(0xFF80CBC4),
                        ),

                        // Birthday Block
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(left: 14),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Icon(
                                    Icons.calendar_today_outlined,
                                    color: Color(0xFF00796B),
                                    size: 22,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'BIRTHDAY',
                                        style: GoogleFonts.poppins(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF004D40),
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                      Text(
                                        formattedBirthday,
                                        style: GoogleFonts.poppins(
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF004D40),
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // 2. LIVE VITALS STREAM
                  Text(
                    'TELEMETRY & CLINICAL VITALS',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 10),

                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricTile(
                          label: 'HEART RATE',
                          value: hr,
                          unit: 'bpm',
                          icon: Icons.favorite,
                          color: const Color(0xFFEF4444),
                          bg: const Color(0xFFFEF2F2),
                          border: const Color(0xFFFECACA),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildMetricTile(
                          label: 'BODY TEMP',
                          value: temp,
                          unit: '',
                          icon: Icons.thermostat,
                          color: const Color(0xFFF59E0B),
                          bg: const Color(0xFFFFFBEB),
                          border: const Color(0xFFFDE68A),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricTile(
                          label: 'OXYGEN SPO2',
                          value: spo2,
                          unit: '',
                          icon: Icons.water_drop,
                          color: const Color(0xFF3B82F6),
                          bg: const Color(0xFFEFF6FF),
                          border: const Color(0xFFBFDBFE),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildMetricTile(
                          label: 'DIAPER SENSOR',
                          value: isWet ? 'Wetness' : 'Dry & Clean',
                          unit: '',
                          icon: Icons.opacity,
                          color: isWet ? const Color(0xFFEA580C) : const Color(0xFF0D9488),
                          bg: isWet ? const Color(0xFFFFF7ED) : const Color(0xFFF0FDFA),
                          border: isWet ? const Color(0xFFFED7AA) : const Color(0xFF99F6E4),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 22),

                  // 3. CLINICAL PROFILE & DIAGNOSIS
                  Text(
                    'CLINICAL DETAILS',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 10),

                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      children: [
                        _buildInfoRow(
                          icon: Icons.medical_services_outlined,
                          title: 'Primary Diagnosis',
                          value: illness,
                        ),
                        const Divider(height: 18, color: Color(0xFFF1F5F9)),
                        _buildInfoRow(
                          icon: Icons.monitor_heart_outlined,
                          title: 'Clinical Status',
                          value: condition,
                        ),
                        const Divider(height: 18, color: Color(0xFFF1F5F9)),
                        _buildInfoRow(
                          icon: Icons.support_agent_outlined,
                          title: 'Care Coordinator',
                          value: assignedCaregiver,
                        ),
                        if (emergencyPhone.isNotEmpty || emergencyName != 'Not on file') ...[
                          const Divider(height: 18, color: Color(0xFFF1F5F9)),
                          _buildInfoRow(
                            icon: Icons.contact_phone_outlined,
                            title: 'Emergency Contact',
                            value: emergencyPhone.isNotEmpty
                                ? '$emergencyName • $emergencyPhone'
                                : emergencyName,
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // 4. ASSIGNED HARDWARE SENSORS
                  Text(
                    'HARDWARE SENSORS INTEGRATION',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 10),

                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.devices,
                                  color: Color(0xFF2563EB), size: 18),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Vital Signs Sensor',
                                    style: GoogleFonts.albertSans(
                                      fontSize: 11,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                  Text(
                                    vsSn,
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF1E293B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDF4),
                                border: Border.all(color: const Color(0xFFBBF7D0)),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'MAX30102 PPG',
                                style: GoogleFonts.poppins(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF15803D),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const Divider(height: 18, color: Color(0xFFF1F5F9)),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF7ED),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.water_drop_outlined,
                                  color: Color(0xFFEA580C), size: 18),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Smart Diaper Sensor',
                                    style: GoogleFonts.albertSans(
                                      fontSize: 11,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                  Text(
                                    sdSn,
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF1E293B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDFA),
                                border: Border.all(color: const Color(0xFF99F6E4)),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'ADC HYGIENE',
                                style: GoogleFonts.poppins(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF0F766E),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Dismiss Button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4DB6AC),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        'Close Patient Profile',
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required String unit,
    required IconData icon,
    required Color color,
    required Color bg,
    required Color border,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: GoogleFonts.poppins(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w700,
                  color: color,
                  letterSpacing: 0.5,
                ),
              ),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1E293B),
                ),
              ),
              if (unit.isNotEmpty) ...[
                const SizedBox(width: 4),
                Text(
                  unit,
                  style: GoogleFonts.albertSans(
                    fontSize: 11,
                    color: const Color(0xFF64748B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: const Color(0xFF4DB6AC)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.albertSans(
                  fontSize: 11,
                  color: const Color(0xFF64748B),
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                value,
                style: GoogleFonts.poppins(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF1E293B),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
