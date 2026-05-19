import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _searchQuery = "";
  String _reportScope = "In General";
  String _reportType = "Vital Signs Data";
  String _timeFrame = "7 Days";
  DateTime _startDate = DateTime.now();
 
  String? _selectedPatient;
  final List<String> _patients = [
    "Juan Dela Cruz",
    "Maria Santos",
    "Ricardo Dalisay",
    "Elena Adarna",
    "Roberto Gomez"
  ];

  final List<String> _timeFrames = [
    "1 Day", "7 Days", "1 Month", "3 Months", "6 Months", "1 Year"
  ];

  final List<String> _reportTypes = [
    "Vital Signs Data", "Moisture Sensor Data", "Both"
  ];

  @override
  Widget build(BuildContext context) {
    final mainTextStyle = GoogleFonts.poppins(fontWeight: FontWeight.bold, color: const Color(0xFF2D3436));
    final descriptionStyle = GoogleFonts.albertSans(color: Colors.grey.shade700, fontSize: 13);
   
    const Color darkPastelTeal = Color(0xFF4DB6AC); // For input borders
    const Color lightTealFill = Color(0xFFE0F2F1); // For input fields
    const Color vibrantTeal = Color(0xFF00897B);
    const Color inputWhite = Color(0xFFFFFFFF);
    const Color yellowishWhite = Color(0xFFFFFDF5);

    return Scaffold(
      backgroundColor: yellowishWhite,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: const BackButton(color: Colors.black),
        title: const Text(""), 
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Analytical Insights",
              style: GoogleFonts.poppins(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF80CBC4),
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              "REPORTS",
              style: mainTextStyle.copyWith(fontSize: 28)
            ),
            // Added short description
            Text(
              "Track vital trends and download your patient health summaries.",
              style: descriptionStyle.copyWith(fontSize: 14),
            ),
            const SizedBox(height: 24),

            _buildSearchBar(descriptionStyle, vibrantTeal),
            const SizedBox(height: 24),

            _buildSectionTitle("Report Configuration", mainTextStyle),
           
            Card(
              elevation: 0,
              color: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildCustomDropdown(
                      "Report Scope",
                      _reportScope,
                      ["In General", "Specific Patient"],
                      (val) => setState(() => _reportScope = val!),
                      descriptionStyle,
                      darkPastelTeal,
                      lightTealFill,
                      inputWhite
                    ),

                    if (_reportScope == "Specific Patient")
                      _buildPatientSearchDropdown(descriptionStyle, darkPastelTeal, lightTealFill, inputWhite),

                    const Divider(height: 32),

                    _buildCustomDropdown(
                      "Report Type",
                      _reportType,
                      _reportTypes,
                      (val) => setState(() => _reportType = val!),
                      descriptionStyle,
                      darkPastelTeal,
                      lightTealFill,
                      inputWhite
                    ),

                    _buildDatePicker(descriptionStyle, darkPastelTeal, lightTealFill, inputWhite, vibrantTeal),

                    _buildCustomDropdown(
                      "Time Frame",
                      _timeFrame,
                      _timeFrames,
                      (val) => setState(() => _timeFrame = val!),
                      descriptionStyle,
                      darkPastelTeal,
                      lightTealFill,
                      inputWhite
                    ),

                    const SizedBox(height: 24),
                   
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text("Preparing report for download...")),
                          );
                        },
                        icon: const Icon(Icons.file_download_outlined, color: Colors.white),
                        label: Text("Download Report", style: mainTextStyle.copyWith(color: Colors.white, fontSize: 15)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: vibrantTeal,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 0,
                        ),
                      ),
                    )
                  ],
                ),
              ),
            ),
           
            const SizedBox(height: 32),
            _buildSectionTitle("Recent Downloads", mainTextStyle),
            _buildReportItem("Gen_Vitals_Summary.pdf", "April 10, 2026 • 1.2 MB", mainTextStyle, descriptionStyle, vibrantTeal),
            _buildReportItem("Patient_Santos_Moisture.csv", "April 08, 2026 • 450 KB", mainTextStyle, descriptionStyle, vibrantTeal),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar(TextStyle desc, Color accent) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: TextField(
        onChanged: (val) => setState(() => _searchQuery = val),
        decoration: InputDecoration(
          hintText: "Search archived reports...",
          hintStyle: desc,
          icon: Icon(Icons.search, color: accent),
          border: InputBorder.none,
        ),
      ),
    );
  }

  Widget _buildPatientSearchDropdown(TextStyle desc, Color borderColor, Color fillColor, Color dropdownBg) {
    return Padding(
      padding: const EdgeInsets.only(top: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Select Patient", style: desc.copyWith(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: fillColor,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: borderColor),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedPatient,
                isExpanded: true,
                hint: Text("Choose from list...", style: desc.copyWith(color: Colors.black54)),
                dropdownColor: dropdownBg,
                items: _patients.map((String patient) {
                  return DropdownMenuItem<String>(
                    value: patient,
                    child: Text(patient, style: desc.copyWith(color: Colors.black87, fontWeight: FontWeight.w600)),
                  );
                }).toList(),
                onChanged: (val) => setState(() => _selectedPatient = val),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomDropdown(String label, String value, List<String> items, Function(String?) onChanged, TextStyle desc, Color borderColor, Color fillColor, Color dropdownBg) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: desc.copyWith(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: fillColor,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: borderColor),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: value,
                isExpanded: true,
                dropdownColor: dropdownBg,
                icon: const Icon(Icons.expand_more, color: Colors.black54),
                items: items.map((String item) {
                  return DropdownMenuItem<String>(
                    value: item,
                    child: Text(item, style: desc.copyWith(color: Colors.black87, fontWeight: FontWeight.w600)),
                  );
                }).toList(),
                onChanged: onChanged,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDatePicker(TextStyle desc, Color borderColor, Color fillColor, Color dropdownBg, Color accent) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Starting Date", style: desc.copyWith(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black)),
          const SizedBox(height: 6),
          InkWell(
            onTap: () async {
              final DateTime? picked = await showDatePicker(
                context: context,
                initialDate: _startDate,
                firstDate: DateTime(2021),
                lastDate: DateTime.now(),
              );
              if (picked != null) setState(() => _startDate = picked);
            },
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: fillColor,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: borderColor),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "${_startDate.month}/${_startDate.day}/${_startDate.year}",
                    style: desc.copyWith(color: Colors.black87, fontWeight: FontWeight.w600),
                  ),
                  Icon(Icons.calendar_today_outlined, size: 16, color: accent),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, TextStyle style) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Text(title, style: style.copyWith(fontSize: 16)),
    );
  }

  Widget _buildReportItem(String title, String subtitle, TextStyle main, TextStyle desc, Color accent) {
    return Card(
      elevation: 0,
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade100)),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: accent.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
          child: Icon(Icons.description_outlined, color: accent, size: 20),
        ),
        title: Text(title, style: main.copyWith(fontSize: 13)),
        subtitle: Text(subtitle, style: desc.copyWith(fontSize: 11)),
        trailing: const Icon(Icons.file_download, color: Colors.grey, size: 18),
      ),
    );
  }
}