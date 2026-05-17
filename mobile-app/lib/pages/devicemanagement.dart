import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

class DeviceManagementScreen extends StatefulWidget {
  const DeviceManagementScreen({super.key});

  @override
  State<DeviceManagementScreen> createState() => _DeviceManagementScreenState();
}

class _DeviceManagementScreenState extends State<DeviceManagementScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = "";

  final List<String> availableVitalsSensors = [];
  final List<String> availableMoistureSensors = [];

  final List<Map<String, dynamic>> patientDevices = [];

  @override
  void initState() {
    super.initState();
    _loadDevices();
  }

  Future<void> _loadDevices() async {
    final inventoryRes = await ApiService.get('/caregiver/devices');
    final patientsRes = await ApiService.get('/caregiver/patients');

    if (!mounted) return;
    if (inventoryRes['success'] == true && inventoryRes['data'] is List) {
      availableVitalsSensors.clear();
      availableMoistureSensors.clear();
      for (final row in (inventoryRes['data'] as List)) {
        final device = row as Map<String, dynamic>;
        final serial = device['serial_number']?.toString() ?? '';
        final name = (device['device_name']?.toString() ?? '').toLowerCase();
        final assigned = device['assigned_patient_id'];
        if (assigned == null) {
          if (name.contains('vital')) {
            availableVitalsSensors.add(serial);
          } else {
            availableMoistureSensors.add(serial);
          }
        }
      }
    }

    if (patientsRes['success'] == true && patientsRes['data'] is List) {
      patientDevices.clear();
      for (final row in (patientsRes['data'] as List)) {
        final patient = row as Map<String, dynamic>;
        patientDevices.add({
          "name": patient['name'] ?? 'Unknown',
          "vsId": patient['vital_device_sn'] ?? 'N/A',
          "msId": patient['diaper_device_sn'] ?? 'N/A',
          "isWet": false,
          "vsBat": 0,
          "msBat": 0,
          "status": (patient['vital_device_sn'] == null && patient['diaper_device_sn'] == null) ? "Offline" : "Active",
        });
      }
    }
    setState(() {});
  }

  // --- Logic for Stats ---
  int get _totalDevices => (patientDevices.length * 2) + availableVitalsSensors.length + availableMoistureSensors.length;
  int get _activeDevices => patientDevices.where((p) => p['status'] == "Active").length * 2;
  int get _maintenanceDevices => patientDevices.where((p) => p['vsBat'] < 20 || p['msBat'] < 20).length;

  // --- NEW: POP-UP FORM LOGIC ---
  void _showNewDeviceDialog(BuildContext context) {
    String selectedType = "Vital Signs";
    final TextEditingController _idController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: Text("Register New Device", style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    value: selectedType,
                    decoration: const InputDecoration(labelText: "Device Type", border: OutlineInputBorder()),
                    items: ["Vital Signs", "Smart Diaper"].map((type) {
                      return DropdownMenuItem(value: type, child: Text(type));
                    }).toList(),
                    onChanged: (val) => setDialogState(() => selectedType = val!),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _idController,
                    decoration: InputDecoration(
                      labelText: "Device Number",
                      hintText: selectedType == "Vital Signs" ? "VS-YYYY-NNN" : "SD-YYYY-NNN",
                      border: const OutlineInputBorder(),
                      helperText: "Format: ${selectedType == "Vital Signs" ? 'VS-2026-001' : 'SD-2026-001'}",
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
                ElevatedButton(
                  onPressed: () {
                    if (_idController.text.isNotEmpty) {
                      setState(() {
                        if (selectedType == "Vital Signs") {
                          availableVitalsSensors.add(_idController.text.toUpperCase());
                        } else {
                          availableMoistureSensors.add(_idController.text.toUpperCase());
                        }
                      });
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Device added to inventory.")));
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF4DB6AC), foregroundColor: Colors.white),
                  child: const Text("Register"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _removeDeviceFromInventory(String id, bool isVital) {
    setState(() {
      if (isVital) {
        availableVitalsSensors.remove(id);
      } else {
        availableMoistureSensors.remove(id);
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Device $id removed from inventory.")));
  }

  void _calibrateDevice(String id) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text("Calibrating device $id... Sensor recalibration in progress.")),
    );
  }

  void _showSwapDeviceDialog(BuildContext context, String currentId, String sensorType) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text("Swap $sensorType", style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 18)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Current Unit: $currentId", style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(height: 16),
              const Text("Select replacement unit:", style: TextStyle(fontSize: 13, color: Colors.grey)),
              const SizedBox(height: 8),
              ... (sensorType == "Vital Signs" ? availableVitalsSensors : availableMoistureSensors).map((newId) {
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.swap_horiz, color: Color(0xFF4DB6AC)),
                  title: Text(newId, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                  trailing: const Icon(Icons.add_circle_outline, color: Color(0xFF4DB6AC), size: 20),
                  onTap: () {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text("Hardware updated: $newId is now active.")),
                    );
                  },
                );
              }).toList(),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          ],
        );
      },
    );
  }

  void _showCategorizedLogs(BuildContext context, String patientName, String sensorType) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        builder: (context, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 30, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(10)))),
              const SizedBox(height: 15),
              Text("Logs: $sensorType", style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 18)),
              Text("Patient: $patientName", style: const TextStyle(color: Colors.grey, fontSize: 12)),
              const Divider(height: 30),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  children: sensorType == "Vital Signs" 
                    ? [_logItem("18:30:04", "Heart Rate: 78 BPM", "VITAL SIGNS", Colors.blue), _logItem("18:25:12", "SpO2: 99%", "VITAL SIGNS", Colors.blue)]
                    : [_logItem("18:45:00", "Moisture Level: 10% (Normal)", "MOISTURE SENSOR", Colors.orange)],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final titleStyle = GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 26, color: const Color(0xFF2D3436));
    final filteredPatients = patientDevices.where((p) => p['name'].toLowerCase().contains(_searchQuery.toLowerCase())).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFB),
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0, leading: const BackButton(color: Colors.black)),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Device Management", style: titleStyle),
                  const Text("Assign, monitor, and swap patient sensors", style: TextStyle(color: Colors.grey, fontSize: 14)),
                  const SizedBox(height: 20),

                  Row(
                    children: [
                      _buildStatCard("Total", "$_totalDevices", Colors.teal),
                      const SizedBox(width: 10),
                      _buildStatCard("Active", "$_activeDevices", Colors.green),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _buildStatCard("Maint.", "$_maintenanceDevices", Colors.orange),
                      const SizedBox(width: 10),
                      _buildStatCard("Offline", "2", Colors.red),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // 2. NEW DEVICE BUTTON (UPDATED TO POP-UP)
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () => _showNewDeviceDialog(context), 
                      icon: const Icon(Icons.add_to_queue),
                      label: const Text("Register New Device"),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4DB6AC),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  TextField(
                    controller: _searchController,
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: "Search patient name...",
                      prefixIcon: const Icon(Icons.search, color: Colors.grey, size: 20),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 24),

                  Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      initiallyExpanded: true,
                      title: Text("Patients & Their Devices", style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
                      children: filteredPatients.map((p) => _buildUnifiedPatientCard(p)).toList(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  ExpansionTile(
                    title: Text("Device List (Inventory)", style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
                    children: [
                      ...availableVitalsSensors.map((id) => _buildInventoryCard(id, "Vital Signs", Colors.blue)),
                      ...availableMoistureSensors.map((id) => _buildInventoryCard(id, "Moisture Sensor", Colors.orange)),
                    ],
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- Utility Builder Widgets ---
  Widget _buildStatCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: color.withOpacity(0.1))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
            Text(value, style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _buildInventoryCard(String id, String type, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(id, style: const TextStyle(fontWeight: FontWeight.bold)),
              Text(type, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.bold)),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.delete_sweep_outlined, color: Colors.redAccent, size: 20),
            onPressed: () => _removeDeviceFromInventory(id, type == "Vital Signs"),
          )
        ],
      ),
    );
  }

  Widget _buildUnifiedPatientCard(Map<String, dynamic> patient) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 15)]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.person_pin_outlined, color: Color(0xFF4DB6AC), size: 22),
            const SizedBox(width: 8),
            Text(patient['name'], style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 18)),
          ]),
          const SizedBox(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _sensorColumn("Vital Signs", patient['vsId'], Colors.blue, patient['vsBat'], patient['name'])),
              const SizedBox(width: 16),
              Expanded(child: _sensorColumn("Moisture Sensor", patient['msId'], Colors.orange, patient['msBat'], patient['name'], isAlert: patient['isWet'])),
            ],
          ),
        ],
      ),
    );
  }

  Widget _sensorColumn(String title, String id, Color color, int battery, String patientName, {bool isAlert = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title.toUpperCase(), style: GoogleFonts.poppins(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 4),
        Text(id, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const Text("Status: Active", style: TextStyle(fontSize: 9, color: Colors.grey)),
        const SizedBox(height: 8),
        Row(children: [
          Icon(Icons.battery_4_bar, size: 12, color: battery < 20 ? Colors.red : Colors.green),
          const SizedBox(width: 4),
          Text("$battery%", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: battery < 20 ? Colors.red : Colors.green)),
        ]),
        const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Divider()),
        _actionButton("View Logs", color, () => _showCategorizedLogs(context, patientName, title), outlined: true),
        const SizedBox(height: 6),
        _actionButton("Swap Device", Colors.redAccent, () => _showSwapDeviceDialog(context, id, title)),
        const SizedBox(height: 6),
        _actionButton("Calibrate", color, () => _calibrateDevice(id)),
      ],
    );
  }

  Widget _actionButton(String label, Color color, VoidCallback onTap, {bool outlined = false}) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          backgroundColor: outlined ? Colors.transparent : color.withOpacity(0.05),
          side: BorderSide(color: color.withOpacity(0.2)),
          padding: const EdgeInsets.symmetric(vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          foregroundColor: color,
        ),
        child: Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _logItem(String time, String message, String tag, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(time, style: const TextStyle(fontSize: 10, color: Colors.grey)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tag, style: TextStyle(color: color, fontSize: 8, fontWeight: FontWeight.bold)),
            Text(message, style: const TextStyle(fontSize: 12)),
          ])),
        ],
      ),
    );
  }
}