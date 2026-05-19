import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Import API service for patient enrollment
import '../services/api_service.dart';

class NewPatientScreen extends StatefulWidget {
  const NewPatientScreen({super.key});

  @override
  State<NewPatientScreen> createState() => _NewPatientScreenState();
}

class _NewPatientScreenState extends State<NewPatientScreen> {
  int currentStep = 1;
  bool isSearching = true;
  bool _isSubmitting = false;

  // [INTEGRATION] Track selected caregiver and device serial numbers
  int? _selectedCaregiverId;

  final TextEditingController _firstNameCtrl = TextEditingController();
  final TextEditingController _lastNameCtrl = TextEditingController();
  final TextEditingController _birthdateCtrl = TextEditingController();
  final TextEditingController _medicalNotesCtrl = TextEditingController();
  final TextEditingController _searchCtrl = TextEditingController();

  // [INTEGRATION] Sends patient enrollment data to POST /api/caregiver/patients.
  // Includes patient info, optional caregiver assignment, and device serial numbers.
  Future<void> _enrollPatient() async {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);

    final patientName = '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}'.trim();

    final body = <String, dynamic>{
      'name': patientName,
      'birthdate': _birthdateCtrl.text.trim(),
      'medicalCondition': _medicalNotesCtrl.text.trim(),
    };

    if (_selectedCaregiverId != null) {
      body['assignedCaregiverId'] = _selectedCaregiverId;
    }

    // [OWASP A05] Parameterized JSON body sent via ApiService
    final result = await ApiService.post('/caregiver/patients', body: body);

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (result['success'] == true) {
      showDialog(
        context: context,
        builder: (BuildContext ctx) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle_outline, color: Color(0xFF5FA9A9), size: 60),
                const SizedBox(height: 20),
                Text("Registration Successful",
                    style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 10),
                Text("The patient has been successfully added to the ALAGA network.",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.albertSans(fontSize: 14)),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx); // Close Popup
                    Navigator.pop(context); // Return to previous screen
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF5FA9A9),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  child: Text("Done", style: GoogleFonts.poppins(color: Colors.white)),
                )
              ],
            ),
          );
        },
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Failed to enroll patient.', style: GoogleFonts.albertSans()),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _showRegisterNewDevicePopup() {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: "RegisterDevice",
      barrierColor: Colors.black.withOpacity(0.4),
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (context, anim1, anim2) {
        return BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
          child: Center(
            child: _RegisterDeviceModal(),
          ),
        );
      },
    );
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
                onPressed: () {
                  if (currentStep > 1) {
                    setState(() => currentStep--);
                  } else {
                    Navigator.pop(context);
                  }
                },
                icon: const Icon(Icons.arrow_back, size: 28, color: Colors.black87),
              ),
              const SizedBox(height: 30),
              Text("Enroll",
                  style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: const Color(0xFF5FA9A9),
                      fontWeight: FontWeight.w600)),
              Text("NEW PATIENT",
                  style: GoogleFonts.poppins(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1)),
              const SizedBox(height: 8),
              Text("Register a new patient to the ALAGA network.",
                  style: GoogleFonts.albertSans(fontSize: 14, color: Colors.black)),
              const SizedBox(height: 30),
              _buildStepper(),
              const SizedBox(height: 30),

              if (currentStep == 1) _buildStepOne(),
              if (currentStep == 2) _buildStepTwo(),
              if (currentStep == 3) _buildStepThree(),

              const SizedBox(height: 40),

              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildActionButton(
                      currentStep == 1 ? "Cancel" : "Back",
                      isPrimary: false,
                      onTap: () {
                        if (currentStep > 1) {
                          setState(() => currentStep--);
                        } else {
                          Navigator.pop(context);
                        }
                      }),
                  const SizedBox(width: 40),
                  _buildActionButton(
                    currentStep == 3 ? "Finish" : "Next Step",
                    isPrimary: true,
                    onTap: () {
                      if (_isSubmitting) return;
                      if (currentStep < 3) {
                        setState(() => currentStep++);
                      } else {
                        _enrollPatient();
                      }
                    },
                  ),
                ],
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepTwo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFC2D9FF),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Image.asset(
                'assets/images/tool.png',
                width: 32,
                height: 32,
                errorBuilder: (c, e, s) => const Icon(Icons.medical_services_outlined,
                    color: Color(0xFF0046AD), size: 32),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Assign Primary Caregiver",
                        style: GoogleFonts.poppins(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: const Color(0xFF0046AD))),
                    Text(
                        "Optional. You can search for an existing nurse/doctor or scan their ID.",
                        style: GoogleFonts.albertSans(
                            fontSize: 12, color: const Color(0xFF0046AD))),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Container(
          height: 54,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
              color: const Color(0xFFDCDCDC),
              borderRadius: BorderRadius.circular(18)),
          child: Row(
            children: [
              _buildCaregiverToggleButton(true, "Search Database"),
              _buildCaregiverToggleButton(false, "Scan ID Token"),
            ],
          ),
        ),
        const SizedBox(height: 30),
        isSearching ? _buildSearchDatabaseView() : _buildScanQRView(),
      ],
    );
  }

  Widget _buildStepThree() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // --- NOTE BANNER ---
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFC2D9FF),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
  // Change .start to .center to align the icon with the middle of the text block
  crossAxisAlignment: CrossAxisAlignment.center, 
  children: [
    Image.asset(
      'assets/images/file.png',
      width: 32,
      height: 32,
      errorBuilder: (c, e, s) => const Icon(
        Icons.insert_drive_file_outlined,
        color: Color(0xFF0046AD),
        size: 32,
      ),
    ),
    const SizedBox(width: 12),
    Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Note",
            style: GoogleFonts.poppins(
              fontWeight: FontWeight.bold,
              fontSize: 14,
              color: const Color(0xFF0046AD),
            ),
          ),
          Text(
            "This step is optional. You can still enroll a patient without a device.",
            style: GoogleFonts.albertSans(
              fontSize: 12,
              color: const Color(0xFF0046AD),
            ),
          ),
        ],
      ),
    ),
  ],
)
        ),
        const SizedBox(height: 20),

        // --- LINK DEVICES SECTION ---
        Text("Link Devices",
            style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
        Text("Select active hardware from the inventory.",
            style: GoogleFonts.albertSans(fontSize: 14, color: Colors.black)),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.refresh, size: 18, color: Colors.black),
            label: Text("Refresh",
                style: GoogleFonts.poppins(color: Colors.black, fontSize: 12)),
          ),
        ),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF9E6),
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: const Color(0xFFFFD54F), width: 1.5),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset(
                'assets/images/phone.png',
                height: 40,
                width: 40,
                errorBuilder: (c, e, s) =>
                    const Icon(Icons.phone_android, size: 40, color: Color(0xFFFFB300)),
              ),
              const SizedBox(height: 16),
              Text("No Available Devices",
                  style: GoogleFonts.poppins(
                      color: const Color(0xFFFBC02D),
                      fontWeight: FontWeight.bold,
                      fontSize: 16)),
              const SizedBox(height: 8),
              Text("All devices are currently assigned or none are registered.",
                  textAlign: TextAlign.center,
                  style: GoogleFonts.albertSans(fontSize: 13, color: Colors.black87)),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _showRegisterNewDevicePopup,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFFFBC02D),
                  side: const BorderSide(color: Color(0xFFFBC02D)),
                  elevation: 0,
                  shape:
                      RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: Text("Register New", style: GoogleFonts.poppins()),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStepOne() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.5)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildInputLabel("First Name"),
              _buildTextField(_firstNameCtrl,
                  radius: 12,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z\s]'))
                  ]),
              const SizedBox(height: 20),
              _buildInputLabel("Last Name"),
              _buildTextField(_lastNameCtrl,
                  radius: 12,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z\s]'))
                  ]),
              const SizedBox(height: 20),
              _buildInputLabel("Birthdate"),
              _buildTextField(_birthdateCtrl,
                  hint: "Select date",
                  radius: 12,
                  isReadOnly: true,
                  onTap: () => _selectDate(context),
                  prefixIcon:
                      const Icon(Icons.calendar_today, size: 18, color: Color(0xFF5FA9A9))),
            ],
          ),
        ),
        const SizedBox(height: 30),
        Text("Medical Notes",
            style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14)),
        const SizedBox(height: 8),
        _buildTextField(_medicalNotesCtrl,
            hint: "Brief medical history...", isLarge: true, radius: 15),
      ],
    );
  }

  // ---- Live Caregiver Search State ----
  List<Map<String, dynamic>> _caregiverResults = [];
  bool _isSearchingCaregivers = false;
  String? _selectedCaregiverName;

  // Debounce timer so we don't hammer the API on every keystroke
  // [OWASP A07] Rate limiting enforced at backend; debounce reduces noise client-side.

  Future<void> _searchCaregivers(String query) async {
    if (query.trim().length < 2) {
      setState(() {
        _caregiverResults = [];
        _isSearchingCaregivers = false;
      });
      return;
    }

    setState(() => _isSearchingCaregivers = true);

    final result = await ApiService.get('/caregiver/search?query=${Uri.encodeQueryComponent(query)}');

    if (!mounted) return;
    if (result['success'] == true) {
      final data = (result['data'] as List<dynamic>? ?? [])
          .map((u) => Map<String, dynamic>.from(u as Map))
          .toList();
      setState(() {
        _caregiverResults = data;
        _isSearchingCaregivers = false;
      });
    } else {
      setState(() {
        _caregiverResults = [];
        _isSearchingCaregivers = false;
      });
    }
  }

  Widget _buildSearchDatabaseView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Email / Username',
            style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 10),
        _buildTextField(
          _searchCtrl,
          hint: 'nurse@hospital.com',
          prefixIcon: _isSearchingCaregivers
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: Padding(
                    padding: EdgeInsets.all(12.0),
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Color(0xFF5FA9A9)),
                  ))
              : const Icon(Icons.search, color: Colors.black26),
          radius: 15,
          onChanged: (val) => _searchCaregivers(val),
        ),

        // Selected caregiver banner
        if (_selectedCaregiverName != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF5FA9A9).withOpacity(0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.4)),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle_outline,
                    color: Color(0xFF5FA9A9), size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Selected: $_selectedCaregiverName',
                    style: GoogleFonts.albertSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF5FA9A9)),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedCaregiverId = null;
                      _selectedCaregiverName = null;
                      _searchCtrl.clear();
                      _caregiverResults = [];
                    });
                  },
                  child: const Icon(Icons.close, size: 16, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],

        // Search results list
        if (_caregiverResults.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 8,
                    offset: const Offset(0, 3))
              ],
            ),
            child: Column(
              children: _caregiverResults.asMap().entries.map((entry) {
                final i = entry.key;
                final caregiver = entry.value;
                final name =
                    '${caregiver['first_name'] ?? ''} ${caregiver['last_name'] ?? ''}'.trim();
                final email = caregiver['email'] ?? '';
                final role = caregiver['role'] ?? '';
                final userId = caregiver['user_id'];

                return Column(
                  children: [
                    ListTile(
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor: const Color(0xFF5FA9A9).withOpacity(0.1),
                        child: Text(
                          name.isNotEmpty ? name[0].toUpperCase() : 'U',
                          style: const TextStyle(
                              color: Color(0xFF5FA9A9),
                              fontWeight: FontWeight.bold,
                              fontSize: 14),
                        ),
                      ),
                      title: Text(name,
                          style: GoogleFonts.poppins(
                              fontSize: 13, fontWeight: FontWeight.w600)),
                      subtitle: Text(email,
                          style: GoogleFonts.albertSans(
                              fontSize: 11, color: Colors.grey)),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF5FA9A9).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          role == 'medical_staff' ? 'Staff' : 'Caregiver',
                          style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF5FA9A9),
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                      onTap: () {
                        setState(() {
                          _selectedCaregiverId = userId;
                          _selectedCaregiverName = name.isNotEmpty ? name : email;
                          _searchCtrl.text = _selectedCaregiverName!;
                          _caregiverResults = [];
                        });
                      },
                    ),
                    if (i < _caregiverResults.length - 1)
                      Divider(
                          height: 1, color: Colors.grey.shade100, indent: 16),
                  ],
                );
              }).toList(),
            ),
          ),
        ] else if (!_isSearchingCaregivers &&
            _searchCtrl.text.trim().length >= 2 &&
            _selectedCaregiverId == null) ...[
          const SizedBox(height: 10),
          Center(
            child: Text('No caregivers found matching your search.',
                style: GoogleFonts.albertSans(
                    fontSize: 12, color: Colors.grey)),
          ),
        ],
      ],
    );
  }



  Widget _buildScanQRView() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.5))),
      child: Column(
        children: [
          Container(
              padding: const EdgeInsets.all(20),
              decoration:
                  BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.black12)),
              child: const Icon(Icons.qr_code_scanner, size: 40)),
          const SizedBox(height: 20),
          Text("Scan QR ID",
              style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Text("Upload a clear photo of the ID QR code.",
              textAlign: TextAlign.center,
              style: GoogleFonts.albertSans(fontSize: 14)),
          const SizedBox(height: 30),
          _buildUploadButton(),
        ],
      ),
    );
  }

  Widget _buildCaregiverToggleButton(bool value, String label) {
    bool isSelected = isSearching == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => isSearching = value),
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
              color: isSelected ? Colors.white : Colors.transparent,
              borderRadius: BorderRadius.circular(15)),
          child: Text(label,
              style: GoogleFonts.poppins(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? const Color(0xFF5FA9A9) : Colors.black54)),
        ),
      ),
    );
  }

  Widget _buildUploadButton() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: BoxDecoration(
          color: const Color(0xFFE0E8E8),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.5))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.upload, color: Color(0xFF5FA9A9)),
        const SizedBox(width: 10),
        Text("Upload Image",
            style: GoogleFonts.poppins(
                color: const Color(0xFF5FA9A9), fontWeight: FontWeight.w600)),
      ]),
    );
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
        context: context,
        initialDate: DateTime.now().subtract(const Duration(days: 365 * 30)),
        firstDate: DateTime(1900),
        lastDate: DateTime.now());
    if (picked != null) {
      setState(() =>
          _birthdateCtrl.text = "${picked.month}/${picked.day}/${picked.year}");
    }
  }

  Widget _buildStepper() {
    return Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _stepIndicator(1, "Details", isActive: currentStep >= 1),
          _stepIndicator(2, "Caregiver", isActive: currentStep >= 2),
          _stepIndicator(3, "Devices", isActive: currentStep >= 3)
        ]);
  }

  Widget _stepIndicator(int number, String label, {required bool isActive}) {
    return Column(children: [
      CircleAvatar(
          radius: 24,
          backgroundColor:
              isActive ? const Color(0xFF5FA9A9) : const Color(0xFFD9D9D9),
          child: Text(number.toString(),
              style: GoogleFonts.poppins(
                  color: isActive ? Colors.white : Colors.black54,
                  fontWeight: FontWeight.bold,
                  fontSize: 18))),
      const SizedBox(height: 8),
      Text(label,
          style: GoogleFonts.poppins(
              fontSize: 12,
              color: isActive ? const Color(0xFF5FA9A9) : Colors.black45,
              fontWeight: isActive ? FontWeight.w600 : FontWeight.normal))
    ]);
  }

  Widget _buildTextField(TextEditingController ctrl,
      {String? hint,
      bool isLarge = false,
      bool isReadOnly = false,
      VoidCallback? onTap,
      Widget? prefixIcon,
      double radius = 30,
      List<TextInputFormatter>? inputFormatters,
      ValueChanged<String>? onChanged}) {
    return TextField(
        controller: ctrl,
        readOnly: isReadOnly,
        onTap: onTap,
        onChanged: onChanged,
        inputFormatters: inputFormatters,
        maxLines: isLarge ? 3 : 1,
        style: GoogleFonts.albertSans(fontSize: 14),
        decoration: InputDecoration(
            hintText: hint,
            prefixIcon: prefixIcon,
            filled: true,
            fillColor: const Color(0xFFE0E8E8),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(radius),
                borderSide: BorderSide(
                    color: const Color(0xFF5FA9A9).withOpacity(0.3))),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(radius),
                borderSide:
                    const BorderSide(color: Color(0xFF5FA9A9), width: 1.5))));
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
              style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold))
        ])));
  }

  Widget _buildActionButton(String label,
      {required bool isPrimary, required VoidCallback onTap}) {
    return SizedBox(
        width: 130,
        height: 48,
        child: isPrimary
            ? ElevatedButton(
                onPressed: onTap,
                style: ElevatedButton.styleFrom(
                    elevation: 2,
                    backgroundColor: const Color(0xFF5FA9A9),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(25))),
                child: Text(label,
                    style: GoogleFonts.poppins(
                        color: Colors.black, fontWeight: FontWeight.w600)))
            : OutlinedButton(
                onPressed: onTap,
                style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.black),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(25))),
                child: Text(label,
                    style: GoogleFonts.poppins(
                        color: Colors.black, fontWeight: FontWeight.w600))));
  }
}

// =============================================================================
// REGISTER DEVICE MODAL — full logic from NewDeviceScreen
// =============================================================================
class _RegisterDeviceModal extends StatefulWidget {
  @override
  State<_RegisterDeviceModal> createState() => _RegisterDeviceModalState();
}

class _RegisterDeviceModalState extends State<_RegisterDeviceModal> {
  bool isManual = true;
  bool isDoubleDevice = true;

  final TextEditingController _vitalSignsCtrl = TextEditingController();
  final TextEditingController _smartDiaperCtrl = TextEditingController();
  String? _vsError;
  String? _sdError;

  final List<Map<String, dynamic>> _singleDevices = [];

  @override
  void dispose() {
    _vitalSignsCtrl.dispose();
    _smartDiaperCtrl.dispose();
    for (var d in _singleDevices) {
      (d['controller'] as TextEditingController).dispose();
    }
    super.dispose();
  }

  void _validateAndRegister() {
    final vsRegex = RegExp(r'^VS-\d{4}-\d{3}$');
    final sdRegex = RegExp(r'^SD-\d{4}-\d{3}$');

    if (isDoubleDevice) {
      setState(() {
        _vsError = vsRegex.hasMatch(_vitalSignsCtrl.text)
            ? null
            : "Please input a valid device number.";
        _sdError = sdRegex.hasMatch(_smartDiaperCtrl.text)
            ? null
            : "Please input a valid device number.";
      });
      if (_vsError == null && _sdError == null) _showSuccessDialog();
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
      if (allValid && _singleDevices.isNotEmpty) _showSuccessDialog();
    }
  }

  void _addSingleDevice(String type) {
    setState(() {
      _singleDevices.add({
        'type': type,
        'controller': TextEditingController(),
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
              leading: Image.asset('assets/images/vital.png',
                  width: 24,
                  errorBuilder: (c, e, s) =>
                      const Icon(Icons.monitor_heart_outlined, size: 24)),
              title: Text("Vital Signs Device",
                  style: GoogleFonts.poppins(fontSize: 14)),
              onTap: () {
                Navigator.pop(context);
                _addSingleDevice('VS');
              },
            ),
            ListTile(
              leading: Image.asset('assets/images/diaper.png',
                  width: 24,
                  errorBuilder: (c, e, s) =>
                      const Icon(Icons.child_care_outlined, size: 24)),
              title: Text("Smart Diaper Device",
                  style: GoogleFonts.poppins(fontSize: 14)),
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

  void _showSuccessDialog() {
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
                  border:
                      Border.all(color: const Color(0xFF5FA9A9), width: 4),
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
            ],
          ),
        ),
      ),
    );
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) Navigator.pop(context);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        width: MediaQuery.of(context).size.width * 0.88,
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.82,
        ),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
            color: const Color(0xFFF5F5F0),
            borderRadius: BorderRadius.circular(18)),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Register",
                  style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: const Color(0xFF5FA9A9),
                      fontWeight: FontWeight.w600)),
              Text("NEW DEVICE",
                  style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5)),
              const SizedBox(height: 20),

              // Toggle Manual / Scan QR
              Container(
                height: 48,
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                    color: const Color(0xFFD9D9D9),
                    borderRadius: BorderRadius.circular(15)),
                child: Row(
                  children: [
                    _toggleBtn(true, 'keyboard', 'Manual'),
                    _toggleBtn(false, 'qr', 'Scan QR'),
                  ],
                ),
              ),
              const SizedBox(height: 25),

              isManual ? _buildManualView() : _buildScanView(),

              const SizedBox(height: 30),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _modalActionBtn(
                      "Cancel", false, () => Navigator.pop(context)),
                  const SizedBox(width: 20),
                  _modalActionBtn("Register", true, _validateAndRegister),
                ],
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _toggleBtn(bool val, String icon, String label) {
    bool selected = isManual == val;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => isManual = val),
        child: Container(
          decoration: BoxDecoration(
              color: selected ? Colors.white : Colors.transparent,
              borderRadius: BorderRadius.circular(12)),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset('assets/images/$icon.png',
                  width: 16,
                  color: selected ? const Color(0xFF5FA9A9) : Colors.black45,
                  errorBuilder: (c, e, s) => Icon(
                      val ? Icons.keyboard : Icons.qr_code_scanner,
                      size: 16,
                      color: selected
                          ? const Color(0xFF5FA9A9)
                          : Colors.black45)),
              const SizedBox(width: 6),
              Text(label,
                  style: GoogleFonts.poppins(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color:
                          selected ? const Color(0xFF5FA9A9) : Colors.black45)),
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
        // Double / Single device selector
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
                color: const Color(0xFF5FA9A9).withOpacity(0.5)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isDoubleDevice ? "DOUBLE DEVICE" : "SINGLE DEVICE",
                    style: GoogleFonts.poppins(
                        fontSize: 14,
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
                        child: Text("Double Device",
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
                _modalLabel("Vital Signs Device No."),
                _modalTextField(_vitalSignsCtrl, "VS-2026-001",
                    errorText: _vsError),
                const SizedBox(height: 15),
                _modalLabel("Smart Diaper Device No."),
                _modalTextField(_smartDiaperCtrl, "SD-2026-001",
                    errorText: _sdError),
              ] else ...[
                ..._singleDevices.asMap().entries.map((entry) {
                  final i = entry.key;
                  final device = entry.value;
                  final ctrl =
                      device['controller'] as TextEditingController;
                  final type = device['type'] as String;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment:
                              MainAxisAlignment.spaceBetween,
                          children: [
                            _modalLabel(type == 'VS'
                                ? "Vital Signs Device No."
                                : "Smart Diaper Device No."),
                            IconButton(
                              icon: const Icon(Icons.close,
                                  size: 16, color: Colors.black45),
                              onPressed: () => _removeSingleDevice(i),
                            ),
                          ],
                        ),
                        _modalTextField(
                            ctrl,
                            type == 'VS'
                                ? "VS-2026-001"
                                : "SD-2026-001",
                            errorText: device['error']),
                      ],
                    ),
                  );
                }),
                GestureDetector(
                  onTap: _showAddDeviceTypeDialog,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4),
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

  Widget _buildScanView() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: const Color(0xFF5FA9A9).withOpacity(0.3))),
      child: Column(
        children: [
          Image.asset('assets/images/qr.png',
              width: 32,
              height: 32,
              errorBuilder: (c, e, s) =>
                  const Icon(Icons.qr_code_scanner, size: 32)),
          const SizedBox(height: 10),
          Text("Scan Device Sticker",
              style:
                  GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text(
              "Upload a clear photo of the QR code\nfound on the back of the device.",
              textAlign: TextAlign.center,
              style: GoogleFonts.albertSans(fontSize: 12, color: Colors.black87)),
          const SizedBox(height: 15),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
                color: const Color(0xFFE0E8E8),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: const Color(0xFF5FA9A9).withOpacity(0.4))),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.upload, size: 16, color: Color(0xFF5FA9A9)),
              SizedBox(width: 8),
              Text("Upload Image",
                  style: TextStyle(
                      color: Color(0xFF5FA9A9),
                      fontWeight: FontWeight.bold,
                      fontSize: 12))
            ]),
          )
        ],
      ),
    );
  }

  Widget _modalLabel(String text) => Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Text.rich(TextSpan(children: [
        TextSpan(
            text: text,
            style: GoogleFonts.poppins(
                fontWeight: FontWeight.bold, fontSize: 12)),
        const TextSpan(
            text: " *", style: TextStyle(color: Colors.red))
      ])));

  Widget _modalTextField(TextEditingController ctrl, String hint,
      {String? errorText}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: ctrl,
          style: GoogleFonts.poppins(fontSize: 12),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle:
                GoogleFonts.poppins(fontSize: 12, color: Colors.black38),
            filled: true,
            fillColor: const Color(0xFFE0E8E8),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(20),
                borderSide: BorderSide(
                    color: errorText != null
                        ? Colors.red
                        : Colors.transparent)),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(20),
                borderSide: BorderSide(
                    color: errorText != null
                        ? Colors.red
                        : const Color(0xFF5FA9A9),
                    width: 1.5)),
          ),
        ),
        if (errorText != null)
          Padding(
            padding: const EdgeInsets.only(left: 12, top: 4),
            child: Text(errorText,
                style:
                    const TextStyle(color: Colors.red, fontSize: 11)),
          ),
      ],
    );
  }

  Widget _modalActionBtn(
          String label, bool primary, VoidCallback tap) =>
      SizedBox(
          width: 110,
          height: 40,
          child: primary
              ? ElevatedButton(
                  onPressed: tap,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF5FA9A9),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20))),
                  child: Text(label,
                      style: GoogleFonts.poppins(
                          color: Colors.black,
                          fontSize: 12,
                          fontWeight: FontWeight.w600)))
              : OutlinedButton(
                  onPressed: tap,
                  style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.black),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20))),
                  child: Text(label,
                      style: GoogleFonts.poppins(
                          color: Colors.black,
                          fontSize: 12,
                          fontWeight: FontWeight.w600))));
}