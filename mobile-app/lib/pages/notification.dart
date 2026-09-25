import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/alert_notification_service.dart';

// ============================================================================
// NotificationScreen — Displays live alerts from the OC-SVM AI pipeline
//
// Data Source: GET /api/alerts/clinical
//   - Backed by alert_notifications + anomaly_events + patients tables
//   - Role-scoped: admins/medical_staff see all; caregivers see assigned only
//   - [OWASP A01] JWT is attached automatically by ApiService
//   - [HIPAA] Only Minimum Necessary fields are fetched from the backend
// ============================================================================

class NotificationScreen extends StatefulWidget {
  final String? initialSearch;
  final bool initialClinical;
  const NotificationScreen({super.key, this.initialSearch, this.initialClinical = true});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  List<dynamic> _alerts = [];
  bool _isLoading = true;
  String? _errorMessage;
  late bool _showClinicalAlerts;
  StreamSubscription? _alertSub;
  final Set<int> _flaggingIds = {};

  String _searchQuery = '';
  String _clinicalFilterType = 'All';
  String _systemFilterType = 'All';
  late final TextEditingController _searchController;

  List<dynamic> get _filteredAlerts {
    var list = List<dynamic>.from(_alerts);

    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.toLowerCase().trim();
      list = list.where((a) {
        final name = (a['patient_name'] ?? '').toString().toLowerCase();
        final msg = (_showClinicalAlerts ? a['message'] : a['description'])?.toString().toLowerCase() ?? '';
        final type = (a['anomaly_type'] ?? a['alert_type'])?.toString().toLowerCase() ?? '';
        return name.contains(q) || msg.contains(q) || type.contains(q);
      }).toList();
    }

    if (_showClinicalAlerts) {
      if (_clinicalFilterType == 'AI Anomaly') {
        list = list.where((a) {
          final anom = (a['anomaly_type'] ?? '').toString().toLowerCase();
          final msg = (a['message'] ?? '').toString().toLowerCase();
          return anom.contains('ocsvm') || anom.contains('pattern') || msg.contains('oc-svm') || msg.contains('abnormal pattern');
        }).toList();
      } else if (_clinicalFilterType == 'Emergency') {
        list = list.where((a) {
          final sev = (a['severity'] ?? '').toString().toLowerCase();
          final msg = (a['message'] ?? '').toString().toLowerCase();
          return sev == 'critical' || msg.contains('emergency') || msg.contains('critical');
        }).toList();
      } else if (_clinicalFilterType == 'Wet Diaper') {
        list = list.where((a) {
          final anom = (a['anomaly_type'] ?? '').toString().toLowerCase();
          final msg = (a['message'] ?? '').toString().toLowerCase();
          return anom.contains('moisture') || anom.contains('diaper') || msg.contains('wet diaper') || msg.contains('moisture');
        }).toList();
      } else if (_clinicalFilterType == 'Vital Signs') {
        list = list.where((a) {
          final anom = (a['anomaly_type'] ?? '').toString().toLowerCase();
          final msg = (a['message'] ?? '').toString().toLowerCase();
          return anom.contains('heart_rate') || anom.contains('temp') || anom.contains('spo2') ||
                 msg.contains('bpm') || msg.contains('tachycardia') || msg.contains('bradycardia') ||
                 msg.contains('fever') || msg.contains('hypothermia') || msg.contains('spo2');
        }).toList();
      }
    } else {
      if (_systemFilterType == 'Low Battery') {
        list = list.where((a) {
          final type = (a['alert_type'] ?? '').toString().toLowerCase();
          final desc = (a['description'] ?? '').toString().toLowerCase();
          return type.contains('battery') || desc.contains('battery');
        }).toList();
      } else if (_systemFilterType == 'Offline') {
        list = list.where((a) {
          final type = (a['alert_type'] ?? '').toString().toLowerCase();
          final desc = (a['description'] ?? '').toString().toLowerCase();
          return type.contains('disconnect') || type.contains('offline') || desc.contains('disconnect') || desc.contains('offline');
        }).toList();
      } else if (_systemFilterType == 'Sensor Fault') {
        list = list.where((a) {
          final type = (a['alert_type'] ?? '').toString().toLowerCase();
          final desc = (a['description'] ?? '').toString().toLowerCase();
          return type.contains('sensor') || type.contains('probe') || desc.contains('sensor') || desc.contains('probe');
        }).toList();
      } else if (_systemFilterType == 'Weak Signal') {
        list = list.where((a) {
          final type = (a['alert_type'] ?? '').toString().toLowerCase();
          final desc = (a['description'] ?? '').toString().toLowerCase();
          return type.contains('signal') || type.contains('rssi') || desc.contains('signal') || desc.contains('rssi');
        }).toList();
      }
    }

    return list;
  }

  Future<void> _testHardwareDiagnostic(String testType) async {
    try {
      final res = await ApiService.post('/api/alerts/system/test-trigger', body: {
        'alert_type': testType,
        'severity': testType.contains('Critical') ? 'Critical' : 'Warning',
        'description': testType == 'Low Battery Warning'
            ? 'Diagnostic Test: IoT Device battery dropped to 14%. Recharging required.'
            : testType == 'Sensor Malfunction'
            ? 'Diagnostic Test: Pulse oximeter probe detached from patient.'
            : 'Diagnostic Test: IoT Device heartbeat timeout (>10 minutes inactive).'
      });
      if (!mounted) return;
      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hardware diagnostic "$testType" triggered.'),
            backgroundColor: const Color(0xFF0D9488),
            behavior: SnackBarBehavior.floating,
          ),
        );
        _fetchAlerts();
      }
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    _showClinicalAlerts = widget.initialClinical;
    _searchQuery = widget.initialSearch ?? '';
    _searchController = TextEditingController(text: _searchQuery);
    _fetchAlerts();

    // Listen to real-time events synced across Web and Mobile
    _alertSub = AlertNotificationService.onAlertUpdate.listen((event) {
      if (mounted) {
        _fetchAlerts();
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _alertSub?.cancel();
    super.dispose();
  }

  // --------------------------------------------------------------------------
  // Fetch clinical alerts from the Express backend.
  // The backend enforces RBAC — caregivers only see their assigned patients.
  // [OWASP A01] JWT is sent in the Authorization header via ApiService.
  // --------------------------------------------------------------------------
  Future<void> _fetchAlerts() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await ApiService.get(
      _showClinicalAlerts ? '/api/alerts/clinical' : '/api/alerts/system',
    );

    if (!mounted) return;

    if (result['success'] == true) {
      setState(() {
        _alerts = result['data'] ?? [];
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage = result['message'] ?? 'Failed to load alerts.';
        _isLoading = false;
      });
    }
  }

  // --------------------------------------------------------------------------
  // Acknowledge an alert and update the audit trail.
  // [HIPAA] Requires an "action taken" note — non-repudiation requirement.
  // --------------------------------------------------------------------------
  Future<void> _acknowledgeAlert(int alertId) async {
    final controller = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Review & Acknowledge Alert',
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Describe the action you took in response to this alert.',
              style: GoogleFonts.albertSans(fontSize: 13, color: Colors.black54),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: InputDecoration(
                hintText: 'e.g. Checked patient, diaper changed, vitals normal.',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
            ),
            onPressed: () {
              if (controller.text.trim().isEmpty) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text('Please describe the action taken.')),
                );
                return;
              }
              Navigator.pop(ctx, true);
            },
            child: Text(
              'Confirm Acknowledge',
              style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final actionText = controller.text.trim();

    // [HIPAA] PUT /alerts/clinical/:id/acknowledge records who acknowledged,
    // when, and what action was taken — required for the audit trail.
    final result = await ApiService.put(
      '/api/alerts/clinical/$alertId/acknowledge',
      body: {'action_taken': actionText},
    );

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result['success'] == true
              ? 'Alert acknowledged. Audit trail updated.'
              : result['message'] ?? 'Acknowledgment failed.',
        ),
        backgroundColor: result['success'] == true
            ? const Color(0xFF16A34A)
            : Colors.redAccent,
      ),
    );

    if (result['success'] == true) {
      _fetchAlerts(); // Refresh list
    }
  }

  // --------------------------------------------------------------------------
  // Flag alert as normal (AI Adaptive Baseline learning, 0/5 to 5/5)
  // --------------------------------------------------------------------------
  Future<void> _flagAsNormal(Map<String, dynamic> alert) async {
    final alertId = alert['alert_id'];
    if (alertId == null) return;

    setState(() {
      _flaggingIds.add(alertId as int);
    });

    try {
      final res = await ApiService.post('/api/alerts/clinical/$alertId/flag-normal');
      if (!mounted) return;

      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? 'Pattern flagged as normal.'),
            backgroundColor: const Color(0xFF0D9488),
          ),
        );
        _fetchAlerts();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? 'Failed to flag alert as normal.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _flaggingIds.remove(alertId);
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Archive alert (Removes from active notification list)
  // --------------------------------------------------------------------------
  Future<void> _archiveAlert(String unifiedId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Archive Alert',
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Are you sure you want to archive this alert? It will be moved to the archive log and removed from active notifications.',
          style: GoogleFonts.albertSans(fontSize: 13, color: Colors.black87),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF475569),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              'Archive',
              style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final res = await ApiService.put(
      '/api/alerts/archive-unified-bulk',
      body: {
        'ids': [unifiedId]
      },
    );

    if (!mounted) return;

    if (res['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Alert archived successfully.'),
          backgroundColor: Color(0xFF0D9488),
        ),
      );
      _fetchAlerts();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message'] ?? 'Failed to archive alert.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  // --------------------------------------------------------------------------
  // Resolve hardware/system alert
  // --------------------------------------------------------------------------
  Future<void> _resolveSystemAlert(int sysAlertId) async {
    final res = await ApiService.put('/api/alerts/system/$sysAlertId/resolve');
    if (!mounted) return;

    if (res['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('System alert resolved.'),
          backgroundColor: Color(0xFF16A34A),
        ),
      );
      _fetchAlerts();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message'] ?? 'Failed to resolve system alert.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  // --------------------------------------------------------------------------
  // Build helpers
  // --------------------------------------------------------------------------

  Color _severityColor(String severity) {
    switch (severity.toLowerCase()) {
      case 'critical':
        return Colors.red.shade600;
      case 'warning':
        return Colors.orange.shade600;
      default:
        return Colors.blueGrey;
    }
  }

  IconData _severityIcon(String severity) {
    switch (severity.toLowerCase()) {
      case 'critical':
        return Icons.warning_rounded;
      case 'warning':
        return Icons.info_outline_rounded;
      default:
        return Icons.notifications_outlined;
    }
  }

  String _formatTime(String? isoString) {
    if (isoString == null) return '';
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return DateFormat('MMM d, h:mm a').format(dt);
    } catch (_) {
      return '';
    }
  }

  String _formatAnomalyType(String? type) {
    if (type == null) return 'AI Detection';
    return type
        .replaceAll('_', ' ')
        .replaceAll('rule ', 'Rule: ')
        .replaceAll('ocsvm', 'OC-SVM')
        .toUpperCase();
  }

  void _showNotificationTestModal() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.notifications_active_outlined, color: Color(0xFF2F7D7B), size: 24),
                const SizedBox(width: 10),
                Text(
                  'Test Sound & Push Notifications',
                  style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Trigger a live Android system notification and test your phone\'s sound tone and vibration.',
              style: GoogleFonts.albertSans(fontSize: 12, color: Colors.black54),
            ),
            const SizedBox(height: 16),
            ListTile(
              tileColor: const Color(0xFF2F7D7B).withValues(alpha: 0.1),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFF2F7D7B), width: 1.5),
              ),
              leading: const Icon(Icons.sync_rounded, color: Color(0xFF2F7D7B)),
              title: Text('Test Live Web & Phone Sound Sync',
                  style: GoogleFonts.poppins(
                      fontWeight: FontWeight.bold, fontSize: 13, color: const Color(0xFF1E5B59))),
              subtitle: Text(
                  'Trigger a real-time critical alarm that rings both Web App & Phone simultaneously',
                  style: GoogleFonts.albertSans(fontSize: 11)),
              trailing: const Icon(Icons.volume_up_rounded,
                  color: Color(0xFF2F7D7B)),
              onTap: () async {
                Navigator.pop(ctx);
                final res = await ApiService.post('/alerts/test-broadcast', body: {
                  'severity': 'Critical',
                  'patientName': 'Maria Santos',
                  'message':
                      'Live synced critical alarm: Heart rate 134 BPM. Triggered to Phone & Web simultaneously.',
                });
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(res['success'] == true
                          ? 'Synchronized alarm broadcasted to Web & Phone!'
                          : res['message'] ?? 'Failed to broadcast test.'),
                      backgroundColor: const Color(0xFF2F7D7B),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
            ),
            const SizedBox(height: 10),
            ListTile(
              tileColor: Colors.red.withValues(alpha: 0.08),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.red.withValues(alpha: 0.3)),
              ),
              leading: const Icon(Icons.emergency_outlined, color: Colors.red),
              title: Text('Test Critical Vitals Alert', style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: Text('Tachycardia (134 BPM) • Emergency Tone & Vibration', style: GoogleFonts.albertSans(fontSize: 11)),
              trailing: const Icon(Icons.volume_up_rounded, color: Colors.red),
              onTap: () async {
                Navigator.pop(ctx);
                await AlertNotificationService.testNotification(
                  severity: 'Critical',
                  customTitle: '🚨 CRITICAL ALERT: Maria Santos',
                  customMessage: 'Heart rate spiked to 134 BPM (Threshold: 100 BPM). Room 302.',
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Critical Alert sent to Android notification tray with sound!'),
                      backgroundColor: Colors.redAccent,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
            ),
            const SizedBox(height: 10),
            ListTile(
              tileColor: const Color(0xFF5FA9A9).withValues(alpha: 0.1),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFF5FA9A9)),
              ),
              leading: const Icon(Icons.water_drop_outlined, color: Color(0xFF2F7D7B)),
              title: Text('Test Diaper Wetness Alert', style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: Text('Moisture 88% detected • Care Chime & Alert', style: GoogleFonts.albertSans(fontSize: 11)),
              trailing: const Icon(Icons.volume_up_rounded, color: Color(0xFF2F7D7B)),
              onTap: () async {
                Navigator.pop(ctx);
                await AlertNotificationService.testNotification(
                  severity: 'Warning',
                  customTitle: '💧 DIAPER ALERT: Baby Emma',
                  customMessage: 'Smart diaper moisture reached 88%. Diaper change recommended.',
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Diaper Alert sent to Android notification tray with sound!'),
                      backgroundColor: Color(0xFF2F7D7B),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
            ),
            const SizedBox(height: 10),
            ListTile(
              tileColor: Colors.blue.withValues(alpha: 0.08),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.blue.withValues(alpha: 0.3)),
              ),
              leading: const Icon(Icons.group_add_outlined, color: Colors.blue),
              title: Text('Test Care Team Invite Alert', style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: Text('New care assignment received • Notification tone', style: GoogleFonts.albertSans(fontSize: 11)),
              trailing: const Icon(Icons.volume_up_rounded, color: Colors.blue),
              onTap: () async {
                Navigator.pop(ctx);
                await AlertNotificationService.testNotification(
                  severity: 'Info',
                  customTitle: '👥 CARE TEAM INVITATION',
                  customMessage: 'Dr. Smith invited you to join the Care Team for Patient John Doe.',
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Care Team Invitation notification sent with sound!'),
                      backgroundColor: Colors.blue,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: SafeArea(
        child: Column(
          children: [
            // Top bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back,
                        color: Colors.black87, size: 28),
                    onPressed: () {
                      Navigator.pop(context);
                    },
                  ),
                  Text(
                    'Alerts',
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Row(
                    children: [
                      // Real-time Audio Mute Toggle (Synced with Web App)
                      IconButton(
                        icon: Icon(
                          AlertNotificationService.isMuted
                              ? Icons.volume_off_rounded
                              : Icons.volume_up_rounded,
                          color: AlertNotificationService.isMuted
                              ? Colors.amber.shade800
                              : const Color(0xFF2F7D7B),
                          size: 24,
                        ),
                        onPressed: () async {
                          final messenger = ScaffoldMessenger.of(context);
                          await AlertNotificationService.toggleMute();
                          if (mounted) setState(() {});
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text(AlertNotificationService.isMuted
                                  ? 'Alert audio muted across all synced devices (Phone & Web)'
                                  : 'Alert audio active on all synced devices (Phone & Web)'),
                              backgroundColor: AlertNotificationService.isMuted
                                  ? Colors.amber.shade800
                                  : const Color(0xFF2F7D7B),
                              behavior: SnackBarBehavior.floating,
                              duration: const Duration(seconds: 2),
                            ),
                          );
                        },
                        tooltip: AlertNotificationService.isMuted
                            ? 'Unmute sound (Synced with Web)'
                            : 'Mute sound (Synced with Web)',
                      ),
                      // Test sound & notification button
                      IconButton(
                        icon: const Icon(Icons.notifications_active_outlined,
                            color: Color(0xFF2F7D7B), size: 24),
                        onPressed: _showNotificationTestModal,
                        tooltip: 'Test Sound & Notification',
                      ),
                      // Manual refresh button
                      IconButton(
                        icon: const Icon(Icons.refresh_rounded,
                            color: Colors.black54, size: 26),
                        onPressed: _fetchAlerts,
                        tooltip: 'Refresh alerts',
                      ),
                    ],
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    _buildAlertTab(
                      label: 'Clinical Alerts',
                      icon: Icons.monitor_heart_outlined,
                      selected: _showClinicalAlerts,
                      onTap: () => _selectTab(true),
                    ),
                    _buildAlertTab(
                      label: 'Hardware Diagnostics',
                      icon: Icons.memory_outlined,
                      selected: !_showClinicalAlerts,
                      onTap: () => _selectTab(false),
                    ),
                  ],
                ),
              ),
            ),

            // Search Bar for Patient & Anomaly Filtering
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.black12),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  style: GoogleFonts.albertSans(fontSize: 13),
                  decoration: InputDecoration(
                    hintText: _showClinicalAlerts
                        ? 'Search patient name, pattern, or vital...'
                        : 'Search patient, device serial, or error...',
                    hintStyle: GoogleFonts.albertSans(fontSize: 12, color: Colors.black38),
                    prefixIcon: const Icon(Icons.search, size: 20, color: Colors.black45),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18, color: Colors.black45),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),

            // Category Filter Chips
            SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: _showClinicalAlerts
                    ? [
                        _buildFilterChip('All', _clinicalFilterType == 'All', () => setState(() => _clinicalFilterType = 'All')),
                        _buildFilterChip('AI Anomaly', _clinicalFilterType == 'AI Anomaly', () => setState(() => _clinicalFilterType = 'AI Anomaly'), icon: Icons.auto_awesome),
                        _buildFilterChip('Emergency', _clinicalFilterType == 'Emergency', () => setState(() => _clinicalFilterType = 'Emergency'), icon: Icons.warning_amber_rounded),
                        _buildFilterChip('Wet Diaper', _clinicalFilterType == 'Wet Diaper', () => setState(() => _clinicalFilterType = 'Wet Diaper'), icon: Icons.water_drop_outlined),
                        _buildFilterChip('Vital Signs', _clinicalFilterType == 'Vital Signs', () => setState(() => _clinicalFilterType = 'Vital Signs'), icon: Icons.monitor_heart_outlined),
                      ]
                    : [
                        _buildFilterChip('All', _systemFilterType == 'All', () => setState(() => _systemFilterType = 'All')),
                        _buildFilterChip('Low Battery', _systemFilterType == 'Low Battery', () => setState(() => _systemFilterType = 'Low Battery'), icon: Icons.battery_alert_outlined),
                        _buildFilterChip('Offline', _systemFilterType == 'Offline', () => setState(() => _systemFilterType = 'Offline'), icon: Icons.wifi_off_outlined),
                        _buildFilterChip('Sensor Fault', _systemFilterType == 'Sensor Fault', () => setState(() => _systemFilterType = 'Sensor Fault'), icon: Icons.build_circle_outlined),
                        _buildFilterChip('Weak Signal', _systemFilterType == 'Weak Signal', () => setState(() => _systemFilterType = 'Weak Signal'), icon: Icons.signal_cellular_alt_outlined),
                        const SizedBox(width: 8),
                        ActionChip(
                          avatar: const Icon(Icons.play_circle_outline, size: 16, color: Color(0xFF92400E)),
                          label: Text('Test Low Battery', style: GoogleFonts.albertSans(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF92400E))),
                          backgroundColor: const Color(0xFFFEF3C7),
                          side: const BorderSide(color: Color(0xFFFCD34D)),
                          onPressed: () => _testHardwareDiagnostic('Low Battery Warning'),
                        ),
                      ],
              ),
            ),
            const SizedBox(height: 8),

            Expanded(child: _buildBody()),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, bool isSelected, VoidCallback onTap, {IconData? icon}) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        avatar: icon != null
            ? Icon(icon, size: 14, color: isSelected ? Colors.white : const Color(0xFF2F7D7B))
            : null,
        label: Text(
          label,
          style: GoogleFonts.albertSans(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : Colors.black87,
          ),
        ),
        selected: isSelected,
        onSelected: (_) => onTap(),
        selectedColor: const Color(0xFF2F7D7B),
        backgroundColor: Colors.white,
        side: BorderSide(color: isSelected ? const Color(0xFF2F7D7B) : Colors.black12),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF5FA9A9)),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded,
                size: 56, color: Colors.black26),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: GoogleFonts.albertSans(
                  fontSize: 14, color: Colors.black54),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _fetchAlerts,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF5FA9A9),
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      );
    }

    final items = _filteredAlerts;

    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: const Color(0xFF5FA9A9).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.notifications_none_rounded,
                size: 60,
                color: Color(0xFF5FA9A9),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              _searchQuery.isNotEmpty
                  ? 'No matching alerts found'
                  : _showClinicalAlerts
                      ? 'No clinical alerts at this time.'
                      : 'No hardware diagnostics at this time.',
              style: GoogleFonts.poppins(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _searchQuery.isNotEmpty
                  ? 'Try a different search keyword or category filter.'
                  : _showClinicalAlerts
                      ? 'All patients are within normal ranges.'
                      : 'All connected devices are operating normally.',
              style: GoogleFonts.albertSans(
                  fontSize: 13, color: Colors.black45),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: const Color(0xFF5FA9A9),
      onRefresh: _fetchAlerts,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) => _buildAlertCard(items[index]),
      ),
    );
  }

  Widget _buildAlertCard(Map<String, dynamic> alert) {
    final severity    = alert['severity']     ?? 'Info';
    final status      = alert['status']       ?? 'Sent';
    final message = _showClinicalAlerts
        ? (alert['message'] ?? 'Alert received.')
        : (alert['description'] ?? 'Hardware diagnostic received.');
    final patientName = alert['patient_name'] ?? 'Unknown Patient';
    final cardTitle = _showClinicalAlerts
        ? patientName
        : (alert['alert_type'] == null
            ? 'Hardware Alert'
            : _formatAnomalyType(alert['alert_type'].toString()));
    final anomalyType = alert['anomaly_type'];
    final ocsvmScore  = alert['ocsvm_score'];
    final sentAt = _showClinicalAlerts ? alert['sent_at'] : alert['triggered_at'];
    final alertId = _showClinicalAlerts ? alert['alert_id'] : alert['sys_alert_id'];
    final isAcknowledged = _showClinicalAlerts
        ? status == 'Acknowledged'
        : status == 'Resolved';
    final color       = _severityColor(severity);

    final flagCount = alert['flag_count'] != null
        ? (int.tryParse(alert['flag_count'].toString()) ?? 0)
        : 0;
    final remainingFlags = (5 - flagCount).clamp(0, 5);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border(
          left: BorderSide(color: color, width: 4),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row: icon + patient name + time
            Row(
              children: [
                Icon(
                  _showClinicalAlerts ? _severityIcon(severity) : Icons.memory_outlined,
                  color: color,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    cardTitle,
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
                Text(
                  _formatTime(sentAt?.toString()),
                  style: GoogleFonts.albertSans(
                    fontSize: 11,
                    color: Colors.black45,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 6),

            // Alert message
            Text(
              message,
              style: GoogleFonts.albertSans(
                fontSize: 13,
                color: Colors.black87,
              ),
            ),

            const SizedBox(height: 8),

            // Chips row: severity + AI type + OC-SVM score
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [
                _chip(severity.toUpperCase(), color),
                if (_showClinicalAlerts && anomalyType != null)
                  _chip(_formatAnomalyType(anomalyType),
                      const Color(0xFF5FA9A9)),
                if (_showClinicalAlerts && ocsvmScore != null)
                  _chip(
                    'Score: ${double.tryParse(ocsvmScore.toString())?.toStringAsFixed(2) ?? ocsvmScore}',
                    Colors.blueGrey,
                  ),
              ],
            ),

            // AI Adaptive Baseline Box (for clinical alerts)
            if (_showClinicalAlerts) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: flagCount >= 5 ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: flagCount >= 5 ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.auto_awesome,
                      size: 15,
                      color: flagCount >= 5 ? const Color(0xFF15803D) : const Color(0xFF0D9488),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: RichText(
                        text: TextSpan(
                          style: GoogleFonts.albertSans(
                            fontSize: 11,
                            color: const Color(0xFF475569),
                          ),
                          children: [
                            TextSpan(
                              text: 'AI Adaptive Baseline: ',
                              style: GoogleFonts.albertSans(
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF334155),
                              ),
                            ),
                            TextSpan(
                              text: flagCount >= 5
                                  ? "The AI model has learned this patient's pattern. Baseline updated (0 more flags needed). Alerts for this pattern are now suppressed."
                                  : "The AI model learns from the patient's pattern. Modifying it's baseline needs to be learned repeatedly. ($remainingFlags more flags needed)",
                              style: TextStyle(
                                color: flagCount >= 5 ? const Color(0xFF166534) : const Color(0xFF475569),
                                fontWeight: flagCount >= 5 ? FontWeight.w500 : FontWeight.normal,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 12),

            // Action Buttons: Review & Acknowledge, Flag as Normal (0/5), Archive
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                // 1. Review & Acknowledge (Clinical)
                if (_showClinicalAlerts && alertId != null)
                  ElevatedButton.icon(
                    onPressed: () => _acknowledgeAlert(alertId),
                    icon: Icon(
                      isAcknowledged ? Icons.check_circle : Icons.assignment_turned_in_outlined,
                      size: 14,
                      color: isAcknowledged ? const Color(0xFF16A34A) : Colors.white,
                    ),
                    label: Text(
                      'Review & Acknowledge',
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isAcknowledged ? const Color(0xFF334155) : Colors.white,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isAcknowledged ? const Color(0xFFF1F5F9) : const Color(0xFFDC2626),
                      elevation: isAcknowledged ? 0 : 1,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: isAcknowledged
                            ? const BorderSide(color: Color(0xFFCBD5E1))
                            : BorderSide.none,
                      ),
                    ),
                  ),

                // 2. Flag as Normal (0/5) (Clinical)
                if (_showClinicalAlerts && alertId != null)
                  OutlinedButton.icon(
                    onPressed: (flagCount >= 5 || _flaggingIds.contains(alertId))
                        ? null
                        : () => _flagAsNormal(alert),
                    icon: Icon(
                      Icons.flag_outlined,
                      size: 14,
                      color: flagCount >= 5 ? const Color(0xFF15803D) : const Color(0xFF92400E),
                    ),
                    label: Text(
                      flagCount >= 5 ? 'Normal (Learned 5/5)' : 'Flag as Normal ($flagCount/5)',
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: flagCount >= 5 ? const Color(0xFF15803D) : const Color(0xFF92400E),
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: flagCount >= 5 ? const Color(0xFFF0FDF4) : const Color(0xFFFEF3C7),
                      side: BorderSide(
                        color: flagCount >= 5 ? const Color(0xFFBBF7D0) : const Color(0xFFFCD34D),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),

                // Resolve button (for hardware system alerts)
                if (!_showClinicalAlerts && alertId != null && !isAcknowledged)
                  ElevatedButton.icon(
                    onPressed: () => _resolveSystemAlert(alertId),
                    icon: const Icon(Icons.check, size: 14, color: Colors.white),
                    label: Text(
                      'Resolve Alert',
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),

                // 3. Archive
                if (alertId != null)
                  OutlinedButton.icon(
                    onPressed: () => _archiveAlert(
                      _showClinicalAlerts ? 'clinical_$alertId' : 'system_$alertId',
                    ),
                    icon: const Icon(
                      Icons.archive_outlined,
                      size: 14,
                      color: Color(0xFF475569),
                    ),
                    label: Text(
                      'Archive',
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF475569),
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: const Color(0xFFF1F5F9),
                      side: const BorderSide(color: Color(0xFFE2E8F0)),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: GoogleFonts.albertSans(
          fontSize: 10,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  void _selectTab(bool clinical) {
    if (_showClinicalAlerts == clinical) return;
    setState(() => _showClinicalAlerts = clinical);
    _fetchAlerts();
  }

  Widget _buildAlertTab({
    required String label,
    required IconData icon,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(11),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 11),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF5FA9A9) : Colors.transparent,
            borderRadius: BorderRadius.circular(11),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: const Color(0xFF5FA9A9).withValues(alpha: 0.25),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 17, color: selected ? Colors.white : Colors.black54),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(
                    fontSize: 11,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    color: selected ? Colors.white : Colors.black54,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
