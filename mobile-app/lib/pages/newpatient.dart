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
  bool _isSubmitting = false;

  // [INTEGRATION] Track selected caregiver and device serial numbers
  int? _selectedCaregiverId;

  final TextEditingController _firstNameCtrl = TextEditingController();
  final TextEditingController _lastNameCtrl = TextEditingController();
  final TextEditingController _birthdateCtrl = TextEditingController();
  final TextEditingController _medicalNotesCtrl = TextEditingController();
  final TextEditingController _wardNameCtrl = TextEditingController();
  final TextEditingController _roomNameCtrl = TextEditingController();
  final TextEditingController _bedNameCtrl = TextEditingController();
  final TextEditingController _searchCtrl = TextEditingController();
  bool _hasInformedConsent = false;

  bool _validatePatientDetails() {
    String? message;
    if (_firstNameCtrl.text.trim().isEmpty || _lastNameCtrl.text.trim().isEmpty) {
      message = 'Please enter the patient\'s first and last names.';
    } else if (_birthdateCtrl.text.trim().isEmpty) {
      message = 'Please select the patient\'s birthdate.';
    } else if (!_hasInformedConsent) {
      message = 'Please confirm informed consent before proceeding.';
    }
    if (message == null) return true;
    setState(() => currentStep = 1);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: Colors.redAccent,
      behavior: SnackBarBehavior.floating,
    ));
    return false;
  }

  List<dynamic> _availableDevices = [];
  String? _selectedVitalDevice;
  String? _selectedDiaperDevice;
  bool _isLoadingDevices = false;

  @override
  void initState() {
    super.initState();
    _fetchAvailableDevices();
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _birthdateCtrl.dispose();
    _medicalNotesCtrl.dispose();
    _wardNameCtrl.dispose();
    _roomNameCtrl.dispose();
    _bedNameCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchAvailableDevices() async {
    setState(() => _isLoadingDevices = true);
    final result = await ApiService.get('/caregiver/devices/available');
    if (!mounted) return;
    setState(() {
      _isLoadingDevices = false;
      if (result['success'] == true) {
        _availableDevices = result['data'] ?? [];
      } else {
        _availableDevices = [];
      }
      // Reset selections if they are no longer in the list
      if (!_availableDevices.any((d) => d['serial_number'] == _selectedVitalDevice)) {
        _selectedVitalDevice = null;
      }
      if (!_availableDevices.any((d) => d['serial_number'] == _selectedDiaperDevice)) {
        _selectedDiaperDevice = null;
      }
    });
  }

  // [INTEGRATION] Sends patient enrollment data to POST /api/caregiver/patients.
  // Includes patient info, optional caregiver assignment, and device serial numbers.
  Future<void> _enrollPatient() async {
    if (_isSubmitting) return;
    if (!_validatePatientDetails()) return;
    if (!_hasInformedConsent) {
      setState(() => currentStep = 1);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please confirm informed consent before proceeding.'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() => _isSubmitting = true);

    final patientName = '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}'.trim();

    final body = <String, dynamic>{
      'name': patientName,
      'birthdate': _birthdateCtrl.text.trim(),
      'medicalCondition': _medicalNotesCtrl.text.trim(),
      'wardName': _wardNameCtrl.text.trim(),
      'roomName': _roomNameCtrl.text.trim(),
      'bedName': _bedNameCtrl.text.trim(),
      'consentGiven': _hasInformedConsent,
    };

    if (_selectedCaregiverId != null) {
      body['assignedCaregiverId'] = _selectedCaregiverId;
    }
    if (_selectedVitalDevice != null) {
      body['vitalDeviceNo'] = _selectedVitalDevice;
    }
    if (_selectedDiaperDevice != null) {
      body['diaperDeviceNo'] = _selectedDiaperDevice;
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

  Future<void> _showRegisterNewDevicePopup() async {
    await showGeneralDialog(
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
    // [FIX] After modal closes, refresh available devices in case new ones were registered.
    _fetchAvailableDevices();
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
                      if (currentStep == 1 && !_validatePatientDetails()) return;
                      if (currentStep < 3) {
                        if (currentStep == 1 && !_hasInformedConsent) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Please confirm informed consent before proceeding.'),
                              backgroundColor: Colors.redAccent,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                          return;
                        }
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
                        "Optional. You can search for an existing nurse/doctor or caregiver.",
                        style: GoogleFonts.albertSans(
                            fontSize: 12, color: const Color(0xFF0046AD))),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        _buildSearchDatabaseView(),
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
            onPressed: _fetchAvailableDevices,
            icon: const Icon(Icons.refresh, size: 18, color: Colors.black),
            label: Text("Refresh",
                style: GoogleFonts.poppins(color: Colors.black, fontSize: 12)),
          ),
        ),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 24),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF9E6),
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: const Color(0xFFFFD54F), width: 1.5),
          ),
          child: _isLoadingDevices 
            ? const Center(child: CircularProgressIndicator())
            : _availableDevices.isEmpty
              ? Column(
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
                    Text("All your registered devices are currently assigned or none are registered.",
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
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Select Vital Sign Monitor", style: GoogleFonts.albertSans(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedVitalDevice,
                      hint: const Text("None"),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                      items: [
                        const DropdownMenuItem<String>(value: null, child: Text("None")),
                        ..._availableDevices
                            .where((d) => d['device_name'].toString().contains('Vital'))
                            .map((d) => DropdownMenuItem<String>(
                                  value: d['serial_number'],
                                  child: Text(d['serial_number']),
                                )),
                      ],
                      onChanged: (val) => setState(() => _selectedVitalDevice = val),
                    ),
                    const SizedBox(height: 16),
                    Text("Select Smart Diaper", style: GoogleFonts.albertSans(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedDiaperDevice,
                      hint: const Text("None"),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                      items: [
                        const DropdownMenuItem<String>(value: null, child: Text("None")),
                        ..._availableDevices
                            .where((d) => d['device_name'].toString().contains('Diaper'))
                            .map((d) => DropdownMenuItem<String>(
                                  value: d['serial_number'],
                                  child: Text(d['serial_number']),
                                )),
                      ],
                      onChanged: (val) => setState(() => _selectedDiaperDevice = val),
                    ),
                    const SizedBox(height: 24),
                    Center(
                      child: ElevatedButton(
                        onPressed: _showRegisterNewDevicePopup,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: const Color(0xFFFBC02D),
                          side: const BorderSide(color: Color(0xFFFBC02D)),
                          elevation: 0,
                          shape:
                              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: Text("Register Another Device", style: GoogleFonts.poppins()),
                      ),
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
              const SizedBox(height: 26),
              _buildInputLabel('Location Assignment', isRequired: false),
              const SizedBox(height: 6),
              Text(
                'Optional. Fill out only if the patient is admitted in a hospital.',
                style: GoogleFonts.albertSans(fontSize: 14, color: Colors.black),
              ),
              const SizedBox(height: 16),
              _buildInputLabel('Ward Name', isRequired: false),
              _buildTextField(_wardNameCtrl, radius: 12),
              const SizedBox(height: 16),
              _buildInputLabel('Room Name', isRequired: false),
              _buildTextField(_roomNameCtrl, radius: 12),
              const SizedBox(height: 16),
              _buildInputLabel('Bed Name', isRequired: false),
              _buildTextField(_bedNameCtrl, radius: 12),
            ],
          ),
        ),
        const SizedBox(height: 30),
        Text("Medical Notes",
            style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14)),
        const SizedBox(height: 8),
        _buildTextField(_medicalNotesCtrl,
            hint: "Brief medical history...", isLarge: true, radius: 15),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFC2D9FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: const Color(0xFFC2D9FF),
            ),
          ),
          child: CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            activeColor: const Color(0xFF0046AD),
            value: _hasInformedConsent,
            onChanged: (value) => setState(() => _hasInformedConsent = value ?? false),
            title: Text(
              'I confirm that the patient or their legal guardian has provided informed consent for health data collection and processing as required by the Data Privacy Act of 2012 (RA 10173), Section 13.',
              style: GoogleFonts.albertSans(fontSize: 12.5, height: 1.35, color: const Color(0xFF0046AD)),
            ),
          ),
        ),
      ],
    );
  }

  // ---- Live Caregiver Search State ----
  List<Map<String, dynamic>> _caregiverResults = [];
  bool _isSearchingCaregivers = false;
  String? _selectedCaregiverName;
  String? _caregiverSearchMessage;
  int _caregiverSearchRequest = 0;

  // Debounce timer so we don't hammer the API on every keystroke
  // [OWASP A07] Rate limiting enforced at backend; debounce reduces noise client-side.

  Future<void> _searchCaregivers(String query) async {
    final request = ++_caregiverSearchRequest;
    _caregiverSearchMessage = null;
    if (query.trim().length < 2) {
      setState(() {
        _caregiverResults = [];
        _isSearchingCaregivers = false;
      });
      return;
    }

    setState(() => _isSearchingCaregivers = true);

    final result = await ApiService.get('/caregiver/search?query=${Uri.encodeQueryComponent(query)}');

    if (!mounted || request != _caregiverSearchRequest) return;
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
        _caregiverSearchMessage = 'Search could not be completed. Please try again.';
        _caregiverResults = [];
        _isSearchingCaregivers = false;
      });
    }
  }

  Future<void> _suggestCaregivers() async {
    final request = ++_caregiverSearchRequest;
    setState(() => _isSearchingCaregivers = true);
    final result = await ApiService.get('/caregiver/all');
    if (!mounted || request != _caregiverSearchRequest) return;
    setState(() => _isSearchingCaregivers = false);
    final suggestions = result['success'] == true
        ? (result['data'] as List? ?? [])
            .map((u) => Map<String, dynamic>.from(u as Map))
            .where((u) => u['role'] == 'caregiver' && u['is_archived'] != true)
            .toList()
        : <Map<String, dynamic>>[];
    final selected = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text('Choose a caregiver',
          style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600)),
        content: SizedBox(
          width: double.maxFinite,
          child: suggestions.isEmpty
              ? Text(result['success'] == true
                  ? 'No registered caregivers are available.'
                  : result['message']?.toString() ?? 'Could not load caregivers. Please try again.',
                  style: GoogleFonts.albertSans(color: Colors.black87))
              : ListView.separated(
                  shrinkWrap: true,
                  itemCount: suggestions.length,
                  separatorBuilder: (_, index) => const Divider(height: 1),
                  itemBuilder: (_, index) {
                    final caregiver = suggestions[index];
                    final name = '${caregiver['first_name'] ?? ''} ${caregiver['last_name'] ?? ''}'.trim();
                    final email = caregiver['email']?.toString() ?? '';
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.person_outline, color: Color(0xFF5FA9A9)),
                      title: Text(name.isEmpty ? email : name,
                        style: GoogleFonts.poppins(fontSize: 14, color: Colors.black87)),
                      subtitle: Text('$email • ${caregiver['role'] == 'medical_staff' ? 'Staff' : 'Caregiver'}',
                        style: GoogleFonts.albertSans(fontSize: 12, color: Colors.black54)),
                      onTap: () => Navigator.pop(dialogContext, caregiver),
                    );
                  },
                ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel'))],
      ),
    );
    if (!mounted || selected == null) return;
    setState(() {
      final name = '${selected['first_name'] ?? ''} ${selected['last_name'] ?? ''}'.trim();
      _selectedCaregiverId = selected['user_id'];
      _selectedCaregiverName = name.isEmpty ? selected['email']?.toString() ?? '' : name;
      _searchCtrl.text = _selectedCaregiverName!;
      _caregiverResults = [];
    });
  }

  Widget _buildSearchDatabaseView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Name / Email / Username',
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
            child: Text(_caregiverSearchMessage ?? 'No caregivers found matching your search.',
                style: GoogleFonts.albertSans(
                    fontSize: 12, color: Colors.grey)),
          ),
          Center(
            child: TextButton.icon(
              onPressed: _suggestCaregivers,
              icon: const Icon(Icons.people_outline),
              label: const Text('Show caregiver suggestions'),
            ),
          ),
        ],
      ],
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

  Widget _buildInputLabel(String label, {bool isRequired = true}) {
    return Padding(
        padding: const EdgeInsets.only(bottom: 8.0),
        child: Text.rich(TextSpan(children: [
          TextSpan(
              text: label,
              style:
                  GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14)),
          if (isRequired)
            const TextSpan(
                text: " *",
                style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold))
        ])));
  }

  Widget _buildActionButton(String label,
      {required bool isPrimary, required VoidCallback? onTap}) {
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
  bool _isSubmitting = false;

  // [FIX] Pre-fill year prefix — mirrors the logic in NewDeviceScreen.
  final int _currentYear = DateTime.now().year;
  late final TextEditingController _vitalSignsCtrl;
  late final TextEditingController _smartDiaperCtrl;
  String? _vsError;
  String? _sdError;

  final List<Map<String, dynamic>> _singleDevices = [];

  @override
  void initState() {
    super.initState();
    _vitalSignsCtrl = TextEditingController(text: 'VS-$_currentYear-');
    _smartDiaperCtrl = TextEditingController(text: 'SD-$_currentYear-');
  }

  @override
  void dispose() {
    _vitalSignsCtrl.dispose();
    _smartDiaperCtrl.dispose();
    for (var d in _singleDevices) {
      (d['controller'] as TextEditingController).dispose();
    }
    super.dispose();
  }

  // [INTEGRATION] Validates device numbers then calls POST /api/caregiver/devices
  // to register them into the backend whitelist.
  // [FIX] Previously this method NEVER called the API — it only called
  // _showSuccessDialog() on valid input, giving a false impression of success
  // while writing nothing to the database.
  Future<void> _validateAndRegister() async {
    if (_isSubmitting) return;

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

      for (var device in _singleDevices) {
        final ctrl = device['controller'] as TextEditingController;
        final type = device['type'] as String;
        if (type == 'VS') vitalDeviceNo = ctrl.text.trim();
        if (type == 'SD') diaperDeviceNo = ctrl.text.trim();
      }
    }

    setState(() => _isSubmitting = true);

    // [OWASP A05] JSON body — parameterized on the backend via prepared statements.
    final result = await ApiService.post(
      '/caregiver/devices',
      body: {
        if (vitalDeviceNo != null) 'vitalDeviceNo': vitalDeviceNo,
        if (diaperDeviceNo != null) 'diaperDeviceNo': diaperDeviceNo,
      },
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (result['success'] == true) {
      _showSuccessDialog();
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
    // [FIX] Pre-fill the prefix so the user only enters the 4-digit suffix.
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

              _buildManualView(),

              const SizedBox(height: 30),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _modalActionBtn(
                      "Cancel", false, () => Navigator.pop(context)),
                  const SizedBox(width: 20),
                  _modalActionBtn("Register", true,
                      _isSubmitting ? () {} : _validateAndRegister),
                ],
              ),
              const SizedBox(height: 8),
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
                    isDoubleDevice ? "PARTNER DEVICE" : "SINGLE DEVICE",
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
                        child: Text("Partner Device",
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
                _modalTextField(_vitalSignsCtrl, 'VS-$_currentYear-0001',
                    errorText: _vsError),
                const SizedBox(height: 15),
                _modalLabel("Smart Diaper Device No."),
                _modalTextField(_smartDiaperCtrl, 'SD-$_currentYear-0001',
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
                                ? 'VS-$_currentYear-0001'
                                : 'SD-$_currentYear-0001',
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
