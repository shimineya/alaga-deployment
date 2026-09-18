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
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  List<dynamic> _alerts = [];
  bool _isLoading = true;
  String? _errorMessage;
  bool _showClinicalAlerts = true;

  @override
  void initState() {
    super.initState();
    _fetchAlerts();
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
          'Acknowledge Alert',
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
                hintText: 'e.g. Checked patient, no distress observed.',
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
              backgroundColor: const Color(0xFF5FA9A9),
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
              'Confirm',
              style: GoogleFonts.poppins(color: Colors.white),
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
            ? const Color(0xFF5FA9A9)
            : Colors.redAccent,
      ),
    );

    if (result['success'] == true) {
      _fetchAlerts(); // Refresh list
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
            Expanded(child: _buildBody()),
          ],
        ),
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

    if (_alerts.isEmpty) {
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
              _showClinicalAlerts
                  ? 'No clinical alerts at this time.'
                  : 'No hardware diagnostics at this time.',
              style: GoogleFonts.poppins(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _showClinicalAlerts
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
        itemCount: _alerts.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) => _buildAlertCard(_alerts[index]),
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

            // Acknowledge button (only for unacknowledged alerts)
            if (_showClinicalAlerts && !isAcknowledged && alertId != null) ...[
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => _acknowledgeAlert(alertId),
                  icon: const Icon(Icons.check_circle_outline,
                      size: 16, color: Color(0xFF5FA9A9)),
                  label: Text(
                    'Acknowledge',
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: const Color(0xFF5FA9A9),
                    ),
                  ),
                ),
              ),
            ],

            if (isAcknowledged) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.check_circle_rounded,
                      size: 14, color: Colors.green),
                  const SizedBox(width: 4),
                  Text(
                    _showClinicalAlerts ? 'Acknowledged' : 'Resolved',
                    style: GoogleFonts.albertSans(
                      fontSize: 11,
                      color: Colors.green,
                    ),
                  ),
                ],
              ),
            ],
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
