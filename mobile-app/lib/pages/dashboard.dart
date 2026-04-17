import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:flutter/gestures.dart'; // Added for the clickable text logic
import '../models/user_session.dart';

// Import your placeholder files
import 'newdevice.dart';
import 'newpatient.dart';
import 'patientlist.dart';
import 'assignment.dart';
import 'usermanagement.dart';
import 'devicemanagement.dart';
import 'reports.dart';
import 'settings.dart';
import 'profile.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 2; // Home selected by default
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    final String today = DateFormat('MMMM d, y').format(DateTime.now());

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFF5F5F0),
      drawer: Drawer(
        backgroundColor: const Color(0xFF1B393D),
        child: Column(
          children: [
            _buildDrawerHeader(),
            const Divider(color: Colors.white24, height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 10),
                children: [
                  _drawerItem('home', 'Dashboard', const DashboardScreen(), true),
                  _drawerItem('device', 'Add New Device', const NewDeviceScreen(), false),
                  _drawerItem('add', 'Add New Patient', const NewPatientScreen(), false),
                  _drawerItem('list', 'Patient List', PatientListScreen(), false), 
                  _drawerItem('assignment', 'Assignment Tracker', const AssignmentScreen(), false),
                  _drawerItem('userM', 'User Management', const UserManagementScreen(), false),
                  _drawerItem('deviceM', 'Device Management', const DeviceManagementScreen(), false),
                  _drawerItem('report', 'Reports', const ReportsScreen(), false),
                  _drawerItem('setting', 'Settings', SettingsScreen(), false), 
                  _drawerItem('profile', 'Profile', const ProfileScreen(), false),
                ],
              ),
            ),
            const Divider(color: Colors.white24, height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Text(
                "© 2026 ALAGA System\nVersion 1.0.0",
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(color: Colors.white60, fontSize: 11),
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        IconButton(
                          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                          icon: const Icon(Icons.menu, size: 32, color: Colors.black87),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 8.0),
                          child: _buildGreeting(today),
                        ),
                      ],
                    ),
                    const SizedBox(height: 35),
                    Text("Patient Management",
                        style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: const Color(0xFF5FA9A9),
                            fontWeight: FontWeight.w500)),
                    Text("DASHBOARD",
                        style: GoogleFonts.poppins(
                            fontSize: 22, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 20),
                    Expanded(
                      child: Stack(
                        children: [
                          Container(
                            width: double.infinity,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(
                                  color: const Color(0xFF5FA9A9).withOpacity(0.5),
                                  width: 1.5),
                            ),
                            child: Center(
                              child: Text.rich(
                                TextSpan(
                                  text: "No devices registered yet.\n",
                                  style: GoogleFonts.albertSans(
                                      fontSize: 15, color: Colors.black87),
                                  children: [
                                    TextSpan(
                                      text: "Register",
                                      style: const TextStyle(
                                          color: Color(0xFF5FA9A9),
                                          fontWeight: FontWeight.bold),
                                      // Redirect logic starts here
                                      recognizer: TapGestureRecognizer()
                                        ..onTap = () {
                                          setState(() {
                                            _currentIndex = 3; // Highlights Device Icon
                                          });
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                                builder: (context) =>
                                                    const NewDeviceScreen()),
                                          );
                                        },
                                    ),
                                    const TextSpan(text: " a device to continue."),
                                  ],
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 2,
                            left: 0,
                            child: Image.asset('assets/images/nakasilip.png',
                                width: 200),
                          ),
                        ],
                      ),
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

  // --- WIDGET COMPONENTS ---

  Widget _buildGreeting(String date) {
    final String displayName = (UserSession.current?.name != null && UserSession.current!.name.isNotEmpty)
        ? UserSession.current!.name
        : (UserSession.current?.username ?? 'User');

    return Row(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text.rich(TextSpan(
              children: [
                TextSpan(
                    text: "Hello, ",
                    style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.black)),
                TextSpan(
                    text: displayName,
                    style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF5FA9A9))),
                TextSpan(
                    text: "!",
                    style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.black)),
              ],
            )),
            Text(date,
                style: GoogleFonts.albertSans(
                    fontSize: 11, color: Colors.black45)),
          ],
        ),
        const SizedBox(width: 10),
        const CircleAvatar(
            backgroundImage: AssetImage('assets/images/pfp.jpg'), radius: 22),
      ],
    );
  }

  Widget _buildDrawerHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
      child: Row(
        children: [
          Image.asset('assets/images/alagahead.png', width: 45),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("ALAGA",
                  style: GoogleFonts.poppins(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16)),
              Text("Patient Monitoring",
                  style: GoogleFonts.poppins(
                      color: Colors.white70, fontSize: 12)),
            ],
          )
        ],
      ),
    );
  }

  Widget _drawerItem(
      String icon, String title, Widget destination, bool isSelected) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: isSelected ? Colors.white.withOpacity(0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        leading: Image.asset('assets/images/$icon.png',
            width: 22, color: Colors.white),
        title: Text(title,
            style: GoogleFonts.poppins(color: Colors.white, fontSize: 13)),
        onTap: () {
          Navigator.pop(context);
          if (!isSelected) {
            Navigator.push(
                context, MaterialPageRoute(builder: (context) => destination));
          }
        },
      ),
    );
  }

  Widget _buildBottomNav() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 30),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
            color: const Color(0xFF5FA9A9),
            borderRadius: BorderRadius.circular(50)),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _navItem(0, 'heart'),
            _navItem(1, 'bell'),
            _navItem(2, 'home'),
            _navItem(3, 'device'),
            _navItem(4, 'profile'),
          ],
        ),
      ),
    );
  }

  Widget _navItem(int index, String icon) {
    bool selected = _currentIndex == index;
    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            shape: BoxShape.circle),
        child: Image.asset('assets/images/$icon.png',
            width: 24,
            color: selected ? const Color(0xFF5FA9A9) : Colors.white),
      ),
    );
  }
}