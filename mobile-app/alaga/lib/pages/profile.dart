import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final titleStyle = GoogleFonts.poppins(
      fontWeight: FontWeight.bold,
      fontSize: 24,
      color: const Color(0xFF2D3436),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: TextButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.edit_outlined, size: 18, color: Colors.white),
              label: const Text("Edit Profile", style: TextStyle(color: Colors.white)),
              style: TextButton.styleFrom(
                backgroundColor: const Color(0xFF4DB6AC),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Profile", style: titleStyle),
            Text("Manage your account information", 
              style: GoogleFonts.poppins(color: Colors.grey, fontSize: 14)),
            const SizedBox(height: 25),

            // 1. Top Profile Header Card
            _buildSectionCard(
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 40,
                    backgroundColor: Color(0xFF4DB6AC),
                    child: Text("P", style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
                    // backgroundImage: AssetImage('assets/images/pfp.jpg'), // Uncomment when ready
                  ),
                  const SizedBox(width: 20),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text("Princess", style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.bold)),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(12)),
                            child: const Text("Admin", style: TextStyle(color: Colors.blue, fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      _iconLabel(Icons.email_outlined, "princess@alaga.com"),
                      _iconLabel(Icons.calendar_today_outlined, "Joined January 15, 2024"),
                    ],
                  ),
                ],
              ),
            ),

            // 2. Personal Information
            _buildSectionHeader("Personal Information", Icons.person_outline),
            _buildSectionCard(
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: _buildDataField("First Name", "Princess")),
                      const SizedBox(width: 15),
                      Expanded(child: _buildDataField("Last Name", "Administrator")),
                    ],
                  ),
                  const SizedBox(height: 15),
                  Row(
                    children: [
                      Expanded(child: _buildDataField("Email Address", "princess@alaga.com")),
                      const SizedBox(width: 15),
                      Expanded(child: _buildDataField("Phone Number", "+63 912 345 6789")),
                    ],
                  ),
                ],
              ),
            ),

            // 3. Security
            _buildSectionHeader("Security", Icons.shield_outlined),
            _buildSectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Password", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () {},
                    child: const Text("Change Password", style: TextStyle(color: Colors.black87)),
                  ),
                  const SizedBox(height: 15),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
                    child: const Row(
                      children: [
                        Icon(Icons.check_circle_outline, color: Colors.green, size: 16),
                        SizedBox(width: 8),
                        Expanded(child: Text("Two-Factor Authentication Enabled", style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold))),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // 4. Recent Activity
            _buildSectionHeader("Recent Activity", Icons.history),
            _buildSectionCard(
              child: Column(
                children: [
                  _activityItem("Logged in", "Manila, Philippines", "2 hours ago"),
                  const Divider(),
                  _activityItem("Updated patient record (P004)", "Manila, Philippines", "5 hours ago"),
                  const Divider(),
                  _activityItem("Generated report", "Manila, Philippines", "1 day ago"),
                ],
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF4DB6AC)),
          const SizedBox(width: 8),
          Text(title, style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildSectionCard({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: child,
    );
  }

  Widget _buildDataField(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey)),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(color: const Color(0xFFF1F2F6), borderRadius: BorderRadius.circular(8)),
          child: Text(value, style: const TextStyle(fontSize: 13, color: Colors.black54)),
        ),
      ],
    );
  }

  Widget _iconLabel(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 14, color: Colors.grey),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _activityItem(String title, String location, String time) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              Text(location, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
          Text(time, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        ],
      ),
    );
  }
}