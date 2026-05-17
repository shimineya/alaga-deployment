import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

class AssignmentScreen extends StatefulWidget {
  const AssignmentScreen({super.key});

  @override
  State<AssignmentScreen> createState() => _AssignmentScreenState();
}

class _AssignmentScreenState extends State<AssignmentScreen> {
  final Color primaryTeal = const Color(0xFF5FA9A9);
  final Color pendingOrange = const Color(0xFFFF9F69);
  final Color acceptedBlue = const Color(0xFF6B99EF);
  final Color inProgressGreen = const Color(0xFF66CB9F);
  final Color dangerRed = const Color(0xFFE57373);

  // Search Logic
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = "";

  List<Map<String, dynamic>> assignments = [];

  @override
  void initState() {
    super.initState();
    _loadAssignments();
  }

  Future<void> _loadAssignments() async {
    final result = await ApiService.get('/assignments/my-assignments');
    if (!mounted) return;
    if (result['success'] == true && result['data'] is List) {
      assignments = (result['data'] as List).map((row) {
        final item = row as Map<String, dynamic>;
        return {
          "patient_id": item["patient_id"],
          "name": item["name"] ?? "Unknown",
          "location": "Patient ID: ${item["patient_id"]}",
          "status": "Accepted",
          "primary": "Care Team Member",
          "backup": "N/A",
          "shift": "N/A",
          "instructions": "Access level: ${item["access_level"] ?? "View"}",
        };
      }).toList();
      setState(() {});
    }
  }

  Future<void> _unlinkCaregiverByPatientId(dynamic patientId) async {
    final result = await ApiService.put('/caregiver/patients/$patientId/unlink-caregiver');
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result['message']?.toString() ?? 'Caregiver unlink request processed')),
    );
    await _loadAssignments();
  }

  void _deleteAssignment(int index) {
    setState(() => assignments.removeAt(index));
  }

  // POPUP: VIEW DETAILS (Added Back-up)
  void _showViewDetails(Map<String, dynamic> data) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text("Assignment Details", style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _detailRow("Patient", data['name']),
              _detailRow("Location", data['location']),
              _detailRow("Status", data['status']),
              _detailRow("Primary", data['primary']),
              _detailRow("Back-up", data['backup']), // Added back-up
              _detailRow("Instructions", data['instructions']),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Close")),
        ],
      ),
    );
  }

  // POPUP: NEW/EDIT ASSIGNMENT FORM (Added Back-up)
  void _showAssignmentForm({int? index}) {
    bool isEdit = index != null;
    final nameCtrl = TextEditingController(text: isEdit ? assignments[index]['name'] : "");
    final locCtrl = TextEditingController(text: isEdit ? assignments[index]['location'] : "");
    final primaryCtrl = TextEditingController(text: isEdit ? assignments[index]['primary'] : "");
    final backupCtrl = TextEditingController(text: isEdit ? assignments[index]['backup'] : ""); // Added back-up
    final instrCtrl = TextEditingController(text: isEdit ? assignments[index]['instructions'] : "");

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(isEdit ? "Update Assignment" : "New Assignment", 
            style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildField("Patient Name", nameCtrl),
              _buildField("Location", locCtrl),
              _buildField("Primary Caregiver", primaryCtrl),
              _buildField("Back-up Caregiver", backupCtrl), // Added back-up field
              _buildField("Special Instructions", instrCtrl, maxLines: 3),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context), 
            child: Text("Cancel", style: TextStyle(color: dangerRed))
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: primaryTeal),
            onPressed: () {
              setState(() {
                final newData = {
                  "patient_id": isEdit ? assignments[index]['patient_id'] : null,
                  "name": nameCtrl.text,
                  "location": locCtrl.text,
                  "status": isEdit ? assignments[index]['status'] : "Pending",
                  "primary": primaryCtrl.text,
                  "backup": backupCtrl.text, // Capture back-up input
                  "shift": isEdit ? assignments[index]['shift'] : "Day Shift",
                  "instructions": instrCtrl.text,
                };
                if (isEdit) {
                  assignments[index] = newData;
                } else {
                  assignments.add(newData);
                }
              });
              Navigator.pop(context);
            },
            child: Text(isEdit ? "Update Assignment" : "Send Assignment", 
                style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildField(String label, TextEditingController ctrl, {int maxLines = 1}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: TextField(
        controller: ctrl,
        maxLines: maxLines,
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: RichText(
        text: TextSpan(
          style: GoogleFonts.poppins(color: Colors.black, fontSize: 13),
          children: [
            TextSpan(text: "$label: ", style: const TextStyle(fontWeight: FontWeight.bold)),
            TextSpan(text: value),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Search Filtering
    final List<Map<String, dynamic>> filteredAssignments = assignments.where((a) {
      return a['name'].toLowerCase().contains(_searchQuery.toLowerCase()) || 
             a['location'].toLowerCase().contains(_searchQuery.toLowerCase());
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          "Assignment Tracker",
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Manage and dispatch caregiver assignments", style: GoogleFonts.poppins(color: Colors.grey, fontSize: 14)),
            const SizedBox(height: 16),
            
            // Restoration of Search Bar
            TextField(
              controller: _searchController,
              onChanged: (val) => setState(() => _searchQuery = val),
              decoration: InputDecoration(
                hintText: "Search patient or location...",
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: 180,
              child: ElevatedButton.icon(
                onPressed: () => _showAssignmentForm(),
                icon: const Icon(Icons.add, size: 18, color: Colors.white),
                label: const Text("New Assignment", style: TextStyle(color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryTeal,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
            const SizedBox(height: 24),
            _buildStatCard("Total Assignments", "${assignments.length}", Icons.people_outline, Colors.blue),
            const SizedBox(height: 10),
            _buildStatCard("Pending", "${assignments.where((a) => a['status'] == 'Pending').length}", Icons.send_outlined, pendingOrange),
            const SizedBox(height: 10),
            _buildStatCard("Accepted", "${assignments.where((a) => a['status'] == 'Accepted').length}", Icons.check_circle_outline, acceptedBlue),
            const SizedBox(height: 10),
            _buildStatCard("In Progress", "${assignments.where((a) => a['status'] == 'In Progress').length}", Icons.sync, inProgressGreen),
            const SizedBox(height: 24),
            Text("Recent Assignments", style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 16),
            ...filteredAssignments.asMap().entries.map((entry) {
              int idx = entry.key;
              Map<String, dynamic> data = entry.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 16.0),
                child: _buildAssignmentCard(
                  index: idx,
                  name: data['name'],
                  location: data['location'],
                  status: data['status'],
                  primary: data['primary'],
                  backup: data['backup'],
                  shift: data['shift'],
                  instructions: data['instructions'],
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String count, IconData icon, Color color) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              Text(count, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildAssignmentCard({
    required int index,
    required String name,
    required String location,
    required String status,
    required String primary,
    required String backup,
    required String shift,
    required String instructions,
  }) {
    bool isInProgress = status == "In Progress";
    bool isAccepted = status == "Accepted";
    bool isPending = status == "Pending";
    Color statusColor = isInProgress ? inProgressGreen : (isAccepted ? acceptedBlue : pendingOrange);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: primaryTeal.withOpacity(0.1),
                    child: Text(name[0], style: TextStyle(color: primaryTeal, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text(location, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(status, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const Divider(height: 24),
          Row(
            children: [
              const Icon(Icons.schedule, size: 16, color: Colors.grey),
              const SizedBox(width: 8),
              Text(shift, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            ],
          ),
          const SizedBox(height: 16),
          const Text("Assignment Progress", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
          const SizedBox(height: 8),
          Row(
            children: [
              _buildProgressStep("Sent", true),
              _buildProgressLine(true),
              _buildProgressStep("Accepted", isInProgress || isAccepted),
              _buildProgressLine(isInProgress),
              _buildProgressStep("Active", isInProgress),
            ],
          ),
          const SizedBox(height: 16),
          _buildCaregiverBox("Primary Caregiver", primary, Colors.blue),
          const SizedBox(height: 8),
          _buildCaregiverBox("Back-up Caregiver", backup, Colors.purple),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border(left: BorderSide(color: pendingOrange, width: 4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("SPECIAL INSTRUCTIONS", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.orange)),
                const SizedBox(height: 4),
                Text(instructions, style: const TextStyle(fontSize: 12, height: 1.4)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildActionButton("View Details", Colors.grey.shade700, () => _showViewDetails(assignments[index])),
              _buildActionButton("Edit", Colors.grey.shade700, () => _showAssignmentForm(index: index)),
              if (isPending) 
                _buildActionButton("Cancel", dangerRed, () => _deleteAssignment(index)),
              if (isInProgress || isAccepted) 
                _buildActionButton("Remove", dangerRed, () async {
                  final patientId = assignments[index]['patient_id'];
                  if (patientId != null) {
                    await _unlinkCaregiverByPatientId(patientId);
                  } else {
                    _deleteAssignment(index);
                  }
                }),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildActionButton(String label, Color color, VoidCallback onTap) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: color.withOpacity(0.5)),
        padding: const EdgeInsets.symmetric(horizontal: 12),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 12)),
    );
  }

  Widget _buildProgressStep(String label, bool completed) {
    return Column(
      children: [
        Icon(completed ? Icons.check_circle : Icons.radio_button_unchecked, 
          size: 16, color: completed ? inProgressGreen : Colors.grey.shade300),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 9, color: completed ? Colors.black : Colors.grey)),
      ],
    );
  }

  Widget _buildProgressLine(bool completed) {
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.only(bottom: 14),
        color: completed ? inProgressGreen : Colors.grey.shade200,
      ),
    );
  }

  Widget _buildCaregiverBox(String label, String name, Color color) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border(left: BorderSide(color: color, width: 4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.bold)),
          Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}