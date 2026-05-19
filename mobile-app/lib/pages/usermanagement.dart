import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class UserManagementScreen extends StatefulWidget {
  const UserManagementScreen({super.key});

  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen> {
  final Color primaryTeal = const Color(0xFF5FA9A9);
  final Color staffBlue = const Color(0xFF4A8BF5);
  final Color caregiverGreen = const Color(0xFF38C976);
  final Color familyOrange = const Color(0xFFF58A4A);
  final Color dangerRed = const Color(0xFFE57373);
  final Color pageBackground = const Color(0xFFFFFDF5);

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = "";

  List<Map<String, dynamic>> users = [
    {
      "name": "Nurse Maria Lopez",
      "email": "maria.lopez@alaga.com",
      "id": "1",
      "role": "MEDICAL STAFF",
      "roleColor": const Color(0xFF4A8BF5),
      "status": "ACTIVE",
      "lastActive": "10 min ago",
    },
    {
      "name": "Nurse John Tan",
      "email": "john.tan@alaga.com",
      "id": "2",
      "role": "MEDICAL STAFF",
      "roleColor": const Color(0xFF4A8BF5),
      "status": "ACTIVE",
      "lastActive": "2 min ago",
    },
    {
      "name": "Sarah Chen",
      "email": "sarah.chen@alaga.com",
      "id": "3",
      "role": "CAREGIVER",
      "roleColor": const Color(0xFF38C976),
      "status": "ACTIVE",
      "lastActive": "15 min ago",
    },
    {
      "name": "Anna Santos (Family)",
      "email": "anna.santos@email.com",
      "id": "4",
      "role": "FAMILY",
      "roleColor": const Color(0xFFF58A4A),
      "status": "ACTIVE",
      "lastActive": "3 hours ago",
    },
  ];

  int get _getStaffCount => users.where((u) => u['role'] == "MEDICAL STAFF").length;
  int get _getCaregiverCount => users.where((u) => u['role'] == "CAREGIVER").length;
  int get _getFamilyCount => users.where((u) => u['role'] == "FAMILY").length;
  int get _getTotalCount => users.length;

  void _deleteUser(String id) {
    setState(() {
      users.removeWhere((user) => user['id'] == id);
    });
  }

  void _showAddUserForm() {
    final formKey = GlobalKey<FormState>();
    String name = '';
    String email = '';
    String selectedRole = 'CAREGIVER';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: pageBackground,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 24, right: 24, top: 24,
        ),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Add Team Member", style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextFormField(
                decoration: InputDecoration(
                  labelText: "Full Name",
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onSaved: (value) => name = value ?? '',
                validator: (v) => v!.isEmpty ? "Required" : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                decoration: InputDecoration(
                  labelText: "Email",
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onSaved: (value) => email = value ?? '',
                validator: (v) => v!.contains('@') ? null : "Invalid Email",
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: selectedRole,
                decoration: InputDecoration(
                  labelText: "Role",
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                items: ["MEDICAL STAFF", "CAREGIVER", "FAMILY"]
                    .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                    .toList(),
                onChanged: (v) => selectedRole = v!,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: primaryTeal, foregroundColor: Colors.white),
                  onPressed: () {
                    if (formKey.currentState!.validate()) {
                      formKey.currentState!.save();
                      setState(() {
                        Color rColor = selectedRole == "MEDICAL STAFF" ? staffBlue : (selectedRole == "FAMILY" ? familyOrange : caregiverGreen);
                        users.insert(0, {
                          "name": name,
                          "email": email,
                          "id": DateTime.now().toString(),
                          "role": selectedRole,
                          "roleColor": rColor,
                          "status": "ACTIVE",
                          "lastActive": "Just now"
                        });
                      });
                      Navigator.pop(context);
                    }
                  },
                  child: const Text("Add User to Team"),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredUsers = users.where((user) {
      final name = user['name'].toString().toLowerCase();
      final email = user['email'].toString().toLowerCase();
      final query = _searchQuery.toLowerCase();
      return name.contains(query) || email.contains(query);
    }).toList();

    return Scaffold(
      backgroundColor: pageBackground,
      appBar: AppBar(
        backgroundColor: pageBackground,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back, color: Colors.black),
        ),
        title: const Text(""),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Access Center",
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.w500,
                fontSize: 14,
                color: primaryTeal,
              ),
            ),
            Text(
              "User Management",
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.bold,
                fontSize: 28,
                color: const Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 4),
            Text("Manage staff and family access control.", style: GoogleFonts.poppins(color: Colors.grey[600], fontSize: 14)),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _showAddUserForm,
                icon: const Icon(Icons.person_add_alt_1),
                label: const Text("Add New User"),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryTeal, foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
            const SizedBox(height: 24),
            _buildSmallStatCard("Total Users", "$_getTotalCount", Icons.people_alt_outlined, Colors.black87),
            const SizedBox(height: 12),
            _buildSmallStatCard("Medical Staff", "$_getStaffCount", Icons.medical_services_outlined, staffBlue),
            const SizedBox(height: 12),
            _buildSmallStatCard("Caregivers", "$_getCaregiverCount", Icons.badge_outlined, caregiverGreen),
            const SizedBox(height: 12),
            _buildSmallStatCard("Family", "$_getFamilyCount", Icons.family_restroom_outlined, familyOrange),
            const SizedBox(height: 24),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200)
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (value) {
                  setState(() {
                    _searchQuery = value;
                  });
                },
                decoration: const InputDecoration(
                  hintText: "Search staff or family...",
                  prefixIcon: Icon(Icons.search),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 12)
                ),
              ),
            ),
            const SizedBox(height: 24),
            ...filteredUsers.map((user) => Column(children: [_buildUserCard(user), const SizedBox(height: 16)])),
          ],
        ),
      ),
    );
  }

  Widget _buildSmallStatCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade100)
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(children: [Icon(icon, size: 20, color: color), const SizedBox(width: 12), Text(title)]),
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 18)),
        ],
      ),
    );
  }

  Widget _buildUserCard(Map<String, dynamic> user) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade100)
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(backgroundColor: primaryTeal.withOpacity(0.1), child: Text(user['name'][0], style: TextStyle(color: primaryTeal))),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(user['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(user['email'], style: const TextStyle(color: Colors.grey, fontSize: 12)),
                ]),
              ),
            ],
          ),
          const Divider(height: 24),
          _infoRow("Role", _badge(user['role'], user['roleColor'])),
          _infoRow("Status", _badge(user['status'], user['status'] == "ACTIVE" ? caregiverGreen : Colors.grey)),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => _deleteUser(user['id']),
              icon: Icon(Icons.delete_outline, color: dangerRed, size: 18),
              label: Text("Remove", style: TextStyle(color: dangerRed)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, Widget value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2.0),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)), value]),
  );

  Widget _badge(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
    child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
  );
}