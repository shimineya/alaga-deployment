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
  bool _isResettingDiaper = false;
  String _selectedTimeframe = 'Day';
  List<double> hrHistory = [];
  List<double> tempHistory = [];
  List<double> spo2History = [];
  List<double> moistureHistory = [];
  List<Map<String, dynamic>> _careLogs = [];

  Future<void> _handleDiaperChange() async {
    final targetPatientId = (_patient['patient_id'] ?? _patient['id'])?.toString();
    if (targetPatientId == null) return;

    setState(() => _isResettingDiaper = true);
    try {
      final res = await ApiService.post('/caregiver/patients/$targetPatientId/diaper-change');
      if (mounted) {
        if (res['success'] == true) {
          setState(() {
            _telemetry['moisture'] = 0;
            _telemetry['moisture_value'] = 0;
            _patient['moisture'] = 0;
            _patient['moisture_value'] = 0;
            _patient['wetness'] = 'Dry';
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Diaper change recorded. Wetness reset to 0% DRY."),
              backgroundColor: Color(0xFF0D9488),
              duration: Duration(seconds: 3),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(res['message'] ?? 'Failed to record diaper change.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isResettingDiaper = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _patient = Map<String, dynamic>.from(widget.patient);
    _telemetry = (_patient['latest_telemetry'] is Map)
        ? Map<String, dynamic>.from(_patient['latest_telemetry'])
        : <String, dynamic>{};

    final targetPatientId = (_patient['patient_id'] ?? _patient['id'])?.toString();

    _fetchHistory();
    _refreshTimer = Timer.periodic(const Duration(seconds: 3), (_) {
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
          final isAct = data['status'] == 'ACTIVE' && data['is_online'] != false;
          final action = data['action']?.toString();
          final isPermanentUnpair = action == 'permanent' || action == 'removed' || data['status'] == 'AVAILABLE' || data['status'] == 'UNASSIGNED';
          final sn = (data['serial_number'] ?? data['serialNumber'] ?? '').toString();
          final isVS = sn.startsWith('VS-') || data['device_type'] == 'vitals';
          final isSD = sn.startsWith('SD-') || data['device_type'] == 'moisture';
          setState(() {
            if (_patient['paired_devices'] is List) {
              final list = List<dynamic>.from(_patient['paired_devices']);
              if (isPermanentUnpair) {
                list.removeWhere((d) => d is Map && d['serial_number'] == sn);
              } else {
                for (var j = 0; j < list.length; j++) {
                  if (list[j] is Map && list[j]['serial_number'] == sn) {
                    list[j] = {
                      ...list[j],
                      'status': isAct ? 'ACTIVE' : 'INACTIVE',
                      'is_online': isAct,
                    };
                  }
                }
              }
              _patient['paired_devices'] = list;
            }
            if (data['is_vitals_active'] != null) {
              _patient['is_vitals_online'] = data['is_vitals_active'] == true;
            } else if (isVS) {
              _patient['is_vitals_online'] = isPermanentUnpair ? false : isAct;
            }
            if (isVS && isPermanentUnpair) _patient['vital_device_sn'] = null;
            if (_patient['is_vitals_online'] != true) {
              _telemetry.remove('heart_rate');
              _telemetry.remove('temperature');
              _telemetry.remove('spo2');
            }

            if (data['is_moisture_active'] != null) {
              _patient['is_moisture_online'] = data['is_moisture_active'] == true;
            } else if (isSD) {
              _patient['is_moisture_online'] = isPermanentUnpair ? false : isAct;
            }
            if (isSD && isPermanentUnpair) _patient['diaper_device_sn'] = null;
            if (_patient['is_moisture_online'] != true) {
              _telemetry.remove('moisture');
              _telemetry.remove('moisture_value');
            }

            final anyOnline = _patient['is_vitals_online'] == true || _patient['is_moisture_online'] == true;
            _patient['is_online'] = anyOnline;
            _patient['isOnline'] = anyOnline;
            _patient['device_status'] = anyOnline ? 'active' : 'inactive';
          });
          _fetchHistory(silent: true);
        }
      }
      if (eventType == 'system_data_update' || eventType == 'assignment_update' || eventType == 'client_mutation') {
        _fetchHistory(silent: true);
      }
      final rawTelem = data['latest_telemetry'] is Map ? Map<String, dynamic>.from(data['latest_telemetry']) : null;
      if (eventType == 'patient_telemetry_update' || rawTelem != null) {
        final updatePatientId = (data['patient_id'] ?? data['patientId'])?.toString();
        if (updatePatientId == targetPatientId) {
          final sn = data['serial_number']?.toString() ?? '';
          final isVS = sn.startsWith('VS-') || data['device_type'] == 'vitals';
          final isSD = sn.startsWith('SD-') || data['device_type'] == 'moisture';
          final isVitalsActiveParam = data['is_vitals_active'];
          final isMoistureActiveParam = data['is_moisture_active'];
          final statusStr = (data['device_status'] ?? data['status'])?.toString().toUpperCase();
          final isExplicitOffline = data['is_online'] == false || statusStr == 'INACTIVE';

          setState(() {
            final bool newVOnline = isVitalsActiveParam != null
                ? (isVitalsActiveParam == true)
                : (isVS ? !isExplicitOffline : (_patient['is_vitals_online'] == true));
            final bool newMOnline = isMoistureActiveParam != null
                ? (isMoistureActiveParam == true)
                : (isSD ? !isExplicitOffline : (_patient['is_moisture_online'] == true));
            final bool anyOnline = newVOnline || newMOnline;

            _patient['is_online'] = anyOnline;
            _patient['isOnline'] = anyOnline;
            _patient['device_status'] = anyOnline ? 'active' : 'inactive';
            _patient['is_vitals_online'] = newVOnline;
            _patient['is_moisture_online'] = newMOnline;

            final hr = data['heart_rate'] ?? data['latest_telemetry']?['heart_rate'];
            final temp = data['temperature'] ?? data['latest_telemetry']?['temperature'];
            final sp = data['spo2'] ?? data['latest_telemetry']?['spo2'];
            final moist = data['moisture'] ?? data['moisture_value'] ?? data['latest_telemetry']?['moisture'] ?? data['latest_telemetry']?['moisture_value'];

            if (!newVOnline) {
              _telemetry.remove('heart_rate');
              _telemetry.remove('temperature');
              _telemetry.remove('spo2');
            } else {
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
            }

            if (!newMOnline) {
              _telemetry.remove('moisture');
              _telemetry.remove('moisture_value');
              _telemetry['is_diaper_unclipped'] = false;
              _telemetry['tape_connected'] = true;
            } else if (isSD || moist != null) {
              final tapeUnplugged = data['is_diaper_unclipped'] == true || data['tape_connected'] == false || data['latest_telemetry']?['is_diaper_unclipped'] == true || data['latest_telemetry']?['tape_connected'] == false || (moist is num && moist < 0);
              final nextMoist = tapeUnplugged ? -1 : (moist ?? _telemetry['moisture'] ?? 0);
              _telemetry['moisture'] = nextMoist;
              _telemetry['moisture_value'] = nextMoist;
              _telemetry['is_diaper_unclipped'] = tapeUnplugged;
              _telemetry['tape_connected'] = !tapeUnplugged;
              if (!tapeUnplugged && nextMoist is num) {
                moistureHistory = [...moistureHistory, nextMoist.toDouble()];
              }
            }
            if (data['finger_detected'] != null || data['latest_telemetry']?['finger_detected'] != null) {
              _telemetry['finger_detected'] = data['finger_detected'] ?? data['latest_telemetry']?['finger_detected'];
            }
            _telemetry['recorded_at'] = data['recorded_at'] ?? data['latest_telemetry']?['recorded_at'] ?? DateTime.now().toIso8601String();

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
      final results = await Future.wait([
        ApiService.get('/sensor/history/$targetPatientId?timeframe=$tfParam'),
        ApiService.get('/api/caregiver/patients/$targetPatientId'),
        ApiService.get('/api/caregiver/patients/$targetPatientId/care-logs'),
      ]);
      final result = results[0];
      final patResult = results[1];
      final logsResult = results.length > 2 ? results[2] : null;

      if (!mounted) return;

      if (logsResult != null && logsResult['success'] == true && logsResult['data'] is List) {
        setState(() {
          _careLogs = (logsResult['data'] as List)
              .whereType<Map>()
              .map(Map<String, dynamic>.from)
              .toList();
        });
      }

      if (patResult['success'] == true && patResult['data'] is Map) {
        final freshPat = Map<String, dynamic>.from(patResult['data']);
        final bool vOnline = freshPat['is_vitals_online'] == true;
        final bool mOnline = freshPat['is_moisture_online'] == true;
        final bool anyOnline = vOnline || mOnline;
        final freshTelem = freshPat['latest_telemetry'] is Map
            ? Map<String, dynamic>.from(freshPat['latest_telemetry'])
            : <String, dynamic>{};

        if (!vOnline) {
          freshTelem.remove('heart_rate');
          freshTelem.remove('temperature');
          freshTelem.remove('spo2');
        }
        if (!mOnline) {
          freshTelem.remove('moisture');
          freshTelem.remove('moisture_value');
        }

        setState(() {
          _patient = {
            ..._patient,
            ...freshPat,
            'is_online': anyOnline,
            'isOnline': anyOnline,
            'device_status': anyOnline ? 'active' : 'inactive',
            'is_vitals_online': vOnline,
            'is_moisture_online': mOnline,
            'latest_telemetry': freshTelem,
          };
          _telemetry = freshTelem;
        });
      }

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

    final bool isVitalsActive = patient['is_vitals_online'] is bool
        ? (patient['is_vitals_online'] == true)
        : pairedList.any((d) =>
            d['is_online'] == true &&
            ((d['serial_number']?.toString().startsWith('VS-') ?? false) ||
                (d['device_name']?.toString().toLowerCase().contains('vital') ?? false)));

    final bool isMoistureActive = patient['is_moisture_online'] is bool
        ? (patient['is_moisture_online'] == true)
        : pairedList.any((d) =>
            d['is_online'] == true &&
            ((d['serial_number']?.toString().startsWith('SD-') ?? false) ||
                (d['device_name']?.toString().toLowerCase().contains('diaper') ?? false) ||
                (d['device_name']?.toString().toLowerCase().contains('moisture') ?? false)));

    final bool isDeviceActive = isVitalsActive || isMoistureActive;

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

    // Vitals readings & telemetry states
    final rawHr = telemetry['heart_rate'] ?? patient['heart_rate'] ?? patient['heartRate'];
    final hrNum = rawHr is num ? rawHr.round() : int.tryParse(rawHr?.toString() ?? '');

    final rawTemp = telemetry['temperature'] ?? patient['temperature'];
    final tempNum = rawTemp is num ? rawTemp.toDouble() : double.tryParse(rawTemp?.toString() ?? '');

    final rawSpo2 = telemetry['spo2'] ?? patient['spo2'];
    final spo2Num = rawSpo2 is num ? rawSpo2.round() : int.tryParse(rawSpo2?.toString() ?? '');

    final bool isFingerOn = telemetry['finger_detected'] == true || patient['finger_detected'] == true;
    final bool isVitalsCalibrating = isVitalsActive && isFingerOn && (hrNum == 0 || hrNum == null);

    final bool isHrMisaligned = isVitalsActive && !isVitalsCalibrating && (hrNum == 0 || hrNum == null);
    final bool isSpo2Misaligned = isVitalsActive && !isVitalsCalibrating && (spo2Num == 0 || spo2Num == null);
    final bool isTempMisaligned = isVitalsActive && !isVitalsCalibrating && ((tempNum != null && tempNum <= 30.0) || tempNum == 0 || tempNum == null || isHrMisaligned || isSpo2Misaligned);

    final rawMoist = telemetry['moisture'] ?? telemetry['moisture_value'] ?? patient['moisture'] ?? patient['moisture_value'];
    final mNum = rawMoist is num ? rawMoist.toInt() : int.tryParse(rawMoist?.toString() ?? '') ?? 0;
    final bool isTapeDisconnected = isMoistureActive && (mNum < 0 || telemetry['is_diaper_unclipped'] == true || telemetry['tape_connected'] == false || patient['is_diaper_unclipped'] == true);
    final bool isMoistCalibrating = isMoistureActive && !isTapeDisconnected && telemetry['is_moisture_calibrating'] == true;
    final isWet = !isTapeDisconnected && (mNum >= 70 || mNum == 100 || patient['wetness'] == 'Wet');
    final isDamp = !isTapeDisconnected && (mNum >= 30 && !isWet);

    // Heart Rate config
    final hr = !isVitalsActive ? '--' : isVitalsCalibrating ? 'Acquiring...' : isHrMisaligned ? 'Misaligned' : '$hrNum';
    final hrBadge = !isVitalsActive ? 'OFFLINE' : isVitalsCalibrating ? 'ACQUIRING' : isHrMisaligned ? 'CHECK PROBE' : (hrNum != null && (hrNum > 120 || hrNum < 50) ? 'CRITICAL' : 'NORMAL');
    final hrBadgeColor = !isVitalsActive ? const Color(0xFF64748B) : isVitalsCalibrating ? const Color(0xFF0891B2) : isHrMisaligned ? const Color(0xFFB45309) : (hrBadge == 'CRITICAL' ? const Color(0xFFDC2626) : const Color(0xFF16A34A));
    final hrBadgeBg = !isVitalsActive ? const Color(0xFFF1F5F9) : isVitalsCalibrating ? const Color(0xFFECFEFF) : isHrMisaligned ? const Color(0xFFFEF3C7) : (hrBadge == 'CRITICAL' ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7));

    // Temperature config
    final temp = !isVitalsActive ? '--' : isVitalsCalibrating ? 'Acquiring...' : isTempMisaligned ? 'Misaligned' : (tempNum != null && tempNum > 0 ? '${tempNum.toStringAsFixed(1)}°C' : '--');
    final tempBadge = !isVitalsActive ? 'OFFLINE' : isVitalsCalibrating ? 'ACQUIRING' : isTempMisaligned ? 'CHECK PROBE' : (tempNum != null && tempNum > 38.0 ? 'FEVER' : 'NORMAL');
    final tempBadgeColor = !isVitalsActive ? const Color(0xFF64748B) : isVitalsCalibrating ? const Color(0xFF0891B2) : isTempMisaligned ? const Color(0xFFB45309) : (tempBadge == 'FEVER' ? const Color(0xFFDC2626) : const Color(0xFF16A34A));
    final tempBadgeBg = !isVitalsActive ? const Color(0xFFF1F5F9) : isVitalsCalibrating ? const Color(0xFFECFEFF) : isTempMisaligned ? const Color(0xFFFEF3C7) : (tempBadge == 'FEVER' ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7));

    // SpO2 config
    final spo2 = !isVitalsActive ? '--' : isVitalsCalibrating ? 'Acquiring...' : isSpo2Misaligned ? 'Misaligned' : (spo2Num != null && spo2Num > 0 ? '$spo2Num%' : '--');
    final spo2Badge = !isVitalsActive ? 'OFFLINE' : isVitalsCalibrating ? 'ACQUIRING' : isSpo2Misaligned ? 'CHECK PROBE' : (spo2Num != null && spo2Num < 90 ? 'HYPOXIA' : 'OPTIMAL');
    final spo2BadgeColor = !isVitalsActive ? const Color(0xFF64748B) : isVitalsCalibrating ? const Color(0xFF0891B2) : isSpo2Misaligned ? const Color(0xFFB45309) : (spo2Badge == 'HYPOXIA' ? const Color(0xFFDC2626) : const Color(0xFF16A34A));
    final spo2BadgeBg = !isVitalsActive ? const Color(0xFFF1F5F9) : isVitalsCalibrating ? const Color(0xFFECFEFF) : isSpo2Misaligned ? const Color(0xFFFEF3C7) : (spo2Badge == 'HYPOXIA' ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7));

    // Moisture config
    final safeMNum = mNum < 0 ? 0 : mNum;
    final wetnessVal = !isMoistureActive ? '--' : isTapeDisconnected ? 'Disconnected' : isMoistCalibrating ? 'Acquiring...' : '$safeMNum%';
    final wetnessBadge = !isMoistureActive ? 'OFFLINE' : isTapeDisconnected ? 'DISCONNECTED' : isMoistCalibrating ? 'ACQUIRING' : isWet ? 'WET / CHANGE' : isDamp ? 'DAMP' : 'DRY & CLEAN';
    final wetnessBadgeColor = !isMoistureActive ? const Color(0xFF64748B) : isTapeDisconnected ? const Color(0xFFB45309) : isMoistCalibrating ? const Color(0xFF0891B2) : (isWet ? const Color(0xFFDC2626) : isDamp ? const Color(0xFFD97706) : const Color(0xFF16A34A));
    final wetnessBadgeBg = !isMoistureActive ? const Color(0xFFF1F5F9) : isTapeDisconnected ? const Color(0xFFFEF3C7) : isMoistCalibrating ? const Color(0xFFECFEFF) : (isWet ? const Color(0xFFFEE2E2) : isDamp ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7));

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
                            color: const Color(0xFF00796B).withValues(alpha: 0.25),
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
                          color: const Color(0xFF00796B).withValues(alpha: 0.08),
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
                    'VITAL SIGNS & READINGS',
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
                          unit: isDeviceActive && !isHrMisaligned && !isVitalsCalibrating ? 'bpm' : '',
                          badgeText: hrBadge,
                          badgeColor: hrBadgeColor,
                          badgeBg: hrBadgeBg,
                          icon: Icons.favorite,
                          color: isVitalsCalibrating ? const Color(0xFF0891B2) : isHrMisaligned ? const Color(0xFFD97706) : const Color(0xFFEF4444),
                          bg: isVitalsCalibrating ? const Color(0xFFF0FDFA) : isHrMisaligned ? const Color(0xFFFFFBEB) : const Color(0xFFFEF2F2),
                          border: isVitalsCalibrating ? const Color(0xFFA5F3FC) : isHrMisaligned ? const Color(0xFFFDE68A) : const Color(0xFFFECACA),
                          isCalibrating: isVitalsCalibrating,
                          isMisaligned: isHrMisaligned,
                          helperText: isVitalsCalibrating ? 'Warming up sensor (3–5s)' : isHrMisaligned ? 'Reposition probe on skin' : null,
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
                          color: isVitalsCalibrating ? const Color(0xFF0891B2) : isTempMisaligned ? const Color(0xFFD97706) : const Color(0xFFF59E0B),
                          bg: isVitalsCalibrating ? const Color(0xFFF0FDFA) : isTempMisaligned ? const Color(0xFFFFFBEB) : const Color(0xFFFFFBEB),
                          border: isVitalsCalibrating ? const Color(0xFFA5F3FC) : isTempMisaligned ? const Color(0xFFFDE68A) : const Color(0xFFFDE68A),
                          isCalibrating: isVitalsCalibrating,
                          isMisaligned: isTempMisaligned,
                          helperText: isVitalsCalibrating ? 'Stabilizing probe (3–5s)' : isTempMisaligned ? 'Probe dislodged / check contact' : null,
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
                          color: isVitalsCalibrating ? const Color(0xFF0891B2) : isSpo2Misaligned ? const Color(0xFFD97706) : const Color(0xFF3B82F6),
                          bg: isVitalsCalibrating ? const Color(0xFFF0FDFA) : isSpo2Misaligned ? const Color(0xFFFFFBEB) : const Color(0xFFEFF6FF),
                          border: isVitalsCalibrating ? const Color(0xFFA5F3FC) : isSpo2Misaligned ? const Color(0xFFFDE68A) : const Color(0xFFBFDBFE),
                          isCalibrating: isVitalsCalibrating,
                          isMisaligned: isSpo2Misaligned,
                          helperText: isVitalsCalibrating ? 'Acquiring pulse signal...' : isSpo2Misaligned ? 'Reposition probe on skin' : null,
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
                          color: isMoistCalibrating ? const Color(0xFF0891B2) : isTapeDisconnected ? const Color(0xFFD97706) : isWet ? const Color(0xFFEA580C) : isDamp ? const Color(0xFFD97706) : const Color(0xFF0D9488),
                          bg: isMoistCalibrating ? const Color(0xFFF0FDFA) : isTapeDisconnected ? const Color(0xFFFFFBEB) : isWet ? const Color(0xFFFFF7ED) : isDamp ? const Color(0xFFFFFBEB) : const Color(0xFFF0FDFA),
                          border: isMoistCalibrating ? const Color(0xFFA5F3FC) : isTapeDisconnected ? const Color(0xFFFDE68A) : isWet ? const Color(0xFFFED7AA) : isDamp ? const Color(0xFFFDE68A) : const Color(0xFF99F6E4),
                          isCalibrating: isMoistCalibrating,
                          isMisaligned: isTapeDisconnected,
                          helperText: isMoistCalibrating ? 'Calibrating moisture sensor...' : isTapeDisconnected ? '2-pin capacitive tape unplugged' : null,
                        ),
                      ),
                    ],
                  ),

                  if (isMoistureActive || mNum > 0) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFF0FDFA), Color(0xFFCCFBF1)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFF99F6E4)),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0D9488).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.cleaning_services, size: 20, color: Color(0xFF0D9488)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Diaper Changed / Sensor Reset',
                                  style: GoogleFonts.poppins(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.bold,
                                    color: const Color(0xFF0F766E),
                                  ),
                                ),
                                Text(
                                  'Tares sensor and resets wetness reading back to 0% DRY.',
                                  style: GoogleFonts.albertSans(
                                    fontSize: 11,
                                    color: const Color(0xFF134E4A),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: _isResettingDiaper ? null : _handleDiaperChange,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0D9488),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              elevation: 0,
                            ),
                            child: _isResettingDiaper
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : Text(
                                    'Reset Dry',
                                    style: GoogleFonts.poppins(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                          ),
                        ],
                      ),
                    ),
                  ],

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
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: isDeviceActive ? const Color(0xFFECFDF5) : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isDeviceActive ? const Color(0xFFA7F3D0) : const Color(0xFFCBD5E1),
                              ),
                            ),
                            child: Text(
                              isDeviceActive ? "Active" : "Offline",
                              style: GoogleFonts.poppins(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w700,
                                color: isDeviceActive ? const Color(0xFF059669) : const Color(0xFF64748B),
                              ),
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

                  const SizedBox(height: 18),

                  // Clinical Care Logs & Alert Reviews Section
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Clinical Care Logs & Alert Reviews',
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF1E293B),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDFA),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFF99F6E4)),
                        ),
                        child: Text(
                          '${_careLogs.length}',
                          style: GoogleFonts.poppins(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF0F766E),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: _careLogs.isEmpty
                        ? Text(
                            'No care logs or alert review notes recorded for this patient yet.',
                            style: GoogleFonts.albertSans(
                              fontSize: 12,
                              color: const Color(0xFF64748B),
                            ),
                          )
                        : Column(
                            children: _careLogs.take(10).map((log) {
                              final author = (log['authorName'] ?? log['author_name'] ?? 'Caregiver').toString();
                              final content = (log['content'] ?? '').toString();
                              final rawDate = (log['createdAt'] ?? log['created_at'] ?? '').toString();
                              String timeStr = '';
                              try {
                                final dt = DateTime.parse(rawDate).toLocal();
                                timeStr = DateFormat('MMM d, h:mm a').format(dt);
                              } catch (_) {}
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          author,
                                          style: GoogleFonts.poppins(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: const Color(0xFF0F766E),
                                          ),
                                        ),
                                        Text(
                                          timeStr,
                                          style: GoogleFonts.albertSans(
                                            fontSize: 10.5,
                                            color: const Color(0xFF64748B),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      content,
                                      style: GoogleFonts.albertSans(
                                        fontSize: 12,
                                        color: const Color(0xFF1E293B),
                                        height: 1.35,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
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
    bool isCalibrating = false,
    bool isMisaligned = false,
    String? helperText,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border, width: isMisaligned || isCalibrating ? 1.5 : 1.0),
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
          if (isCalibrating)
            Row(
              children: [
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0891B2)),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  'Acquiring...',
                  style: GoogleFonts.poppins(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0E7490),
                  ),
                ),
              ],
            )
          else if (isMisaligned)
            Row(
              children: [
                const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFD97706)),
                const SizedBox(width: 4),
                Text(
                  value == 'Disconnected' ? 'Disconnected' : 'Misaligned',
                  style: GoogleFonts.poppins(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFFB45309),
                  ),
                ),
              ],
            )
          else
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
          if (helperText != null && helperText.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              helperText,
              style: GoogleFonts.albertSans(
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                color: isCalibrating ? const Color(0xFF0891B2) : const Color(0xFFB45309),
              ),
            ),
          ],
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
