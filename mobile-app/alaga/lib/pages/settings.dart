import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  // Notification States
  bool criticalAlerts = true;
  bool warningAlerts = true;
  bool infoNotifications = false;
  bool emailNotifications = true;
  bool smsNotifications = false;

  // Dropdown Values
  String selectedLanguage = "English";
  String selectedTimezone = "Asia/Manila (PHT)";
  String selectedTheme = "Light";
  String selectedSensitivity = "Medium (Balanced)";
  String selectedRetention = "1 Year (Default)";

  @override
  Widget build(BuildContext context) {
    final headerStyle = GoogleFonts.poppins(
      fontWeight: FontWeight.bold,
      fontSize: 24,
      color: const Color(0xFF2D3436),
    );

    final sectionTitleStyle = GoogleFonts.poppins(
      fontWeight: FontWeight.bold,
      fontSize: 16,
      color: const Color(0xFF2D3436),
    );

    final labelStyle = GoogleFonts.poppins(
      fontWeight: FontWeight.w600,
      fontSize: 13,
      color: const Color(0xFF2D3436),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Settings", style: headerStyle),
            Text("Manage your application preferences", 
              style: GoogleFonts.poppins(color: Colors.grey, fontSize: 14)),
            const SizedBox(height: 25),

            // 1. General Settings Section
            _buildSectionCard(
              title: "General Settings",
              icon: Icons.settings_outlined,
              children: [
                _buildDropdown("Language", selectedLanguage, ["English", "Tagalog"], (val) => setState(() => selectedLanguage = val!)),
                _buildDropdown("Timezone", selectedTimezone, ["Asia/Manila (PHT)", "UTC+0"], (val) => setState(() => selectedTimezone = val!)),
                _buildDropdown("Theme", selectedTheme, ["Light", "Dark"], (val) => setState(() => selectedTheme = val!)),
              ],
            ),

            // 2. Notification Preferences
            _buildSectionCard(
              title: "Notification Preferences",
              icon: Icons.notifications_none_outlined,
              children: [
                _buildSwitchTile("Critical Alerts", "Extreme fever, heart rate anomalies", criticalAlerts, (val) => setState(() => criticalAlerts = val)),
                _buildSwitchTile("Warning Alerts", "Elevated vitals, moisture detection", warningAlerts, (val) => setState(() => warningAlerts = val)),
                _buildSwitchTile("Info Notifications", "General updates and reminders", infoNotifications, (val) => setState(() => infoNotifications = val)),
                const Divider(height: 30),
                Text("Notification Channels", style: labelStyle),
                _buildSwitchTile("Email Notifications", null, emailNotifications, (val) => setState(() => emailNotifications = val)),
                _buildSwitchTile("SMS Notifications", null, smsNotifications, (val) => setState(() => smsNotifications = val)),
              ],
            ),

            // 3. Alert Configuration (Anomaly Detection)
            _buildSectionCard(
              title: "Alert Configuration",
              icon: Icons.shield_outlined,
              children: [
                _buildDropdown("Alert Sensitivity", selectedSensitivity, ["Low", "Medium (Balanced)", "High"], (val) => setState(() => selectedSensitivity = val!)),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE3F2FD),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Anomaly Detection (OC-SVM)", style: labelStyle.copyWith(color: Colors.blue.shade800)),
                      const SizedBox(height: 4),
                      Text("One-Class SVM algorithm is active for high-precision alerts and reduced false positives.", 
                        style: GoogleFonts.poppins(fontSize: 11, color: Colors.blue.shade700)),
                    ],
                  ),
                ),
              ],
            ),

            // 4. Data Management
            _buildSectionCard(
              title: "Data Management",
              icon: Icons.storage_outlined,
              children: [
                _buildDropdown("Data Retention Period", selectedRetention, ["6 Months", "1 Year (Default)", "Indefinite"], (val) => setState(() => selectedRetention = val!)),
                const SizedBox(height: 12),
                _buildInfoAlert("Important", "All patient data is protected under HIPAA compliance standards and encrypted at rest and in transit."),
              ],
            ),

            // 5. System Information
            _buildSystemInfo(),

            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(child: ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4DB6AC),
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text("Save Changes", style: TextStyle(color: Colors.white)),
                )),
                const SizedBox(width: 15),
                TextButton(onPressed: () {}, child: const Text("Reset to Defaults", style: TextStyle(color: Colors.black54))),
              ],
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  // UI Component: Section Card
  Widget _buildSectionCard({required String title, required IconData icon, required List<Widget> children}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: const Color(0xFF4DB6AC)),
              const SizedBox(width: 10),
              Text(title, style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 20),
          ...children,
        ],
      ),
    );
  }

  // UI Component: Dropdown
  Widget _buildDropdown(String label, String value, List<String> items, Function(String?) onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: value,
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFFF1F2F6),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
            ),
            items: items.map((i) => DropdownMenuItem(value: i, child: Text(i, style: const TextStyle(fontSize: 14)))).toList(),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  // UI Component: Switch Tile
  Widget _buildSwitchTile(String title, String? subtitle, bool value, Function(bool) onChanged) {
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      title: Text(title, style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500)),
      subtitle: subtitle != null ? Text(subtitle, style: const TextStyle(fontSize: 12)) : null,
      value: value,
      activeColor: const Color(0xFF4DB6AC),
      onChanged: onChanged,
    );
  }

  Widget _buildInfoAlert(String title, String content) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFFFF9C4), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [const Icon(Icons.warning_amber_rounded, size: 16, color: Colors.orange), const SizedBox(width: 5), Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))]),
          const SizedBox(height: 4),
          Text(content, style: const TextStyle(fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildSystemInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("System Information", style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 15),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _infoItem("Application Version", "v1.0.8"),
            _infoItem("Database Status", "Connected", isStatus: true),
          ],
        ),
        const SizedBox(height: 15),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _infoItem("Last Backup", "March 24, 2026 - 3:00 AM"),
            _infoItem("Active Devices", "6 devices online"),
          ],
        ),
      ],
    );
  }

  Widget _infoItem(String label, String value, {bool isStatus = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        Text(value, style: GoogleFonts.poppins(
          fontSize: 13, 
          fontWeight: FontWeight.bold, 
          color: isStatus ? Colors.green : Colors.black
        )),
      ],
    );
  }
}