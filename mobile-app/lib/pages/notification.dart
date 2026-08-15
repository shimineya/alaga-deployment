import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'dashboard.dart';
import '../services/api_service.dart';

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

    final result = await ApiService.get('/alerts/clinical');

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
      '/alerts/clinical/$alertId/acknowledge',
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
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              const DashboardScreen(initialIndex: 2),
                        ),
                      );
                    },
                  ),
                  Text(
                    'Alerts',
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
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
                color: const Color(0xFF5FA9A9).withOpacity(0.1),
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
              'No alerts at this time.',
              style: GoogleFonts.poppins(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'All patients are within normal ranges.',
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
    final message     = alert['message']      ?? 'Alert received.';
    final patientName = alert['patient_name'] ?? 'Unknown Patient';
    final anomalyType = alert['anomaly_type'];
    final ocsvmScore  = alert['ocsvm_score'];
    final sentAt      = alert['sent_at'];
    final alertId     = alert['alert_id'];
    final isAcknowledged = status == 'Acknowledged';
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
            color: Colors.black.withOpacity(0.05),
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
                Icon(_severityIcon(severity), color: color, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    patientName,
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
                if (anomalyType != null)
                  _chip(_formatAnomalyType(anomalyType),
                      const Color(0xFF5FA9A9)),
                if (ocsvmScore != null)
                  _chip(
                    'Score: ${double.tryParse(ocsvmScore.toString())?.toStringAsFixed(2) ?? ocsvmScore}',
                    Colors.blueGrey,
                  ),
              ],
            ),

            // Acknowledge button (only for unacknowledged alerts)
            if (!isAcknowledged && alertId != null) ...[
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
                    'Acknowledged',
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
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
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
}