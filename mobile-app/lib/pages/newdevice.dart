import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Import API service for device registration
import '../services/api_service.dart';

class NewDeviceScreen extends StatefulWidget {
  const NewDeviceScreen({super.key});

  @override
  State<NewDeviceScreen> createState() => _NewDeviceScreenState();
}

class _NewDeviceScreenState extends State<NewDeviceScreen> {
  bool isDoubleDevice = true;

  // [FIX] Pre-fill the year prefix so users only enter the 4-digit suffix.
  // Using the current year dynamically avoids hardcoded '2026'.
  final int _currentYear = DateTime.now().year;
  late final TextEditingController _vitalSignsCtrl;
  late final TextEditingController _smartDiaperCtrl;
  String? _vsError;
  String? _sdError;

  @override
  void initState() {
    super.initState();
    _vitalSignsCtrl = TextEditingController(text: 'VS-$_currentYear-');
    _smartDiaperCtrl = TextEditingController(text: 'SD-$_currentYear-');
  }

  final List<Map<String, dynamic>> _singleDevices = [];

  bool _isSubmitting = false;

  // [INTEGRATION] Validates device numbers, then calls POST /api/caregiver/devices
  // to register them in the backend whitelist.
  // [FIX] Regex updated to require exactly 4 digits at the end (NNNN not NNN).
  Future<void> _validateAndRegister() async {
    final vsRegex = RegExp(r'^VS-\d{4}-\d{4}$');
    final sdRegex = RegExp(r'^SD-\d{4}-\d{4}$');

    String? vitalDeviceNo;
    String? diaperDeviceNo;

    if (isDoubleDevice) {
      setState(() {
        _vsError = vsRegex.hasMatch(_vitalSignsCtrl.text)
            ? null
            : "Please input a valid device number.";
        _sdError = sdRegex.hasMatch(_smartDiaperCtrl.text)
            ? null
            : "Please input a valid device number.";
      });
      if (_vsError != null || _sdError != null) return;
      vitalDeviceNo = _vitalSignsCtrl.text.trim();
      diaperDeviceNo = _smartDiaperCtrl.text.trim();
    } else {
      bool allValid = true;
      setState(() {
        for (var device in _singleDevices) {
          final ctrl = device['controller'] as TextEditingController;
          final type = device['type'] as String;
          final regex = type == 'VS' ? vsRegex : sdRegex;
          device['error'] = regex.hasMatch(ctrl.text)
              ? null
              : "Please input a valid device number.";
          if (device['error'] != null) allValid = false;
        }
      });
      if (!allValid || _singleDevices.isEmpty) return;

      // Collect serial numbers from single device cards
      for (var device in _singleDevices) {
        final ctrl = device['controller'] as TextEditingController;
        final type = device['type'] as String;
        if (type == 'VS') vitalDeviceNo = ctrl.text.trim();
        if (type == 'SD') diaperDeviceNo = ctrl.text.trim();
      }
    }

    setState(() => _isSubmitting = true);

    final result = await ApiService.post(
      '/api/caregiver/devices',
      body: {
        if (vitalDeviceNo != null) 'vitalDeviceNo': vitalDeviceNo,
        if (diaperDeviceNo != null) 'diaperDeviceNo': diaperDeviceNo,
      },
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (result['success'] == true) {
      _showSuccessDialog(result);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ?? 'Failed to register devices.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _addSingleDevice(String type) {
    // [FIX] Pre-fill the prefix so the user only enters the 4-digit suffix
    final prefix = type == 'VS' ? 'VS-$_currentYear-' : 'SD-$_currentYear-';
    setState(() {
      _singleDevices.add({
        'type': type,
        'controller': TextEditingController(text: prefix),
        'error': null,
      });
    });
  }

  void _removeSingleDevice(int index) {
    setState(() {
      (_singleDevices[index]['controller'] as TextEditingController).dispose();
      _singleDevices.removeAt(index);
    });
  }

  void _showAddDeviceTypeDialog() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Select Device Type",
                style: GoogleFonts.poppins(
                    fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 16),
            ListTile(
              leading: Image.asset(
                'assets/images/vital.png',
                width: 28,
                height: 28,
                errorBuilder: (c, e, s) => const Icon(
                    Icons.monitor_heart_outlined,
                    color: Color(0xFF5FA9A9),
                    size: 28),
              ),
              title: Text("Vital Signs Monitor (VS)",
                  style: GoogleFonts.poppins(fontSize: 14)),
              subtitle: Text('e.g. VS-$_currentYear-0001',
                  style:
                      GoogleFonts.albertSans(fontSize: 11, color: Colors.grey)),
              onTap: () {
                Navigator.pop(context);
                _addSingleDevice('VS');
              },
            ),
            ListTile(
              leading: Image.asset(
                'assets/images/diaper.png',
                width: 28,
                height: 28,
                errorBuilder: (c, e, s) => const Icon(Icons.child_care_outlined,
                    color: Color(0xFF5FA9A9), size: 28),
              ),
              title: Text("Smart Diaper Module (SD)",
                  style: GoogleFonts.poppins(fontSize: 14)),
              subtitle: Text('e.g. SD-$_currentYear-0001',
                  style:
                      GoogleFonts.albertSans(fontSize: 11, color: Colors.grey)),
              onTap: () {
                Navigator.pop(context);
                _addSingleDevice('SD');
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showSuccessDialog(Map<String, dynamic> result) {
    final rawTokens = result['provisioning_tokens'];
    final tokens =
        rawTokens is List ? rawTokens.whereType<Map>().toList() : <Map>[];
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Dialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF5FA9A9), width: 4),
                ),
                child: const Icon(Icons.check_rounded,
                    size: 60, color: Color(0xFF5FA9A9)),
              ),
              const SizedBox(height: 24),
              Text(
                "Devices registered!",
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: Colors.black),
              ),
              if (tokens.isNotEmpty) ...[
                const SizedBox(height: 20),
                Text(
                  'Enter each one-time provisioning token in the matching device setup portal. It will not be shown again.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.albertSans(
                      fontSize: 12, color: Colors.black54),
                ),
                const SizedBox(height: 12),
                ...tokens.map((entry) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: SelectableText(
                        '${entry['serial_number']}: ${entry['token']}',
                        style: GoogleFonts.robotoMono(fontSize: 11),
                      ),
                    )),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('I saved the tokens'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
    if (tokens.isEmpty) {
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted && Navigator.canPop(context)) Navigator.pop(context);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.arrow_back,
                    size: 28, color: Colors.black87),
              ),
              const SizedBox(height: 30),
              Text("Register",
                  style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: const Color(0xFF5FA9A9),
                      fontWeight: FontWeight.w600)),
              Text("NEW DEVICE",
                  style: GoogleFonts.poppins(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1)),
              const SizedBox(height: 25),
              _buildManualView(),
              const SizedBox(height: 40),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildActionButton("Cancel",
                      isPrimary: false, onTap: () => Navigator.pop(context)),
                  const SizedBox(width: 50),
                  _buildActionButton("Register",
                      isPrimary: true, onTap: _validateAndRegister),
                ],
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildManualView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Device Details",
            style: GoogleFonts.poppins(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF5FA9A9))),
        const SizedBox(height: 8),
        Text("Enter the unique serial numbers found on your device.",
            style: GoogleFonts.albertSans(fontSize: 15, color: Colors.black)),
        const SizedBox(height: 30),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
                color: const Color(0xFF5FA9A9).withValues(alpha: 0.5)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isDoubleDevice ? "PAIRED DEVICE" : "SINGLE DEVICE",
                    style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF5FA9A9)),
                  ),
                  PopupMenuButton<bool>(
                    initialValue: isDoubleDevice,
                    onSelected: (value) {
                      setState(() {
                        isDoubleDevice = value;
                        _vsError = null;
                        _sdError = null;
                        _singleDevices.clear();
                      });
                    },
                    itemBuilder: (context) => [
                      PopupMenuItem(
                        value: true,
                        child: Text("Paired Device",
                            style: GoogleFonts.poppins(fontSize: 13)),
                      ),
                      PopupMenuItem(
                        value: false,
                        child: Text("Single Device",
                            style: GoogleFonts.poppins(fontSize: 13)),
                      ),
                    ],
                    child: Image.asset(
                      'assets/images/dropdown.png',
                      width: 20,
                      height: 20,
                      color: Colors.black54,
                      errorBuilder: (c, e, s) => const Icon(
                          Icons.arrow_drop_down,
                          size: 20,
                          color: Colors.black54),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (isDoubleDevice) ...[
                _buildInputLabel("Vital Signs Device No."),
                _buildTextField(_vitalSignsCtrl,
                    errorText: _vsError, hint: 'VS-$_currentYear-0001'),
                const SizedBox(height: 20),
                _buildInputLabel("Smart Diaper Device No."),
                _buildTextField(_smartDiaperCtrl,
                    errorText: _sdError, hint: 'SD-$_currentYear-0001'),
              ] else ...[
                ..._singleDevices.asMap().entries.map((entry) {
                  final i = entry.key;
                  final device = entry.value;
                  final ctrl = device['controller'] as TextEditingController;
                  final type = device['type'] as String;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildInputLabel(type == 'VS'
                                ? "Vital Signs Device No."
                                : "Smart Diaper Device No."),
                            IconButton(
                              icon: const Icon(Icons.close,
                                  size: 18, color: Colors.black45),
                              onPressed: () => _removeSingleDevice(i),
                            ),
                          ],
                        ),
                        _buildTextField(ctrl,
                            errorText: device['error'],
                            hint: type == 'VS'
                                ? 'VS-$_currentYear-0001'
                                : 'SD-$_currentYear-0001'),
                      ],
                    ),
                  );
                }),
                GestureDetector(
                  onTap: _showAddDeviceTypeDialog,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      "+ Add a single device",
                      style: GoogleFonts.albertSans(
                          fontSize: 13,
                          color: Colors.black,
                          fontWeight: FontWeight.w500),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTextField(TextEditingController ctrl,
      {String? errorText, String? hint}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: ctrl,
          style: GoogleFonts.albertSans(fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.black26),
            filled: true,
            fillColor: const Color(0xFFE0E8E8),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(30),
              borderSide: BorderSide(
                  color: errorText != null
                      ? Colors.red
                      : const Color(0xFF5FA9A9).withValues(alpha: 0.3)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(30),
              borderSide: BorderSide(
                  color:
                      errorText != null ? Colors.red : const Color(0xFF5FA9A9),
                  width: 1.5),
            ),
          ),
        ),
        if (errorText != null)
          Padding(
            padding: const EdgeInsets.only(left: 12, top: 6),
            child: Text(errorText,
                style: const TextStyle(color: Colors.red, fontSize: 12)),
          ),
      ],
    );
  }

  Widget _buildActionButton(String label,
      {required bool isPrimary, required VoidCallback onTap}) {
    return SizedBox(
      width: 125,
      height: 48,
      child: isPrimary
          ? ElevatedButton(
              onPressed: _isSubmitting ? null : onTap,
              style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF5FA9A9),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(25))),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(label,
                      style: GoogleFonts.poppins(
                          color: Colors.black, fontWeight: FontWeight.w600)))
          : OutlinedButton(
              onPressed: _isSubmitting ? null : onTap,
              style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Colors.black),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(25))),
              child: Text(label,
                  style: GoogleFonts.poppins(
                      color: Colors.black, fontWeight: FontWeight.w600))),
    );
  }

  Widget _buildInputLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text.rich(TextSpan(children: [
        TextSpan(
            text: label,
            style:
                GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14)),
        const TextSpan(
            text: " *",
            style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
      ])),
    );
  }
}
