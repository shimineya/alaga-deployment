import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Define the Typography Styles
    final mainTextStyle = GoogleFonts.poppins(
      fontWeight: FontWeight.bold,
      color: const Color(0xFF2D3436),
    );

    final descriptionStyle = GoogleFonts.albertSans(
      color: Colors.grey,
      fontSize: 13,
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFB),
      appBar: AppBar(
        title: Text("Reports", style: mainTextStyle.copyWith(fontSize: 20)),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.file_upload_outlined, color: Color(0xFF4DB6AC)),
            onPressed: () {},
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Generate and export medical reports", style: descriptionStyle),
            const SizedBox(height: 20),
            
            _buildSectionTitle("Report Configuration", mainTextStyle),
            _buildConfigurationCard(mainTextStyle, descriptionStyle),
            
            const SizedBox(height: 24),
            
            Row(
              children: [
                Expanded(child: _buildStatCard("Avg Heart Rate", "76 BPM", Icons.favorite, Colors.blue, mainTextStyle, descriptionStyle)),
                const SizedBox(width: 8),
                Expanded(child: _buildStatCard("Avg Temp", "37.2°C", Icons.thermostat, Colors.orange, mainTextStyle, descriptionStyle)),
              ],
            ),
            const SizedBox(height: 8),
            _buildStatCard("Hygiene Changes/Day", "8", Icons.calendar_today, Colors.green, mainTextStyle, descriptionStyle),

            const SizedBox(height: 24),
            _buildSectionTitle("Recent Reports", mainTextStyle),
            _buildReportItem("Weekly Vital Signs Summary - Ward A", "March 24, 2026 • PDF • 245 KB", mainTextStyle, descriptionStyle),
            _buildReportItem("Monthly Recovery Trends - All Patients", "March 1, 2026 • CSV • 89 KB", mainTextStyle, descriptionStyle),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, TextStyle style) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Text(title, style: style.copyWith(fontSize: 16)),
    );
  }

  Widget _buildConfigurationCard(TextStyle main, TextStyle desc) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            _buildDropdown("Report Type", "Vital Signs Trends", desc),
            _buildDropdown("Timeframe", "Last 7 Days", desc),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4DB6AC),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: Text("Generate Report", style: main.copyWith(color: Colors.white, fontSize: 14)),
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildDropdown(String label, String value, TextStyle desc) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: desc.copyWith(fontSize: 11)),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(color: const Color(0xFFF1F3F4), borderRadius: BorderRadius.circular(8)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(value, style: desc.copyWith(fontWeight: FontWeight.w600, color: Colors.black87)),
                const Icon(Icons.arrow_drop_down, color: Colors.grey),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color, TextStyle main, TextStyle desc) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade100)),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Row(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: desc.copyWith(fontSize: 10), overflow: TextOverflow.ellipsis),
                  Text(value, style: main.copyWith(fontSize: 14), overflow: TextOverflow.ellipsis),
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildReportItem(String title, String subtitle, TextStyle main, TextStyle desc) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade100)),
      child: ListTile(
        leading: const Icon(Icons.description_outlined, color: Color(0xFF4DB6AC)),
        title: Text(title, style: main.copyWith(fontSize: 13, fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle, style: desc.copyWith(fontSize: 11)),
        trailing: const Icon(Icons.download_outlined, color: Colors.grey, size: 20),
      ),
    );
  }
}