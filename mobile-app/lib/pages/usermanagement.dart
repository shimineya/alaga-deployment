import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Live data from GET /api/caregiver/users
import '../services/api_service.dart';
import '../models/user_session.dart';

class UserManagementScreen extends StatefulWidget {
  const UserManagementScreen({super.key});

  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen> {
  static const Color _teal = Color(0xFF5FA9A9);
  static const Color _staffBlue = Color(0xFF4A8BF5);
  static const Color _caregiverGreen = Color(0xFF38C976);
  static const Color _adminOrange = Color(0xFFF58A4A);
  static const Color _dangerRed = Color(0xFFE57373);
  static const Color _pageBg = Color(0xFFFFFDF5);

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  List<Map<String, dynamic>> _users = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // [INTEGRATION] Fetches all users visible to the logged-in user
  // from GET /api/caregiver/users. Admins see all users;
  // caregivers see only teammates on shared patients.
  Future<void> _fetchUsers() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await ApiService.get('/caregiver/users');

    if (!mounted) return;

    if (result['success'] == true) {
      final data = (result['data'] as List<dynamic>? ?? [])
          .map((u) => Map<String, dynamic>.from(u as Map))
          .toList();
      setState(() {
        _users = data;
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage = result['message'] ?? 'Failed to load users.';
        _isLoading = false;
      });
    }
  }

  // Maps the backend role string to a readable display label
  String _formatRole(String role) {
    switch (role) {
      case 'medical_staff':
        return 'Medical Staff';
      case 'caregiver':
        return 'Caregiver';
      case 'admin':
      case 'facility_admin':
        return 'Facility Admin';
      case 'system_admin':
        return 'System Admin';
      default:
        return role;
    }
  }

  Color _roleColor(String role) {
    switch (role) {
      case 'medical_staff':
        return _staffBlue;
      case 'admin':
      case 'facility_admin':
      case 'system_admin':
        return _adminOrange;
      default:
        return _caregiverGreen;
    }
  }

  // Counts by role from live data
  int get _staffCount => _users.where((u) => u['role'] == 'medical_staff').length;
  int get _caregiverCount => _users.where((u) => u['role'] == 'caregiver').length;
  int get _adminCount =>
      _users.where((u) => u['role'] == 'admin' || u['role'] == 'facility_admin').length;

  @override
  Widget build(BuildContext context) {
    final filtered = _users.where((user) {
      final name =
          '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.toLowerCase();
      final email = (user['email'] ?? '').toString().toLowerCase();
      final username = (user['username'] ?? '').toString().toLowerCase();
      final q = _searchQuery.toLowerCase();
      return name.contains(q) || email.contains(q) || username.contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        backgroundColor: _pageBg,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back, color: Colors.black),
        ),
        title: const Text(''),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, color: Colors.black54),
            tooltip: 'Refresh',
            onPressed: _fetchUsers,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Access Center',
              style: GoogleFonts.poppins(
                  fontWeight: FontWeight.w500, fontSize: 14, color: _teal),
            ),
            Text(
              'User Management',
              style: GoogleFonts.poppins(
                  fontWeight: FontWeight.bold,
                  fontSize: 28,
                  color: const Color(0xFF2D3436)),
            ),
            const SizedBox(height: 4),
            Text('Manage staff and caregiver access.',
                style: GoogleFonts.poppins(color: Colors.grey[600], fontSize: 14)),
            const SizedBox(height: 24),

            // --- Stat Cards ---
            Row(
              children: [
                _statCard('Total', '${_users.length}',
                    Icons.people_alt_outlined, Colors.black87),
                const SizedBox(width: 10),
                _statCard('Medical Staff', '$_staffCount',
                    Icons.medical_services_outlined, _staffBlue),
                const SizedBox(width: 10),
                _statCard('Caregivers', '$_caregiverCount',
                    Icons.badge_outlined, _caregiverGreen),
                const SizedBox(width: 10),
                _statCard('Admins', '$_adminCount',
                    Icons.admin_panel_settings_outlined, _adminOrange),
              ],
            ),
            const SizedBox(height: 20),

            // --- Search Bar ---
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (v) => setState(() => _searchQuery = v),
                decoration: const InputDecoration(
                  hintText: 'Search by name, email, or username...',
                  prefixIcon: Icon(Icons.search),
                  border: InputBorder.none,
                  contentPadding:
                      EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // --- Body ---
            if (_isLoading)
              const Center(
                  child: Padding(
                padding: EdgeInsets.only(top: 60),
                child: CircularProgressIndicator(color: _teal),
              ))
            else if (_errorMessage != null)
              Center(
                  child: Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Column(
                  children: [
                    const Icon(Icons.error_outline,
                        color: Colors.redAccent, size: 48),
                    const SizedBox(height: 12),
                    Text(_errorMessage!,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.albertSans(color: Colors.grey)),
                    const SizedBox(height: 16),
                    TextButton(
                        onPressed: _fetchUsers,
                        child: const Text('Retry',
                            style: TextStyle(color: _teal))),
                  ],
                ),
              ))
            else if (filtered.isEmpty)
              Center(
                  child: Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Column(
                  children: [
                    const Icon(Icons.group_off_outlined,
                        color: Colors.grey, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      _searchQuery.isEmpty
                          ? 'No users in the system yet.'
                          : 'No users match your search.',
                      style: GoogleFonts.albertSans(color: Colors.grey),
                    ),
                  ],
                ),
              ))
            else
              ...filtered.map(
                (user) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _buildUserCard(user),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade100),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 6),
            Text(value,
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: color, fontSize: 16)),
            Text(label,
                style: const TextStyle(color: Colors.grey, fontSize: 9),
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }

  Widget _buildUserCard(Map<String, dynamic> user) {
    final fullName =
        '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
    final displayName = fullName.isNotEmpty ? fullName : (user['username'] ?? 'Unknown');
    final role = user['role'] ?? 'caregiver';
    final status = user['account_status'] ?? 'Active';
    final isActive = status.toLowerCase().contains('active') ||
        status.toLowerCase() == 'verified';

    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: _teal.withValues(alpha: 0.1),
                child: Text(
                  displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U',
                  style: TextStyle(color: _teal, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(displayName,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                        overflow: TextOverflow.ellipsis),
                    Text(user['email'] ?? '',
                        style:
                            const TextStyle(color: Colors.grey, fontSize: 12),
                        overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 20),
          _infoRow('Role', _badge(_formatRole(role), _roleColor(role))),
          _infoRow(
              'Status',
              _badge(
                  isActive ? 'ACTIVE' : status.toUpperCase(),
                  isActive ? _caregiverGreen : Colors.grey)),

          // [OWASP A01] Remove User button — visible to parent accounts only.
          // [GDPR] Supports 'Right to Erasure' — parent can permanently revoke a user's access.
          if (UserSession.current?.isParent == true) ...[
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _confirmRemoveUser(context, user),
                icon: const Icon(Icons.person_remove_outlined,
                    size: 15, color: _dangerRed),
                label: Text(
                  'Remove User',
                  style: GoogleFonts.poppins(fontSize: 12, color: _dangerRed),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: _dangerRed),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _infoRow(String label, Widget value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: const TextStyle(color: Colors.grey, fontSize: 12)),
            value
          ],
        ),
      );

  Widget _badge(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration:
            BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
        child: Text(text,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold)),
      );

  // [OWASP A01] Only parent accounts can remove users.
  // [GDPR] Supports the Right to Erasure — parent-initiated account removal.
  // [OWASP A05] userId is sent as a typed path parameter — never concatenated.
  // A two-step confirmation dialog guards against accidental removal.
  Future<void> _confirmRemoveUser(
    BuildContext pageContext,
    Map<String, dynamic> user,
  ) async {
    final userId = user['id'] ?? user['user_id'];
    final fullName =
        '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
    final displayName =
        fullName.isNotEmpty ? fullName : (user['username'] ?? 'this user');

    final confirmed = await showDialog<bool>(
      context: pageContext,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          "Remove User?",
          style: GoogleFonts.poppins(
              fontWeight: FontWeight.bold, color: Colors.redAccent),
        ),
        content: Text(
          "You are about to permanently remove $displayName from the system. "
          "Their account and access credentials will be revoked immediately. "
          "This action cannot be undone.",
          style: GoogleFonts.albertSans(fontSize: 13, color: Colors.grey[700]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text("Cancel", style: GoogleFonts.poppins(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape:
                  RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text("Yes, Remove", style: GoogleFonts.poppins(fontSize: 13)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    // [OWASP A05] userId is sent as a path segment — no string concatenation into queries.
    final result = await ApiService.delete('/caregiver/users/$userId');

    if (!mounted) return;

    if (result['success'] == true) {
      _fetchUsers();
      ScaffoldMessenger.of(pageContext).showSnackBar(
        SnackBar(
          content: Text(
            "$displayName has been removed from the system.",
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      // [OWASP A10] Show only the server's generic error — no stack traces.
      ScaffoldMessenger.of(pageContext).showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ?? 'Failed to remove user.',
            style: GoogleFonts.albertSans(),
          ),
          backgroundColor: Colors.grey[700],
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}