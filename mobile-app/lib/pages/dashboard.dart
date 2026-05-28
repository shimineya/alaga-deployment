import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:flutter/gestures.dart';

// [INTEGRATION] Import session management for user data
import '../models/user_session.dart';
import '../services/api_service.dart';

import 'newdevice.dart';
import 'newpatient.dart';
import 'patientlist.dart';
import 'assignment.dart';
import 'usermanagement.dart';
import 'devicemanagement.dart';
import 'reports.dart';
import 'settings.dart';
import 'profile.dart';
import 'notification.dart';

class DashboardScreen extends StatefulWidget {
  final int initialIndex; // ← added
  const DashboardScreen({super.key, this.initialIndex = 2}); // ← added

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late int _currentIndex; // ← changed
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  List<dynamic> _devices = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _fetchDevices();
  }

  Future<void> _fetchDevices() async {
    final result = await ApiService.get('/caregiver/devices');
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      if (result['success'] == true) {
        _devices = result['data'] ?? [];
      } else {
        _devices = [];
      }
    });
  }

  // [INTEGRATION] Pull-to-refresh handler.
  // Reloads the session from encrypted storage so any profile changes
  // (picture, username) made on another screen are immediately visible
  // in the dashboard avatar and greeting without requiring a re-login.
  Future<void> _refreshDashboard() async {
    await SessionManager.loadSession();
    await _fetchDevices();
    if (mounted) setState(() {});
  }

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
                  // [OWASP A01] Only the parent (admin) account can register
                  // devices and enroll new patients. Caregivers see a drawer
                  // without these options — they are also blocked at the backend.
                  if (UserSession.current?.isParent == true) ..._parentOnlyDrawerItems(),
                  _drawerItem('list', 'Patient List', PatientListScreen(), false),
                  _drawerItem('assignment', 'Assignment Tracker', const AssignmentScreen(), false),
                  _drawerItem('userM', 'User Management', const UserManagementScreen(), false),
                  _drawerItem('deviceM', 'Device Management', const DeviceManagementScreen(), false),
                  _drawerItem('report', 'Reports', const ReportsScreen(), false),
                  _drawerItem('profile', 'Profile', const ProfileScreen(), false,
                      // [INTEGRATION] Rebuild the dashboard when the user returns
                      // from the profile screen so the avatar reflects any changes
                      // written to UserSession (profile picture, username).
                      onReturn: () => setState(() {})),
                  _drawerItem('setting', 'Settings', SettingsScreen(), false),
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
              // [INTEGRATION] RefreshIndicator provides the pull-to-refresh gesture.
              // CustomScrollView + AlwaysScrollableScrollPhysics ensures the drag
              // fires even when content does not overflow (the normal dashboard state).
              child: RefreshIndicator(
                onRefresh: _refreshDashboard,
                color: const Color(0xFF4DB6AC),
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    // -- Header: menu button, greeting, section labels --
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
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
                        ]),
                      ),
                    ),

                    // -- Patient content area --
                    if (_isLoading)
                      const SliverToBoxAdapter(
                        child: Padding(
                          padding: EdgeInsets.all(40),
                          child: Center(child: CircularProgressIndicator()),
                        ),
                      )
                    else if (_devices.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(24, 0, 24, 30),
                          child: Stack(
                            children: [
                              Container(
                                width: double.infinity,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(24),
                                  border: Border.all(
                                      color: const Color(0xFF5FA9A9).withValues(alpha: 0.5),
                                      width: 1.5),
                                ),
                                child: Center(
                                  child: Builder(builder: (_) {
                                    final isParent = UserSession.current?.isParent == true;
                                    // [OWASP A01] Parent accounts see a tappable 'Register' link.
                                    // Caregivers see a plain message — they cannot register hardware.
                                    if (isParent) {
                                      return Text.rich(
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
                                              recognizer: TapGestureRecognizer()
                                                ..onTap = () {
                                                  setState(() => _currentIndex = 3);
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
                                      );
                                    } else {
                                      return Text(
                                        "No devices assigned yet.\nContact your administrator to assign a device.",
                                        textAlign: TextAlign.center,
                                        style: GoogleFonts.albertSans(
                                            fontSize: 15, color: Colors.black87),
                                      );
                                    }
                                  }),
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
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final device = _devices[index];
                              return _buildDeviceCard(device);
                            },
                            childCount: _devices.length,
                          ),
                        ),
                      ),
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

  Widget _buildGreeting(String date) {
    // [INTEGRATION] Display the user's name from the active session
    final userName = UserSession.current?.name ?? 'User';

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
                    text: userName,
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
        // [INTEGRATION] Avatar: shows the user's profile picture when available.
        // Falls back to a teal circle with the first-name initial when no picture
        // has been uploaded. Rebuilt by the .then(setState) on profile navigation
        // so the change appears immediately after returning from the profile screen.
        Builder(builder: (_) {
          final session = UserSession.current;
          final picUrl = session?.profilePictureUrl;
          final initial = (session?.name.isNotEmpty == true)
              ? session!.name[0].toUpperCase()
              : 'U';
          return CircleAvatar(
            radius: 22,
            backgroundColor: const Color(0xFF5FA9A9),
            backgroundImage: picUrl != null
                ? NetworkImage('${ApiService.serverOrigin}$picUrl')
                : null,
            child: picUrl == null
                ? Text(
                    initial,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 17,
                    ),
                  )
                : null,
          );
        }),
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

  // [OWASP A01] Returns the drawer entries that only the parent (admin) account
  // should see. Keeping them in a separate method avoids nesting spread operators
  // inside a deeply indented widget tree.
  List<Widget> _parentOnlyDrawerItems() => [
    _drawerItem('device', 'Add New Device', const NewDeviceScreen(), false),
    _drawerItem('add', 'Add New Patient', const NewPatientScreen(), false),
  ];

  Widget _drawerItem(
      String icon, String title, Widget destination, bool isSelected,
      {VoidCallback? onReturn}) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: isSelected ? Colors.white.withValues(alpha: 0.1) : Colors.transparent,
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
                context,
                MaterialPageRoute(
                    builder: (context) => destination))
              .then((_) => onReturn?.call());
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
      onTap: () {
        setState(() => _currentIndex = index); // ← highlight on tap
        switch (index) {
          case 0:
  Navigator.push(
    context,
    MaterialPageRoute(builder: (context) => PatientListScreen(
      onBack: () => setState(() => _currentIndex = 2),
    )),
  );
  break;
          case 1:
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const NotificationScreen()),
            );
            break;
          case 2:
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (context) => const DashboardScreen(initialIndex: 2)),
            );
            break;
          case 3:
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const DeviceManagementScreen()),
            );
            break;
          case 4:
  // [INTEGRATION] .then() triggers a setState when the user pops back from
  // ProfileScreen, causing the dashboard to re-read UserSession.current
  // and immediately display the updated avatar / greeting.
  Navigator.push(
    context,
    MaterialPageRoute(builder: (context) => ProfileScreen(
      onBack: () => setState(() => _currentIndex = 2),
    )),
  ).then((_) => setState(() {}));
  break;
        }
      },
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

  Widget _buildDeviceCard(Map<String, dynamic> device) {
    final serialNumber = device['serial_number'] ?? 'Unknown';
    final deviceName = device['device_name'] ?? 'Unknown';
    final status = device['status'] ?? 'INACTIVE';
    final patientName = device['assigned_patient_name'];
    final isAssigned = device['assigned_patient_id'] != null;
    final isVital = deviceName.toString().toLowerCase().contains('vital');
    final color = isVital ? Colors.blue : Colors.orange;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, 2))],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(serialNumber, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isAssigned ? Colors.green.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      status,
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: isAssigned ? Colors.green : Colors.grey),
                    ),
                  ),
                ]),
                const SizedBox(height: 2),
                Text(deviceName, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold)),
                Text(
                  isAssigned ? "Patient: $patientName" : "Unassigned",
                  style: TextStyle(fontSize: 11, color: isAssigned ? const Color(0xFF00796B) : Colors.grey),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Icon(
            isVital ? Icons.monitor_heart_outlined : Icons.baby_changing_station,
            color: color.withValues(alpha: 0.5),
            size: 28,
          ),
        ],
      ),
    );
  }
}