import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/alert_notification_service.dart';
import '../services/api_service.dart';

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

class PatientProfileModal extends StatefulWidget {
  final Map<String, dynamic> patient;

  const PatientProfileModal({super.key, required this.patient});

  @override
  State<PatientProfileModal> createState() => _PatientProfileModalState();
}

class _PatientProfileModalState extends State<PatientProfileModal> {
  late Map<String, dynamic> _patient;
  late Map<String, dynamic> _telemetry;
  StreamSubscription<Map<String, dynamic>>? _sub;
  Timer? _refreshTimer;

  bool _isLoadingHistory = false;
  String _selectedTimeframe = 'Day';
  List<double> hrHistory = [];
  List<double> tempHistory = [];
  List<double> spo2History = [];
  List<double> moistureHistory = [];

  @override
  void initState() {
    super.initState();
    _patient = Map<String, dynamic>.from(widget.patient);
    _telemetry = (_patient['latest_telemetry'] is Map)
        ? Map<String, dynamic>.from(_patient['latest_telemetry'])
        : <String, dynamic>{};

    final targetPatientId = (_patient['patient_id'] ?? _patient['id'])?.toString();

    _fetchHistory();
    _refreshTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (mounted) _fetchHistory(silent: true);
    });

    _sub = AlertNotificationService.onAlertUpdate.listen((eventData) {
      if (!mounted) return;
      final eventType = eventData['event']?.toString() ?? '';
      final data = eventData['data'] is Map<String, dynamic>
          ? eventData['data'] as Map<String, dynamic>
          : <String, dynamic>{};

      if (eventType == 'device_status_update') {
        final updatePatientId = (data['patient_id'] ?? data['patientId'])?.toString();
        if (updatePatientId == null || updatePatientId == targetPatientId) {
          final isAct = data['status'] == 'ACTIVE';
          setState(() {
            _patient['is_online'] = isAct;
            _patient['isOnline'] = isAct;
            _patient['device_status'] = isAct ? 'active' : 'inactive';
          });
        }
      } else if (eventType == 'patient_telemetry_update') {
        final updatePatientId = (data['patient_id'] ?? data['patientId'])?.toString();
        if (updatePatientId == targetPatientId) {
          final sn = data['serial_number']?.toString() ?? '';
          final isVS = sn.startsWith('VS-') || data['device_type'] == 'vitals';
          final isSD = sn.startsWith('SD-') || data['device_type'] == 'moisture';

          setState(() {
            _patient['is_online'] = true;
            _patient['isOnline'] = true;
            _patient['device_status'] = 'active';
            _patient['is_vitals_online'] = isVS ? true : _patient['is_vitals_online'];
            _patient['is_moisture_online'] = isSD ? true : _patient['is_moisture_online'];

            final hr = data['heart_rate'] ?? data['latest_telemetry']?['heart_rate'];
            final temp = data['temperature'] ?? data['latest_telemetry']?['temperature'];
            final sp = data['spo2'] ?? data['latest_telemetry']?['spo2'];
            final moist = data['moisture'] ?? data['moisture_value'] ?? data['latest_telemetry']?['moisture'] ?? data['latest_telemetry']?['moisture_value'];

            if (hr != null && ((hr is num && hr > 0) || !isSD)) {
              _telemetry['heart_rate'] = hr;
              hrHistory = [...hrHistory, (hr as num).toDouble()];
            }
            if (temp != null && ((temp is num && temp > 0) || !isSD)) {
              _telemetry['temperature'] = temp;
              tempHistory = [...tempHistory, (temp as num).toDouble()];
            }
            if (sp != null && ((sp is num && sp > 0) || !isSD)) {
              _telemetry['spo2'] = sp;
              spo2History = [...spo2History, (sp as num).toDouble()];
            }
            if (moist != null) {
              _telemetry['moisture'] = moist;
              moistureHistory = [...moistureHistory, (moist as num).toDouble()];
            }

            _patient['latest_telemetry'] = _telemetry;
          });
        }
      }
    });
  }

  void _fetchHistory({bool silent = false}) async {
    final targetPatientId = (_patient['patient_id'] ?? _patient['id'])?.toString();
    if (targetPatientId == null) return;
    if (_isLoadingHistory && !silent) return;

    if (!silent) {
      setState(() { _isLoadingHistory = true; });
    }

    try {
      final tfParam = _selectedTimeframe.toLowerCase();
      final result = await ApiService.get('/sensor/history/$targetPatientId?timeframe=$tfParam');

      if (mounted && result['success'] == true) {
        final List<dynamic> historyData = result['history'] ?? [];
        final chronological = historyData;

        setState(() {
          hrHistory = chronological.map((d) {
            final hr = d['heart_rate'];
            if (hr is num) return hr.toDouble();
            if (hr is String) return double.tryParse(hr) ?? 0.0;
            return 0.0;
          }).where((val) => val > 0).toList();

          tempHistory = chronological.map((d) {
            final temp = d['temperature'];
            if (temp is num) return temp.toDouble();
            if (temp is String) return double.tryParse(temp) ?? 0.0;
            return 0.0;
          }).where((val) => val > 0).toList();

          spo2History = chronological.map((d) {
            final spo2 = d['spo2'];
            if (spo2 is num) return spo2.toDouble();
            if (spo2 is String) return double.tryParse(spo2) ?? 0.0;
            return 0.0;
          }).where((val) => val > 0).toList();

          moistureHistory = chronological.map((d) {
            final m = d['moisture_value'] ?? d['moisture'];
            if (m is num) return m.toDouble();
            if (m is String) return double.tryParse(m) ?? 0.0;
            return 0.0;
          }).toList();

          // Live fallback hydration if history empty but latest telemetry present
          if (hrHistory.isEmpty && _telemetry['heart_rate'] != null) {
            final v = (_telemetry['heart_rate'] as num?)?.toDouble() ?? 0.0;
            if (v > 0) hrHistory = [v];
          }
          if (tempHistory.isEmpty && _telemetry['temperature'] != null) {
            final v = (_telemetry['temperature'] as num?)?.toDouble() ?? 0.0;
            if (v > 0) tempHistory = [v];
          }
          if (spo2History.isEmpty && _telemetry['spo2'] != null) {
            final v = (_telemetry['spo2'] as num?)?.toDouble() ?? 0.0;
            if (v > 0) spo2History = [v];
          }
          if (moistureHistory.isEmpty && (_telemetry['moisture'] != null || _telemetry['moisture_value'] != null)) {
            final v = ((_telemetry['moisture'] ?? _telemetry['moisture_value']) as num?)?.toDouble() ?? 0.0;
            moistureHistory = [v];
          }

          _isLoadingHistory = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() { _isLoadingHistory = false; });
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final patient = _patient;
    final telemetry = _telemetry;

    final pairedList = patient['paired_devices'] is List ? (patient['paired_devices'] as List) : [];
    final isDeviceActive = patient['is_online'] == true ||
        patient['isOnline'] == true ||
        patient['device_status']?.toString().toLowerCase() == 'active' ||
        pairedList.any((d) => d['is_online'] == true || d['status'] == 'ACTIVE');

    final bool isVitalsActive = patient['is_vitals_online'] == true ||
        pairedList.any((d) => (d['is_online'] == true || d['status'] == 'ACTIVE') &&
            ((d['serial_number']?.toString().startsWith('VS-') ?? false) ||
             (d['device_name']?.toString().toLowerCase().contains('vital') ?? false) ||
             (d['serial_number']?.toString().startsWith('SD-') != true &&
              d['device_name']?.toString().toLowerCase().contains('diaper') != true &&
              d['device_name']?.toString().toLowerCase().contains('moisture') != true))) ||
        (pairedList.isEmpty && isDeviceActive);

    final bool isMoistureActive = patient['is_moisture_online'] == true ||
        pairedList.any((d) => (d['is_online'] == true || d['status'] == 'ACTIVE') &&
            ((d['serial_number']?.toString().startsWith('SD-') ?? false) ||
             (d['device_name']?.toString().toLowerCase().contains('diaper') ?? false) ||
             (d['device_name']?.toString().toLowerCase().contains('moisture') ?? false) ||
             (d['serial_number']?.toString().startsWith('VS-') != true &&
              d['device_name']?.toString().toLowerCase().contains('vital') != true))) ||
        (pairedList.isEmpty && isDeviceActive);

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
    final rawHr = telemetry['heart_rate'] ?? patient['heart_rate'] ?? patient['heartRate'];
    final hrNum = rawHr is num ? rawHr.round() : int.tryParse(rawHr?.toString() ?? '');
    final bool isHrDetached = isVitalsActive && (hrNum == 0 || hrNum == null);
    final hr = !isVitalsActive ? '--' : isHrDetached ? '0' : '$hrNum';
    final hrBadge = !isVitalsActive ? 'OFFLINE' : isHrDetached ? 'DETACHED' : (hrNum != null && (hrNum > 120 || hrNum < 50) ? 'CRITICAL' : 'NORMAL');
    final hrBadgeColor = !isVitalsActive || isHrDetached ? const Color(0xFF64748B) : (hrBadge == 'CRITICAL' ? const Color(0xFFDC2626) : const Color(0xFF16A34A));
    final hrBadgeBg = !isVitalsActive || isHrDetached ? const Color(0xFFF1F5F9) : (hrBadge == 'CRITICAL' ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7));

    final rawTemp = telemetry['temperature'] ?? patient['temperature'];
    final tempNum = rawTemp is num ? rawTemp.toDouble() : double.tryParse(rawTemp?.toString() ?? '');
    final rawSpo2 = telemetry['spo2'] ?? patient['spo2'];
    final spo2Num = rawSpo2 is num ? rawSpo2.round() : int.tryParse(rawSpo2?.toString() ?? '');
    final bool isTempDetached = isVitalsActive && ((tempNum != null && tempNum <= 30.0) || tempNum == 0 || tempNum == null || (isHrDetached && (spo2Num == 0 || spo2Num == null)));
    final temp = !isVitalsActive ? '--' : isTempDetached ? (tempNum != null && tempNum > 0 ? '${tempNum.toStringAsFixed(1)}°C' : '0.0°C') : (tempNum != null && tempNum > 0 ? '${tempNum.toStringAsFixed(1)}°C' : '--');
    final tempBadge = !isVitalsActive ? 'OFFLINE' : isTempDetached ? 'DETACHED' : (tempNum != null && tempNum > 38.0 ? 'FEVER' : 'NORMAL');
    final tempBadgeColor = !isVitalsActive || isTempDetached ? const Color(0xFF64748B) : (tempBadge == 'FEVER' ? const Color(0xFFDC2626) : const Color(0xFF16A34A));
    final tempBadgeBg = !isVitalsActive || isTempDetached ? const Color(0xFFF1F5F9) : (tempBadge == 'FEVER' ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7));

    final bool isSpo2Detached = isVitalsActive && (spo2Num == 0 || spo2Num == null);
    final spo2 = !isVitalsActive ? '--' : isSpo2Detached ? '0%' : (spo2Num != null && spo2Num > 0 ? '$spo2Num%' : '--');
    final spo2Badge = !isVitalsActive ? 'OFFLINE' : isSpo2Detached ? 'DETACHED' : (spo2Num != null && spo2Num < 90 ? 'HYPOXIA' : 'OPTIMAL');
    final spo2BadgeColor = !isVitalsActive || isSpo2Detached ? const Color(0xFF64748B) : (spo2Badge == 'HYPOXIA' ? const Color(0xFFDC2626) : const Color(0xFF16A34A));
    final spo2BadgeBg = !isVitalsActive || isSpo2Detached ? const Color(0xFFF1F5F9) : (spo2Badge == 'HYPOXIA' ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7));

    final rawMoist = telemetry['moisture'] ?? telemetry['moisture_value'] ?? patient['moisture'] ?? patient['moisture_value'];
    final mNum = rawMoist is num ? rawMoist.toInt() : int.tryParse(rawMoist?.toString() ?? '') ?? 0;
    final isWet = mNum >= 70 || mNum == 100 || patient['wetness'] == 'Wet';
    final isDamp = mNum >= 30 && !isWet;
    final wetnessVal = !isMoistureActive ? '--' : '$mNum%';
    final wetnessBadge = !isMoistureActive ? 'OFFLINE' : isWet ? 'WET / CHANGE' : isDamp ? 'DAMP' : 'DRY & CLEAN';
    final wetnessBadgeColor = !isMoistureActive ? const Color(0xFF64748B) : (isWet ? const Color(0xFFDC2626) : isDamp ? const Color(0xFFD97706) : const Color(0xFF16A34A));
    final wetnessBadgeBg = !isMoistureActive ? const Color(0xFFF1F5F9) : (isWet ? const Color(0xFFFEE2E2) : isDamp ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7));

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
                          unit: isDeviceActive && !isHrDetached ? 'bpm' : '',
                          badgeText: hrBadge,
                          badgeColor: hrBadgeColor,
                          badgeBg: hrBadgeBg,
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
                          badgeText: tempBadge,
                          badgeColor: tempBadgeColor,
                          badgeBg: tempBadgeBg,
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
                          badgeText: spo2Badge,
                          badgeColor: spo2BadgeColor,
                          badgeBg: spo2BadgeBg,
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
                          value: wetnessVal,
                          unit: '',
                          badgeText: wetnessBadge,
                          badgeColor: wetnessBadgeColor,
                          badgeBg: wetnessBadgeBg,
                          icon: Icons.opacity,
                          color: isWet ? const Color(0xFFEA580C) : isDamp ? const Color(0xFFD97706) : const Color(0xFF0D9488),
                          bg: isWet ? const Color(0xFFFFF7ED) : isDamp ? const Color(0xFFFFFBEB) : const Color(0xFFF0FDFA),
                          border: isWet ? const Color(0xFFFED7AA) : isDamp ? const Color(0xFFFDE68A) : const Color(0xFF99F6E4),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 22),

                  // 2.5 VITAL STATISTICS HISTORY
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text(
                            'VITAL STATISTICS HISTORY',
                            style: GoogleFonts.poppins(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF64748B),
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: Color(0xFF10B981),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            "LIVE",
                            style: GoogleFonts.poppins(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF10B981),
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: ['Day', 'Week', 'Month'].map((tf) {
                            final isSelected = _selectedTimeframe == tf;
                            return GestureDetector(
                              onTap: () {
                                if (_selectedTimeframe != tf) {
                                  setState(() {
                                    _selectedTimeframe = tf;
                                  });
                                  _fetchHistory();
                                }
                              },
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFF00796B) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  tf,
                                  style: GoogleFonts.albertSans(
                                    fontSize: 10.5,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                    color: isSelected ? Colors.white : const Color(0xFF64748B),
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: _isLoadingHistory
                        ? const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Center(
                              child: CircularProgressIndicator(color: Color(0xFF00796B), strokeWidth: 2),
                            ),
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildModalGraph("Heart Rate Trend", hrHistory, const Color(0xFFEF4444), unit: ' BPM'),
                              const SizedBox(height: 14),
                              _buildModalGraph("Body Temperature Trend", tempHistory, const Color(0xFFF59E0B), unit: '°C'),
                              const SizedBox(height: 14),
                              _buildModalGraph("Blood Oxygen SpO2", spo2History, const Color(0xFF3B82F6), unit: '%'),
                              const SizedBox(height: 14),
                              _buildModalGraph("Diaper Moisture Sensor", moistureHistory, const Color(0xFF0D9488), unit: '%'),
                            ],
                          ),
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
    String? badgeText,
    Color? badgeColor,
    Color? badgeBg,
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
          if (badgeText != null && badgeText.isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: badgeBg ?? const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(5),
                border: Border.all(color: (badgeColor ?? const Color(0xFF64748B)).withValues(alpha: 0.3)),
              ),
              child: Text(
                badgeText,
                style: GoogleFonts.poppins(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: badgeColor ?? const Color(0xFF64748B),
                  letterSpacing: 0.4,
                ),
              ),
            ),
          ],
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

  Widget _buildModalGraph(String label, List<double> points, Color color, {String unit = ''}) {
    final displayPoints = (points.length < 2) ? [points.isNotEmpty ? points.first : 0.0, points.isNotEmpty ? points.first : 0.0] : points;
    final latestVal = points.isNotEmpty ? points.last : 0.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: GoogleFonts.albertSans(
                    fontSize: 11,
                    color: const Color(0xFF475569),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            Text(
              points.isNotEmpty ? "Latest: ${latestVal.toStringAsFixed(1)}$unit" : "--",
              style: GoogleFonts.poppins(
                fontSize: 11,
                color: color,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.15)),
          ),
          child: SizedBox(
            height: 48,
            width: double.infinity,
            child: CustomPaint(
              key: ValueKey('${displayPoints.hashCode}_${displayPoints.length}'),
              painter: _ModalGraphPainter(displayPoints, color),
            ),
          ),
        ),
      ],
    );
  }
}

class _ModalGraphPainter extends CustomPainter {
  final List<double> points;
  final Color color;

  _ModalGraphPainter(this.points, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty || points.length < 2) return;

    final paint = Paint()
      ..color = color
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = Path();
    double spacing = size.width / (points.length - 1);

    double minVal = points.reduce((a, b) => a < b ? a : b);
    double maxVal = points.reduce((a, b) => a > b ? a : b);
    double diff = maxVal - minVal;
    double range = diff < 2.0 ? 5.0 : diff;
    double mid = (minVal + maxVal) / 2;
    double minBound = mid - (range / 2);

    for (int i = 0; i < points.length; i++) {
      double x = i * spacing;
      double normalizedY = (points[i] - minBound) / range;
      double y = size.height - (normalizedY * size.height);
      y = y.clamp(0.0, size.height);

      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, paint);

    if (points.isNotEmpty) {
      final lastX = (points.length - 1) * spacing;
      final normalizedLastY = (points.last - minBound) / range;
      final lastY = (size.height - (normalizedLastY * size.height)).clamp(0.0, size.height);
      final dotPaint = Paint()..color = color..style = PaintingStyle.fill;
      canvas.drawCircle(Offset(lastX, lastY), 3.5, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _ModalGraphPainter oldDelegate) {
    return points.hashCode != oldDelegate.points.hashCode;
  }
}
