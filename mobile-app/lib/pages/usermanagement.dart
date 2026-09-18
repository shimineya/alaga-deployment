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

  // Search controllers
  final TextEditingController _careTeamSearchController = TextEditingController();
  final TextEditingController _assignmentSearchController = TextEditingController();
  String _careTeamSearchQuery = '';
  String _assignmentSearchQuery = '';

  // Data lists
  List<Map<String, dynamic>> _patients = [];
  List<Map<String, dynamic>> _pendingInvites = [];
  List<Map<String, dynamic>> _sentPendingInvites = [];
  String _pendingFilter = 'all'; // 'all', 'received', 'sent'
  Map<int, List<Map<String, dynamic>>> _careTeams = {};
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
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
    _careTeamSearchController.dispose();
    _assignmentSearchController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // DATA FETCHING & SILENT POLLING
  // ---------------------------------------------------------------------------
  Future<void> _loadAll() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final results = await Future.wait([
        ApiService.get('/api/caregiver/patients'),
        ApiService.get('/api/assignments/pending-invites'),
        ApiService.get('/api/assignments/sent-invites'),
      ]);

      if (!mounted) return;

      final patientRes = results[0];
      final inviteRes = results[1];
      final sentInviteRes = results[2];

      if (patientRes['success'] == true) {
        _patients = (patientRes['data'] as List<dynamic>? ?? [])
            .map((p) => Map<String, dynamic>.from(p as Map))
            .toList();

        // Fetch care teams for each patient
        final Map<int, List<Map<String, dynamic>>> teamsMap = {};
        await Future.wait(
          _patients.map((pat) async {
            final pId = pat['patient_id'];
            if (pId != null) {
              final teamRes = await ApiService.get('/api/caregiver/patients/$pId/care-team');
              if (teamRes['success'] == true && teamRes['data'] != null) {
                teamsMap[pId as int] = (teamRes['data'] as List<dynamic>)
                    .map((m) => Map<String, dynamic>.from(m as Map))
                    .toList();
              }
            }
          }),
        );
        _careTeams = teamsMap;
      } else {
        _errorMessage = patientRes['message'] ?? 'Failed to load patient records.';
      }

      if (inviteRes['success'] == true) {
        _pendingInvites = (inviteRes['data'] as List<dynamic>? ?? [])
            .map((i) => Map<String, dynamic>.from(i as Map))
            .toList();
      }

      // Collect sent pending invitations
      final List<Map<String, dynamic>> sentList = [];
      if (sentInviteRes['success'] == true && sentInviteRes['data'] != null) {
        sentList.addAll((sentInviteRes['data'] as List<dynamic>)
            .map((s) => Map<String, dynamic>.from(s as Map)));
      }

      // Fallback/sync: check _careTeams for any pending members
      final currentUserId = UserSession.current?.id;
      for (final patient in _patients) {
        final pId = patient['patient_id'];
        final pName = patient['name'] ?? 'Patient';
        final team = _careTeams[pId] ?? [];
        for (final member in team) {
          final mStatus = (member['invite_status'] ?? '').toString().toLowerCase();
          final mUserId = member['user_id'];
          if (mStatus == 'pending' && mUserId != currentUserId) {
            final alreadyPresent = sentList.any((s) =>
                (s['patient_id'] == pId && s['invitee_user_id'] == mUserId) ||
                (s['access_id'] != null && member['access_id'] != null && s['access_id'] == member['access_id']));
            if (!alreadyPresent) {
              sentList.add({
                'access_id': member['access_id'] ?? 0,
                'patient_id': pId,
                'patient_name': pName,
                'relationship': member['relationship'] ?? 'Caregiver',
                'access_level': member['access_level'] ?? 'View',
                'invitee_user_id': mUserId,
                'invitee_first_name': member['first_name'] ?? '',
                'invitee_last_name': member['last_name'] ?? '',
                'invitee_email': member['email'] ?? '',
                'invitee_role': member['system_role'] ?? member['role'] ?? 'Caregiver',
              });
            }
          }
        }
      }
      _sentPendingInvites = sentList;

      setState(() => _isLoading = false);
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Network connection issue: $err';
        _isLoading = false;
      });
    }
  }

  Future<void> _pollRealtimeUpdates() async {
    try {
      final results = await Future.wait([
        ApiService.get('/api/caregiver/patients'),
        ApiService.get('/api/assignments/pending-invites'),
        ApiService.get('/api/assignments/sent-invites'),
      ]);

      if (!mounted) return;

      final patientRes = results[0];
      final inviteRes = results[1];
      final sentInviteRes = results[2];

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

      if (sentInviteRes['success'] == true && sentInviteRes['data'] != null) {
        final newSent = (sentInviteRes['data'] as List<dynamic>)
            .map((s) => Map<String, dynamic>.from(s as Map))
            .toList();
        if (newSent.length != _sentPendingInvites.length) {
          _sentPendingInvites = newSent;
          hasUpdates = true;
        }
      }

      if (hasUpdates && mounted) {
        setState(() {});
      }
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // RESPOND TO INVITATIONS (ACCEPT / DECLINE)
  // ---------------------------------------------------------------------------
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
            action == 'accept' ? 'Invitation accepted! Telemetry now active.' : 'Invitation declined.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: action == 'accept' ? _caregiverGreen : Colors.grey[700],
          behavior: SnackBarBehavior.floating,
        ),
      );
      _loadAll();
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

  // ---------------------------------------------------------------------------
  // REVOKE / CANCEL SENT INVITATION (BY INVITER)
  // ---------------------------------------------------------------------------
  Future<void> _handleRevokeSentInvite(Map<String, dynamic> invite) async {
    final patientName = invite['patient_name'] ?? 'Patient';
    final inviteeName = '${invite['invitee_first_name'] ?? ''} ${invite['invitee_last_name'] ?? ''}'.trim();
    final displayName = inviteeName.isNotEmpty ? inviteeName : (invite['invitee_email'] ?? 'Caregiver');
    final accessId = invite['access_id'];
    final patientId = invite['patient_id'];
    final inviteeUserId = invite['invitee_user_id'];

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          "Revoke Invitation?",
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold, color: _dangerRed),
        ),
        content: Text(
          "Are you sure you want to cancel the pending invitation sent to $displayName for $patientName's care team?",
          style: GoogleFonts.albertSans(fontSize: 13, color: Colors.grey[700]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Keep")),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: _dangerRed),
            child: const Text("Revoke", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    Map<String, dynamic> result = {'success': false};

    if (accessId != null && accessId != 0) {
      result = await ApiService.delete('/api/assignments/revoke-invite/$accessId');
    }

    if (result['success'] != true && patientId != null && inviteeUserId != null) {
      result = await ApiService.delete('/api/caregiver/patients/$patientId/care-team/$inviteeUserId');
    }

    if (!mounted) return;

    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Invitation for $displayName has been revoked.'),
          backgroundColor: Colors.grey[800],
          behavior: SnackBarBehavior.floating,
        ),
      );
      _loadAll();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Failed to revoke invitation.'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // SELF-RESIGN FROM CAREGIVER ASSIGNMENT
  // ---------------------------------------------------------------------------
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
          "Are you sure you want to resign from caring for $patientName? You will lose real-time telemetry access.",
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
          content: Text('You have resigned from $patientName\'s care team.'),
          backgroundColor: Colors.grey[800],
          behavior: SnackBarBehavior.floating,
        ),
      );
      _loadAll();
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
  // REMOVE CAREGIVER FROM PATIENT (BY ADMIN / PARENT)
  // ---------------------------------------------------------------------------
  Future<void> _handleRemoveCaregiverFromTeam(int patientId, int userId, String memberName) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          "Remove Caregiver?",
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold, color: _dangerRed),
        ),
        content: Text(
          "Are you sure you want to remove $memberName from this patient's care team?",
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

    final result = await ApiService.delete('/api/caregiver/patients/$patientId/care-team/$userId');

    if (!mounted) return;

    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$memberName has been removed from the care team.'),
          backgroundColor: _dangerRed,
          behavior: SnackBarBehavior.floating,
        ),
      );
      _loadAll();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Failed to remove caregiver.'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // INVITE MEMBER MODAL
  // ---------------------------------------------------------------------------
  void _showInviteMemberModal(BuildContext context, {String? defaultPatientName}) {
    final emailCtrl = TextEditingController();
    String? selectedPatient = defaultPatientName ??
        (_patients.isNotEmpty ? (_patients.first['name'] ?? _patients.first['patient_id']?.toString()) : null);
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
                          'Assigns a member as Pending until they accept.',
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

              Text('Member Email Address', style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600)),
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

              Text('Target Patient', style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600)),
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
                    hint: const Text('Select patient...'),
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

              Text('Role in Care Team', style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600)),
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
              const SizedBox(height: 22),

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
                              const SnackBar(content: Text('Please select a target patient.')),
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
  // MAIN BUILD & 3-TAB INTERFACE
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
          'Assignment Command Center',
          style: GoogleFonts.poppins(
            fontSize: 16,
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
            tooltip: 'Refresh Feed',
            onPressed: _loadAll,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: _darkTeal,
          unselectedLabelColor: Colors.grey[600],
          indicatorColor: _teal,
          indicatorWeight: 3,
          isScrollable: true,
          labelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: [
            Tab(
              icon: const Icon(Icons.groups_outlined, size: 20),
              text: 'Care Teams (${_patients.length})',
            ),
            Builder(
              builder: (context) {
                final totalPending = _pendingInvites.length + _sentPendingInvites.length;
                return Tab(
                  icon: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Icon(Icons.mail_outline, size: 20),
                      if (totalPending > 0)
                        Positioned(
                          top: -4,
                          right: -8,
                          child: Container(
                            padding: const EdgeInsets.all(3),
                            decoration: const BoxDecoration(color: _dangerRed, shape: BoxShape.circle),
                            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                            child: Text(
                              '$totalPending',
                              style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  ),
                  text: 'Pending ($totalPending)',
                );
              },
            ),
            Tab(
              icon: const Icon(Icons.link, size: 20),
              text: 'Active Assignments (${_patients.length})',
            ),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: _teal))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center, style: GoogleFonts.albertSans()),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadAll,
                          style: ElevatedButton.styleFrom(backgroundColor: _teal),
                          child: const Text('Retry', style: TextStyle(color: Colors.white)),
                        )
                      ],
                    ),
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildCareTeamsTab(),
                    _buildPendingAssignmentsTab(),
                    _buildActiveAssignmentsTab(),
                  ],
                ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 1: CARE TEAMS (SCREENSHOT 2 PARITY)
  // ---------------------------------------------------------------------------
  Widget _buildCareTeamsTab() {
    final filtered = _patients.where((p) {
      final name = (p['name'] ?? '').toString().toLowerCase();
      final q = _careTeamSearchQuery.toLowerCase();
      return name.contains(q);
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 18.0, vertical: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Care Team Management',
                    style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF2D3436)),
                  ),
                  Text(
                    'Manage caregivers and monitor their invitation status in real-time.',
                    style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
              IconButton(
                onPressed: _loadAll,
                icon: const Icon(Icons.refresh, color: _darkTeal, size: 20),
                tooltip: 'Refresh Care Teams',
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Search and Global Invite
          Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: TextField(
                    controller: _careTeamSearchController,
                    onChanged: (v) => setState(() => _careTeamSearchQuery = v),
                    decoration: const InputDecoration(
                      hintText: 'Search patients...',
                      prefixIcon: Icon(Icons.search, size: 20, color: Colors.grey),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: () => _showInviteMemberModal(context),
                icon: const Icon(Icons.person_add_alt_1, size: 16, color: Colors.white),
                label: Text('Invite Member', style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _teal,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          if (filtered.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Text('No patient care teams found.', style: GoogleFonts.albertSans(color: Colors.grey)),
              ),
            )
          else
            ...filtered.map((patient) => _buildPatientCareTeamCard(patient)),
        ],
      ),
    );
  }

  Widget _buildPatientCareTeamCard(Map<String, dynamic> patient) {
    final patientId = patient['patient_id'] as int;
    final patientName = patient['name'] ?? 'Patient #$patientId';
    final members = _careTeams[patientId] ?? [];

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
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
          // Card Header with Patient Info + Inline Invite Member Button
          Padding(
            padding: const EdgeInsets.all(14.0),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        patientName,
                        style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D3436)),
                      ),
                      Text(
                        'Patient ID: $patientId',
                        style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[600]),
                      ),
                    ],
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: () => _showInviteMemberModal(context, defaultPatientName: patientName),
                  icon: const Icon(Icons.person_add_alt_1, size: 14, color: _darkTeal),
                  label: Text('Invite Member', style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.bold, color: _darkTeal)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: _darkTeal),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Caregiver roster subheader
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Text(
              'ASSIGNED CAREGIVERS (${members.length})',
              style: GoogleFonts.poppins(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[600], letterSpacing: 0.5),
            ),
          ),

          if (members.isEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 14, right: 14, bottom: 14),
              child: Text(
                'No care team members assigned yet. Click "Invite Member" to add one.',
                style: GoogleFonts.albertSans(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.grey[500]),
              ),
            )
          else
            ...members.map((member) => _buildMemberRow(patientId, member)),
        ],
      ),
    );
  }

  Widget _buildMemberRow(int patientId, Map<String, dynamic> member) {
    final userId = member['user_id'] as int;
    final firstName = member['first_name'] ?? '';
    final lastName = member['last_name'] ?? '';
    final name = '$firstName $lastName'.trim().isNotEmpty ? '$firstName $lastName'.trim() : 'Care Team Member';
    final email = member['email'] ?? '';
    final relationship = member['relationship'] ?? 'Caregiver';
    final status = (member['invite_status'] ?? 'Active').toString();
    final isCurrentUser = userId == UserSession.current?.id;

    Color statusColor;
    String statusLabel;
    IconData? statusIcon;

    if (status.toLowerCase() == 'pending') {
      statusColor = _adminOrange;
      statusLabel = 'Pending Acceptance';
      statusIcon = Icons.access_time;
    } else if (status.toLowerCase() == 'declined') {
      statusColor = _dangerRed;
      statusLabel = 'Declined';
      statusIcon = Icons.cancel_outlined;
    } else {
      statusColor = _caregiverGreen;
      statusLabel = 'Active';
      statusIcon = Icons.check_circle_outline;
    }

    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'U';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Colors.grey.shade100)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: const Color(0xFF5FA9A9).withValues(alpha: 0.15),
            child: Text(
              initial,
              style: const TextStyle(color: _darkTeal, fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF2D3436)),
                ),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        email,
                        style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[600]),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        relationship,
                        style: GoogleFonts.albertSans(fontSize: 10, color: Colors.grey[700]),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),

          // Status Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: statusColor.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(statusIcon, size: 12, color: statusColor),
                const SizedBox(width: 4),
                Text(
                  statusLabel,
                  style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          // Remove Caregiver Button (cannot remove self)
          if (!isCurrentUser)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: _dangerRed, size: 18),
              tooltip: 'Remove Caregiver',
              onPressed: () => _handleRemoveCaregiverFromTeam(patientId, userId, name),
            ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 2: PENDING ASSIGNMENTS (DEDICATED SEPARATE TAB)
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // TAB 2: PENDING ASSIGNMENTS (RECEIVED & SENT INVITATIONS)
  // ---------------------------------------------------------------------------
  Widget _buildPendingAssignmentsTab() {
    final totalPending = _pendingInvites.length + _sentPendingInvites.length;

    final showReceived = _pendingFilter == 'all' || _pendingFilter == 'received';
    final showSent = _pendingFilter == 'all' || _pendingFilter == 'sent';

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 18.0, vertical: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pending Care Team Invitations ($totalPending)',
                      style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF2D3436)),
                    ),
                    Text(
                      'Accept incoming care team invites or track invites you dispatched.',
                      style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: _loadAll,
                icon: const Icon(Icons.refresh, color: _darkTeal, size: 20),
                tooltip: 'Refresh Invitations',
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Segmented Filter Pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('all', 'All ($totalPending)'),
                const SizedBox(width: 8),
                _buildFilterChip('received', 'Received (${_pendingInvites.length})'),
                const SizedBox(width: 8),
                _buildFilterChip('sent', 'Sent by You (${_sentPendingInvites.length})'),
              ],
            ),
          ),
          const SizedBox(height: 18),

          if (totalPending == 0)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF9E6),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _adminOrange.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  const Icon(Icons.mail_outline, color: _adminOrange, size: 40),
                  const SizedBox(height: 12),
                  Text(
                    'No pending invitations at this time.',
                    style: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: Colors.grey[800], fontSize: 14),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'When you invite caregivers or receive care team invites, they will appear here.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.albertSans(color: Colors.grey[600], fontSize: 12),
                  ),
                ],
              ),
            )
          else ...[
            // SECTION 1: INVITATIONS RECEIVED (TO JOIN OTHER TEAMS)
            if (showReceived) ...[
              Row(
                children: [
                  const Icon(Icons.inbox_outlined, size: 18, color: _teal),
                  const SizedBox(width: 8),
                  Text(
                    'Invitations Received (${_pendingInvites.length})',
                    style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF2D3436)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Care teams that invited you to join. Accept to begin monitoring vitals.',
                style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[600]),
              ),
              const SizedBox(height: 10),

              if (_pendingInvites.isEmpty)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 18),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Text(
                    'No incoming invitations waiting for your response.',
                    style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey[500], fontStyle: FontStyle.italic),
                  ),
                )
              else ...[
                ..._pendingInvites.map((invite) => _buildPendingInviteCard(invite)),
                const SizedBox(height: 14),
              ],
            ],

            // SECTION 2: INVITATIONS SENT (TO YOUR CAREGIVERS/STAFF)
            if (showSent) ...[
              Row(
                children: [
                  const Icon(Icons.send_outlined, size: 18, color: _adminOrange),
                  const SizedBox(width: 8),
                  Text(
                    'Invitations Sent to Caregivers (${_sentPendingInvites.length})',
                    style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF2D3436)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Caregivers you enrolled or invited. Awaiting their acceptance before access is granted.',
                style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[600]),
              ),
              const SizedBox(height: 10),

              if (_sentPendingInvites.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Text(
                    'No pending invitations sent to caregivers.',
                    style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey[500], fontStyle: FontStyle.italic),
                  ),
                )
              else
                ..._sentPendingInvites.map((invite) => _buildSentPendingInviteCard(invite)),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _pendingFilter == key;
    return InkWell(
      onTap: () => setState(() => _pendingFilter = key),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? _darkTeal : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? _darkTeal : Colors.grey.shade300),
          boxShadow: isSelected
              ? [BoxShadow(color: _darkTeal.withValues(alpha: 0.25), blurRadius: 4, offset: const Offset(0, 2))]
              : [],
        ),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? Colors.white : Colors.grey[700],
          ),
        ),
      ),
    );
  }

  Widget _buildSentPendingInviteCard(Map<String, dynamic> invite) {
    final patientName = invite['patient_name'] ?? 'Patient';
    final firstName = invite['invitee_first_name'] ?? '';
    final lastName = invite['invitee_last_name'] ?? '';
    final fullName = '$firstName $lastName'.trim();
    final email = invite['invitee_email'] ?? '';
    final inviteeDisplayName = fullName.isNotEmpty ? fullName : (email.isNotEmpty ? email : 'Invited Caregiver');
    final relationship = invite['relationship'] ?? 'Assigned Caregiver';

    final initial = inviteeDisplayName.isNotEmpty ? inviteeDisplayName[0].toUpperCase() : 'C';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
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
                radius: 18,
                backgroundColor: _adminOrange.withValues(alpha: 0.15),
                child: Text(
                  initial,
                  style: const TextStyle(color: _adminOrange, fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      inviteeDisplayName,
                      style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14, color: const Color(0xFF2D3436)),
                    ),
                    if (email.isNotEmpty && email != inviteeDisplayName)
                      Text(
                        email,
                        style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[600]),
                      ),
                    Text(
                      'Patient: $patientName • $relationship',
                      style: GoogleFonts.albertSans(fontSize: 12, color: _darkTeal, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF9E6),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: _adminOrange),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.access_time, size: 12, color: _adminOrange),
                    const SizedBox(width: 4),
                    const Text(
                      'PENDING',
                      style: TextStyle(color: _adminOrange, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Waiting for caregiver to accept...',
                style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[500], fontStyle: FontStyle.italic),
              ),
              OutlinedButton.icon(
                onPressed: () => _handleRevokeSentInvite(invite),
                icon: const Icon(Icons.close, size: 14, color: _dangerRed),
                label: const Text('Cancel Invite', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _dangerRed,
                  side: const BorderSide(color: _dangerRed),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPendingInviteCard(Map<String, dynamic> invite) {
    final patientName = invite['patient_name'] ?? 'Patient';
    final inviter = '${invite['invited_by_first_name'] ?? ''} ${invite['invited_by_last_name'] ?? ''}'.trim();
    final relationship = invite['relationship'] ?? 'Caregiver';
    final accessId = invite['access_id'] as int;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _adminOrange.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: _adminOrange.withValues(alpha: 0.08),
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
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: _adminOrange.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.access_time, color: _adminOrange, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      patientName,
                      style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 15, color: const Color(0xFF2D3436)),
                    ),
                    Text(
                      'Role: $relationship',
                      style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey[700]),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF9E6),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: _adminOrange),
                ),
                child: const Text(
                  'PENDING',
                  style: TextStyle(color: _adminOrange, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          if (inviter.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Invited by: $inviter',
              style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[600]),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _respondToInvite(accessId, 'decline'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _dangerRed,
                    side: const BorderSide(color: _dangerRed),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  child: const Text('Decline', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _respondToInvite(accessId, 'accept'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _teal,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
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

  // ---------------------------------------------------------------------------
  // TAB 3: ACTIVE ASSIGNMENTS (SCREENSHOT 1 PARITY)
  // ---------------------------------------------------------------------------
  Widget _buildActiveAssignmentsTab() {
    final filtered = _patients.where((p) {
      final name = (p['name'] ?? '').toString().toLowerCase();
      final vitalSn = (p['vital_device_sn'] ?? p['device_serial_number'] ?? '').toString().toLowerCase();
      final diaperSn = (p['diaper_device_sn'] ?? '').toString().toLowerCase();
      final q = _assignmentSearchQuery.toLowerCase();
      return name.contains(q) || vitalSn.contains(q) || diaperSn.contains(q);
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 18.0, vertical: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Active Assignments',
                    style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF2D3436)),
                  ),
                  Text(
                    'Patients currently registered under your caregiver roster.',
                    style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
              IconButton(
                onPressed: _loadAll,
                icon: const Icon(Icons.refresh, color: _darkTeal, size: 20),
                tooltip: 'Refresh Feed',
              ),
            ],
          ),
          const SizedBox(height: 14),

          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: TextField(
              controller: _assignmentSearchController,
              onChanged: (v) => setState(() => _assignmentSearchQuery = v),
              decoration: const InputDecoration(
                hintText: 'Search patients...',
                prefixIcon: Icon(Icons.search, size: 20, color: Colors.grey),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
          const SizedBox(height: 16),

          if (filtered.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Text('No active assignments found.', style: GoogleFonts.albertSans(color: Colors.grey)),
              ),
            )
          else
            ...filtered.map((p) => _buildActivePatientCard(p)),
        ],
      ),
    );
  }

  Widget _buildActivePatientCard(Map<String, dynamic> patient) {
    final patientName = patient['name'] ?? 'Patient';
    final patientId = patient['patient_id'] as int;
    final vitalSn = patient['vital_device_sn'] ?? patient['device_serial_number'];
    final diaperSn = patient['diaper_device_sn'];
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      patientName,
                      style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16, color: const Color(0xFF2D3436)),
                    ),
                    Text(
                      'Patient ID: $patientId',
                      style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _caregiverGreen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'Assigned Caregiver',
                  style: TextStyle(color: _caregiverGreen, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Hardware device status
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

          // Telemetry snippet
          if (hr != null || moisture != null) ...[
            const SizedBox(height: 10),
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

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Access Level: View',
                style: GoogleFonts.albertSans(fontSize: 11, color: Colors.grey[600]),
              ),
              TextButton.icon(
                onPressed: () => _confirmSelfRemove(patientId, patientName),
                icon: const Icon(Icons.delete_outline, size: 16, color: _dangerRed),
                label: Text(
                  'Resign',
                  style: GoogleFonts.poppins(color: _dangerRed, fontSize: 12, fontWeight: FontWeight.bold),
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
    final displaySerial = isLinked ? serial.toString() : 'None';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isLinked ? activeColor.withValues(alpha: 0.08) : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isLinked ? activeColor.withValues(alpha: 0.3) : Colors.grey.shade300,
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: isLinked ? activeColor : Colors.grey),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: GoogleFonts.poppins(fontSize: 9, fontWeight: FontWeight.bold, color: isLinked ? activeColor : Colors.grey[600])),
                Text(displaySerial, style: GoogleFonts.albertSans(fontSize: 10, color: Colors.black87), overflow: TextOverflow.ellipsis),
              ],
            ),
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
}