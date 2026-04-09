import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class NewDeviceScreen extends StatefulWidget {
  const NewDeviceScreen({super.key});

  @override
  State<NewDeviceScreen> createState() => _NewDeviceScreenState();
}

class _NewDeviceScreenState extends State<NewDeviceScreen> {
  bool isManual = true;
  final TextEditingController _vitalSignsCtrl = TextEditingController();
  final TextEditingController _smartDiaperCtrl = TextEditingController();

  // Error state variables
  String? _vsError;
  String? _sdError;

  // --- VALIDATION & SUCCESS POPUP ---
  void _validateAndRegister() {
    // Regex: Starts with VS- or SD-, then 4 digits (Year), dash, 3 digits
    final vsRegex = RegExp(r'^VS-\d{4}-\d{3}$');
    final sdRegex = RegExp(r'^SD-\d{4}-\d{3}$');

    setState(() {
      _vsError = vsRegex.hasMatch(_vitalSignsCtrl.text) 
          ? null 
          : "Please input a valid device number.";
      _sdError = sdRegex.hasMatch(_smartDiaperCtrl.text) 
          ? null 
          : "Please input a valid device number.";
    });

    if (_vsError == null && _sdError == null) {
      _showSuccessDialog();
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Dialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Circular Teal Icon matching your reference
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF5FA9A9), width: 4),
                ),
                child: const Icon(
                  Icons.check_rounded,
                  size: 60,
                  color: Color(0xFF5FA9A9),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                "Devices registered!",
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.black,
                ),
              ),
            ],
          ),
        ),
      ),
    );

    // Auto-dismiss after 2 seconds
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        Navigator.pop(context); 
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 20),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.arrow_back, size: 28, color: Colors.black87),
                    ),
                    const SizedBox(height: 30),
                    Text("Register", style: GoogleFonts.poppins(fontSize: 14, color: const Color(0xFF5FA9A9), fontWeight: FontWeight.w600)),
                    Text("NEW DEVICE", style: GoogleFonts.poppins(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 1)),
                    const SizedBox(height: 25),

                    // Toggle Bar
                    Container(
                      height: 54,
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(color: const Color(0xFFD9D9D9), borderRadius: BorderRadius.circular(18)),
                      child: Row(
                        children: [
                          _buildToggleButton(true, 'keyboard', 'Manual'),
                          _buildToggleButton(false, 'qr', 'Scan QR'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 40),

                    isManual ? _buildManualView() : _buildScanView(),

                    const SizedBox(height: 40),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _buildActionButton("Cancel", isPrimary: false, onTap: () => Navigator.pop(context)),
                        const SizedBox(width: 50),
                        _buildActionButton("Register", isPrimary: true, onTap: _validateAndRegister),
                      ],
                    ),
                    const SizedBox(height: 30),
                  ],
                ),
              ),
            ),
            _buildBottomNav(),
          ],
        ),
      ),
    );
  }

  Widget _buildManualView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Device Details", style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.bold, color: const Color(0xFF5FA9A9))),
        const SizedBox(height: 8),
        Text("Enter the unique serial numbers found on your device.", style: GoogleFonts.albertSans(fontSize: 15, color: Colors.black)),
        const SizedBox(height: 30),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.5)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildInputLabel("Vital Signs Device No."),
              _buildTextField(_vitalSignsCtrl, errorText: _vsError, hint: "VS-2026-001"),
              const SizedBox(height: 20),
              _buildInputLabel("Smart Diaper Device No."),
              _buildTextField(_smartDiaperCtrl, errorText: _sdError, hint: "SD-2026-001"),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildScanView() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.5)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.black12)),
            child: Image.asset('assets/images/qr.png', width: 40, height: 40, errorBuilder: (c, e, s) => const Icon(Icons.qr_code_scanner, size: 40)),
          ),
          const SizedBox(height: 20),
          Text("Scan Device Sticker", style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Text("Upload a clear photo of the QR code\nfound on the back of the device.", textAlign: TextAlign.center, style: GoogleFonts.albertSans(fontSize: 14, color: Colors.black87)),
          const SizedBox(height: 30),
          _buildUploadButton(),
        ],
      ),
    );
  }

  Widget _buildTextField(TextEditingController ctrl, {String? errorText, String? hint}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: ctrl,
          style: GoogleFonts.albertSans(fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.black26),
            filled: true,
            fillColor: const Color(0xFFE0E8E8),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(30),
              borderSide: BorderSide(color: errorText != null ? Colors.red : const Color(0xFF5FA9A9).withOpacity(0.3)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(30),
              borderSide: BorderSide(color: errorText != null ? Colors.red : const Color(0xFF5FA9A9), width: 1.5),
            ),
          ),
        ),
        if (errorText != null)
          Padding(
            padding: const EdgeInsets.only(left: 12, top: 6),
            child: Text(errorText, style: const TextStyle(color: Colors.red, fontSize: 12)),
          ),
      ],
    );
  }

  Widget _buildToggleButton(bool value, String icon, String label) {
    bool isSelected = isManual == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          isManual = value;
          _vsError = null; // Clear errors on toggle
          _sdError = null;
        }),
        child: Container(
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(15),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset('assets/images/$icon.png', width: 20, color: isSelected ? const Color(0xFF5FA9A9) : Colors.black45, errorBuilder: (c, e, s) => Icon(value ? Icons.keyboard : Icons.qr_code_scanner, size: 20, color: isSelected ? const Color(0xFF5FA9A9) : Colors.black45)),
              const SizedBox(width: 8),
              Text(label, style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600, color: isSelected ? const Color(0xFF5FA9A9) : Colors.black45)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildUploadButton() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: BoxDecoration(color: const Color(0xFFE0E8E8), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.5))),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset('assets/images/upload.png', width: 20, color: const Color(0xFF5FA9A9), errorBuilder: (c, e, s) => const Icon(Icons.upload, color: Color(0xFF5FA9A9))),
          const SizedBox(width: 10),
          Text("Upload Image", style: GoogleFonts.poppins(color: const Color(0xFF5FA9A9), fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildActionButton(String label, {required bool isPrimary, required VoidCallback onTap}) {
    return SizedBox(
      width: 125, height: 48,
      child: isPrimary
          ? ElevatedButton(onPressed: onTap, style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF5FA9A9), elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25))), child: Text(label, style: GoogleFonts.poppins(color: Colors.black, fontWeight: FontWeight.w600)))
          : OutlinedButton(onPressed: onTap, style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.black), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25))), child: Text(label, style: GoogleFonts.poppins(color: Colors.black, fontWeight: FontWeight.w600))),
    );
  }

  Widget _buildInputLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text.rich(TextSpan(children: [
        TextSpan(text: label, style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14)),
        const TextSpan(text: " *", style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
      ])),
    );
  }

  Widget _buildBottomNav() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 30),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(color: const Color(0xFF5FA9A9), borderRadius: BorderRadius.circular(50)),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _navItem('heart', false),
            _navItem('bell', false),
            _navItem('home', false, onTap: () => Navigator.pop(context)),
            _navItem('device', true),
            _navItem('profile', false),
          ],
        ),
      ),
    );
  }

  Widget _navItem(String icon, bool isSelected, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: isSelected ? Colors.white : Colors.transparent, shape: BoxShape.circle),
        child: Image.asset('assets/images/$icon.png', width: 24, color: isSelected ? const Color(0xFF5FA9A9) : Colors.white, errorBuilder: (c, e, s) => Icon(Icons.circle, color: isSelected ? const Color(0xFF5FA9A9) : Colors.white, size: 24)),
      ),
    );
  }
} 