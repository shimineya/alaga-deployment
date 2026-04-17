import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class DeviceManagementScreen extends StatefulWidget {
  const DeviceManagementScreen({super.key});

  @override
  State<DeviceManagementScreen> createState() => _DeviceManagementScreenState();
}

class _DeviceManagementScreenState extends State<DeviceManagementScreen> {
  // --- Logic: Show Logs Bottom Sheet ---
  void _showLogs(BuildContext context, String deviceName) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          minChildSize: 0.4,
          expand: false,
          builder: (context, scrollController) {
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              ),
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("System Logs: $deviceName",
                          style: GoogleFonts.poppins(
                              fontWeight: FontWeight.bold, fontSize: 18)),
                      IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close)),
                    ],
                  ),
                  const Divider(height: 30),
                  Expanded(
                    child: ListView(
                      controller: scrollController,
                      children: [
                        _logItem("20:10:05", "Moisture threshold exceeded", "ALARM", Colors.red),
                        _logItem("19:40:02", "Heartbeat sent to gateway", "SUCCESS", Colors.green),
                        _logItem("19:35:15", "Vital signs transmitted", "DATA", Colors.blue),
                        _logItem("19:30:00", "One-Class SVM Anomaly check", "NORMAL", Colors.teal),
                        _logItem("19:00:10", "ESP32 Deep Sleep exited", "SYSTEM", Colors.grey),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _logItem(String time, String message, String tag, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(time, style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w500)),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                  child: Text(tag, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 6),
                Text(message, style: const TextStyle(fontSize: 14, color: Color(0xFF2D3436))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final titleStyle = GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 26, color: const Color(0xFF2D3436));
    double screenWidth = MediaQuery.of(context).size.width;
    bool isTablet = screenWidth > 900;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: const BackButton(color: Colors.black),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.cloud_upload_outlined, size: 18),
              label: const Text("OTA Update", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4DB6AC),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Device Management", style: titleStyle),
                  const Text("Monitor and manage all IoT hardware devices", style: TextStyle(color: Colors.grey, fontSize: 14)),
                  const SizedBox(height: 24),
                  LayoutBuilder(builder: (context, constraints) {
                    return GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: isTablet ? 4 : 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 1.8,
                      children: [
                        _buildStatCard("Total Devices", "6", Icons.developer_board, Colors.blue),
                        _buildStatCard("Active Now", "4", Icons.check_circle_outline, Colors.green),
                        _buildStatCard("Maintenance", "1", Icons.warning_amber_rounded, Colors.orange),
                        _buildStatCard("Offline", "1", Icons.error_outline, Colors.red),
                      ],
                    );
                  }),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            sliver: SliverGrid(
              gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 450,
                mainAxisSpacing: 20,
                crossAxisSpacing: 20,
                mainAxisExtent: 440, // Height adjusted for the new Figma layout
              ),
              delegate: SliverChildListDelegate([
                _buildDeviceCard(context, "ESP32-ABC123", "Combo Device", "D001", "Maria Santos (P001)", 85, 92, "ACTIVE", isWet: false),
                _buildDeviceCard(context, "ESP32-GHI789", "Smart Diaper", "D003", "Rosa Reyes (P003)", 15, 78, "ACTIVE", isWet: true),
                _buildDeviceCard(context, "ESP32-JKL012", "Combo Device", "D004", "Carlos Tan (P004)", 95, 85, "ACTIVE", isWet: false),
              ]),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 50)),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white, 
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)],
      ),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 4),
        Text(value, style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 18)),
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 10)),
      ]),
    );
  }

  Widget _buildDeviceCard(BuildContext context, String name, String type, String id, String assignedTo, int battery, int signal, String status, {bool isWet = false}) {
    Color statusColor = status == "ACTIVE" ? const Color(0xFF2ECC71) : Colors.orange;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 24, offset: const Offset(0, 8)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4DB6AC).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.memory, color: Color(0xFF4DB6AC), size: 28),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16, color: const Color(0xFF2D3436))),
                      Text("$type • ID: $id", style: const TextStyle(color: Colors.grey, fontSize: 11)),
                    ],
                  ),
                ],
              ),
              _statusTag(status, statusColor),
            ],
          ),
          const SizedBox(height: 20),
          _infoBanner("Assigned To", assignedTo),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _miniInfoCard("Firmware", "v2.3.1")),
              const SizedBox(width: 10),
              Expanded(child: _miniInfoCard("Last Update", "2 min ago")),
            ],
          ),
          const SizedBox(height: 20),
          _buildProgressRow(Icons.battery_std, "Battery Level", battery, battery < 20 ? Colors.red : const Color(0xFF2ECC71)),
          const SizedBox(height: 12),
          _buildProgressRow(Icons.wifi, "Signal Strength", signal, const Color(0xFF2ECC71)),
          
          const Spacer(),

          if (isWet) _moistureAlert(),

          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.sync, size: 14),
                  label: const Text("Calibrate", style: TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey.shade200),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _showLogs(context, name),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey.shade200),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text("View Logs", style: TextStyle(fontSize: 12)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _infoBanner(String label, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(color: const Color(0xFFF1F8FD), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: Colors.blueGrey)),
          Text(value, style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF2D3436))),
        ],
      ),
    );
  }

  Widget _miniInfoCard(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFF8FAFB), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _moistureAlert() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue.shade100),
      ),
      child: Row(
        children: [
          const Icon(Icons.water_drop, color: Colors.blue, size: 16),
          const SizedBox(width: 8),
          Text("WET CONDITION DETECTED", 
            style: GoogleFonts.poppins(color: Colors.blue, fontWeight: FontWeight.bold, fontSize: 10)),
        ],
      ),
    );
  }

  Widget _statusTag(String status, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)),
      child: Text(status, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildProgressRow(IconData icon, String label, int value, Color color) {
    return Column(children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Row(children: [Icon(icon, size: 14, color: Colors.black54), const SizedBox(width: 8), Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54))]),
        Text("$value%", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
      ]),
      const SizedBox(height: 8),
      ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: LinearProgressIndicator(value: value / 100, backgroundColor: Colors.grey.shade100, color: color, minHeight: 6),
      ),
    ]);
  }
}