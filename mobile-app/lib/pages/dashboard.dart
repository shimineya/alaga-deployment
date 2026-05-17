import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:flutter/gestures.dart';

// Page imports for navigation
import 'newdevice.dart';
import 'newpatient.dart';
import 'patientlist.dart';
import 'assignment.dart';
import 'usermanagement.dart';
import 'devicemanagement.dart';
import 'reports.dart';
import 'settings.dart';
import 'profile.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 2; // Home selected by default
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  // --- Live Data State ---
  bool _isLoading = true;
  List<Map<String, dynamic>> _patients = [];
  int _deviceCount = 0;
  String? _profilePictureUrl;
  bool _imageLoadFailed = false;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  /// [OWASP A01] Fetch dashboard data using the authenticated JWT session.
  /// Only retrieves data the current user is authorized to access.
  Future<void> _loadDashboardData() async {
    setState(() => _isLoading = true);

    // Fetch patients, devices, and profile in parallel for performance
    final results = await Future.wait([
      ApiService.get('/caregiver/patients'),
      ApiService.get('/caregiver/devices'),
      ApiService.get('/user/profile'),
    ]);

    if (!mounted) return;

    final patientsResult = results[0];
    final devicesResult = results[1];
    final profileResult = results[2];

    setState(() {
      // Parse patient data
      if (patientsResult['success'] == true && patientsResult['data'] is List) {
        _patients = (patientsResult['data'] as List)
            .map((row) => row as Map<String, dynamic>)
            .toList();
      }

      // Parse device count
      if (devicesResult['success'] == true && devicesResult['data'] is List) {
        _deviceCount = (devicesResult['data'] as List).length;
      }

      // Parse profile picture URL
      if (profileResult['success'] == true &&
          profileResult['profile'] is Map<String, dynamic>) {
        final profile = profileResult['profile'] as Map<String, dynamic>;
        _profilePictureUrl = profile['profile_picture_url']?.toString();
        _imageLoadFailed = false; // Reset so the new URL gets a fresh attempt
      }

      _isLoading = false;
    });
  }

  /// Determines whether any devices or patients exist to show the
  /// appropriate dashboard view (empty state vs. summary cards).
  bool get _hasData => _patients.isNotEmpty || _deviceCount > 0;

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
                  _drawerItem('list', 'Patient List', const PatientListScreen(), false), 
                  _drawerItem('assignment', 'Assignment Tracker', const AssignmentScreen(), false),
                  _drawerItem('userM', 'User Management', const UserManagementScreen(), false),
                  _drawerItem('deviceM', 'Device Management', const DeviceManagementScreen(), false),
                  _drawerItem('report', 'Reports', const ReportsScreen(), false),
                  _drawerItem('setting', 'Settings', const SettingsScreen(), false), 
                  _drawerItem('profile', 'Profile', const ProfileScreen(), false),
                ],
              ),
            ),
            const Divider(color: Colors.white24, height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Text(
                "\u00a9 2026 ALAGA System\nVersion 1.0.0",
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
              child: _buildPageBody(today),
            ),
            _buildBottomNav(),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // PAGE BODY ROUTER
  // Switches content based on the active bottom nav tab index.
  // ---------------------------------------------------------------------------
  Widget _buildPageBody(String today) {
    switch (_currentIndex) {
      case 0:
        // Patient List tab
        return const PatientListScreen();
      case 1:
        // Notifications tab (placeholder -- no dedicated page exists yet)
        return _buildNotificationsPlaceholder();
      case 2:
        // Home / Dashboard tab
        return _buildHomeDashboard(today);
      case 3:
        // Device Management tab
        return const DeviceManagementScreen();
      case 4:
        // Profile tab
        return const ProfileScreen();
      default:
        return _buildHomeDashboard(today);
    }
  }

  // ---------------------------------------------------------------------------
  // HOME DASHBOARD CONTENT (index 2)
  // ---------------------------------------------------------------------------
  Widget _buildHomeDashboard(String today) {
    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      color: const Color(0xFF5FA9A9),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
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

              // Conditional: loading, empty state, or live summary
              if (_isLoading)
                const SizedBox(
                  height: 300,
                  child: Center(
                    child: CircularProgressIndicator(
                      color: Color(0xFF5FA9A9),
                    ),
                  ),
                )
              else if (!_hasData)
                _buildEmptyState()
              else
                _buildLiveSummary(),

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // EMPTY STATE  --  shown when no patients/devices are registered
  // ---------------------------------------------------------------------------
  Widget _buildEmptyState() {
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.45,
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
                      recognizer: TapGestureRecognizer()
                        ..onTap = () {
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
    );
  }

  // ---------------------------------------------------------------------------
  // LIVE SUMMARY  --  shown when patients/devices exist
  // ---------------------------------------------------------------------------
  Widget _buildLiveSummary() {
    final int activePatients = _patients.where((p) =>
        p['vital_device_sn'] != null || p['diaper_device_sn'] != null).length;
    final int offlinePatients = _patients.length - activePatients;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Quick Stats Row
        Row(
          children: [
            _buildStatTile(
              label: "Total Patients",
              value: "${_patients.length}",
              icon: Icons.people_outline,
              color: const Color(0xFF5FA9A9),
            ),
            const SizedBox(width: 12),
            _buildStatTile(
              label: "Devices",
              value: "$_deviceCount",
              icon: Icons.devices_other,
              color: const Color(0xFF4DB6AC),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildStatTile(
              label: "Active",
              value: "$activePatients",
              icon: Icons.monitor_heart_outlined,
              color: Colors.green.shade600,
            ),
            const SizedBox(width: 12),
            _buildStatTile(
              label: "Offline",
              value: "$offlinePatients",
              icon: Icons.signal_wifi_off,
              color: Colors.orange.shade700,
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Recent Patients Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text("Recent Patients",
                style: GoogleFonts.poppins(
                    fontSize: 15, fontWeight: FontWeight.w600)),
            GestureDetector(
              onTap: () => setState(() => _currentIndex = 0),
              child: Text("View All",
                  style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: const Color(0xFF5FA9A9),
                      fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Show up to 5 most recent patients
        ..._patients.take(5).map((patient) => _buildPatientRow(patient)),
      ],
    );
  }

  Widget _buildStatTile({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.2)),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.06),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 20, color: color),
            ),
            const SizedBox(width: 12),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value,
                      style: GoogleFonts.poppins(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: color)),
                  Text(label,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.albertSans(
                          fontSize: 11, color: Colors.grey.shade600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPatientRow(Map<String, dynamic> patient) {
    final String name = patient['name']?.toString() ?? 'Unknown';
    final bool hasVital = patient['vital_device_sn'] != null;
    final bool hasDiaper = patient['diaper_device_sn'] != null;
    final bool isOnline = hasVital || hasDiaper;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          // Patient initials avatar
          CircleAvatar(
            radius: 20,
            backgroundColor: const Color(0xFF5FA9A9).withOpacity(0.15),
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: GoogleFonts.poppins(
                  color: const Color(0xFF5FA9A9),
                  fontWeight: FontWeight.bold,
                  fontSize: 16),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: GoogleFonts.poppins(
                        fontSize: 14, fontWeight: FontWeight.w600)),
                Text(
                  "ID: ${patient['patient_id'] ?? 'N/A'}",
                  style: GoogleFonts.albertSans(
                      fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isOnline
                  ? Colors.green.shade50
                  : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              isOnline ? "Online" : "Offline",
              style: GoogleFonts.poppins(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: isOnline
                      ? Colors.green.shade700
                      : Colors.grey.shade600),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS PLACEHOLDER (index 1)
  // ---------------------------------------------------------------------------
  Widget _buildNotificationsPlaceholder() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_none_rounded,
              size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(
            "No notifications yet.",
            style: GoogleFonts.poppins(fontSize: 15, color: Colors.grey),
          ),
          const SizedBox(height: 6),
          Text(
            "Alert notifications will appear here.",
            style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey.shade400),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // WIDGET COMPONENTS
  // ---------------------------------------------------------------------------

  /// Builds the greeting header with a dynamic avatar.
  /// Falls back to initials when no profile picture URL is available.
  Widget _buildGreeting(String date) {
    final displayName = UserSession.current?.name.isNotEmpty == true
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
        _buildProfileAvatar(displayName),
      ],
    );
  }

  /// Renders the profile avatar.
  /// Attempts to load the user's profile picture from the backend.
  /// Uses serverOrigin (without /api) because uploads are served at /uploads/...
  /// Falls back to a circle with the user's first initial.
  Widget _buildProfileAvatar(String displayName) {
    final String origin = ApiService.serverOrigin;
    final String initial = displayName.isNotEmpty
        ? displayName[0].toUpperCase()
        : 'U';

    // If a profile picture URL was returned by the backend, attempt to load it.
    if (_profilePictureUrl != null && _profilePictureUrl!.isNotEmpty && !_imageLoadFailed) {
      final String fullUrl = _profilePictureUrl!.startsWith('http')
          ? _profilePictureUrl!
          : '$origin$_profilePictureUrl';

      return CircleAvatar(
        radius: 22,
        backgroundColor: const Color(0xFF5FA9A9).withOpacity(0.15),
        backgroundImage: NetworkImage(fullUrl),
        onBackgroundImageError: (_, __) {
          // Mark as failed so we stop retrying and fall back to initials
          if (mounted) setState(() => _imageLoadFailed = true);
        },
      );
    }

    // Default: initials-based avatar
    return CircleAvatar(
      radius: 22,
      backgroundColor: const Color(0xFF5FA9A9).withOpacity(0.15),
      child: Text(
        initial,
        style: GoogleFonts.poppins(
          color: const Color(0xFF5FA9A9),
          fontWeight: FontWeight.bold,
          fontSize: 16,
        ),
      ),
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
      onTap: () {
        if (_currentIndex != index) {
          setState(() => _currentIndex = index);
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
}