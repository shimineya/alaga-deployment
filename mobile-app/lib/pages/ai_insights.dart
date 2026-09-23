import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../services/api_service.dart';

class AiInsightsScreen extends StatefulWidget {
  const AiInsightsScreen({super.key});

  @override
  State<AiInsightsScreen> createState() => _AiInsightsScreenState();
}

class _AiInsightsScreenState extends State<AiInsightsScreen> {
  static const _teal = Color(0xFF2F7D7B);
  static const _navy = Color(0xFF173C43);
  static const _background = Color(0xFFF5F5F0);

  List<Map<String, dynamic>> _patients = [];
  List<Map<String, dynamic>> _history = [];
  List<Map<String, dynamic>> _anomalies = [];
  Map<String, dynamic>? _status;
  int? _selectedPatientId;
  bool _loadingPatients = true;
  bool _loadingInsights = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPatients();
  }

  Future<void> _loadPatients() async {
    final result = await ApiService.get('/caregiver/patients');
    if (!mounted) return;
    final raw = result['success'] == true && result['data'] is List
        ? result['data'] as List
        : const [];
    _patients = raw.whereType<Map>().map(Map<String, dynamic>.from).toList();
    _selectedPatientId = _patients.isEmpty
        ? null
        : int.tryParse(_patients.first['patient_id'].toString());
    setState(() => _loadingPatients = false);
    if (_selectedPatientId != null) await _loadInsights();
  }

  Future<void> _loadInsights() async {
    final patientId = _selectedPatientId;
    if (patientId == null) return;
    setState(() {
      _loadingInsights = true;
      _error = null;
    });

    final results = await Future.wait([
      ApiService.get('/sensor/status/$patientId'),
      ApiService.get('/sensor/history/$patientId'),
      ApiService.get('/alerts/clinical',
          queryParams: {'patientId': '$patientId'}),
    ]);
    if (!mounted || patientId != _selectedPatientId) return;

    final statusResult = results[0];
    final historyResult = results[1];
    final alertResult = results[2];
    setState(() {
      _status = statusResult['success'] == true ? statusResult : null;
      _history =
          historyResult['success'] == true && historyResult['history'] is List
              ? (historyResult['history'] as List)
                  .whereType<Map>()
                  .map(Map<String, dynamic>.from)
                  .toList()
              : [];
      _anomalies = alertResult['success'] == true && alertResult['data'] is List
          ? (alertResult['data'] as List)
              .whereType<Map>()
              .map(Map<String, dynamic>.from)
              .where((item) => item['anomaly_type'] != 'schedule_due')
              .toList()
          : [];
      _error =
          historyResult['success'] != true && statusResult['success'] != true
              ? (historyResult['message'] ??
                      statusResult['message'] ??
                      'AI data is unavailable.')
                  .toString()
              : null;
      _loadingInsights = false;
    });
  }

  Future<void> _flagAsNormal(Map<String, dynamic> anomaly) async {
    final alertId = int.tryParse(anomaly['alert_id'].toString());
    if (alertId == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Teach the AI?'),
        content: const Text(
          'Only mark this pattern as normal after checking the patient. Repeated feedback changes the personalized OC-SVM baseline.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Mark as normal'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final result =
        await ApiService.post('/alerts/clinical/$alertId/flag-normal');
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result['message'] ??
            (result['success'] == true
                ? 'AI baseline feedback saved.'
                : 'Feedback failed.')),
        backgroundColor: result['success'] == true ? _teal : Colors.redAccent,
      ),
    );
    if (result['success'] == true) await _loadInsights();
  }

  Map<String, dynamic>? get _selectedPatient {
    for (final patient in _patients) {
      if (int.tryParse(patient['patient_id'].toString()) == _selectedPatientId) {
        return patient;
      }
    }
    return null;
  }

  double? _number(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value');

  String _time(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    return date == null
        ? 'Unknown time'
        : DateFormat('MMM d, h:mm a').format(date);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _background,
      appBar: AppBar(
        backgroundColor: _background,
        elevation: 0,
        foregroundColor: _navy,
        title: Text('AI Insights',
            style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
              onPressed: _loadingInsights ? null : _loadInsights,
              icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loadingPatients
          ? const Center(child: CircularProgressIndicator(color: _teal))
          : _patients.isEmpty
              ? _emptyPatients()
              : RefreshIndicator(
                  onRefresh: _loadInsights,
                  color: _teal,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
                    children: [
                      _patientPicker(),
                      const SizedBox(height: 14),
                      if (_loadingInsights)
                        const LinearProgressIndicator(
                            color: _teal, minHeight: 3)
                      else ...[
                        _modelSummary(),
                        const SizedBox(height: 14),
                        _vitalsGrid(),
                        const SizedBox(height: 14),
                        _trendCard(),
                        const SizedBox(height: 14),
                        _anomalyCard(),
                        const SizedBox(height: 14),
                        _clinicalNotice(),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _emptyPatients() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.monitor_heart_outlined,
                  size: 52, color: Colors.grey),
              const SizedBox(height: 12),
              Text('No accessible patients',
                  style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Text('Assign a patient before viewing OC-SVM insights.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.albertSans(color: Colors.black54)),
            ],
          ),
        ),
      );

  Widget _patientPicker() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFDCE7E5)),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<int>(
            value: _selectedPatientId,
            isExpanded: true,
            icon: const Icon(Icons.keyboard_arrow_down, color: _teal),
            items: _patients.map((patient) {
              final id = int.tryParse(patient['patient_id'].toString())!;
              return DropdownMenuItem(
                  value: id,
                  child: Text(patient['name']?.toString() ?? 'Patient #$id'));
            }).toList(),
            onChanged: (value) {
              if (value == null || value == _selectedPatientId) return;
              setState(() => _selectedPatientId = value);
              _loadInsights();
            },
          ),
        ),
      );

  Widget _modelSummary() {
    final modelResult = _status?['ocsvm_result']?.toString().toLowerCase();
    final isAnomaly = modelResult == 'anomaly';
    final isNotApplicable = modelResult == 'not_applicable';
    final isUnavailable = modelResult == 'unavailable';
    final hasData = _status != null;
    final color = !hasData || isNotApplicable || isUnavailable
        ? Colors.blueGrey
        : (isAnomaly ? Colors.deepOrange : _teal);
    final modelLabel = !hasData
        ? 'NO DATA'
        : isNotApplicable
            ? 'RULE-ONLY'
            : isUnavailable
                ? 'UNAVAILABLE'
                : isAnomaly
                    ? 'ANOMALY'
                    : 'NORMAL';
    final patientName = _selectedPatient?['name']?.toString() ?? 'Patient';
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient:
            LinearGradient(colors: [_navy, Color.lerp(_navy, color, 0.55)!]),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
              color: _navy.withValues(alpha: 0.18),
              blurRadius: 16,
              offset: const Offset(0, 7))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    shape: BoxShape.circle),
                child: const Icon(Icons.psychology_alt_outlined,
                    color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('OC-SVM monitoring',
                          style: GoogleFonts.poppins(
                              color: Colors.white70, fontSize: 12)),
                      Text(patientName,
                          style: GoogleFonts.poppins(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 17)),
                    ]),
              ),
              _statusPill(modelLabel, color),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            !hasData
                ? (_error ?? 'Waiting for the first sensor reading.')
                : isNotApplicable
                    ? 'Infant monitoring uses the existing rule-based alerts; the adult OC-SVM is not applied.'
                    : isUnavailable
                        ? 'OC-SVM monitoring is temporarily unavailable. Rule-based alerts remain active.'
                : isAnomaly
                    ? (_status?['latest_alert']?.toString() ??
                        'The latest reading differs from the learned baseline.')
                    : 'The latest reading is consistent with the patient’s learned baseline.',
            style: GoogleFonts.albertSans(color: Colors.white, height: 1.35),
          ),
          if (_status?['recorded_at'] != null) ...[
            const SizedBox(height: 10),
            Text('Last analyzed ${_time(_status!['recorded_at'])}',
                style: GoogleFonts.albertSans(
                    color: Colors.white60, fontSize: 11)),
          ],
        ],
      ),
    );
  }

  Widget _statusPill(String label, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(30)),
        child: Text(label,
            style: GoogleFonts.poppins(
                color: color, fontSize: 10, fontWeight: FontWeight.w700)),
      );

  Widget _vitalsGrid() {
    final items = [
      (
        'Heart rate',
        _number(_status?['heart_rate']),
        'bpm',
        Icons.favorite_outline,
        Colors.redAccent
      ),
      ('SpO₂', _number(_status?['spo2']), '%', Icons.air, Colors.blue),
      (
        'Temperature',
        _number(_status?['temperature']),
        '°C',
        Icons.thermostat,
        Colors.orange
      ),
      (
        'Moisture',
        _number(_status?['moisture']),
        '',
        Icons.water_drop_outlined,
        _teal
      ),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.65,
      children: items
          .map((item) => Container(
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14)),
                child: Row(children: [
                  Icon(item.$4, color: item.$5, size: 23),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                        Text(item.$1,
                            style: GoogleFonts.albertSans(
                                fontSize: 11, color: Colors.black54)),
                        Text(
                            item.$2 == null
                                ? '—'
                                : '${item.$2!.toStringAsFixed(item.$1 == 'Temperature' ? 1 : 0)}${item.$3}',
                            style: GoogleFonts.poppins(
                                fontWeight: FontWeight.w700,
                                color: _navy,
                                fontSize: 16)),
                      ])),
                ]),
              ))
          .toList(),
    );
  }

  Widget _trendCard() {
    final points = _history
        .map((row) => _number(row['heart_rate']))
        .whereType<double>()
        .toList();
    return _section(
      title: 'Heart-rate trend',
      subtitle:
          'Most recent ${points.length} readings analyzed by the pipeline',
      child: SizedBox(
        height: 120,
        child: points.length < 2
            ? const Center(
                child: Text('More readings are needed to draw a trend.'))
            : CustomPaint(
                painter: _TrendPainter(points, _teal), size: Size.infinite),
      ),
    );
  }

  Widget _anomalyCard() => _section(
        title: 'AI-detected anomalies',
        subtitle:
            '${_anomalies.length} active event${_anomalies.length == 1 ? '' : 's'} for this patient',
        child: _anomalies.isEmpty
            ? Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Center(
                    child: Text('No active anomalies.',
                        style: GoogleFonts.albertSans(color: Colors.black54))),
              )
            : Column(
                children: _anomalies.take(10).map((anomaly) {
                  final flags =
                      int.tryParse(anomaly['flag_count']?.toString() ?? '') ??
                          0;
                  final severity = anomaly['severity']?.toString() ?? 'Info';
                  return Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.all(13),
                    decoration: BoxDecoration(
                      color: severity.toLowerCase() == 'critical'
                          ? const Color(0xFFFFF1F0)
                          : const Color(0xFFFFF8E8),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Icon(Icons.warning_amber_rounded,
                                size: 19,
                                color: severity.toLowerCase() == 'critical'
                                    ? Colors.red
                                    : Colors.orange),
                            const SizedBox(width: 8),
                            Expanded(
                                child: Text(
                                    anomaly['anomaly_type']
                                            ?.toString()
                                            .replaceAll('_', ' ') ??
                                        'Anomaly',
                                    style: GoogleFonts.poppins(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 12))),
                            Text(_time(anomaly['sent_at']),
                                style: GoogleFonts.albertSans(
                                    fontSize: 10, color: Colors.black45)),
                          ]),
                          const SizedBox(height: 7),
                          Text(
                              anomaly['message']?.toString() ??
                                  'Unusual pattern detected.',
                              style: GoogleFonts.albertSans(
                                  fontSize: 12, height: 1.3)),
                          const SizedBox(height: 8),
                          Row(children: [
                            Expanded(
                                child: Text('Normal feedback: $flags/5',
                                    style: GoogleFonts.albertSans(
                                        fontSize: 10, color: Colors.black54))),
                            TextButton.icon(
                              onPressed: anomaly['is_suppressed'] == true
                                  ? null
                                  : () => _flagAsNormal(anomaly),
                              icon: const Icon(Icons.school_outlined, size: 16),
                              label: const Text('This is normal'),
                            ),
                          ]),
                        ]),
                  );
                }).toList(),
              ),
      );

  Widget _clinicalNotice() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: const Color(0xFFEAF3F2),
            borderRadius: BorderRadius.circular(14)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.info_outline, color: _teal, size: 20),
          const SizedBox(width: 10),
          Expanded(
              child: Text(
            'OC-SVM detects deviations from learned patterns; it does not diagnose illness. Always assess the patient and follow clinical escalation procedures.',
            style: GoogleFonts.albertSans(
                fontSize: 11.5, color: _navy, height: 1.35),
          )),
        ]),
      );

  Widget _section(
          {required String title,
          required String subtitle,
          required Widget child}) =>
      Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: GoogleFonts.poppins(
                  fontWeight: FontWeight.w700, color: _navy, fontSize: 14)),
          Text(subtitle,
              style:
                  GoogleFonts.albertSans(color: Colors.black45, fontSize: 11)),
          const SizedBox(height: 8),
          child,
        ]),
      );
}

class _TrendPainter extends CustomPainter {
  _TrendPainter(this.values, this.color);
  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final minValue = values.reduce(math.min);
    final maxValue = values.reduce(math.max);
    final range = math.max(1.0, maxValue - minValue);
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = i * size.width / (values.length - 1);
      final y = size.height -
          12 -
          ((values[i] - minValue) / range) * (size.height - 24);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..strokeWidth = 3
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round);
    for (var i = 0; i < values.length; i++) {
      final x = i * size.width / (values.length - 1);
      final y = size.height -
          12 -
          ((values[i] - minValue) / range) * (size.height - 24);
      canvas.drawCircle(Offset(x, y), 3, Paint()..color = color);
    }
  }

  @override
  bool shouldRepaint(covariant _TrendPainter oldDelegate) =>
      oldDelegate.values != values || oldDelegate.color != color;
}
