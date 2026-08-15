import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

// [INTEGRATION] Live data from GET /api/assignments/my-assignments and
//               GET /api/assignments/pending-invites
import '../services/api_service.dart';

class AssignmentScreen extends StatefulWidget {
  const AssignmentScreen({super.key});

  @override
  State<AssignmentScreen> createState() => _AssignmentScreenState();
}

class _AssignmentScreenState extends State<AssignmentScreen> {
  static const Color _teal = Color(0xFF5FA9A9);
  static const Color _bgColor = Color(0xFFFDFCF5);
  static const Color _pendingOrange = Color(0xFFFF9F69);
  static const Color _activeGreen = Color(0xFF66CB9F);

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  List<Map<String, dynamic>> _assignments = [];
  List<Map<String, dynamic>> _pendingInvites = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchAll();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // DATA FETCHING
  // ---------------------------------------------------------------------------

  // [INTEGRATION] Fetches both active assignments and pending invitations in
  // parallel for efficiency. Pending invites are only fetched for caregivers
  // (non-parent users) since parents are the ones who send invitations.
  Future<void> _fetchAll() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    // Run both fetches concurrently
    final results = await Future.wait([
      ApiService.get('/assignments/my-assignments'),
      ApiService.get('/assignments/pending-invites'),
    ]);

    if (!mounted) return;

    final assignResult = results[0];
    final inviteResult = results[1];

    if (assignResult['success'] == true) {
      _assignments = (assignResult['data'] as List<dynamic>? ?? [])
          .map((a) => Map<String, dynamic>.from(a as Map))
          .toList();
    } else {
      _errorMessage = assignResult['message'] ?? 'Failed to load assignments.';
    }

    if (inviteResult['success'] == true) {
      _pendingInvites = (inviteResult['data'] as List<dynamic>? ?? [])
          .map((i) => Map<String, dynamic>.from(i as Map))
          .toList();
    }
    // Silently ignore invite fetch failure — assignments still display

    setState(() => _isLoading = false);

    // Show invite dialog automatically if there are pending invitations
    if (_pendingInvites.isNotEmpty && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showNextPendingInvite(0);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // PENDING INVITE DIALOG FLOW
  // [DPA] Caregivers must provide explicit, informed consent before being
  // linked to a patient's Protected Health Information (PHI).
  // ---------------------------------------------------------------------------

  void _showNextPendingInvite(int index) {
    if (index >= _pendingInvites.length || !mounted) return;
    final invite = _pendingInvites[index];
    _showInviteResponseDialog(invite, onDone: () {
      // After responding, show the next pending invite (if any)
      if (index + 1 < _pendingInvites.length) {
        _showNextPendingInvite(index + 1);
      } else {
        _fetchAll(); // Refresh data after all invites are handled
      }
    });
  }

  void _showInviteResponseDialog(
    Map<String, dynamic> invite, {
    required VoidCallback onDone,
  }) {
    final patientName = invite['patient_name'] ?? 'Unknown Patient';
    final relationship = invite['relationship'] ?? 'Caregiver';
    final accessLevel = invite['access_level'] ?? 'View';
    final inviterFirst = invite['invited_by_first_name'] ?? '';
    final inviterLast = invite['invited_by_last_name'] ?? '';
    final inviterName = '$inviterFirst $inviterLast'.trim();
    final invitedAt = invite['invited_at'];
    final accessId = invite['access_id'];

    showDialog(
      context: context,
      barrierDismissible: false, // [UX] Force explicit decision — no dismissal
      builder: (dialogContext) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Header icon
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: _teal.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.assignment_ind_outlined,
                    color: _teal,
                    size: 32,
                  ),
                ),
                const SizedBox(height: 16),

                Text(
                  'New Assignment',
                  style: GoogleFonts.poppins(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 8),

                Text(
                  inviterName.isNotEmpty
                      ? '$inviterName has assigned you to care for:'
                      : 'You have been assigned to care for:',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.albertSans(
                    fontSize: 13,
                    color: Colors.black54,
                  ),
                ),
                const SizedBox(height: 12),

                // Patient name card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                      vertical: 12, horizontal: 16),
                  decoration: BoxDecoration(
                    color: _teal.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _teal.withOpacity(0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        patientName,
                        style: GoogleFonts.poppins(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: const Color(0xFF2D3436),
                        ),
                      ),
                      const SizedBox(height: 4),
                      _inviteDetailRow(
                          Icons.badge_outlined, 'Your Role', relationship),
                      _inviteDetailRow(
                          Icons.lock_outline, 'Access Level', accessLevel),
                      // [UX] Tooltip suggestion: "View = read-only data.
                      // Edit = can update patient records."
                      if (invitedAt != null)
                        _inviteDetailRow(
                          Icons.schedule_outlined,
                          'Invited',
                          _formatInviteTime(invitedAt.toString()),
                        ),
                    ],
                  ),
                ),

                const SizedBox(height: 8),

                // [DPA] Plain-language consent notice
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.amber.shade200),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline,
                          size: 14, color: Colors.amber.shade700),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'By accepting, you will be granted access to view the '
                          'health data of this patient in accordance with the '
                          'Data Privacy Act of 2012.',
                          style: GoogleFonts.albertSans(
                            fontSize: 10,
                            color: Colors.amber.shade800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Action buttons
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          Navigator.pop(dialogContext);
                          _respondToInvite(
                              accessId, 'decline', onDone: onDone);
                        },
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: Colors.red.shade300),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: Text(
                          'Decline',
                          style: GoogleFonts.poppins(
                            color: Colors.red.shade400,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.pop(dialogContext);
                          _respondToInvite(
                              accessId, 'accept', onDone: onDone);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _teal,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: Text(
                          'Accept',
                          style: GoogleFonts.poppins(
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _inviteDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Row(
        children: [
          Icon(icon, size: 12, color: Colors.grey),
          const SizedBox(width: 6),
          Text('$label: ',
              style: const TextStyle(fontSize: 11, color: Colors.grey)),
          Flexible(
            child: Text(value,
                style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  String _formatInviteTime(String isoString) {
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return DateFormat('MMM d, h:mm a').format(dt);
    } catch (_) {
      return '';
    }
  }

  // [INTEGRATION] POST /assignments/respond-invite
  // Sends the caregiver's Accept/Decline decision to the backend.
  Future<void> _respondToInvite(
    dynamic accessId,
    String action, {
    required VoidCallback onDone,
  }) async {
    final result = await ApiService.post(
      '/assignments/respond-invite',
      body: {
        'access_id': accessId,
        'action': action,
      },
    );

    if (!mounted) return;

    final color = action == 'accept' ? _teal : Colors.redAccent;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result['message'] ??
            (action == 'accept'
                ? 'Assignment accepted.'
                : 'Assignment declined.')),
        backgroundColor: result['success'] == true ? color : Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );

    onDone();
  }

  // ---------------------------------------------------------------------------
  // SELF-REMOVAL
  // [DPA] The caregiver exercises their right to withdraw from a care role.
  // ---------------------------------------------------------------------------

  void _showSelfRemoveDialog(int patientId, String patientName) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Remove My Assignment',
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Are you sure you want to remove yourself from the care team of:',
              style: GoogleFonts.albertSans(fontSize: 13, color: Colors.black54),
            ),
            const SizedBox(height: 8),
            Text(
              patientName,
              style: GoogleFonts.poppins(
                  fontWeight: FontWeight.bold, color: const Color(0xFF2D3436)),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.orange.shade200),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.warning_amber_outlined,
                      size: 14, color: Colors.orange.shade700),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'You will lose access to this patient\'s health data. '
                      'A new assignment invitation will be required to regain access.',
                      style: GoogleFonts.albertSans(
                          fontSize: 10, color: Colors.orange.shade800),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Keep Assignment'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _selfRemove(patientId);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade400,
              foregroundColor: Colors.white,
            ),
            child: Text('Remove Me', style: GoogleFonts.poppins()),
          ),
        ],
      ),
    );
  }

  // [INTEGRATION] DELETE /assignments/caregiver/self-remove
  // [OWASP A01] The backend verifies the JWT matches the record being deleted —
  //             a user cannot remove someone else via this endpoint.
  Future<void> _selfRemove(int patientId) async {
    final result = await ApiService.delete(
      '/assignments/caregiver/self-remove',
      body: {'patient_id': patientId},
    );

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result['message'] ?? 'Assignment removed.'),
        backgroundColor:
            result['success'] == true ? _teal : Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );

    if (result['success'] == true) {
      _fetchAll();
    }
  }

  // ---------------------------------------------------------------------------
  // ADMIN: REVOKE ANOTHER CAREGIVER
  // ---------------------------------------------------------------------------

  Future<void> _revokeAccess(int patientId, int targetUserId) async {
    final result = await ApiService.delete(
      '/assignments/caregiver/revoke',
      body: {
        'patient_id': patientId,
        'target_user_id': targetUserId,
      },
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result['message'] ?? 'Caregiver access revoked.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    if (result['success'] == true) _fetchAll();
  }

  // ---------------------------------------------------------------------------
  // ADMIN: UPDATE PERMISSIONS
  // ---------------------------------------------------------------------------

  Future<void> _updatePermissions(
      int patientId, int targetUserId, String relationship, String accessLevel) async {
    final result = await ApiService.put(
      '/assignments/caregiver/permissions',
      body: {
        'patient_id': patientId,
        'target_user_id': targetUserId,
        'relationship': relationship,
        'access_level': accessLevel,
      },
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result['message'] ?? 'Permissions updated.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    if (result['success'] == true) _fetchAll();
  }

  void _showEditDialog(int patientId, Map<String, dynamic> member) {
    String selectedRole = member['relationship'] ?? 'Secondary Caregiver';
    String selectedAccess = member['access_level'] ?? 'View';
    final targetUserId = member['user_id'];

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            final roles = {
              'Primary Caregiver',
              'Secondary Caregiver',
              'Parent',
              'Doctor',
              'Nurse',
              selectedRole
            };
            final accesses = {'Admin', 'Edit', 'View', selectedAccess};
            return AlertDialog(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              title: Text('Edit Permissions',
                  style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Caregiver: ${member['first_name'] ?? ''} ${member['last_name'] ?? ''}',
                    style: GoogleFonts.albertSans(fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  Tooltip(
                    message:
                        'Select the relationship of the caregiver to the patient.',
                    child: const Text('Role:'),
                  ),
                  DropdownButton<String>(
                    isExpanded: true,
                    value: selectedRole,
                    items: roles
                        .map((role) =>
                            DropdownMenuItem(value: role, child: Text(role)))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setStateDialog(() => selectedRole = val);
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  Tooltip(
                    message:
                        'Admin allows editing everything. Edit allows data changes. View is read-only.',
                    child: const Text('Access Level:'),
                  ),
                  DropdownButton<String>(
                    isExpanded: true,
                    value: selectedAccess,
                    items: accesses
                        .map((level) => DropdownMenuItem(
                            value: level, child: Text(level)))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setStateDialog(() => selectedAccess = val);
                      }
                    },
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _updatePermissions(patientId, targetUserId, selectedRole,
                        selectedAccess);
                  },
                  style: ElevatedButton.styleFrom(
                      backgroundColor: _teal,
                      foregroundColor: Colors.white),
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showRevokeDialog(int patientId, Map<String, dynamic> member) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text('Remove Caregiver',
              style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
          content: Text(
            'Are you sure you want to remove '
            '${member['first_name'] ?? ''} ${member['last_name'] ?? ''} '
            'from the care team?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                _revokeAccess(patientId, member['user_id']);
              },
              style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red, foregroundColor: Colors.white),
              child: const Text('Remove'),
            ),
          ],
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final filtered = _assignments.where((a) {
      final name = (a['name'] ?? '').toString().toLowerCase();
      final q = _searchQuery.toLowerCase();
      return name.contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: _bgColor,
      appBar: AppBar(
        backgroundColor: _bgColor,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(''),
        actions: [
          // Pending invite badge button
          if (_pendingInvites.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications_active_outlined,
                        color: Colors.black54),
                    tooltip:
                        'You have ${_pendingInvites.length} pending assignment invitation(s). Tap to review.',
                    onPressed: () => _showNextPendingInvite(0),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Container(
                      width: 16,
                      height: 16,
                      decoration: const BoxDecoration(
                        color: Colors.redAccent,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          '${_pendingInvites.length}',
                          style: const TextStyle(
                              fontSize: 9,
                              color: Colors.white,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh_outlined, color: Colors.black54),
            tooltip: 'Refresh',
            onPressed: _fetchAll,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Monitor Dispatch',
              style: GoogleFonts.poppins(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: _teal.withOpacity(0.8)),
            ),
            Text(
              'Assignment Tracker',
              style: GoogleFonts.poppins(
                  fontWeight: FontWeight.bold,
                  fontSize: 28,
                  color: const Color(0xFF2D3436)),
            ),
            const SizedBox(height: 8),
            Text('Patients assigned to your care.',
                style:
                    GoogleFonts.poppins(color: Colors.grey, fontSize: 14)),
            const SizedBox(height: 16),

            // --- Pending Invitations Banner ---
            if (_pendingInvites.isNotEmpty) ...[
              GestureDetector(
                onTap: () => _showNextPendingInvite(0),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: _pendingOrange.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: _pendingOrange.withOpacity(0.4), width: 1.5),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.assignment_ind_outlined,
                          color: _pendingOrange, size: 22),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'You have ${_pendingInvites.length} pending assignment '
                          'invitation${_pendingInvites.length > 1 ? 's' : ''}. '
                          'Tap to review.',
                          style: GoogleFonts.albertSans(
                            fontSize: 12,
                            color: _pendingOrange,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Icon(Icons.chevron_right, color: _pendingOrange),
                    ],
                  ),
                ),
              ),
            ],

            // --- Search ---
            TextField(
              controller: _searchController,
              onChanged: (v) => setState(() => _searchQuery = v),
              decoration: InputDecoration(
                hintText: 'Search patient name...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.white,
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      BorderSide(color: Colors.grey.shade300, width: 1),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: _teal, width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // --- Stat Summary ---
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 2.5,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              children: [
                _statCard('Total Patients', '${_assignments.length}',
                    Icons.people_outline, Colors.blue),
                _statCard(
                    'Pending Invitations',
                    '${_pendingInvites.length}',
                    Icons.pending_actions_outlined,
                    _pendingInvites.isNotEmpty
                        ? _pendingOrange
                        : Colors.grey),
              ],
            ),
            const SizedBox(height: 24),

            Text('My Patients',
                style: GoogleFonts.poppins(
                    fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 16),

            // --- Content ---
            if (_isLoading)
              const Center(
                  child: Padding(
                padding: EdgeInsets.only(top: 40),
                child: CircularProgressIndicator(color: _teal),
              ))
            else if (_errorMessage != null)
              Center(
                  child: Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Column(children: [
                  const Icon(Icons.error_outline,
                      color: Colors.redAccent, size: 48),
                  const SizedBox(height: 12),
                  Text(_errorMessage!,
                      textAlign: TextAlign.center,
                      style:
                          GoogleFonts.albertSans(color: Colors.grey)),
                  const SizedBox(height: 16),
                  TextButton(
                      onPressed: _fetchAll,
                      child: const Text('Retry',
                          style: TextStyle(color: _teal))),
                ]),
              ))
            else if (filtered.isEmpty)
              Center(
                  child: Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Column(children: [
                  const Icon(Icons.assignment_outlined,
                      color: Colors.grey, size: 56),
                  const SizedBox(height: 12),
                  Text(
                    _searchQuery.isEmpty
                        ? 'No patients assigned to you yet.\nEnroll a patient to get started.'
                        : 'No patients match your search.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(color: Colors.grey),
                  ),
                ]),
              ))
            else
              ...filtered.map((assignment) => Padding(
                    padding: const EdgeInsets.only(bottom: 16.0),
                    child: _buildAssignmentCard(assignment),
                  )),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // ASSIGNMENT CARD
  // ---------------------------------------------------------------------------

  Widget _buildAssignmentCard(Map<String, dynamic> data) {
    final patientId = data['patient_id'];
    final name = data['name'] ?? 'Unknown Patient';
    final accessLevel = data['access_level'] ?? 'View';
    final relationship = data['relationship'] ?? 'Caregiver';
    final careTeam = (data['care_team'] as List<dynamic>? ?? [])
        .map((m) => Map<String, dynamic>.from(m as Map))
        .toList();
    final teamCount = data['care_team_count'] ?? careTeam.length;

    final isPrimary =
        accessLevel == 'Edit' || accessLevel == 'Admin';
    final statusColor = isPrimary ? _activeGreen : _pendingOrange;
    final statusLabel = isPrimary ? 'Primary' : 'Secondary';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 10,
              offset: const Offset(0, 4))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: _teal.withOpacity(0.1),
                    child: Text(name[0],
                        style: const TextStyle(
                            color: _teal,
                            fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  Text(name,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(statusLabel,
                    style: TextStyle(
                        color: statusColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const Divider(height: 20),

          // Role and access info
          _infoRow(Icons.badge_outlined, 'Your Role', relationship),
          _infoRow(Icons.lock_outline, 'Access Level', accessLevel),
          _infoRow(Icons.group_outlined, 'Care Team Size',
              '$teamCount member(s)'),

          // Care team members list
          if (careTeam.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('Care Team',
                style: GoogleFonts.poppins(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey)),
            const SizedBox(height: 8),
            ...careTeam.map((member) {
              final mName =
                  '${member['first_name'] ?? ''} ${member['last_name'] ?? ''}'
                      .trim();
              final mRole = member['role'] ?? '';
              final mRelationship = member['relationship'] ?? '';
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: _teal.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(8),
                    border: const Border(
                        left: BorderSide(color: _teal, width: 3)),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: _teal.withOpacity(0.15),
                        child: Text(
                          mName.isNotEmpty
                              ? mName[0].toUpperCase()
                              : 'U',
                          style: const TextStyle(
                              color: _teal,
                              fontSize: 11,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment:
                              CrossAxisAlignment.start,
                          children: [
                            Text(mName,
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold)),
                            Text(
                              '$mRelationship${mRole.isNotEmpty ? ' • $mRole' : ''}',
                              style: const TextStyle(
                                  fontSize: 11, color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                      // Admin controls to edit/remove other caregivers
                      if (isPrimary && patientId != null) ...[
                        IconButton(
                          icon: const Icon(Icons.edit_outlined,
                              size: 18, color: Colors.blue),
                          tooltip: 'Edit Permissions',
                          // [User Experience] Tooltip text: "Change this caregiver's role or access level."
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () =>
                              _showEditDialog(patientId, member),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          icon: const Icon(Icons.person_remove_outlined,
                              size: 18, color: Colors.red),
                          tooltip: 'Remove Caregiver from Care Team',
                          // [User Experience] Tooltip text: "Remove this person from the patient's care team."
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () =>
                              _showRevokeDialog(patientId, member),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
          ],

          const SizedBox(height: 12),

          // "Cancel My Assignment" — available to all caregivers for their own record
          // [DPA] This gives the caregiver the right to withdraw from a care role.
          if (patientId != null)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () =>
                    _showSelfRemoveDialog(patientId, name),
                icon: const Icon(Icons.exit_to_app_outlined,
                    size: 15, color: Colors.red),
                label: Text(
                  'Cancel My Assignment',
                  style: GoogleFonts.poppins(
                    fontSize: 11,
                    color: Colors.red,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // HELPER WIDGETS
  // ---------------------------------------------------------------------------

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(icon, size: 14, color: Colors.grey),
          const SizedBox(width: 8),
          Text('$label: ',
              style: const TextStyle(fontSize: 12, color: Colors.grey)),
          Text(value,
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _statCard(
      String label, String count, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 9, color: Colors.grey),
                    overflow: TextOverflow.ellipsis),
                Text(count,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}