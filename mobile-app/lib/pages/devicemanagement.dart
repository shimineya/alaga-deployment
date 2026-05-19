import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Import API service for fetching device data
import '../services/api_service.dart';

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

  @override
  void initState() {
    super.initState();
    _fetchDevices();
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
  void _showNewDeviceDialog(BuildContext context) {
    String selectedType = "Vital Signs";
    final TextEditingController idController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFB2DFDB),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: Text("Add to Inventory", style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _popupFieldWrapper("Device Type", DropdownButtonFormField<String>(
                    decoration: _popupInputDecoration(),
                    items: ["Vital Signs", "Smart Diaper Device"].map((type) => DropdownMenuItem(value: type, child: Text(type))).toList(),
                    onChanged: (val) => setDialogState(() => selectedType = val!),
                  )),
                  const SizedBox(height: 20),
                  _popupFieldWrapper("Device Number", TextField(
                    controller: idController,
                    decoration: _popupInputDecoration(hint: selectedType == "Vital Signs" ? "VS-YYYY-NNN" : "SD-YYYY-NNN"),
                  )),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel", style: TextStyle(color: Color(0xFF004D40)))),
                ElevatedButton(
                  onPressed: () async {
                    String input = idController.text.toUpperCase().trim();
                    RegExp vsRegex = RegExp(r'^VS-\d{4}-\d{3}$');
                    RegExp sdRegex = RegExp(r'^SD-\d{4}-\d{3}$');

                    bool isValid = (selectedType == "Vital Signs" && vsRegex.hasMatch(input)) ||
                                   (selectedType == "Smart Diaper Device" && sdRegex.hasMatch(input));

                    if (isValid) {
                      Navigator.pop(context);

                      final result = await ApiService.post('/caregiver/devices', body: {
                        if (selectedType == "Vital Signs") 'vitalDeviceNo': input,
                        if (selectedType == "Smart Diaper Device") 'diaperDeviceNo': input,
                      });

                      if (!mounted) return;

                      if (result['success'] == true) {
                        _fetchDevices(); // Refresh the list
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text("Device $input added successfully.", style: GoogleFonts.albertSans()), backgroundColor: const Color(0xFF4DB6AC), behavior: SnackBarBehavior.floating),
                        );
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(result['message'] ?? 'Failed to add device.', style: GoogleFonts.albertSans()), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating),
                        );
                      }
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text("Invalid format. Use ${selectedType == "Vital Signs" ? "VS-YYYY-NNN" : "SD-YYYY-NNN"}")),
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
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () => _showNewDeviceDialog(context),
                              icon: const Icon(Icons.add, size: 18),
                              label: const Text("Add Device to Inventory", style: TextStyle(fontSize: 14)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF4DB6AC),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
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
          Icon(
            isVital ? Icons.monitor_heart_outlined : Icons.baby_changing_station,
            color: color.withValues(alpha: 0.5),
            size: 28,
          ),
        ],
      ),
    );
  }
}