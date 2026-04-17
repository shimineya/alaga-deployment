import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'ToS.dart';
import '../models/registration_data.dart';

class RoleScreen extends StatefulWidget {
  final RegistrationData registrationData;

  const RoleScreen({super.key, required this.registrationData});

  @override
  State<RoleScreen> createState() => _RoleScreenState();
}

class _RoleScreenState extends State<RoleScreen> {
  String? selectedRole;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: SafeArea(
        child: Stack(
          children: [
            // Main content
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                // Changed to crossAxisAlignment.center for global centering
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const SizedBox(height: 20),
                  
                  // 1. Welcome Text: Centered and less bold (w600)
                  Center(
                    child: Text(
                      "Welcome to Alaga!",
                      textAlign: TextAlign.center,
                      style: GoogleFonts.poppins(
                        fontSize: 28,
                        fontWeight: FontWeight.w600, // Less bold than .bold
                        color: Colors.black,
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 8),
                  
                  // 2. Question: Centered and Albert Sans font
                  Center(
                    child: Text(
                      "How would you use the app?",
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontFamily: 'AlbertSans',
                        fontSize: 14,
                        color: Colors.black54,
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 30),

                  // Role Cards
                  _roleCard(
                    role: "PARENT",
                    description: "I would like to watch over the well being of my child.",
                    imagePath: "assets/images/parent.png",
                  ),
                  _roleCard(
                    role: "CAREGIVER",
                    description: "I would like to make my job easier by providing efficient service.",
                    imagePath: "assets/images/caregiver.png",
                  ),
                  _roleCard(
                    role: "MEDICAL STAFF",
                    description: "I would like to assess the patient's health better and provide timely care.",
                    imagePath: "assets/images/med staff.png",
                  ),

                  const SizedBox(height: 40),

                  // Continue button
                  Center(
                    child: SizedBox(
                      width: 200,
                      child: ElevatedButton(
                        onPressed: selectedRole == null
                            ? null
                            : () {
                                String mappedRole = 'caregiver';
                                if (selectedRole == 'MEDICAL STAFF') {
                                  mappedRole = 'medical_staff';
                                }
                                widget.registrationData.role = mappedRole;

                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => ToSScreen(registrationData: widget.registrationData),
                                  ),
                                );
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF5FA9A9),
                          disabledBackgroundColor: Colors.grey.shade300,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(30),
                          ),
                          elevation: 0,
                        ),
                        child: Text(
                          "Continue",
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: selectedRole == null ? Colors.grey.shade600 : Colors.black,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),

            // Robot mascot
            Positioned(
              bottom: 0,
              left: 0,
              child: Image.asset(
                'assets/images/nakasilip.png',
                height: 180,
                fit: BoxFit.contain,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _roleCard({
    required String role,
    required String description,
    required String imagePath,
  }) {
    final bool isSelected = selectedRole == role;

    return GestureDetector(
      onTap: () {
        setState(() {
          selectedRole = role;
        });
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF5FA9A9) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF5FA9A9) : Colors.grey.shade300,
            width: 2,
          ),
          boxShadow: [
            if (isSelected)
              BoxShadow(
                color: const Color(0xFF5FA9A9).withOpacity(0.3),
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
          ],
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.asset(
                imagePath,
                width: 50,
                height: 50,
                fit: BoxFit.contain,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    role,
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? Colors.white : Colors.black,
                    ),
                  ),
                  const SizedBox(height: 4),
                  
                  // 3. Descriptions: Set to Albert Sans
                  Text(
                    description,
                    style: TextStyle(
                      fontFamily: 'AlbertSans',
                      fontSize: 12,
                      color: isSelected ? Colors.white.withOpacity(0.9) : Colors.grey.shade700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}