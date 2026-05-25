import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:alaga/pages/login.dart';

// [INTEGRATION] Import API service and session management
import '../services/api_service.dart';
import '../models/user_session.dart';

class ProfileScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const ProfileScreen({super.key, this.onBack});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isEditing = false;
  bool _isChangingPassword = false;
  bool _isLoading = true;
  bool _isSaving = false;

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  bool _hasMinLength = false;
  bool _hasUpperLower = false;
  bool _hasNumberSymbol = false;

  // [INTEGRATION] Profile data loaded from the backend
  String _email = '';
  String _role = '';
  String? _profilePictureUrl;

  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _currentPasswordController = TextEditingController();
  final TextEditingController _newPasswordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  // --- Colour & font constants ---
  static const Color _teal = Color(0xFF4DB6AC);
  static const Color _bgColor = Color(0xFFF5F5F0);

  TextStyle get _titleStyle => GoogleFonts.poppins(
        fontWeight: FontWeight.bold,
        fontSize: 24,
        color: const Color(0xFF2D3436),
      );

  TextStyle get _sectionHeaderStyle => GoogleFonts.poppins(
        fontWeight: FontWeight.bold,
        fontSize: 16,
      );

  TextStyle get _bodyStyle => GoogleFonts.albertSans(
        fontSize: 13,
        color: Colors.black54,
      );

  TextStyle get _labelStyle => GoogleFonts.albertSans(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: Colors.grey,
      );

  @override
  void initState() {
    super.initState();
    _newPasswordController.addListener(_checkRequirements);
    _fetchProfile();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _usernameController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  // [INTEGRATION] Fetches the user's profile data from GET /api/user/profile.
  // Populates all text controllers with the backend data.
  Future<void> _fetchProfile() async {
    setState(() => _isLoading = true);

    final result = await ApiService.get('/user/profile');

    if (!mounted) return;

    if (result['success'] == true && result['profile'] != null) {
      final profile = result['profile'];
      setState(() {
        _firstNameController.text = profile['first_name'] ?? '';
        _lastNameController.text = profile['last_name'] ?? '';
        _phoneController.text = profile['mobile_number'] ?? '';
        _usernameController.text = profile['username'] ?? '';
        _email = profile['email'] ?? '';
        _role = profile['role'] ?? 'caregiver';
        _profilePictureUrl = profile['profile_picture_url'];
        _isLoading = false;
      });
    } else {
      setState(() => _isLoading = false);
      _showSnackBar(result['message'] ?? 'Failed to load profile.', isError: true);
    }
  }

  void _checkRequirements() {
    final pass = _newPasswordController.text;
    setState(() {
      _hasMinLength = pass.length >= 12;
      _hasUpperLower = pass.contains(RegExp(r'[A-Z]')) &&
          pass.contains(RegExp(r'[a-z]'));
      _hasNumberSymbol = pass.contains(RegExp(r'[0-9]')) &&
          pass.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>+_-]'));
    });
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.albertSans()),
        backgroundColor: isError ? Colors.redAccent : _teal,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // [INTEGRATION] Saves profile changes via PUT /api/user/profile.
  // Only sends changed fields to adhere to Data Minimization (DPA).
  Future<void> _toggleEdit() async {
    if (_isEditing) {
      // Save changes to the backend
      setState(() => _isSaving = true);

      final result = await ApiService.put(
        '/user/profile',
        body: {
          'username': _usernameController.text.trim(),
          'mobile_number': _phoneController.text.trim(),
        },
      );

      if (!mounted) return;
      setState(() => _isSaving = false);

      if (result['success'] == true) {
        _showSnackBar("Profile updated successfully.");
      } else {
        _showSnackBar(result['message'] ?? 'Failed to update profile.', isError: true);
        return; // Don't exit edit mode on failure
      }
    }
    setState(() => _isEditing = !_isEditing);
  }

  // [INTEGRATION] Updates the password via PUT /api/user/profile with the password field.
  Future<void> _saveNewPassword() async {
    if (!(_hasMinLength && _hasUpperLower && _hasNumberSymbol)) {
      _showSnackBar("Password must meet all security requirements", isError: true);
      return;
    }
    if (_newPasswordController.text != _confirmPasswordController.text) {
      _showSnackBar("New passwords do not match!", isError: true);
      return;
    }

    setState(() => _isSaving = true);

    // [OWASP A07] Include current_password so the backend can verify identity
    // before accepting the credential change. Without this, a stolen JWT could
    // be used to permanently lock out the real account owner.
    final result = await ApiService.put(
      '/user/profile',
      body: {
        'current_password': _currentPasswordController.text,
        'password': _newPasswordController.text,
      },
    );

    if (!mounted) return;
    setState(() => _isSaving = false);

    if (result['success'] == true) {
      setState(() {
        _isChangingPassword = false;
        _currentPasswordController.clear();
        _newPasswordController.clear();
        _confirmPasswordController.clear();
        _obscureCurrent = true;
        _obscureNew = true;
        _obscureConfirm = true;
      });
      _showSnackBar("Password changed successfully.");
    } else {
      _showSnackBar(result['message'] ?? 'Failed to change password.', isError: true);
    }
  }

  // [INTEGRATION] Handles logout by calling POST /api/auth/logout, then clearing the session.
  void _handleLogout() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text("Logout", style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
        content: Text("Are you sure you want to log out of ALAGA?", style: GoogleFonts.albertSans()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text("Cancel", style: GoogleFonts.albertSans(color: Colors.grey, fontWeight: FontWeight.w500)),
          ),
          SizedBox(
            width: 120,
            child: ElevatedButton(
              onPressed: () async {
                // [OWASP A07] Clear the session and notify the backend
                await ApiService.post('/auth/logout');
                await SessionManager.clearSession();

                if (!context.mounted) return;

                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (context) => const LoginPage()),
                  (route) => false,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
              ),
              child: Text("Logout", style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  // Helper to format role string for display
  String _formatRole(String role) {
    switch (role) {
      case 'caregiver':
        return 'Parent Account';
      case 'medical_staff':
        return 'Caregiver Account';
      case 'admin':
      case 'facility_admin':
        return 'Facility Admin';
      case 'system_admin':
        return 'System Admin';
      default:
        return role;
    }
  }

  // -- Build --
  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: _bgColor,
        body: const Center(child: CircularProgressIndicator(color: _teal)),
      );
    }

    return Scaffold(
      backgroundColor: _bgColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () {
            widget.onBack?.call();
            Navigator.pop(context);
          },
        ),
        actions: [
          if (_isEditing)
            TextButton(
              onPressed: () => setState(() => _isEditing = false),
              child: Text("Cancel", style: GoogleFonts.albertSans(color: Colors.grey)),
            ),
          Padding(
            padding: const EdgeInsets.only(right: 16, left: 8),
            child: TextButton.icon(
              onPressed: _isSaving ? null : _toggleEdit,
              icon: _isSaving
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Icon(_isEditing ? Icons.check : Icons.edit_outlined, size: 18, color: Colors.white),
              label: Text(
                _isEditing ? "Save Changes" : "Edit Profile",
                style: GoogleFonts.albertSans(color: Colors.white),
              ),
              style: TextButton.styleFrom(
                backgroundColor: _teal,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Accounts Center",
                style: GoogleFonts.albertSans(
                  color: _teal,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                )),
            const SizedBox(height: 2),
            Text("PROFILE", style: _titleStyle),
            Text("Manage your account information and settings across ALAGA Network.",
                style: GoogleFonts.albertSans(color: Colors.black, fontSize: 14)),
            const SizedBox(height: 25),

            // -- Profile Card --
            _buildSectionCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: _teal,
                    backgroundImage: _profilePictureUrl != null
                        ? NetworkImage('${ApiService.serverOrigin}$_profilePictureUrl')
                        : null,
                    child: _profilePictureUrl == null
                        ? Text(
                            _firstNameController.text.isNotEmpty
                                ? _firstNameController.text[0].toUpperCase()
                                : 'U',
                            style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold))
                        : null,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "${_firstNameController.text} ${_lastNameController.text}",
                          style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          _formatRole(_role),
                          style: GoogleFonts.albertSans(fontSize: 12, color: _teal, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 6),
                        _iconLabel(Icons.email_outlined, _email),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // -- Personal Information --
            _buildSectionHeader("Personal Information", Icons.person_outline),
            _buildSectionCard(
              child: Column(
                children: [
                  _buildDataField(label: "First Name", controller: _firstNameController, isEditable: false),
                  const SizedBox(height: 15),
                  _buildDataField(label: "Last Name", controller: _lastNameController, isEditable: false),
                  const SizedBox(height: 15),
                  _buildDataField(label: "Email Address", value: _email, isEditable: false),
                  const SizedBox(height: 15),
                  _buildDataField(label: "Phone Number", controller: _phoneController, isEditable: _isEditing),
                ],
              ),
            ),

            _buildSectionHeader("Security", Icons.shield_outlined),
            _buildSectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDataField(label: "Username", controller: _usernameController, isEditable: _isEditing),
                  const SizedBox(height: 16),
                  if (!_isChangingPassword)
                    OutlinedButton.icon(
                      onPressed: () => setState(() => _isChangingPassword = true),
                      icon: const Icon(Icons.lock_outline, size: 18, color: _teal),
                      label: Text("Change Password", style: GoogleFonts.albertSans(color: Colors.black87)),
                      style: OutlinedButton.styleFrom(side: const BorderSide(color: _teal)),
                    )
                  else
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildPasswordField(
                          label: "Current Password",
                          controller: _currentPasswordController,
                          obscure: _obscureCurrent,
                          onToggle: () => setState(() => _obscureCurrent = !_obscureCurrent),
                        ),
                        const SizedBox(height: 12),
                        _buildPasswordField(
                          label: "New Password",
                          controller: _newPasswordController,
                          obscure: _obscureNew,
                          onToggle: () => setState(() => _obscureNew = !_obscureNew),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F2F6),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.grey.shade300),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text("Password Requirements:",
                                    style: GoogleFonts.albertSans(fontSize: 12, fontWeight: FontWeight.bold)),
                                const SizedBox(height: 6),
                                _reqItem("Minimum of 12 characters long", _hasMinLength),
                                _reqItem("At least one uppercase and lowercase letter", _hasUpperLower),
                                _reqItem("At least one number and one symbol", _hasNumberSymbol),
                              ],
                            ),
                          ),
                        ),
                        _buildPasswordField(
                          label: "Confirm New Password",
                          controller: _confirmPasswordController,
                          obscure: _obscureConfirm,
                          onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                onPressed: _isSaving ? null : _saveNewPassword,
                                style: ElevatedButton.styleFrom(backgroundColor: _teal),
                                child: _isSaving
                                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                    : Text("Update Password", style: GoogleFonts.albertSans(color: Colors.white)),
                              ),
                            ),
                            const SizedBox(width: 10),
                            TextButton(
                              onPressed: () => setState(() => _isChangingPassword = false),
                              child: Text("Cancel", style: GoogleFonts.albertSans(color: Colors.grey)),
                            ),
                          ],
                        ),
                      ],
                    ),
                ],
              ),
            ),

            const SizedBox(height: 25),

            // -- Logout --
            Center(
              child: SizedBox(
                width: 200,
                height: 50,
                child: ElevatedButton(
                  onPressed: _handleLogout,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.redAccent,
                    elevation: 2,
                    alignment: Alignment.center,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                    padding: EdgeInsets.zero,
                  ),
                  child: Text(
                    "Logout Account",
                    maxLines: 1,
                    overflow: TextOverflow.visible,
                    style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 50),
          ],
        ),
      ),
    );
  }

  // -- Helper Widgets --

  Widget _reqItem(String text, bool isMet) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(isMet ? Icons.check_circle : Icons.circle_outlined, size: 14, color: isMet ? Colors.green : Colors.blueGrey),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: GoogleFonts.albertSans(fontSize: 11, color: isMet ? Colors.green : Colors.black87, fontWeight: isMet ? FontWeight.bold : FontWeight.normal)),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: _teal),
          const SizedBox(width: 8),
          Text(title, style: _sectionHeaderStyle),
        ],
      ),
    );
  }

  Widget _buildSectionCard({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300, width: 1.2),
      ),
      child: child,
    );
  }

  Widget _buildDataField({
    required String label,
    String? value,
    TextEditingController? controller,
    required bool isEditable,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _labelStyle),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: isEditable ? Colors.white : const Color(0xFFF1F2F6),
            borderRadius: BorderRadius.circular(8),
            border: isEditable ? Border.all(color: _teal) : null,
          ),
          child: isEditable && controller != null
              ? TextField(
                  controller: controller,
                  style: _bodyStyle,
                  decoration: const InputDecoration(
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    border: InputBorder.none,
                  ),
                )
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  child: Text(value ?? controller?.text ?? "", style: _bodyStyle),
                ),
        ),
      ],
    );
  }

  Widget _buildPasswordField({
    required String label,
    required TextEditingController controller,
    required bool obscure,
    required VoidCallback onToggle,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.albertSans(fontSize: 11, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscure,
          style: _bodyStyle,
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFFF1F2F6),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            suffixIcon: IconButton(
              icon: Icon(obscure ? Icons.visibility_off : Icons.visibility, size: 18, color: Colors.grey),
              onPressed: onToggle,
            ),
          ),
        ),
      ],
    );
  }

  Widget _iconLabel(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 14, color: Colors.grey),
          const SizedBox(width: 6),
          // [FIX] Flexible prevents long email addresses from overflowing the card.
          Flexible(
            child: Text(
              label,
              style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
        ],
      ),
    );
  }
}