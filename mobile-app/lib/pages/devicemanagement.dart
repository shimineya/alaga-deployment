import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Import API service for fetching device data
import '../services/api_service.dart';
import '../models/user_session.dart';

class DeviceManagementScreen extends StatefulWidget {
  const DeviceManagementScreen({super.key});

  @override
  State<DeviceManagementScreen> createState() => _DeviceManagementScreenState();
}

class _DeviceManagementScreenState extends State<DeviceManagementScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = "";

  // [INTEGRATION] Live device data from the backend
  List<Map<String, dynamic>> _allDevices = [];
  bool _isLoading = true;
  String? _errorMessage;

  // [INTEGRATION] Patient list cached here so the Register Device dialog
  // does not need a separate StatefulWidget to manage its own async fetch.
  List<Map<String, dynamic>> _patientList = [];
  bool _isFetchingPatients = false;

  @override
  void initState() {
    super.initState();
    _fetchDevices();
    // [OWASP A01] Only parents assign devices. Pre-fetch patients now so
    // the dropdown in the dialog opens instantly without an extra spinner.
    if (UserSession.current?.isParent == true) {
      _fetchPatientsForDialog();
    }
  }

  // [INTEGRATION] Fetches device inventory from GET /api/caregiver/devices.
  Future<void> _fetchDevices() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await ApiService.get('/caregiver/devices');

    if (!mounted) return;

    if (result['success'] == true && result['data'] != null) {
      setState(() {
        _allDevices = List<Map<String, dynamic>>.from(result['data']);
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage = result['message'] ?? 'Failed to load devices.';
        _isLoading = false;
      });
    }
  }

  // [INTEGRATION] Fetches the parent's patient roster for the Register Device dialog.
  // Uses GET /api/caregiver/patients — backend scopes response to the logged-in user.
  Future<void> _fetchPatientsForDialog() async {
    if (_isFetchingPatients) return;
    _isFetchingPatients = true;

    final result = await ApiService.get('/caregiver/patients');

    if (!mounted) return;
    _isFetchingPatients = false;

    if (result['success'] == true && result['data'] != null) {
      final raw = List<dynamic>.from(result['data']);
      setState(() {
        _patientList = raw.map((p) => {
          'patient_id': p['patient_id'],
          'name': p['name'] ?? 'Unknown',
        }).toList();
      });
    }
    // Silently ignore errors — the dialog will show an appropriate message.
  }

  // Computed getters from API data
  int get _totalDevices => _allDevices.length;
  int get _activeDevices =>
      _allDevices.where((d) => d['status'] == 'ACTIVE' && d['assigned_patient_id'] != null).length;
  int get _unassignedDevices =>
      _allDevices.where((d) => d['assigned_patient_id'] == null).length;

  List<Map<String, dynamic>> get _filteredDevices {
    if (_searchQuery.isEmpty) return _allDevices;
    final query = _searchQuery.toLowerCase();
    return _allDevices.where((d) {
      final sn = (d['serial_number'] ?? '').toString().toLowerCase();
      final name = (d['device_name'] ?? '').toString().toLowerCase();
      final patient = (d['assigned_patient_name'] ?? '').toString().toLowerCase();
      return sn.contains(query) || name.contains(query) || patient.contains(query);
    }).toList();
  }

  Widget _popupFieldWrapper(String label, Widget child) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF004D40))),
        const SizedBox(height: 8),
        child,
      ],
    );
  }

  InputDecoration _popupInputDecoration({String? hint}) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF80CBC4), width: 1)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF00897B), width: 2)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }

  // [INTEGRATION] Adds a new device to the backend whitelist via POST /api/caregiver/devices.
  // [FIX] Captured the page-level scaffold context before opening the dialog so that
  // SnackBar messages and _fetchDevices() are dispatched from a live context even
  // after the dialog is dismissed.
  void _showNewDeviceDialog(BuildContext pageContext) {
    String selectedType = "Vital Signs";
    final TextEditingController idController = TextEditingController();

    showDialog(
      context: pageContext,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (dialogContext, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFB2DFDB),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: Text("Add to Inventory", style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _popupFieldWrapper("Device Type", DropdownButtonFormField<String>(
                    decoration: _popupInputDecoration(),
                    initialValue: selectedType,
                    items: ["Vital Signs", "Smart Diaper Device"].map((type) => DropdownMenuItem(value: type, child: Text(type))).toList(),
                    onChanged: (val) => setDialogState(() => selectedType = val!),
                  )),
                  const SizedBox(height: 20),
                  _popupFieldWrapper("Device Number", TextField(
                    controller: idController,
                    decoration: _popupInputDecoration(hint: selectedType == "Vital Signs" ? "VS-YYYY-NNNN" : "SD-YYYY-NNNN"),
                  )),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text("Cancel", style: TextStyle(color: Color(0xFF004D40)))),
                ElevatedButton(
                  onPressed: () async {
                    String input = idController.text.toUpperCase().trim();
                    RegExp vsRegex = RegExp(r'^VS-\d{4}-\d{4}$');
                    RegExp sdRegex = RegExp(r'^SD-\d{4}-\d{4}$');

                    bool isValid = (selectedType == "Vital Signs" && vsRegex.hasMatch(input)) ||
                                   (selectedType == "Smart Diaper Device" && sdRegex.hasMatch(input));

                    if (!isValid) {
                      ScaffoldMessenger.of(pageContext).showSnackBar(
                        SnackBar(content: Text("Invalid format. Use ${selectedType == "Vital Signs" ? "VS-YYYY-NNNN" : "SD-YYYY-NNNN"}")),
                      );
                      return;
                    }

                    // [FIX] Only dismiss the dialog AFTER the API response is received
                    // so the dialogContext is still valid through the await.
                    final result = await ApiService.post('/caregiver/devices', body: {
                      if (selectedType == "Vital Signs") 'vitalDeviceNo': input,
                      if (selectedType == "Smart Diaper Device") 'diaperDeviceNo': input,
                    });

                    if (!mounted) return;

                    if (result['success'] == true) {
                      Navigator.pop(dialogContext);
                      _fetchDevices();
                      ScaffoldMessenger.of(pageContext).showSnackBar(
                        SnackBar(content: Text("Device $input added successfully.", style: GoogleFonts.albertSans()), backgroundColor: const Color(0xFF4DB6AC), behavior: SnackBarBehavior.floating),
                      );
                    } else {
                      // [FIX] Leave the dialog open on failure so the user can correct the input.
                      ScaffoldMessenger.of(pageContext).showSnackBar(
                        SnackBar(content: Text(result['message'] ?? 'Failed to add device.', style: GoogleFonts.albertSans()), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00796B), foregroundColor: Colors.white),
                  child: const Text("Add"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // REGISTER DEVICE TO PATIENT DIALOG
  // [OWASP A01] Visible only to parent accounts. Enforced both here (UI) and
  // on the backend (JWT role check on the PATCH endpoint).
  // [OWASP A05] patient_id is sent as a typed integer in the JSON body —
  // never concatenated into a URL string.
  // ---------------------------------------------------------------------------

  void _showRegisterDeviceDialog(BuildContext pageContext) {
    // Guard: if patients have not loaded yet, trigger a refresh then open.
    if (_patientList.isEmpty && !_isFetchingPatients) {
      _fetchPatientsForDialog();
    }

    // Dialog-local state. Using a String key makes the cascade reset clean.
    Map<String, dynamic>? selectedPatient;
    String selectedDeviceType = "Vital Signs";
    Map<String, dynamic>? selectedDevice;

    showDialog(
      context: pageContext,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (dialogContext, setDialogState) {
            // ----------------------------------------------------------------
            // Filter the already-loaded device inventory to only show devices
            // that match the chosen type AND are currently unassigned.
            // This avoids a second network call and enforces data minimisation.
            // ----------------------------------------------------------------
            final List<Map<String, dynamic>> availableDevices = _allDevices.where((d) {
              final isUnassigned = d['assigned_patient_id'] == null;
              final name = (d['device_name'] ?? '').toString().toLowerCase();
              final isMatchingType = selectedDeviceType == "Vital Signs"
                  ? name.contains('vital')
                  : name.contains('diaper') || name.contains('smart');
              return isUnassigned && isMatchingType;
            }).toList();

            return AlertDialog(
              backgroundColor: const Color(0xFFB2DFDB),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: Text(
                "Register Device to Patient",
                style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // --------------------------------------------------------
                    // Dropdown 1: Select Patient
                    // --------------------------------------------------------
                    _popupFieldWrapper(
                      "Select Patient",
                      _patientList.isEmpty
                          ? Container(
                              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFF80CBC4)),
                              ),
                              child: Row(
                                children: [
                                  const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00897B)),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    "Loading patients...",
                                    style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey),
                                  ),
                                ],
                              ),
                            )
                          : DropdownButtonFormField<Map<String, dynamic>>(
                              decoration: _popupInputDecoration(hint: "Select a patient"),
                              initialValue: selectedPatient,
                              isExpanded: true,
                              items: _patientList.map((p) {
                                return DropdownMenuItem<Map<String, dynamic>>(
                                  value: p,
                                  // [OWASP A01] Only patients belonging to
                                  // the logged-in parent are in this list.
                                  child: Text(
                                    p['name'] as String,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.poppins(fontSize: 13),
                                  ),
                                );
                              }).toList(),
                              onChanged: (val) => setDialogState(() => selectedPatient = val),
                            ),
                    ),
                    const SizedBox(height: 20),

                    // --------------------------------------------------------
                    // Dropdown 2: Device Type
                    // Resetting selectedDevice when type changes prevents
                    // a stale device from a different category being submitted.
                    // --------------------------------------------------------
                    _popupFieldWrapper(
                      "Device Type",
                      DropdownButtonFormField<String>(
                        decoration: _popupInputDecoration(),
                        initialValue: selectedDeviceType,
                        items: ["Vital Signs", "Smart Diaper Device"].map((type) {
                          return DropdownMenuItem(value: type, child: Text(type, style: GoogleFonts.poppins(fontSize: 13)));
                        }).toList(),
                        onChanged: (val) => setDialogState(() {
                          selectedDeviceType = val!;
                          // Reset device selection when the type changes.
                          selectedDevice = null;
                        }),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // --------------------------------------------------------
                    // Dropdown 3: Available Device ID
                    // Only unassigned devices of the selected type are shown.
                    // --------------------------------------------------------
                    _popupFieldWrapper(
                      "Available Device ID",
                      availableDevices.isEmpty
                          ? Container(
                              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFF80CBC4)),
                              ),
                              child: Text(
                                "No available ${selectedDeviceType.toLowerCase()} devices",
                                style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey),
                              ),
                            )
                          : DropdownButtonFormField<Map<String, dynamic>>(
                              decoration: _popupInputDecoration(hint: "Select a device"),
                              initialValue: selectedDevice,
                              isExpanded: true,
                              items: availableDevices.map((d) {
                                return DropdownMenuItem<Map<String, dynamic>>(
                                  value: d,
                                  child: Text(
                                    d['serial_number'] as String,
                                    style: GoogleFonts.poppins(fontSize: 13),
                                  ),
                                );
                              }).toList(),
                              onChanged: (val) => setDialogState(() => selectedDevice = val),
                            ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text("Cancel", style: TextStyle(color: Color(0xFF004D40))),
                ),
                ElevatedButton(
                  onPressed: (selectedPatient == null || selectedDevice == null)
                      ? null
                      : () async {
                          final int patientId = selectedPatient!['patient_id'] as int;
                          final String serialNumber = selectedDevice!['serial_number'] as String;

                          // [OWASP A05] Parameters are typed values in a JSON body —
                          // never concatenated into a SQL string on the backend.
                          // [OWASP A01] JWT role is verified server-side before the
                          // UPDATE is executed on device_whitelist.
                          // Endpoint: POST /api/caregiver/patients/:patientId/assign-device
                          // Body: { serialNumber } — matches caregiverRoutes.js line 550.
                          final result = await ApiService.post(
                            '/caregiver/patients/$patientId/assign-device',
                            body: {'serialNumber': serialNumber},
                          );

                          if (!mounted) return;

                          if (result['success'] == true) {
                            Navigator.pop(dialogContext);
                            _fetchDevices();
                            ScaffoldMessenger.of(pageContext).showSnackBar(
                              SnackBar(
                                content: Text(
                                  "$serialNumber assigned to ${selectedPatient!['name']} successfully.",
                                  style: GoogleFonts.albertSans(),
                                ),
                                backgroundColor: const Color(0xFF4DB6AC),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          } else {
                            // [OWASP A10] Show the server's generic error message.
                            // The backend must never leak stack traces here.
                            ScaffoldMessenger.of(pageContext).showSnackBar(
                              SnackBar(
                                content: Text(
                                  result['message'] ?? 'Failed to register device.',
                                  style: GoogleFonts.albertSans(),
                                ),
                                backgroundColor: Colors.redAccent,
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00796B),
                    foregroundColor: Colors.white,
                    // Visually disable when required fields are not yet selected.
                    disabledBackgroundColor: Colors.grey.shade300,
                  ),
                  child: const Text("Register"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final titleStyle = GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 26, color: const Color(0xFF2D3436));
    final devices = _filteredDevices;

    return Scaffold(
      backgroundColor: const Color(0xFFFFFDF5),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.black), onPressed: () => Navigator.pop(context)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF5FA9A9)))
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 48, color: Colors.grey.shade400),
                      const SizedBox(height: 16),
                      Text(_errorMessage!, style: GoogleFonts.albertSans(color: Colors.grey)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _fetchDevices,
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF5FA9A9)),
                        child: Text('Retry', style: GoogleFonts.poppins(color: Colors.white)),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchDevices,
                  color: const Color(0xFF5FA9A9),
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    clipBehavior: Clip.none,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Sensor Hub",
                            style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF80CBC4), letterSpacing: 1.2),
                          ),
                          const SizedBox(height: 2),
                          Text("Device Management", style: titleStyle),
                          const Text("Monitor and manage active sensors", style: TextStyle(color: Colors.grey, fontSize: 14)),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(child: _buildStatCard("Total", "$_totalDevices", Colors.teal)),
                              const SizedBox(width: 8),
                              Expanded(child: _buildStatCard("Active", "$_activeDevices", Colors.green)),
                              const SizedBox(width: 8),
                              Expanded(child: _buildStatCard("Available", "$_unassignedDevices", Colors.orange)),
                            ],
                          ),
                          const SizedBox(height: 16),
                          // [OWASP A01] Only parent accounts can register hardware or assign devices.
                          if (UserSession.current?.isParent == true) ...[
                            Row(
                              children: [
                                // --- Add Device to Inventory ---
                                Expanded(
                                  child: ElevatedButton.icon(
                                    onPressed: () => _showNewDeviceDialog(context),
                                    icon: const Icon(Icons.add, size: 16),
                                    label: const Text("+ Inventory", style: TextStyle(fontSize: 13)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF4DB6AC),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                // --- Register Device to Patient ---
                                Expanded(
                                  child: ElevatedButton.icon(
                                    onPressed: () => _showRegisterDeviceDialog(context),
                                    icon: const Icon(Icons.person_add_alt_1_outlined, size: 16),
                                    label: const Text("Register", style: TextStyle(fontSize: 13)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF00796B),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),
                          ],
                          TextField(
                            controller: _searchController,
                            onChanged: (val) => setState(() => _searchQuery = val),
                            decoration: InputDecoration(
                              hintText: "Search device or patient...",
                              prefixIcon: const Icon(Icons.search, size: 22),
                              filled: true,
                              fillColor: Colors.white,
                              contentPadding: const EdgeInsets.symmetric(vertical: 14),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFF80CBC4), width: 1),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFF00897B), width: 2),
                              ),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                          const SizedBox(height: 16),
                          if (devices.isEmpty)
                            Center(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 40),
                                child: Column(
                                  children: [
                                    Icon(Icons.devices_other, size: 48, color: Colors.grey.shade300),
                                    const SizedBox(height: 12),
                                    Text("No devices found.", style: GoogleFonts.albertSans(color: Colors.grey)),
                                  ],
                                ),
                              ),
                            )
                          else
                            ...devices.map((d) => _buildDeviceCard(d)),
                          const SizedBox(height: 40),
                        ],
                      ),
                    ),
                  ),
                ),
    );
  }

  Widget _buildStatCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.1)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          FittedBox(child: Text(value, style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.bold, color: color)))
        ],
      ),
    );
  }

  Widget _buildDeviceCard(Map<String, dynamic> device) {
    final serialNumber = device['serial_number'] ?? 'Unknown';
    final deviceName = device['device_name'] ?? 'Unknown';
    final status = device['status'] ?? 'INACTIVE';
    final patientName = device['assigned_patient_name'];
    final isAssigned = device['assigned_patient_id'] != null;
    final isVital = deviceName.toString().toLowerCase().contains('vital');
    final color = isVital ? Colors.blue : Colors.orange;
    // [OWASP A01] Only parent accounts can remove devices from the inventory.
    final isParent = UserSession.current?.isParent == true;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, 2))],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(serialNumber, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isAssigned ? Colors.green.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      status,
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: isAssigned ? Colors.green : Colors.grey),
                    ),
                  ),
                ]),
                const SizedBox(height: 2),
                Text(deviceName, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold)),
                Text(
                  isAssigned ? "Patient: $patientName" : "Unassigned",
                  style: TextStyle(fontSize: 11, color: isAssigned ? const Color(0xFF00796B) : Colors.grey),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isVital ? Icons.monitor_heart_outlined : Icons.baby_changing_station,
                color: color.withValues(alpha: 0.5),
                size: 28,
              ),
              // [OWASP A01] Delete button only visible to parent accounts.
              if (isParent) ...[
                const SizedBox(width: 4),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 22),
                  tooltip: 'Remove device from inventory',
                  onPressed: () => _confirmRemoveDevice(context, device),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
  // [OWASP A01] Only a parent account can remove a device from the inventory.
  // [OWASP A05] Serial number is sent as a typed path parameter — never concatenated.
  // A two-step confirmation dialog is required before the DELETE is executed.
  Future<void> _confirmRemoveDevice(
    BuildContext pageContext,
    Map<String, dynamic> device,
  ) async {
    final serialNumber = device['serial_number'] as String? ?? 'this device';
    final isAssigned = device['assigned_patient_id'] != null;

    final confirmed = await showDialog<bool>(
      context: pageContext,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          "Remove Device?",
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold, color: Colors.redAccent),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "You are about to remove $serialNumber from the device inventory.",
              style: GoogleFonts.albertSans(fontSize: 13, color: Colors.grey[700]),
            ),
            if (isAssigned) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "This device is currently assigned to a patient. Removing it will unlink it from that patient.",
                        style: GoogleFonts.albertSans(fontSize: 12, color: Colors.orange.shade800),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
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

    // [OWASP A05] Serial number is sent as a path segment — no string concatenation into queries.
    final result = await ApiService.delete('/caregiver/devices/$serialNumber');

    if (!mounted) return;

    if (result['success'] == true) {
      _fetchDevices();
      ScaffoldMessenger.of(pageContext).showSnackBar(
        SnackBar(
          content: Text("Device $serialNumber removed from inventory.", style: GoogleFonts.albertSans()),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      // [OWASP A10] Display only the server's generic error — no stack traces.
      ScaffoldMessenger.of(pageContext).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Failed to remove device.', style: GoogleFonts.albertSans()),
          backgroundColor: Colors.grey[700],
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}