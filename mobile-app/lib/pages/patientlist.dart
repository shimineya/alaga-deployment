import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class PatientListScreen extends StatefulWidget {
  const PatientListScreen({super.key});

  @override
  State<PatientListScreen> createState() => _PatientListScreenState();
}

class _PatientListScreenState extends State<PatientListScreen> {
  String selectedFilter = "All Patients";

  // 1. Updated Sample Data to include wetness
  final List<Map<String, dynamic>> allPatients = [
    {"name": "First Patient", "id": "ID: 1", "room": "Room Home", "status": "Stable", "hr": "75", "temp": "37.2", "spo2": "98", "wetness": "Dry"},
    {"name": "Fourth Patient", "id": "ID: 2", "room": "Room Home", "status": "Stable", "hr": "78", "temp": "37.3", "spo2": "97", "wetness": "Wet"},
    {"name": "Juan Cruz", "id": "ID: 3", "room": "Room Home", "status": "Stable", "hr": "72", "temp": "36.9", "spo2": "99", "wetness": "Dry"},
    {"name": "Dad Dada", "id": "ID: 5", "room": "Room Home", "status": "Offline", "hr": "---", "temp": "---", "spo2": "---", "wetness": "Unknown"},
  ];

  @override
  Widget build(BuildContext context) {
    final mainTextStyle = GoogleFonts.poppins(fontWeight: FontWeight.bold, color: const Color(0xFF2D3436));
    final descriptionStyle = GoogleFonts.albertSans(color: Colors.grey, fontSize: 13);

    final filteredPatients = selectedFilter == "Active Monitoring"
        ? allPatients.where((p) => p['status'] == "Stable").toList()
        : allPatients;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFB),
      appBar: AppBar(
        title: Text("Patient List", style: mainTextStyle.copyWith(fontSize: 20)),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: const BackButton(color: Colors.black),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Text("Manage and monitor all assigned patients", style: descriptionStyle),
          ),
          
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                _buildFilterChip("All Patients", mainTextStyle),
                const SizedBox(width: 8),
                _buildFilterChip("Active Monitoring", mainTextStyle),
              ],
            ),
          ),

          Expanded(
            child: filteredPatients.isEmpty
                ? _buildEmptyState(descriptionStyle)
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredPatients.length,
                    itemBuilder: (context, index) {
                      return _buildPatientCard(filteredPatients[index], mainTextStyle, descriptionStyle);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  // 2. Updated Card Logic: Highlights Wet status automatically
  Widget _buildPatientCard(Map<String, dynamic> patient, TextStyle main, TextStyle desc) {
    bool isOffline = patient["status"] == "Offline";
    bool isWet = patient["wetness"] == "Wet";

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        // Adds an orange border if moisture is detected
        side: BorderSide(color: isWet ? Colors.orange : Colors.grey.shade200, width: isWet ? 1.5 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(patient["name"], style: main.copyWith(fontSize: 15)),
                    Text("${patient["id"]} • ${patient["room"]}", style: desc.copyWith(fontSize: 11)),
                  ],
                ),
                // Combined Status/Wetness Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isWet ? Colors.orange.shade100 : (isOffline ? Colors.grey.shade100 : const Color(0xFFE8F5E9)),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isWet) ...[
                        const Icon(Icons.opacity, size: 12, color: Colors.orange),
                        const SizedBox(width: 4),
                      ],
                      Text(
                        isWet ? "WET" : patient["status"],
                        style: desc.copyWith(
                          fontSize: 11, 
                          fontWeight: FontWeight.bold, 
                          color: isWet ? Colors.orange.shade900 : (isOffline ? Colors.grey : Colors.green.shade700)
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildVital(Icons.favorite, "HR", patient["hr"], Colors.redAccent, desc, main),
                _buildVital(Icons.thermostat, "TEMP", patient["temp"] == "---" ? "---" : "${patient["temp"]}°C", Colors.orange, desc, main),
                _buildVital(Icons.water_drop, "SPO2", patient["spo2"] == "---" ? "---" : "${patient["spo2"]}%", Colors.blue, desc, main),
                const Icon(Icons.visibility_outlined, color: Colors.grey, size: 22),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // --- UI Helpers ---
  Widget _buildFilterChip(String label, TextStyle style) {
    bool isSelected = selectedFilter == label;
    return GestureDetector(
      onTap: () => setState(() => selectedFilter = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF4DB6AC) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? const Color(0xFF4DB6AC) : Colors.grey.shade300),
        ),
        child: Text(label, style: style.copyWith(fontSize: 12, color: isSelected ? Colors.white : Colors.grey)),
      ),
    );
  }

  Widget _buildVital(IconData icon, String label, String value, Color color, TextStyle desc, TextStyle main) {
    return Column(
      children: [
        Row(children: [Icon(icon, size: 12, color: color), const SizedBox(width: 4), Text(label, style: desc.copyWith(fontSize: 10, fontWeight: FontWeight.bold))]),
        const SizedBox(height: 4),
        Text(value, style: main.copyWith(fontSize: 13)),
      ],
    );
  }

  Widget _buildEmptyState(TextStyle style) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.person_search_outlined, size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text("No patients found with this status.", style: style),
        ],
      ),
    );
  }
}