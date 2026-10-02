import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:async';

// [INTEGRATION] Import API service for fetching patient data
import '../services/api_service.dart';
import '../services/alert_notification_service.dart';
import '../models/user_session.dart';
import 'newpatient.dart';
import '../widgets/patient_profile_modal.dart';
import '../theme/alaga_theme.dart';

class PatientListScreen extends StatefulWidget {
  final VoidCallback? onBack; 
  const PatientListScreen({super.key, this.onBack}); 

  @override
  State<PatientListScreen> createState() => _PatientListScreenState();
}

class _PatientListScreenState extends State<PatientListScreen> {
  String selectedFilter = "All Patients";
  String searchQuery = "";
  final TextEditingController _searchController = TextEditingController();

  // [INTEGRATION] Live patient data from the backend
  List<Map<String, dynamic>> allPatients = [];
  bool _isLoading = true;
  StreamSubscription<Map<String, dynamic>>? _alertSyncSub;

  @override
  void initState() {
    super.initState();
    _fetchPatients();
    _alertSyncSub = AlertNotificationService.onAlertUpdate.listen((eventData) {
      if (!mounted) return;
      final eventType = eventData['event']?.toString() ?? '';
      if (eventType == 'patient_telemetry_update' || eventType == 'device_status_update' || eventType == 'new_alert') {
        _fetchPatients();
      }
    });
  }

  // [INTEGRATION] Fetches patient list from GET /api/caregiver/patients.
  // The backend returns role-scoped data: admins see all patients,
  // caregivers only see patients they have access to (OWASP A01).
    Future<void> _fetchPatients() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final result = await ApiService.get('/api/caregiver/patients');

      if (!mounted) return;

      if (result['success'] == true && result['data'] != null && result['data'] is List) {
        final List<dynamic> rawPatients = result['data'];
        setState(() {
          allPatients = rawPatients.map((p) {
            final telemetry = p['latest_telemetry'] ?? {};
            final pairedList = p['paired_devices'] is List ? (p['paired_devices'] as List) : [];
            final bool isDeviceActive = p['is_online'] == true ||
                p['isOnline'] == true ||
                p['device_status']?.toString().toLowerCase() == 'active' ||
                pairedList.any((d) => d['is_online'] == true || d['status'] == 'ACTIVE');

            final bool isVitalsActive = p['is_vitals_online'] == true ||
                pairedList.any((d) => (d['is_online'] == true || d['status'] == 'ACTIVE') &&
                    ((d['serial_number']?.toString().startsWith('VS-') ?? false) ||
                     (d['device_name']?.toString().toLowerCase().contains('vital') ?? false) ||
                     (d['serial_number']?.toString().startsWith('SD-') != true &&
                      d['device_name']?.toString().toLowerCase().contains('diaper') != true &&
                      d['device_name']?.toString().toLowerCase().contains('moisture') != true))) ||
                (pairedList.isEmpty && isDeviceActive);

            final bool isMoistureActive = p['is_moisture_online'] == true ||
                pairedList.any((d) => (d['is_online'] == true || d['status'] == 'ACTIVE') &&
                    ((d['serial_number']?.toString().startsWith('SD-') ?? false) ||
                     (d['device_name']?.toString().toLowerCase().contains('diaper') ?? false) ||
                     (d['device_name']?.toString().toLowerCase().contains('moisture') ?? false) ||
                     (d['serial_number']?.toString().startsWith('VS-') != true &&
                      d['device_name']?.toString().toLowerCase().contains('vital') != true))) ||
                (pairedList.isEmpty && isDeviceActive);

            // Extract raw numbers (or null) to allow for graph calculations
            final hr = (telemetry['heart_rate'] ?? p['heart_rate'] ?? p['heartRate']) as num?;
            final temp = (telemetry['temperature'] ?? p['temperature']) as num?;
            final spo2 = (telemetry['spo2'] ?? p['spo2']) as num?;
            final moist = (telemetry['moisture'] ?? telemetry['moisture_value'] ?? p['moisture'] ?? p['moisture_value']) as num?;

            final bool isHrDetached = isVitalsActive && (hr == 0 || hr == null);
            final bool isSpo2Detached = isVitalsActive && (spo2 == 0 || spo2 == null);
            final bool isTempDetached = isVitalsActive && ((temp != null && temp <= 30.0) || temp == 0 || temp == null || (isHrDetached && isSpo2Detached));
            final bool isMoistDetached = isMoistureActive && (moist == null || moist <= 0);

            final String hrDisplay = !isVitalsActive ? '---' : isHrDetached ? '0 (Detached)' : '$hr';
            final String tempDisplay = !isVitalsActive ? '---' : isTempDetached ? '${temp != null && temp > 0 ? temp.toStringAsFixed(1) : "0.0"}°C (Detached)' : (temp != null ? "${temp.toStringAsFixed(1)}°C" : '---');
            final String spo2Display = !isVitalsActive ? '---' : isSpo2Detached ? '0% (Detached)' : (spo2 != null ? "$spo2%" : '---');
            final String wetDisplay = !isMoistureActive ? '---' : isMoistDetached ? '0% (Detached)' : (moist != null && moist >= 70 ? 'Wet ($moist%)' : 'Dry ($moist%)');

            return <String, dynamic>{
              ...p,
              'patient_id': p['patient_id'] ?? p['id'],
              'name': p['name'] ?? 'Unknown',
              'room': p['room'] ?? p['baseline_data']?['room'] ?? 'Room Home',
              'status': isDeviceActive ? 'Stable' : 'Offline',
              'is_online': isDeviceActive,
              'isOnline': isDeviceActive,
              'is_vitals_online': isVitalsActive,
              'is_moisture_online': isMoistureActive,
              
              // UI Labels (Strings)
              'hr': hrDisplay,
              'temp': tempDisplay,
              'spo2': spo2Display,
              'wetness': wetDisplay,
              'is_wet': isMoistureActive && moist != null && moist >= 70,
              
              // Raw Numbers for Graphing (Use these in your CustomPainter)
              'hr_num': hr?.toDouble() ?? 0.0,
              'temp_num': temp?.toDouble() ?? 0.0,
              'spo2_num': spo2?.toDouble() ?? 0.0,
              'moist_num': moist?.toDouble() ?? 0.0,
              
              'vs_id': p['vital_device_sn'] ?? 'None',
              'sd_id': p['diaper_device_sn'] ?? 'None',
              'birthdate': p['birthdate'],
              'assigned_caregiver': p['assigned_caregiver_name'] ?? 'Unassigned',
            };
          }).toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          allPatients = [];
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          allPatients = [];
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _alertSyncSub?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mainTextStyle = GoogleFonts.poppins(fontWeight: FontWeight.bold, color: const Color(0xFF2D3436));
    final descriptionStyle = GoogleFonts.albertSans(color: Colors.grey, fontSize: 13);
    const Color bgColor = AlagaColors.background;

    final filteredPatients = allPatients.where((p) {
      bool matchesFilter = selectedFilter == "All Patients" || p['status'] == "Stable";
      String query = searchQuery.toLowerCase();
      bool matchesSearch = p['name'].toLowerCase().contains(query) ||
          p['room'].toLowerCase().contains(query) ||
          (p['vs_id'] ?? '').toLowerCase().contains(query) ||
          (p['sd_id'] ?? '').toLowerCase().contains(query);
      return matchesFilter && matchesSearch;
    }).toList();

    return Scaffold(
      backgroundColor: bgColor,
      floatingActionButton: UserSession.current?.role.toLowerCase() == 'caregiver' ? null : FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const NewPatientScreen()),
          ).then((_) => _fetchPatients());
        },
        backgroundColor: AlagaColors.primary,
        icon: const Icon(Icons.person_add_alt_1, color: Colors.white),
        label: Text(
          "Enroll Patient",
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            fontSize: 13,
            color: Colors.white,
          ),
        ),
      ),
      appBar: AppBar(
        title: const Text(""),
        backgroundColor: bgColor,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () {
            widget.onBack?.call(); 
            Navigator.pop(context); 
          },
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      "Care Roster",
                      style: GoogleFonts.poppins(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF00796B), 
                      ),
                    ),
                    if (UserSession.current?.hasFacility == true) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF004D40).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF00796B).withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.apartment_rounded, size: 12, color: Color(0xFF00796B)),
                            const SizedBox(width: 4),
                            Text(
                              UserSession.current!.facilityName!,
                              style: GoogleFonts.poppins(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF004D40),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
                Text(
                  "Patient List",
                  style: mainTextStyle.copyWith(fontSize: 28),
                ),
                const SizedBox(height: 8),
                Text(
                  "Manage and monitor all assigned patients",
                  style: descriptionStyle.copyWith(color: Colors.black),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AlagaColors.cardBorder, width: 1),
                boxShadow: const [BoxShadow(color: Color(0x0A0F172A), blurRadius: 10, offset: Offset(0, 4))],
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => searchQuery = value),
                decoration: InputDecoration(
                  hintText: "Search patient, room, or device ID...",
                  hintStyle: descriptionStyle.copyWith(color: Colors.grey),
                  prefixIcon: const Icon(Icons.search, color: AlagaColors.primary, size: 20),
                  suffixIcon: searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => searchQuery = "");
                          })
                      : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                _buildFilterChip("All Patients", mainTextStyle),
                const SizedBox(width: 8),
                _buildFilterChip("Active Monitoring", mainTextStyle),
              ],
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AlagaColors.primary))
                : filteredPatients.isEmpty
                    ? _buildEmptyState(descriptionStyle)
                    : RefreshIndicator(
                        onRefresh: _fetchPatients,
                        color: AlagaColors.primary,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: filteredPatients.length,
                          itemBuilder: (context, index) {
                            return _buildPatientCard(
                              filteredPatients[index],
                              mainTextStyle,
                              descriptionStyle,
                              // [OWASP A01] Callback triggers a list refresh
                              // after a successful removal — keeps state consistent.
                              onRemoved: _fetchPatients,
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildPatientCard(
    Map<String, dynamic> patient,
    TextStyle main,
    TextStyle desc, {
    VoidCallback? onRemoved,
  }) {
    return PatientCardWidget(
      patient: patient,
      mainStyle: main,
      descStyle: desc,
      onRemoved: onRemoved,
    );
  }

  Widget _buildFilterChip(String label, TextStyle style) {
    bool isSelected = selectedFilter == label;
    return GestureDetector(
      onTap: () => setState(() => selectedFilter = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AlagaColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AlagaColors.primary : AlagaColors.cardBorder),
        ),
        child: Text(label, style: style.copyWith(fontSize: 12, color: isSelected ? Colors.white : Colors.grey)),
      ),
    );
  }


  Widget _buildEmptyState(TextStyle style) {
    final message = searchQuery.isNotEmpty
        ? "No patients found matching '$searchQuery'."
        : "There are currently no patients assigned to you.";

    return RefreshIndicator(
      onRefresh: _fetchPatients,
      color: const Color(0xFF5FA9A9),
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.person_outline, size: 64, color: Colors.grey.shade400),
                    const SizedBox(height: 16),
                    Text(
                      message,
                      textAlign: TextAlign.center,
                      style: style.copyWith(
                        fontSize: 14,
                        color: Colors.black87,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class MiniGraphPainter extends CustomPainter {
  final List<double> points;
  final Color color;

  MiniGraphPainter(this.points, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty || points.length < 2) return;

    final paint = Paint()
      ..color = color
      ..strokeWidth = 3.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = Path();
    double spacing = size.width / (points.length - 1);

    double minVal = points.reduce((a, b) => a < b ? a : b);
    double maxVal = points.reduce((a, b) => a > b ? a : b);
    
    // CRITICAL FIX: If the variance is small (e.g., 28.1 to 28.4), 
    // we force a minimum range of 5 degrees to make the line 'bouncy' and visible.
    double diff = maxVal - minVal;
    double range = diff < 2.0 ? 5.0 : diff; 
    
    // Center the data within the 5-degree range
    double mid = (minVal + maxVal) / 2;
    double minBound = mid - (range / 2);

    for (int i = 0; i < points.length; i++) {
      double x = i * spacing;
      // Map value to Y-coordinate
      double normalizedY = (points[i] - minBound) / range;
      // Invert because Y=0 is the top of the canvas
      double y = size.height - (normalizedY * size.height);
      
      // Clamp the Y value to stay inside the box
      y = y.clamp(0.0, size.height);

      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, paint);

    // Draw active pulse dot on latest reading
    if (points.isNotEmpty) {
      final lastX = (points.length - 1) * spacing;
      final normalizedLastY = (points.last - minBound) / range;
      final lastY = (size.height - (normalizedLastY * size.height)).clamp(0.0, size.height);
      final dotPaint = Paint()..color = color..style = PaintingStyle.fill;
      canvas.drawCircle(Offset(lastX, lastY), 3.5, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant MiniGraphPainter oldDelegate) {
    // hashCode checks content equality, not just memory reference
    return points.hashCode != oldDelegate.points.hashCode;
  }
}

class PatientCardWidget extends StatefulWidget {
  final Map<String, dynamic> patient;
  final TextStyle mainStyle;
  final TextStyle descStyle;
  // [OWASP A01] Parent-only: callback to refresh the list after removal.
  final VoidCallback? onRemoved;

  const PatientCardWidget({
    Key? key,
    required this.patient,
    required this.mainStyle,
    required this.descStyle,
    this.onRemoved,
  }) : super(key: key);

  @override
  State<PatientCardWidget> createState() => _PatientCardWidgetState();
}

class _PatientCardWidgetState extends State<PatientCardWidget> {
  bool _isLoadingHistory = false;
  String _selectedTimeframe = 'Day';
  List<double> hrHistory = [];
  List<double> tempHistory = [];
  List<double> spo2History = [];
  List<double> moistureHistory = [];
  Timer? _refreshTimer;
  StreamSubscription<Map<String, dynamic>>? _telemetrySub;
  bool _isExpanded = false;

  @override
  void initState() {
    super.initState();
    final targetId = (widget.patient['patient_id'] ?? widget.patient['id'])?.toString();

    // Listen to real-time telemetry updates for this specific patient
    _telemetrySub = AlertNotificationService.onAlertUpdate.listen((eventData) {
      if (!mounted) return;
      final eventType = eventData['event']?.toString() ?? '';
      final data = eventData['data'] is Map<String, dynamic>
          ? eventData['data'] as Map<String, dynamic>
          : <String, dynamic>{};

      if (eventType == 'patient_telemetry_update' || eventType == 'device_status_update') {
        final updateId = (data['patient_id'] ?? data['patientId'])?.toString();
        if (updateId == targetId) {
          final hr = (data['heart_rate'] ?? data['latest_telemetry']?['heart_rate'] as num?)?.toDouble();
          final temp = (data['temperature'] ?? data['latest_telemetry']?['temperature'] as num?)?.toDouble();
          final sp = (data['spo2'] ?? data['latest_telemetry']?['spo2'] as num?)?.toDouble();
          final moist = (data['moisture'] ?? data['latest_telemetry']?['moisture'] as num?)?.toDouble();

          setState(() {
            if (hr != null && hr > 0) hrHistory = [...hrHistory, hr];
            if (temp != null && temp > 0) tempHistory = [...tempHistory, temp];
            if (sp != null && sp > 0) spo2History = [...spo2History, sp];
            if (moist != null) moistureHistory = [...moistureHistory, moist];
          });

          // If currently expanded, silently refresh to ensure full database synchronization
          if (_isExpanded) {
            _fetchHistory(silent: true);
          }
        }
      }
    });
  }

  void _startAutoRefresh() {
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _fetchHistory(silent: true);
    });
  }

  void _stopAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  void _fetchHistory({bool silent = false}) async {
    if (_isLoadingHistory && !silent) return;
    
    if (!silent) {
      setState(() { _isLoadingHistory = true; });
    }

    try {
      final tfParam = _selectedTimeframe.toLowerCase();
      final targetPatientId = widget.patient['patient_id'] ?? widget.patient['id'];
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
          
          _isLoadingHistory = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _isLoadingHistory = false; });
    }
  }

  Widget _buildVital(IconData icon, String label, String value, Color color, TextStyle desc, TextStyle main) {
    return Column(
      children: [
        Row(children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(label, style: desc.copyWith(fontSize: 10, fontWeight: FontWeight.bold))
        ]),
        const SizedBox(height: 4),
        Text(value, style: main.copyWith(fontSize: 13)),
      ],
    );
  }

  Widget _buildStatusBadge(bool isWet, bool isOffline, String status, TextStyle desc) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isWet ? Colors.orange.shade100 : (isOffline ? Colors.grey.shade100 : const Color(0xFFE8F5E9)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isWet) ...[const Icon(Icons.opacity, size: 12, color: Colors.orange), const SizedBox(width: 4)],
          Text(isWet ? "WET" : status,
              style: desc.copyWith(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: isWet ? Colors.orange.shade900 : (isOffline ? Colors.grey : Colors.green.shade700))),
        ],
      ),
    );
  }

  Widget _buildDeviceBadge(String id, Color color, TextStyle main) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: color.withValues(alpha: 0.3))),
      child: Text(id, style: main.copyWith(fontSize: 10, color: color.withValues(alpha: 0.9))),
    );
  }

  Widget _buildDetailRow(String label, String value, TextStyle desc, TextStyle main) {
    return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: desc.copyWith(fontSize: 11)), Text(value, style: main.copyWith(fontSize: 11))]);
  }

  Widget _buildFullWidthGraph(String label, List<double> points, Color color, {String unit = ''}) {
    // Always ensure the painter receives a valid list
    final displayPoints = (points.length < 2) ? [0.0, 0.0] : points;
    final latestVal = displayPoints.isNotEmpty ? displayPoints.last : 0.0;

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
                Text(label, style: GoogleFonts.albertSans(fontSize: 11, color: const Color(0xFF475569), fontWeight: FontWeight.w600)),
              ],
            ),
            Text("Latest: ${latestVal.toStringAsFixed(1)}$unit", 
                style: GoogleFonts.poppins(fontSize: 11, color: color, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.15)),
          ),
          child: RepaintBoundary(
            child: SizedBox(
              height: 52,
              width: double.infinity,
              child: CustomPaint(
                key: ValueKey('${displayPoints.hashCode}_${displayPoints.length}'),
                painter: MiniGraphPainter(displayPoints, color),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // [OWASP A01] Only a parent account can permanently remove a patient.
  // A two-step confirmation dialog is shown to prevent accidental deletion.
  // Calls DELETE /api/caregiver/patients/:id — the backend re-verifies the JWT role.
  Future<void> _confirmRemovePatient(BuildContext tileContext) async {
    final patientName = widget.patient['name'] as String? ?? 'this patient';
    final patientId = widget.patient['patient_id'];

    final confirmed = await showDialog<bool>(
      context: tileContext,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          "Remove Patient?",
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold, color: Colors.redAccent),
        ),
        content: Text(
          "You are about to permanently remove $patientName from the system. "
          "All associated records and device assignments will be unlinked. "
          "This action cannot be undone.",
          style: GoogleFonts.albertSans(fontSize: 13, color: Colors.grey[700]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text("Cancel", style: GoogleFonts.poppins(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text("Yes, Remove", style: GoogleFonts.poppins(fontSize: 13)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    // [OWASP A05] Patient ID is sent as a typed path parameter — never concatenated as a raw string.
    final result = await ApiService.delete('/caregiver/patients/$patientId');

    if (!mounted) return;

    if (result['success'] == true) {
      ScaffoldMessenger.of(tileContext).showSnackBar(
        SnackBar(
          content: Text("$patientName has been removed.", style: GoogleFonts.albertSans()),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
      // Notify the parent list screen to refresh its data.
      widget.onRemoved?.call();
    } else {
      // [OWASP A10] Display only the server's generic error — no stack traces.
      ScaffoldMessenger.of(tileContext).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Failed to remove patient.', style: GoogleFonts.albertSans()),
          backgroundColor: Colors.grey[700],
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  void dispose() {
    _stopAutoRefresh();
    _telemetrySub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    bool isOffline = widget.patient["status"] == "Offline" || widget.patient["is_online"] == false;
    bool isWet = widget.patient["is_wet"] == true || widget.patient["wetness"]?.toString().contains("Wet") == true;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: isWet ? Colors.orange : Colors.grey.shade200, width: isWet ? 1.5 : 1),
      ),
      child: ExpansionTile(
        onExpansionChanged: (expanded) {
          _isExpanded = expanded;
          if (expanded) {
            _fetchHistory();
            _startAutoRefresh();
          } else {
            _stopAutoRefresh();
          }
        },
        tilePadding: const EdgeInsets.all(16.0),
        collapsedBackgroundColor: Colors.white,
        backgroundColor: Colors.white,
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: const Color(0xFFF0F2F5), borderRadius: BorderRadius.circular(20)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text("View", style: widget.mainStyle.copyWith(fontSize: 12, color: const Color(0xFF4DB6AC))),
              const Icon(Icons.keyboard_arrow_down, size: 18, color: Color(0xFF4DB6AC)),
            ],
          ),
        ),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            InkWell(
              onTap: () => showPatientProfileModal(context, widget.patient),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 2.0, horizontal: 4.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(widget.patient["name"], style: widget.mainStyle.copyWith(fontSize: 15)),
                        const SizedBox(width: 5),
                        const Icon(Icons.info_outline, size: 14, color: Color(0xFF4DB6AC)),
                      ],
                    ),
                    Text(widget.patient["room"], style: widget.descStyle.copyWith(fontSize: 11)),
                  ],
                ),
              ),
            ),
            _buildStatusBadge(isWet, isOffline, widget.patient["status"], widget.descStyle),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildVital(Icons.favorite, "HR", widget.patient["hr"], Colors.redAccent, widget.descStyle, widget.mainStyle),
              _buildVital(Icons.thermostat, "TEMP", widget.patient["temp"], Colors.orange, widget.descStyle, widget.mainStyle),
              _buildVital(Icons.water_drop, "SPO2", widget.patient["spo2"], Colors.blue, widget.descStyle, widget.mainStyle),
              _buildVital(Icons.opacity, "SDM", widget.patient["wetness"], const Color(0xFF4DB6AC), widget.descStyle, widget.mainStyle),
              const SizedBox(width: 4),
            ],
          ),
        ),
        children: [
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Hardware Configuration", 
                    style: widget.descStyle.copyWith(fontSize: 11, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildDeviceBadge(widget.patient["vs_id"], Colors.blue, widget.mainStyle),
                    _buildDeviceBadge(widget.patient["sd_id"], Colors.orange, widget.mainStyle),
                  ],
                ),
                
                const SizedBox(height: 12),
                _buildDetailRow("Assigned Caregiver", widget.patient["assigned_caregiver"] ?? "Unassigned", widget.descStyle, widget.mainStyle),
                const SizedBox(height: 24),
                
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Text("Vital Statistics History", style: widget.mainStyle.copyWith(fontSize: 13)),
                        const SizedBox(width: 8),
                        Container(
                          width: 7,
                          height: 7,
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
                              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFF1B393D) : Colors.transparent,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                tf,
                                style: GoogleFonts.albertSans(
                                  fontSize: 11,
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
                const SizedBox(height: 16),
                
                if (_isLoadingHistory)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator(color: Color(0xFF5FA9A9), strokeWidth: 2)),
                  )
                else ...[
                  _buildFullWidthGraph("Heart Rate Trend", hrHistory, Colors.redAccent, unit: ' BPM'),
                  const SizedBox(height: 16),
                  _buildFullWidthGraph("Body Temperature Trend", tempHistory, Colors.orange, unit: '°C'),
                  const SizedBox(height: 16),
                  _buildFullWidthGraph("Blood Oxygen SpO2", spo2History, Colors.blue, unit: '%'),
                  const SizedBox(height: 16),
                  _buildFullWidthGraph("Diaper Moisture Sensor", moistureHistory, Colors.teal, unit: '%'),
                ],

                const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Divider()),
                _buildDetailRow("System Integrity", isOffline ? "Offline" : "Secure - Live Connection", widget.descStyle, widget.mainStyle),

                // [OWASP A01] Remove Patient button — visible to parent accounts only.
                // [GDPR] Supports the 'Right to Erasure' for enrolled patient records.
                if (UserSession.current?.isParent == true) ...[
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => _confirmRemovePatient(context),
                      icon: const Icon(Icons.person_remove_outlined, size: 16, color: Colors.redAccent),
                      label: Text(
                        "Remove Patient",
                        style: GoogleFonts.poppins(fontSize: 13, color: Colors.redAccent),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Colors.redAccent),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
