import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../services/api_service.dart';
import '../models/user_session.dart';

class UserManagementScreen extends StatefulWidget {
  const UserManagementScreen({super.key});

  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen>
    with SingleTickerProviderStateMixin {
  static const Color _teal = Color(0xFF5FA9A9);
  static const Color _darkTeal = Color(0xFF2F7D7B);
  static const Color _staffBlue = Color(0xFF4A8BF5);
  static const Color _caregiverGreen = Color(0xFF38C976);
  static const Color _adminOrange = Color(0xFFF58A4A);
  static const Color _dangerRed = Color(0xFFE57373);
  static const Color _pageBg = Color(0xFFF5F5F0);

  late TabController _tabController;
  Timer? _realtimeTimer;

  // Directory state
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  List<Map<String, dynamic>> _users = [];
  bool _isLoadingUsers = true;
  String? _userErrorMessage;

  // Command Center state
  final TextEditingController _assignmentSearchController = TextEditingController();
  String _assignmentSearchQuery = '';
  List<Map<String, dynamic>> _patients = [];
  List<Map<String, dynamic>> _pendingInvites = [];
  bool _isLoadingAssignments = true;
  String? _assignmentErrorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadAll();
    _startRealtimePolling();
  }

  void _startRealtimePolling() {
    _realtimeTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (mounted) {
        _pollRealtimeUpdates();
      }
    });
  }

  @override
  void dispose() {
    _realtimeTimer?.cancel();
    _tabController.dispose();
    _searchController.dispose();
    _assignmentSearchController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    await Future.wait([
      _fetchUsers(),
      _fetchAssignmentsData(),
    ]);
  }

  // ---------------------------------------------------------------------------
  // REAL-TIME SILENT POLLING (Background)
  // ---------------------------------------------------------------------------
  Future<void> _pollRealtimeUpdates() async {
    try {
      final results = await Future.wait([
        ApiService.get('/api/caregiver/patients'),
        ApiService.get('/api/assignments/pending-invites'),
      ]);

      if (!mounted) return;

      final patientRes = results[0];
      final inviteRes = results[1];

      bool hasUpdates = false;

      if (patientRes['success'] == true) {
        final newPatients = (patientRes['data'] as List<dynamic>? ?? [])
            .map((p) => Map<String, dynamic>.from(p as Map))
            .toList();
        if (newPatients.length != _patients.length) {
          _patients = newPatients;
          hasUpdates = true;
        }
      }

      if (inviteRes['success'] == true) {
        final newInvites = (inviteRes['data'] as List<dynamic>? ?? [])
            .map((i) => Map<String, dynamic>.from(i as Map))
            .toList();
        if (newInvites.length != _pendingInvites.length) {
          _pendingInvites = newInvites;
          hasUpdates = true;
        }
      }

      if (hasUpdates && mounted) {
        setState(() {});
      }
    } catch (_) {
      // Silent polling errors do not interrupt UI
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 1: USERS DIRECTORY
  // ---------------------------------------------------------------------------
  Future<void> _fetchUsers() async {
    setState(() {
      _isLoadingUsers = true;
      _userErrorMessage = null;
    });

    final result = await ApiService.get('/api/caregiver/users');

    if (!mounted) return;

    if (result['success'] == true) {
      final data = (result['data'] as List<dynamic>? ?? [])
          .map((u) => Map<String, dynamic>.from(u as Map))
          .toList();
      setState(() {
        _users = data;
        _isLoadingUsers = false;
      });
    } else {
      setState(() {
        _userErrorMessage = result['message'] ?? 'Failed to load team directory.';
        _isLoadingUsers = false;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 2: ASSIGNMENT COMMAND CENTER DATA
  // ---------------------------------------------------------------------------
  Future<void> _fetchAssignmentsData() async {
    setState(() {
      _isLoadingAssignments = true;
      _assignmentErrorMessage = null;
    });

    final results = await Future.wait([
      ApiService.get('/api/caregiver/patients'),
      ApiService.get('/api/assignments/pending-invites'),
    ]);

    if (!mounted) return;

    final patientRes = results[0];
    final inviteRes = results[1];

    if (patientRes['success'] == true) {
      _patients = (patientRes['data'] as List<dynamic>? ?? [])
          .map((p) => Map<String, dynamic>.from(p as Map))
          .toList();
    } else {
      _assignmentErrorMessage = patientRes['message'] ?? 'Failed to load assignments.';
    }

    if (inviteRes['success'] == true) {
      _pendingInvites = (inviteRes['data'] as List<dynamic>? ?? [])
          .map((i) => Map<String, dynamic>.from(i as Map))
          .toList();
    }

    setState(() {
      _isLoadingAssignments = false;
    });
  }

  Future<void> _respondToInvite(int accessId, String action) async {
    final result = await ApiService.post(
      '/api/assignments/respond-invite',
      body: {
        'access_id': accessId,
        'action': action,
      },
    );

    if (!mounted) return;

    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            action == 'accept' ? 'Invitation accepted! Telemetry active.' : 'Invitation declined.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: action == 'accept' ? _caregiverGreen : Colors.grey[700],
          behavior: SnackBarBehavior.floating,
        ),
      );
      _fetchAssignmentsData();
      _fetchUsers();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Failed to respond to invitation.'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _confirmSelfRemove(int patientId, String patientName) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          "Resign from Care Team?",
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold, color: _dangerRed),
        ),
        content: Text(
          "You are about to voluntarily resign from caring for $patientName. You will lose real-time telemetry access for this patient.",
          style: GoogleFonts.albertSans(fontSize: 13, color: Colors.grey[700]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text("Cancel", style: GoogleFonts.poppins(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: _dangerRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text("Yes, Resign", style: GoogleFonts.poppins(fontSize: 13)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final result = await ApiService.delete(
      '/api/assignments/caregiver/self-remove',
      body: {'patient_id': patientId},
    );

    if (!mounted) return;

    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('You have been removed from $patientName\'s care team.'),
          backgroundColor: Colors.grey[800],
          behavior: SnackBarBehavior.floating,
        ),
      );
      _fetchAssignmentsData();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Failed to resign from assignment.'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // INVITE MEMBER MODAL (WEB-APP PARITY)
  // ---------------------------------------------------------------------------
  void _showInviteMemberModal(BuildContext context) {
    final emailCtrl = TextEditingController();
    String? selectedPatient = _patients.isNotEmpty
        ? (_patients.first['name'] ?? _patients.first['patient_id']?.toString())
        : null;
    String selectedRole = 'Assigned Caregiver';
    bool isSending = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _teal.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.person_add_alt_1, color: _darkTeal, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Invite Care Team Member',
                          style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Grant real-time vital & diaper telemetry access.',
                          style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.grey),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const Divider(height: 24),

              Text(
                'Member Email Address',
                style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  hintText: 'e.g. nurse.santos@hospital.com',
                  prefixIcon: const Icon(Icons.email_outlined, color: _teal, size: 20),
                  filled: true,
                  fillColor: const Color(0xFFE0F2F1).withValues(alpha: 0.4),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFF4DB6AC)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 14),

              Text(
                'Assign to Patient',
                style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F2F1).withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: selectedPatient,
                    isExpanded: true,
                    hint: const Text('Choose patient...'),
                    items: _patients.map((p) {
                      final name = p['name'] ?? 'Patient #${p['patient_id']}';
                      return DropdownMenuItem<String>(
                        value: name,
                        child: Text(name, style: GoogleFonts.albertSans(fontWeight: FontWeight.w600)),
                      );
                    }).toList(),
                    onChanged: (val) => setModalState(() => selectedPatient = val),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              Text(
                'Care Team Role',
                style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F2F1).withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: selectedRole,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: 'Assigned Caregiver', child: Text('Assigned Caregiver')),
                      DropdownMenuItem(value: 'Primary Caregiver', child: Text('Primary Caregiver')),
                      DropdownMenuItem(value: 'Attending Medical Staff', child: Text('Attending Medical Staff')),
                      DropdownMenuItem(value: 'Parent / Guardian', child: Text('Parent / Guardian')),
                      DropdownMenuItem(value: 'Secondary Caregiver', child: Text('Secondary Caregiver')),
                    ],
                    onChanged: (val) {
                      if (val != null) setModalState(() => selectedRole = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 20),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: isSending
                      ? null
                      : () async {
                          final email = emailCtrl.text.trim();
                          if (email.isEmpty || !email.contains('@')) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please enter a valid email address.')),
                            );
                            return;
                          }
                          if (selectedPatient == null || selectedPatient!.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please select a patient to assign.')),
                            );
                            return;
                          }

                          final messenger = ScaffoldMessenger.of(context);
                          final navigator = Navigator.of(modalCtx);

                          setModalState(() => isSending = true);

                          final result = await ApiService.post(
                            '/api/caregiver/patients/invite-by-email',
                            body: {
                              'caregiverEmail': email,
                              'patientName': selectedPatient,
                            },
                          );

                          if (!mounted) return;
                          setModalState(() => isSending = false);

                          if (result['success'] == true) {
                            navigator.pop();
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text(result['message'] ?? 'Invitation sent successfully!'),
                                backgroundColor: _caregiverGreen,
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                            _loadAll();
                          } else {
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text(result['message'] ?? 'Failed to send invitation.'),
                                backgroundColor: Colors.redAccent,
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        },
                  icon: isSending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                  label: Text(
                    isSending ? 'Sending Invitation...' : 'Send Care Invitation',
                    style: GoogleFonts.poppins(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 14),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _teal,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  String _formatRole(String role) {
    switch (role.toLowerCase()) {
      case 'medical_staff':
        return 'Medical Staff';
      case 'caregiver':
        return 'Caregiver';
      case 'admin':
      case 'facility_admin':
        return 'Facility Admin';
      case 'system_admin':
      case 'sysadmin':
        return 'System Admin';
      case 'parent':
      case 'guardian':
        return 'Parent / Guardian';
      default:
        return role;
    }
  }

  Color _roleColor(String role) {
    switch (role.toLowerCase()) {
      case 'medical_staff':
        return _staffBlue;
      case 'admin':
      case 'facility_admin':
      case 'system_admin':
      case 'sysadmin':
        return _adminOrange;
      case 'parent':
      case 'guardian':
        return _teal;
      default:
        return _caregiverGreen;
    }
  }

  int get _staffCount => _users.where((u) => u['role'] == 'medical_staff').length;
  int get _caregiverCount => _users.where((u) => u['role'] == 'caregiver').length;
  int get _adminCount =>
      _users.where((u) => ['admin', 'facility_admin', 'system_admin'].contains(u['role'])).length;

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
        ),
        title: Text(
          'Care Operations',
          style: GoogleFonts.poppins(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF2D3436),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_alt_1_outlined, color: _darkTeal),
            tooltip: 'Invite Member',
            onPressed: () => _showInviteMemberModal(context),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_outlined, color: Colors.black54),
            tooltip: 'Refresh',
            onPressed: _loadAll,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: _darkTeal,
          unselectedLabelColor: Colors.grey[600],
          indicatorColor: _teal,
          indicatorWeight: 3,
          labelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: [
            Tab(
              icon: const Icon(Icons.people_outline, size: 20),
              text: 'Care Team (${_users.length})',
            ),
            Tab(
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.assignment_ind_outlined, size: 20),
                  if (_pendingInvites.isNotEmpty)
                    Positioned(
                      top: -2,
                      right: -6,
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                          color: _dangerRed,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                        child: Text(
                          '${_pendingInvites.length}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              text: 'Command Center',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildDirectoryTab(),
          _buildCommandCenterTab(),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 1: DIRECTORY TAB VIEW
  // ---------------------------------------------------------------------------
  Widget _buildDirectoryTab() {
    final filtered = _users.where((user) {
      final name = '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.toLowerCase();
      final email = (user['email'] ?? '').toString().toLowerCase();
      final username = (user['username'] ?? '').toString().toLowerCase();
      final role = (user['role'] ?? '').toString().toLowerCase();
      final q = _searchQuery.toLowerCase();
      return name.contains(q) || email.contains(q) || username.contains(q) || role.contains(q);
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TEAM DIRECTORY',
            style: GoogleFonts.poppins(
              fontWeight: FontWeight.w600,
              fontSize: 12,
              color: _teal,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Care Team Members',
            style: GoogleFonts.poppins(
              fontWeight: FontWeight.bold,
              fontSize: 22,
              color: const Color(0xFF2D3436),
            ),
          ),
          Text(
            'Explore clinical staff, caregivers, and assigned roles.',
            style: GoogleFonts.albertSans(color: Colors.grey[600], fontSize: 13),
          ),
          const SizedBox(height: 16),

          // Stat Cards
          Row(
            children: [
              _statCard('Total', '${_users.length}', Icons.people_alt_outlined, Colors.black87),
              const SizedBox(width: 8),
              _statCard('Staff', '$_staffCount', Icons.medical_services_outlined, _staffBlue),
              const SizedBox(width: 8),
              _statCard('Caregivers', '$_caregiverCount', Icons.badge_outlined, _caregiverGreen),
              const SizedBox(width: 8),
              _statCard('Admins', '$_adminCount', Icons.admin_panel_settings_outlined, _adminOrange),
            ],
          ),
          const SizedBox(height: 16),

          // Search Bar
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: (v) => setState(() => _searchQuery = v),
              decoration: const InputDecoration(
                hintText: 'Search by name, role, email...',
                prefixIcon: Icon(Icons.search, color: Colors.grey),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Quick Action: Invite Member Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _showInviteMemberModal(context),
              icon: const Icon(Icons.person_add_alt_1, color: Colors.white, size: 18),
              label: Text(
                'Invite Caregiver / Member',
                style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: _teal,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(height: 16),

          if (_isLoadingUsers)
            const Center(
              child: Padding(
                padding: EdgeInsets.only(top: 40),
                child: CircularProgressIndicator(color: _teal),
              ),
            )
          else if (_userErrorMessage != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(top: 30),
                child: Column(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.redAccent, size: 40),
                    const SizedBox(height: 8),
                    Text(_userErrorMessage!, style: GoogleFonts.albertSans(color: Colors.grey)),
                    const SizedBox(height: 12),
                    TextButton(onPressed: _fetchUsers, child: const Text('Retry', style: TextStyle(color: _teal))),
                  ],
                ),
              ),
            )
          else if (filtered.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Text('No members found.', style: GoogleFonts.albertSans(color: Colors.grey)),
              ),
            )
          else
            ...filtered.map((u) => _buildUserCard(u)),
        ],
      ),
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 15)),
            Text(label, style: const TextStyle(color: Colors.grey, fontSize: 9), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _buildUserCard(Map<String, dynamic> user) {
    final fullName = '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
    final displayName = fullName.isNotEmpty ? fullName : (user['username'] ?? 'Team Member');
    final role = user['role'] ?? 'caregiver';
    final status = user['account_status'] ?? 'Active';
    final isActive = status.toString().toLowerCase().contains('active') ||
        status.toString().toLowerCase() == 'verified';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _showPermissionsModal(user),
          child: Padding(
            padding: const EdgeInsets.all(14.0),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: _roleColor(role).withValues(alpha: 0.15),
                  child: Text(
                    displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U',
                    style: TextStyle(color: _roleColor(role), fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        displayName,
                        style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        user['email'] ?? '',
                        style: GoogleFonts.albertSans(color: Colors.grey[600], fontSize: 12),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          _badge(_formatRole(role), _roleColor(role)),
                          const SizedBox(width: 6),
                          _badge(
                            isActive ? 'ACTIVE' : status.toString().toUpperCase(),
                            isActive ? _caregiverGreen : Colors.grey,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colors.grey),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showPermissionsModal(Map<String, dynamic> user) {
    final fullName = '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
    final displayName = fullName.isNotEmpty ? fullName : (user['username'] ?? 'User');
    final role = user['role'] ?? 'caregiver';
    final roleFormatted = _formatRole(role);
    final isStaffOrAdmin = ['admin', 'facility_admin', 'system_admin', 'medical_staff'].contains(role);
    final isParent = UserSession.current?.isParent == true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: _roleColor(role).withValues(alpha: 0.15),
                  child: Text(
                    displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U',
                    style: TextStyle(color: _roleColor(role), fontWeight: FontWeight.bold, fontSize: 18),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(displayName, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
                      Text(user['email'] ?? '', style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey[600])),
                    ],
                  ),
                ),
                _badge(roleFormatted, _roleColor(role)),
              ],
            ),
            const Divider(height: 28),
            Text(
              'Permissions & Access Level',
              style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF2D3436)),
            ),
            const SizedBox(height: 12),
            _permissionTile(
              'Real-Time Vitals Telemetry',
              'Can stream real-time heart rate, temperature, and SpO2 from assigned devices.',
              true,
            ),
            _permissionTile(
              'Moisture & Diaper Sensor Monitoring',
              'Receives wetness events and diaper change alerts.',
              true,
            ),
            _permissionTile(
              'Acknowledge Critical Clinical Alerts',
              'Can flag anomalies and acknowledge medical warnings.',
              true,
            ),
            _permissionTile(
              'Modify Patient Records & Baselines',
              isStaffOrAdmin ? 'Full read/write medical authority.' : 'Restricted to primary clinicians and administrators.',
              isStaffOrAdmin,
            ),
            _permissionTile(
              'Facility Administrative Authority',
              ['admin', 'facility_admin', 'system_admin'].contains(role)
                  ? 'Authorized to manage devices and care team assignments.'
                  : 'Requires administrative elevation.',
              ['admin', 'facility_admin', 'system_admin'].contains(role),
            ),
            const SizedBox(height: 20),
            if (isParent) ...[
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _confirmRemoveUser(user);
                  },
                  icon: const Icon(Icons.person_remove_outlined, color: _dangerRed, size: 18),
                  label: Text('Remove from Care Team', style: GoogleFonts.poppins(color: _dangerRed, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: _dangerRed),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _teal,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: Text('Close', style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _permissionTile(String title, String desc, bool allowed) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            allowed ? Icons.check_circle_outline : Icons.cancel_outlined,
            color: allowed ? _caregiverGreen : Colors.grey,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600)),
                Text(desc, style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[600])),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmRemoveUser(Map<String, dynamic> user) async {
    final userId = user['id'] ?? user['user_id'];
    final fullName = '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
    final displayName = fullName.isNotEmpty ? fullName : (user['username'] ?? 'User');

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text("Remove Member?", style: GoogleFonts.poppins(fontWeight: FontWeight.bold, color: _dangerRed)),
        content: Text(
          "Are you sure you want to remove $displayName? This will revoke their access to patient telemetry.",
          style: GoogleFonts.albertSans(fontSize: 13, color: Colors.grey[700]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Cancel")),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: _dangerRed),
            child: const Text("Remove", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final result = await ApiService.delete('/caregiver/users/$userId');
    if (!mounted) return;

    if (result['success'] == true) {
      _fetchUsers();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$displayName removed successfully.'), backgroundColor: Colors.redAccent),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'] ?? 'Failed to remove member.')),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 2: ASSIGNMENT COMMAND CENTER
  // ---------------------------------------------------------------------------
  Widget _buildCommandCenterTab() {
    final filteredPatients = _patients.where((p) {
      final name = (p['name'] ?? '').toString().toLowerCase();
      final vitalSn = (p['vital_device_sn'] ?? p['device_serial_number'] ?? '').toString().toLowerCase();
      final diaperSn = (p['diaper_device_sn'] ?? '').toString().toLowerCase();
      final q = _assignmentSearchQuery.toLowerCase();
      return name.contains(q) || vitalSn.contains(q) || diaperSn.contains(q);
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'COMMAND CENTER',
            style: GoogleFonts.poppins(
              fontWeight: FontWeight.w600,
              fontSize: 12,
              color: _teal,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Care Assignments',
                style: GoogleFonts.poppins(
                  fontWeight: FontWeight.bold,
                  fontSize: 22,
                  color: const Color(0xFF2D3436),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _caregiverGreen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _caregiverGreen.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: _caregiverGreen,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      'LIVE SYNC',
                      style: GoogleFonts.poppins(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: _caregiverGreen,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Text(
            'Real-time patient telemetry links, hardware sensors, and invitations.',
            style: GoogleFonts.albertSans(color: Colors.grey[600], fontSize: 13),
          ),
          const SizedBox(height: 16),

          // PENDING INVITATIONS BANNER (REAL TIME)
          if (_pendingInvites.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF9E6),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _adminOrange.withValues(alpha: 0.6), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: _adminOrange.withValues(alpha: 0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.notification_important, color: _adminOrange, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'Pending Invitations (${_pendingInvites.length})',
                        style: GoogleFonts.poppins(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: _adminOrange,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'You have been invited to join patient care teams. Accept to activate live vitals streaming.',
                    style: GoogleFonts.albertSans(fontSize: 12, color: Colors.black87),
                  ),
                  const SizedBox(height: 12),
                  ..._pendingInvites.map((invite) => _buildInviteCard(invite)),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Search Field & Invite Action Row
          Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: TextField(
                    controller: _assignmentSearchController,
                    onChanged: (v) => setState(() => _assignmentSearchQuery = v),
                    decoration: const InputDecoration(
                      hintText: 'Filter patients or serials...',
                      prefixIcon: Icon(Icons.search, color: Colors.grey),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: () => _showInviteMemberModal(context),
                icon: const Icon(Icons.person_add_alt_1, color: _teal),
                tooltip: 'Invite Member',
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: Colors.grey.shade300),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          if (_isLoadingAssignments)
            const Center(
              child: Padding(
                padding: EdgeInsets.only(top: 40),
                child: CircularProgressIndicator(color: _teal),
              ),
            )
          else if (_assignmentErrorMessage != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(top: 30),
                child: Column(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.redAccent, size: 40),
                    const SizedBox(height: 8),
                    Text(_assignmentErrorMessage!, style: GoogleFonts.albertSans(color: Colors.grey)),
                    const SizedBox(height: 12),
                    TextButton(onPressed: _fetchAssignmentsData, child: const Text('Retry', style: TextStyle(color: _teal))),
                  ],
                ),
              ),
            )
          else if (filteredPatients.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Text('No active assignments found.', style: GoogleFonts.albertSans(color: Colors.grey)),
              ),
            )
          else
            ...filteredPatients.map((p) => _buildPatientAssignmentCard(p)),
        ],
      ),
    );
  }

  Widget _buildInviteCard(Map<String, dynamic> invite) {
    final patientName = invite['patient_name'] ?? 'Patient';
    final inviter = '${invite['invited_by_first_name'] ?? ''} ${invite['invited_by_last_name'] ?? ''}'.trim();
    final relationship = invite['relationship'] ?? 'Caregiver';
    final accessId = invite['access_id'];

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(patientName, style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14)),
          if (inviter.isNotEmpty)
            Text('Invited by $inviter as $relationship', style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[700])),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _respondToInvite(accessId, 'decline'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _dangerRed,
                    side: const BorderSide(color: _dangerRed),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Decline', style: TextStyle(fontSize: 12)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _respondToInvite(accessId, 'accept'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _teal,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Accept', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPatientAssignmentCard(Map<String, dynamic> patient) {
    final patientName = patient['name'] ?? 'Patient';
    final patientId = patient['patient_id'];
    final vitalSn = patient['vital_device_sn'] ?? patient['device_serial_number'];
    final diaperSn = patient['diaper_device_sn'];
    final caregiverName = patient['assigned_caregiver_name'];
    final telemetry = patient['latest_telemetry'] as Map<String, dynamic>?;

    final hr = telemetry?['heart_rate'];
    final temp = telemetry?['temperature'];
    final spo2 = telemetry?['spo2'];
    final moisture = telemetry?['moisture'];

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: _teal.withValues(alpha: 0.15),
                child: const Icon(Icons.person, color: _teal),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      patientName,
                      style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    Text(
                      'Patient ID #$patientId',
                      style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
              _badge('ASSIGNED', _caregiverGreen),
            ],
          ),
          const SizedBox(height: 12),

          // Assigned caregiver row
          if (caregiverName != null && caregiverName.toString().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  const Icon(Icons.badge_outlined, size: 15, color: Colors.grey),
                  const SizedBox(width: 6),
                  Text(
                    'Assigned Caregiver: ',
                    style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey[600]),
                  ),
                  Text(
                    caregiverName.toString(),
                    style: GoogleFonts.albertSans(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87),
                  ),
                ],
              ),
            ),

          // Hardware Devices Row
          Text(
            'LINKED SENSOR DEVICES',
            style: GoogleFonts.poppins(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Colors.grey[700],
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: _deviceChip(
                  icon: Icons.monitor_heart_outlined,
                  label: 'Vital Signs',
                  serial: vitalSn,
                  activeColor: _caregiverGreen,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _deviceChip(
                  icon: Icons.water_drop_outlined,
                  label: 'Smart Diaper',
                  serial: diaperSn,
                  activeColor: _staffBlue,
                ),
              ),
            ],
          ),

          // Live Telemetry snippet if active
          if (hr != null || moisture != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: _pageBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _telemetrySnippet('HR', hr != null && hr > 0 ? '$hr bpm' : '--'),
                  _telemetrySnippet('SpO2', spo2 != null && spo2 > 0 ? '$spo2%' : '--'),
                  _telemetrySnippet('Temp', temp != null && temp > 0 ? '$temp°C' : '--'),
                  _telemetrySnippet('Diaper', moisture != null && moisture > 200 ? 'Wet' : 'Dry'),
                ],
              ),
            ),
          ],

          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 8),

          // Action row
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () => _confirmSelfRemove(patientId, patientName),
                icon: const Icon(Icons.exit_to_app, size: 15, color: _dangerRed),
                label: Text(
                  'Resign from Care',
                  style: GoogleFonts.poppins(color: _dangerRed, fontSize: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _deviceChip({
    required IconData icon,
    required String label,
    required dynamic serial,
    required Color activeColor,
  }) {
    final isLinked = serial != null && serial.toString().isNotEmpty;
    final displaySerial = isLinked ? serial.toString() : 'Not Paired';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: isLinked ? activeColor.withValues(alpha: 0.08) : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isLinked ? activeColor.withValues(alpha: 0.3) : Colors.grey.shade300,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: isLinked ? activeColor : Colors.grey),
              const SizedBox(width: 4),
              Text(
                label,
                style: GoogleFonts.poppins(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: isLinked ? activeColor : Colors.grey[600],
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            displaySerial,
            style: GoogleFonts.albertSans(
              fontSize: 11,
              fontWeight: isLinked ? FontWeight.bold : FontWeight.normal,
              color: isLinked ? Colors.black87 : Colors.grey,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _telemetrySnippet(String label, String val) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
        Text(val, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black87)),
      ],
    );
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6)),
      child: Text(
        text,
        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}