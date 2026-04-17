import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

class NewPatientScreen extends StatefulWidget {
  const NewPatientScreen({super.key});

  @override
  State<NewPatientScreen> createState() => _NewPatientScreenState();
}

class _NewPatientScreenState extends State<NewPatientScreen> {
  int currentStep = 1;
  bool isSearching = true;

  final TextEditingController _firstNameCtrl = TextEditingController();
  final TextEditingController _lastNameCtrl = TextEditingController();
  final TextEditingController _birthdateCtrl = TextEditingController();
  final TextEditingController _medicalNotesCtrl = TextEditingController();
  final TextEditingController _searchCtrl = TextEditingController();

  // --- SUCCESS POPUP ---
  void _showSuccessPopup() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_outline, color: Color(0xFF5FA9A9), size: 60),
              const SizedBox(height: 20),
              Text("Registration Successful", 
                style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 18)),
              const SizedBox(height: 10),
              Text("The patient has been successfully added to the ALAGA network.",
                textAlign: TextAlign.center,
                style: GoogleFonts.albertSans(fontSize: 14)),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context); // Close Popup
                  Navigator.pop(context); // Return to previous screen
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF5FA9A9),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                child: Text("Done", style: GoogleFonts.poppins(color: Colors.white)),
              )
            ],
          ),
        );
      },
    );
  }

  void _showRegisterNewDevicePopup() {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: "RegisterDevice",
      barrierColor: Colors.black.withOpacity(0.4),
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (context, anim1, anim2) {
        return BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
          child: Center(
            child: _RegisterDeviceModal(),
          ),
        );
      },
    );
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
                      onPressed: () {
                        if (currentStep > 1) {
                          setState(() => currentStep--);
                        } else {
                          Navigator.pop(context);
                        }
                      },
                      icon: const Icon(Icons.arrow_back, size: 28, color: Colors.black87),
                    ),
                    const SizedBox(height: 30),
                    Text("Enroll",
                        style: GoogleFonts.poppins(
                            fontSize: 14,
                            color: const Color(0xFF5FA9A9),
                            fontWeight: FontWeight.w600)),
                    Text("NEW PATIENT",
                        style: GoogleFonts.poppins(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1)),
                    const SizedBox(height: 8),
                    Text("Register a new patient to the ALAGA network.",
                        style: GoogleFonts.albertSans(fontSize: 14, color: Colors.black)),
                    const SizedBox(height: 30),
                    _buildStepper(),
                    const SizedBox(height: 30),

                    if (currentStep == 1) _buildStepOne(),
                    if (currentStep == 2) _buildStepTwo(),
                    if (currentStep == 3) _buildStepThree(),

                    const SizedBox(height: 40),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _buildActionButton(
                            currentStep == 1 ? "Cancel" : "Back",
                            isPrimary: false, 
                            onTap: () {
                              if (currentStep > 1) {
                                setState(() => currentStep--);
                              } else {
                                Navigator.pop(context);
                              }
                            }),
                        const SizedBox(width: 40),
                        _buildActionButton(
                          currentStep == 3 ? "Finish" : "Next Step",
                          isPrimary: true,
                          onTap: () {
                            if (currentStep < 3) {
                              setState(() => currentStep++);
                            } else {
                              _showSuccessPopup();
                            }
                          },
                        ),
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

  // Restored tool.png
  Widget _buildStepTwo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFC2D9FF),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Image.asset(
                'assets/images/tool.png',
                width: 32,
                height: 32,
                errorBuilder: (c, e, s) => const Icon(Icons.medical_services_outlined, color: Color(0xFF0046AD), size: 32),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Assign Primary Caregiver",
                      style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 15, color: const Color(0xFF0046AD))),
                    Text("Optional. You can search for an existing nurse/doctor or scan their ID.",
                      style: GoogleFonts.albertSans(fontSize: 12, color: const Color(0xFF0046AD))),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Container(
          height: 54,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: const Color(0xFFDCDCDC), borderRadius: BorderRadius.circular(18)),
          child: Row(
            children: [
              _buildCaregiverToggleButton(true, "Search Database"),
              _buildCaregiverToggleButton(false, "Scan ID Token"),
            ],
          ),
        ),
        const SizedBox(height: 30),
        isSearching ? _buildSearchDatabaseView() : _buildScanQRView(),
      ],
    );
  }

  // Restored phone.png and Poppins for "Register New"
  Widget _buildStepThree() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Link Devices", style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
        Text("Select active hardware from the inventory.", style: GoogleFonts.albertSans(fontSize: 14, color: Colors.black54)),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.refresh, size: 18, color: Colors.black),
            label: Text("Refresh", style: GoogleFonts.poppins(color: Colors.black, fontSize: 12)),
          ),
        ),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF9E6),
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: const Color(0xFFFFD54F), width: 1.5),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset(
                'assets/images/phone.png',
                height: 40,
                width: 40,
                errorBuilder: (c, e, s) => const Icon(Icons.phone_android, size: 40, color: Color(0xFFFFB300)),
              ),
              const SizedBox(height: 16),
              Text("No Available Devices",
                style: GoogleFonts.poppins(color: const Color(0xFFFBC02D), fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              Text("All devices are currently assigned or none are registered.",
                textAlign: TextAlign.center, style: GoogleFonts.albertSans(fontSize: 13, color: Colors.black87)),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _showRegisterNewDevicePopup,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFFFBC02D),
                  side: const BorderSide(color: Color(0xFFFBC02D)),
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: Text("Register New", style: GoogleFonts.poppins()), 
              ),
            ],
          ),
        ),
      ],
    );
  }

  // Restored Navbar Assets
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
            _navItem('device', false),
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
        child: Image.asset('assets/images/$icon.png', 
          width: 24, 
          color: isSelected ? const Color(0xFF5FA9A9) : Colors.white, 
          errorBuilder: (c, e, s) => const Icon(Icons.circle, color: Colors.white, size: 24)),
      ),
    );
  }

  // (Remaining helper widgets like _buildStepOne, _buildStepper, etc. kept as original)
  Widget _buildStepOne() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.5)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildInputLabel("First Name"),
              _buildTextField(_firstNameCtrl, radius: 12, inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z\s]'))]),
              const SizedBox(height: 20),
              _buildInputLabel("Last Name"),
              _buildTextField(_lastNameCtrl, radius: 12, inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z\s]'))]),
              const SizedBox(height: 20),
              _buildInputLabel("Birthdate"),
              _buildTextField(_birthdateCtrl, hint: "Select date", radius: 12, isReadOnly: true, onTap: () => _selectDate(context), prefixIcon: const Icon(Icons.calendar_today, size: 18, color: Color(0xFF5FA9A9))),
            ],
          ),
        ),
        const SizedBox(height: 30),
        Text("Medical Notes", style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14)),
        const SizedBox(height: 8),
        _buildTextField(_medicalNotesCtrl, hint: "Brief medical history...", isLarge: true, radius: 15),
      ],
    );
  }

  Widget _buildSearchDatabaseView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Email / Username", style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 10),
        _buildTextField(_searchCtrl, hint: "nurse@hospital.com", prefixIcon: const Icon(Icons.search, color: Colors.black26), radius: 15),
      ],
    );
  }

  Widget _buildScanQRView() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.5))),
      child: Column(
        children: [
          Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.black12)), child: const Icon(Icons.qr_code_scanner, size: 40)),
          const SizedBox(height: 20),
          Text("Scan QR ID", style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Text("Upload a clear photo of the ID QR code.", textAlign: TextAlign.center, style: GoogleFonts.albertSans(fontSize: 14)),
          const SizedBox(height: 30),
          _buildUploadButton(),
        ],
      ),
    );
  }

  Widget _buildCaregiverToggleButton(bool value, String label) {
    bool isSelected = isSearching == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => isSearching = value),
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(color: isSelected ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(15)),
          child: Text(label, style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600, color: isSelected ? const Color(0xFF5FA9A9) : Colors.black54)),
        ),
      ),
    );
  }

  Widget _buildUploadButton() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: BoxDecoration(color: const Color(0xFFE0E8E8), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.5))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.upload, color: Color(0xFF5FA9A9)),
        const SizedBox(width: 10),
        Text("Upload Image", style: GoogleFonts.poppins(color: const Color(0xFF5FA9A9), fontWeight: FontWeight.w600)),
      ]),
    );
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(context: context, initialDate: DateTime.now().subtract(const Duration(days: 365 * 30)), firstDate: DateTime(1900), lastDate: DateTime.now());
    if (picked != null) setState(() => _birthdateCtrl.text = "${picked.month}/${picked.day}/${picked.year}");
  }

  Widget _buildStepper() {
    return Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [_stepIndicator(1, "Details", isActive: currentStep >= 1), _stepIndicator(2, "Caregiver", isActive: currentStep >= 2), _stepIndicator(3, "Devices", isActive: currentStep >= 3)]);
  }

  Widget _stepIndicator(int number, String label, {required bool isActive}) {
    return Column(children: [CircleAvatar(radius: 24, backgroundColor: isActive ? const Color(0xFF5FA9A9) : const Color(0xFFD9D9D9), child: Text(number.toString(), style: GoogleFonts.poppins(color: isActive ? Colors.white : Colors.black54, fontWeight: FontWeight.bold, fontSize: 18))), const SizedBox(height: 8), Text(label, style: GoogleFonts.poppins(fontSize: 12, color: isActive ? const Color(0xFF5FA9A9) : Colors.black45, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal))]);
  }

  Widget _buildTextField(TextEditingController ctrl, {String? hint, bool isLarge = false, bool isReadOnly = false, VoidCallback? onTap, Widget? prefixIcon, double radius = 30, List<TextInputFormatter>? inputFormatters}) {
    return TextField(controller: ctrl, readOnly: isReadOnly, onTap: onTap, inputFormatters: inputFormatters, maxLines: isLarge ? 3 : 1, style: GoogleFonts.albertSans(fontSize: 14), decoration: InputDecoration(hintText: hint, prefixIcon: prefixIcon, filled: true, fillColor: const Color(0xFFE0E8E8), contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(radius), borderSide: BorderSide(color: const Color(0xFF5FA9A9).withOpacity(0.3))), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(radius), borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 1.5))));
  }

  Widget _buildInputLabel(String label) {
    return Padding(padding: const EdgeInsets.only(bottom: 8.0), child: Text.rich(TextSpan(children: [TextSpan(text: label, style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14)), const TextSpan(text: " *", style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold))])));
  }

  Widget _buildActionButton(String label, {required bool isPrimary, required VoidCallback onTap}) {
    return SizedBox(width: 130, height: 48, child: isPrimary ? ElevatedButton(onPressed: onTap, style: ElevatedButton.styleFrom(elevation: 2, backgroundColor: const Color(0xFF5FA9A9), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25))), child: Text(label, style: GoogleFonts.poppins(color: Colors.black, fontWeight: FontWeight.w600))) : OutlinedButton(onPressed: onTap, style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.black), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25))), child: Text(label, style: GoogleFonts.poppins(color: Colors.black, fontWeight: FontWeight.w600))));
  }
}

// --- MODAL WITH RESTORED ASSETS ---
class _RegisterDeviceModal extends StatefulWidget {
  @override
  State<_RegisterDeviceModal> createState() => _RegisterDeviceModalState();
}

class _RegisterDeviceModalState extends State<_RegisterDeviceModal> {
  bool isManual = true;
  final TextEditingController _vitalSignsCtrl = TextEditingController();
  final TextEditingController _smartDiaperCtrl = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        width: MediaQuery.of(context).size.width * 0.85,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: const Color(0xFFF5F5F0), borderRadius: BorderRadius.circular(18)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Register", style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF5FA9A9), fontWeight: FontWeight.w600)),
            Text("NEW DEVICE", style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
            const SizedBox(height: 20),
            
            Container(
              height: 48,
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(color: const Color(0xFFD9D9D9), borderRadius: BorderRadius.circular(15)),
              child: Row(
                children: [
                  _toggleBtn(true, 'keyboard', 'Manual'),
                  _toggleBtn(false, 'qr', 'Scan QR'),
                ],
              ),
            ),
            const SizedBox(height: 25),

            isManual ? _buildManualView() : _buildScanView(),

            const SizedBox(height: 30),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _modalActionBtn("Cancel", false, () => Navigator.pop(context)),
                const SizedBox(width: 20),
                _modalActionBtn("Register", true, () => Navigator.pop(context)),
              ],
            )
          ],
        ),
      ),
    );
  }

  Widget _toggleBtn(bool val, String icon, String label) {
    bool selected = isManual == val;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => isManual = val),
        child: Container(
          decoration: BoxDecoration(color: selected ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(12)),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset('assets/images/$icon.png', 
                width: 16, 
                color: selected ? const Color(0xFF5FA9A9) : Colors.black45, 
                errorBuilder: (c, e, s) => Icon(val ? Icons.keyboard : Icons.qr_code_scanner, size: 16, color: selected ? const Color(0xFF5FA9A9) : Colors.black45)),
              const SizedBox(width: 6),
              Text(label, style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: selected ? const Color(0xFF5FA9A9) : Colors.black45)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildManualView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _modalLabel("Vital Signs Device No."),
        _modalTextField(_vitalSignsCtrl, "VS-2026-001"),
        const SizedBox(height: 15),
        _modalLabel("Smart Diaper Device No."),
        _modalTextField(_smartDiaperCtrl, "SD-2026-001"),
      ],
    );
  }

  Widget _buildScanView() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF5FA9A9).withOpacity(0.3))),
      child: Column(
        children: [
          Image.asset('assets/images/qr.png', width: 32, height: 32, errorBuilder: (c, e, s) => const Icon(Icons.qr_code_scanner, size: 32)),
          const SizedBox(height: 10),
          Text("Scan Device Sticker", style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 15),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(color: const Color(0xFFE0E8E8), borderRadius: BorderRadius.circular(8)),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.upload, size: 16, color: Color(0xFF5FA9A9)), SizedBox(width: 8), Text("Upload Image", style: TextStyle(color: Color(0xFF5FA9A9), fontWeight: FontWeight.bold, fontSize: 12))]),
          )
        ],
      ),
    );
  }

  Widget _modalLabel(String text) => Padding(padding: const EdgeInsets.only(bottom: 5), child: Text.rich(TextSpan(children: [TextSpan(text: text, style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 12)), const TextSpan(text: " *", style: TextStyle(color: Colors.red))])));

  Widget _modalTextField(TextEditingController ctrl, String hint) => TextField(
    controller: ctrl, 
    style: GoogleFonts.poppins(fontSize: 12), 
    decoration: InputDecoration(
      hintText: hint, 
      hintStyle: GoogleFonts.poppins(fontSize: 12, color: Colors.black38),
      filled: true, 
      fillColor: const Color(0xFFE0E8E8), 
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10), 
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none))
    );

  Widget _modalActionBtn(String label, bool primary, VoidCallback tap) => SizedBox(
    width: 110, 
    height: 40, 
    child: primary ? ElevatedButton(
      onPressed: tap, 
      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF5FA9A9), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))), 
      child: Text(label, style: GoogleFonts.poppins(color: Colors.black, fontSize: 12, fontWeight: FontWeight.w600))
    ) : OutlinedButton(
      onPressed: tap, 
      style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.black), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))), 
      child: Text(label, style: GoogleFonts.poppins(color: Colors.black, fontSize: 12, fontWeight: FontWeight.w600))
    )
  );
}