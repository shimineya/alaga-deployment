import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

class PatientListScreen extends StatefulWidget {
  const PatientListScreen({super.key});

  @override
  State<PatientListScreen> createState() => _PatientListScreenState();
}

class _PatientListScreenState extends State<PatientListScreen> {
  String selectedFilter = "All Patients";
  String searchQuery = ""; 
  final TextEditingController _searchController = TextEditingController();
  bool _isLoading = true;

  List<Map<String, dynamic>> allPatients = [];

  @override
  void initState() {
    super.initState();
    _loadPatients();
  }

  Future<void> _loadPatients() async {
    setState(() => _isLoading = true);
    final result = await ApiService.get('/caregiver/patients');
    if (!mounted) return;
    if (result['success'] == true && result['data'] is List) {
      final rows = (result['data'] as List)
          .map((row) => row as Map<String, dynamic>)
          .map((row) {
        final isOffline = row['vital_device_sn'] == null && row['diaper_device_sn'] == null;
        return {
          "name": row["name"] ?? "Unknown",
          "id": "ID: ${row["patient_id"]}",
          "room": "Room N/A",
          "status": isOffline ? "Offline" : "Stable",
          "hr": "---",
          "temp": "---",
          "spo2": "---",
          "wetness": "Unknown",
          "vs_id": row["vital_device_sn"] ?? "N/A",
          "sd_id": row["diaper_device_sn"] ?? "N/A",
        };
      }).toList();
      setState(() {
        allPatients = rows;
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message']?.toString() ?? 'Failed to load patients')),
      );
    }
    setState(() => _isLoading = false);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mainTextStyle = GoogleFonts.poppins(fontWeight: FontWeight.bold, color: const Color(0xFF2D3436));
    final descriptionStyle = GoogleFonts.albertSans(color: Colors.grey, fontSize: 13);

    final filteredPatients = allPatients.where((p) {
      bool matchesFilter = selectedFilter == "All Patients" || p['status'] == "Stable";
      String query = searchQuery.toLowerCase();
      bool matchesSearch = p['name'].toLowerCase().contains(query) ||
                           p['room'].toLowerCase().contains(query) ||
                           p['vs_id'].toLowerCase().contains(query) ||
                           p['sd_id'].toLowerCase().contains(query);
      return matchesFilter && matchesSearch;
    }).toList();

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
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => searchQuery = value),
                decoration: InputDecoration(
                  hintText: "Search patient, room, or device ID...",
                  hintStyle: descriptionStyle.copyWith(color: Colors.grey.shade400),
                  prefixIcon: const Icon(Icons.search, color: Color(0xFF4DB6AC), size: 20),
                  suffixIcon: searchQuery.isNotEmpty 
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18), 
                        onPressed: () {
                          _searchController.clear();
                          setState(() => searchQuery = "");
                        }) 
                    : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ),
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
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : filteredPatients.isEmpty
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

  Widget _buildPatientCard(Map<String, dynamic> patient, TextStyle main, TextStyle desc) {
    bool isOffline = patient["status"] == "Offline";
    bool isWet = patient["wetness"] == "Wet";

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: isWet ? Colors.orange : Colors.grey.shade200, width: isWet ? 1.5 : 1),
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.all(16.0),
        collapsedBackgroundColor: Colors.white,
        backgroundColor: Colors.white,
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: const Color(0xFFF0F2F5), borderRadius: BorderRadius.circular(20)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text("View", style: main.copyWith(fontSize: 12, color: const Color(0xFF4DB6AC))),
              const Icon(Icons.keyboard_arrow_down, size: 18, color: Color(0xFF4DB6AC)),
            ],
          ),
        ),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(patient["name"], style: main.copyWith(fontSize: 15)),
                Text("${patient["id"]} • ${patient["room"]}", style: desc.copyWith(fontSize: 11)),
              ],
            ),
            _buildStatusBadge(isWet, isOffline, patient["status"], desc),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildVital(Icons.favorite, "HR", patient["hr"], Colors.redAccent, desc, main),
              _buildVital(Icons.thermostat, "TEMP", patient["temp"] == "---" ? "---" : "${patient["temp"]}°C", Colors.orange, desc, main),
              _buildVital(Icons.water_drop, "SPO2", patient["spo2"] == "---" ? "---" : "${patient["spo2"]}%", Colors.blue, desc, main),
              const SizedBox(width: 20),
            ],
          ),
        ),
        children: [
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("Hardware Configuration", style: desc.copyWith(fontSize: 11, fontWeight: FontWeight.bold)),
                    Wrap(
                      spacing: 8,
                      children: [
                        _buildDeviceBadge(patient["vs_id"], Colors.blue, main),
                        _buildDeviceBadge(patient["sd_id"], Colors.orange, main),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Text("Vital Statistics History", style: main.copyWith(fontSize: 13)),
                const SizedBox(height: 16),
                _buildFullWidthGraph("Heart Rate Trend (BPM)", [68, 72, 75, 71, 74, 78, 75], Colors.redAccent),
                const SizedBox(height: 20),
                _buildFullWidthGraph("Body Temperature Trend (°C)", [36.5, 36.8, 37.2, 37.0, 36.9, 36.8, 37.1], Colors.orange),
                const SizedBox(height: 20),
                _buildFullWidthGraph("Blood Oxygen SpO2 (%)", [98, 97, 98, 99, 98, 98, 97], Colors.blue),
                const SizedBox(height: 20),
                _buildFullWidthGraph("Diaper Moisture Sensor Status", [2, 5, 2, 85, 10, 5, 2], Colors.teal),
                const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Divider()),
                _buildDetailRow("System Integrity", isOffline ? "Offline" : "Secure - Live Connection", desc, main),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Graph and Helper widgets remain below...
  Widget _buildFullWidthGraph(String label, List<double> points, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: GoogleFonts.albertSans(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w600)),
            Text("Latest: ${points.last}", style: GoogleFonts.poppins(fontSize: 10, color: color, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 50, 
          width: double.infinity, 
          child: CustomPaint(painter: MiniGraphPainter(points.map((e) => e.toDouble()).toList(), color))
        ),
      ],
    );
  }

  Widget _buildStatusBadge(bool isWet, bool isOffline, String status, TextStyle desc) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isWet ? Colors.orange.shade100 : (isOffline ? Colors.grey.shade100 : const Color(0xFFE8F5E9)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isWet) ...[const Icon(Icons.opacity, size: 12, color: Colors.orange), const SizedBox(width: 4)],
          Text(isWet ? "WET" : status, style: desc.copyWith(fontSize: 11, fontWeight: FontWeight.bold, color: isWet ? Colors.orange.shade900 : (isOffline ? Colors.grey : Colors.green.shade700))),
        ],
      ),
    );
  }

  Widget _buildDeviceBadge(String id, Color color, TextStyle main) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4), border: Border.all(color: color.withOpacity(0.3))),
      child: Text(id, style: main.copyWith(fontSize: 10, color: color.withOpacity(0.9))),
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

  Widget _buildDetailRow(String label, String value, TextStyle desc, TextStyle main) {
    return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: desc.copyWith(fontSize: 11)), Text(value, style: main.copyWith(fontSize: 11))]);
  }

  Widget _buildEmptyState(TextStyle style) {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.person_search_outlined, size: 64, color: Colors.grey.shade300), const SizedBox(height: 16), Text("No patients found.", style: style)]));
  }
}

class MiniGraphPainter extends CustomPainter {
  final List<double> points;
  final Color color;
  MiniGraphPainter(this.points, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color..strokeWidth = 2.5..style = PaintingStyle.stroke..strokeCap = StrokeCap.round;
    final path = Path();
    double spacing = size.width / (points.length - 1);
    
    double maxVal = points.reduce((a, b) => a > b ? a : b);
    if (maxVal < 1) maxVal = 100;

    for (int i = 0; i < points.length; i++) {
      double x = i * spacing;
      double y = size.height - (points[i] / (maxVal * 1.2) * size.height);
      if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    canvas.drawPath(path, paint);
  }

  @override bool shouldRepaint(CustomPainter oldDelegate) => false;
}