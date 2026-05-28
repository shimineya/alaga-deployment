import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Live data from GET /api/assignments/my-assignments
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
  static const Color _dangerRed = Color(0xFFE57373);

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  List<Map<String, dynamic>> _assignments = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchAssignments();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // [INTEGRATION] Fetches assigned patients and their care teams from
  // GET /api/assignments/my-assignments.
  // Each row in the response is a patient the current user has access to,
  // along with the full care_team array.
  Future<void> _fetchAssignments() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await ApiService.get('/assignments/my-assignments');

    if (!mounted) return;

    if (result['success'] == true) {
      final data = (result['data'] as List<dynamic>? ?? [])
          .map((a) => Map<String, dynamic>.from(a as Map))
          .toList();
      setState(() {
        _assignments = data;
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage = result['message'] ?? 'Failed to load assignments.';
        _isLoading = false;
      });
    }
  }

  // [INTEGRATION] Revoke access for a caregiver
  Future<void> _revokeAccess(int patientId, int targetUserId) async {
    final result = await ApiService.delete(
      '/assignments/caregiver/revoke',
      body: {
        'patient_id': patientId,
        'target_user_id': targetUserId,
      },
    );
    if (!mounted) return;
    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Caregiver access revoked.')),
      );
      _fetchAssignments();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'] ?? 'Failed to revoke access.')),
      );
    }
  }

  // [INTEGRATION] Update permissions for a caregiver
  Future<void> _updatePermissions(int patientId, int targetUserId, String relationship, String accessLevel) async {
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
    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Permissions updated successfully.')),
      );
      _fetchAssignments();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'] ?? 'Failed to update permissions.')),
      );
    }
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
            final roles = {'Primary Caregiver', 'Secondary Caregiver', 'Parent', 'Doctor', 'Nurse', selectedRole};
            final accesses = {'Admin', 'Edit', 'View', selectedAccess};
            return AlertDialog(
              title: const Text('Edit Permissions'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Caregiver: ${member['first_name'] ?? ''} ${member['last_name'] ?? ''}'),
                  const SizedBox(height: 16),
                  Tooltip(
                    message: 'Select the relationship of the caregiver to the patient.',
                    child: const Text('Role:'),
                  ),
                  DropdownButton<String>(
                    isExpanded: true,
                    value: selectedRole,
                    items: roles
                        .map((role) => DropdownMenuItem(value: role, child: Text(role)))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setStateDialog(() => selectedRole = val);
                    },
                  ),
                  const SizedBox(height: 16),
                  Tooltip(
                    message: 'Admin allows editing everything. Edit allows data changes. View is read-only.',
                    child: const Text('Access Level:'),
                  ),
                  DropdownButton<String>(
                    isExpanded: true,
                    value: selectedAccess,
                    items: accesses
                        .map((level) => DropdownMenuItem(value: level, child: Text(level)))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setStateDialog(() => selectedAccess = val);
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
                    _updatePermissions(patientId, targetUserId, selectedRole, selectedAccess);
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: _teal, foregroundColor: Colors.white),
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
          title: const Text('Remove Caregiver'),
          content: Text('Are you sure you want to remove ${member['first_name'] ?? ''} ${member['last_name'] ?? ''} from the care team?'),
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
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
              child: const Text('Remove'),
            ),
          ],
        );
      },
    );
  }

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
          IconButton(
            icon: const Icon(Icons.refresh_outlined, color: Colors.black54),
            tooltip: 'Refresh',
            onPressed: _fetchAssignments,
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
                style: GoogleFonts.poppins(color: Colors.grey, fontSize: 14)),
            const SizedBox(height: 16),

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
                  borderSide: const BorderSide(color: _teal, width: 1.5),
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
                _statCard('Total Patients',
                    '${_assignments.length}', Icons.people_outline, Colors.blue),
                _statCard('My Assignments',
                    '${_assignments.length}', Icons.assignment_ind_outlined, _teal),
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
                      style: GoogleFonts.albertSans(color: Colors.grey)),
                  const SizedBox(height: 16),
                  TextButton(
                      onPressed: _fetchAssignments,
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

  Widget _buildAssignmentCard(Map<String, dynamic> data) {
    final patientId = data['patient_id'];
    final name = data['name'] ?? 'Unknown Patient';
    final accessLevel = data['access_level'] ?? 'View';
    final relationship = data['relationship'] ?? 'Caregiver';
    final careTeam = (data['care_team'] as List<dynamic>? ?? [])
        .map((m) => Map<String, dynamic>.from(m as Map))
        .toList();
    final teamCount = data['care_team_count'] ?? careTeam.length;

    final isPrimary = accessLevel == 'Edit' || accessLevel == 'Admin';
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
                            color: _teal, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  Text(name,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16)),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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

          // Relationship and access
          _infoRow(Icons.badge_outlined, 'Your Role', relationship),
          _infoRow(Icons.lock_outline, 'Access Level', accessLevel),
          _infoRow(Icons.group_outlined, 'Care Team Size', '$teamCount member(s)'),

          // Care team members
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
                  '${member['first_name'] ?? ''} ${member['last_name'] ?? ''}'.trim();
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
                    border:
                        const Border(left: BorderSide(color: _teal, width: 3)),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: _teal.withOpacity(0.15),
                        child: Text(
                          mName.isNotEmpty ? mName[0].toUpperCase() : 'U',
                          style: const TextStyle(
                              color: _teal,
                              fontSize: 11,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
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
                      if (isPrimary && patientId != null) ...[
                        IconButton(
                          icon: const Icon(Icons.edit_outlined, size: 18, color: Colors.blue),
                          tooltip: 'Edit Permissions', // [User Experience] Tooltip for non-technical users
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () => _showEditDialog(patientId, member),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red),
                          tooltip: 'Remove Caregiver', // [User Experience] Tooltip for clear actions
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () => _showRevokeDialog(patientId, member),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(icon, size: 14, color: Colors.grey),
          const SizedBox(width: 8),
          Text('$label: ',
              style:
                  const TextStyle(fontSize: 12, color: Colors.grey)),
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
                    style: const TextStyle(fontSize: 9, color: Colors.grey),
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