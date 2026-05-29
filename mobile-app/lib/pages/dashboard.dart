import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:flutter/gestures.dart';

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
  final int initialIndex;
  const DashboardScreen({super.key, this.initialIndex = 2});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late int _currentIndex;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  List<Map<String, dynamic>> _patients = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _fetchDashboardData();
  }

  Future<void> _fetchDashboardData() async {
    final result = await ApiService.get('/caregiver/patients');
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      if (result['success'] == true && result['data'] != null) {
        _patients = List<Map<String, dynamic>>.from(result['data']);
      } else {
        _patients = [];
      }
    });
  }

  Future<void> _refreshDashboard() async {
    await SessionManager.loadSession();
    await _fetchDashboardData();
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
                  if (UserSession.current?.isParent == true) ..._parentOnlyDrawerItems(),
                  _drawerItem('list', 'Patient List', PatientListScreen(), false),
                  _drawerItem('assignment', 'Assignment Tracker', const AssignmentScreen(), false),
                  _drawerItem('userM', 'User Management', const UserManagementScreen(), false),
                  _drawerItem('deviceM', 'Device Management', const DeviceManagementScreen(), false),
                  _drawerItem('report', 'Reports', const ReportsScreen(), false),
                  _drawerItem('profile', 'Profile', const ProfileScreen(), false, onReturn: () => setState(() {})),
                  _drawerItem('setting', 'Settings', SettingsScreen(), false),
                ],
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refreshDashboard,
                color: const Color(0xFF4DB6AC),
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              IconButton(
                                onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                                icon: const Icon(Icons.menu, size: 32, color: Colors.black87),
                              ),
                              Padding(padding: const EdgeInsets.only(top: 8.0), child: _buildGreeting(today)),
                            ],
                          ),
                          const SizedBox(height: 35),
                          Text("PATIENT MONITORING", style: GoogleFonts.poppins(fontSize: 13, color: const Color(0xFF5FA9A9), fontWeight: FontWeight.w500)),
                          Text("DASHBOARD", style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 20),
                        ]),
                      ),
                    ),
                    if (_isLoading)
                      const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())))
                    else if (_patients.isEmpty)
                      SliverFillRemaining(child: Center(child: Text("No patients assigned.", style: GoogleFonts.albertSans())))
                    else
                      SliverPadding(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) => _buildPatientCard(_patients[index]),
                            childCount: _patients.length,
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

  Widget _buildPatientCard(Map<String, dynamic> patient) {
    final telemetry = patient['latest_telemetry'] ?? {};
    final bool isDeviceActive = patient['device_status'] == 'active';
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, 2))],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(patient['name'] ?? 'Unknown', style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
                  Text("Room: ${patient['room'] ?? '---'}", style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: isDeviceActive ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                child: Text(isDeviceActive ? "ACTIVE" : "INACTIVE", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isDeviceActive ? Colors.green : Colors.red)),
              )
            ],
          ),
          const Divider(height: 20),
          Row(
            children: [
              Expanded(child: _vitalStat("BPM", telemetry['heart_rate']?.toString() ?? "--", Icons.favorite, Colors.red)),
              Expanded(child: _vitalStat("TEMP", "${telemetry['temperature'] ?? '--'}°C", Icons.thermostat, Colors.orange)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _vitalStat("SpO2", "${telemetry['spo2'] ?? '--'}%", Icons.water_drop, Colors.blue)),
              Expanded(child: _vitalStat("MOISTURE", telemetry['moisture'] == 100 ? 'Wet' : 'Dry', Icons.dry, telemetry['moisture'] == 100 ? Colors.blue : Colors.teal)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _vitalStat(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, size: 20, color: color),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        Text(label, style: const TextStyle(fontSize: 9, color: Colors.grey)),
      ],
    );
  }

  Widget _buildGreeting(String date) {
    final userName = UserSession.current?.name ?? 'User';
    return Row(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text.rich(TextSpan(children: [
              TextSpan(text: "Hello, ", style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black)),
              TextSpan(text: userName, style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF5FA9A9))),
              TextSpan(text: "!", style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black)),
            ])),
            Text(date, style: GoogleFonts.albertSans(fontSize: 11, color: Colors.black45)),
          ],
        ),
        const SizedBox(width: 10),
        Builder(builder: (_) {
          final session = UserSession.current;
          final picUrl = session?.profilePictureUrl;
          final initial = (session?.name.isNotEmpty == true) ? session!.name[0].toUpperCase() : 'U';
          return CircleAvatar(
            radius: 22,
            backgroundColor: const Color(0xFF5FA9A9),
            backgroundImage: picUrl != null ? NetworkImage('${ApiService.serverOrigin}$picUrl') : null,
            child: picUrl == null ? Text(initial, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17)) : null,
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
              Text("ALAGA", style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
              Text("Patient Monitoring", style: GoogleFonts.poppins(color: Colors.white70, fontSize: 12)),
            ],
          )
        ],
      ),
    );
  }

  List<Widget> _parentOnlyDrawerItems() => [
        _drawerItem('device', 'Add New Device', const NewDeviceScreen(), false),
        _drawerItem('add', 'Add New Patient', const NewPatientScreen(), false),
      ];

  Widget _drawerItem(String icon, String title, Widget destination, bool isSelected, {VoidCallback? onReturn}) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: isSelected ? Colors.white.withValues(alpha: 0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        leading: Image.asset('assets/images/$icon.png', width: 22, color: Colors.white),
        title: Text(title, style: GoogleFonts.poppins(color: Colors.white, fontSize: 13)),
        onTap: () {
          Navigator.pop(context);
          if (!isSelected) {
            Navigator.push(context, MaterialPageRoute(builder: (context) => destination)).then((_) => onReturn?.call());
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
        decoration: BoxDecoration(color: const Color(0xFF5FA9A9), borderRadius: BorderRadius.circular(50)),
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
        setState(() => _currentIndex = index);
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
            // This is the corrected navigation logic for index 4
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => ProfileScreen(
                onBack: () => setState(() => _currentIndex = 2),
              )),
            ).then((_) => setState(() {})); // .then is now chained to the Navigator.push call
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
}