import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../models/user_session.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  // --- State Variables ---
  bool _isEditing = false;
  bool _isChangingPassword = false;

  // Visibility Toggles
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  // Requirement States (Real-time)
  bool _hasMinLength = false;
  bool _hasUpperLower = false;
  bool _hasNumberSymbol = false;

  // Controllers for personal info
  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  String _email = '';
  String _username = '';
  bool _isSavingProfile = false;

  // Profile Picture State
  String? _profilePictureUrl;
  bool _isUploadingPicture = false;
  bool _imageLoadFailed = false;
  final ImagePicker _imagePicker = ImagePicker();

  // Controllers for password change
  final TextEditingController _currentPasswordController = TextEditingController();
  final TextEditingController _newPasswordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Real-time listener for the new password field
    _newPasswordController.addListener(_checkRequirements);
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final result = await ApiService.get('/user/profile');
    if (!mounted) return;
    if (result['success'] == true && result['profile'] is Map<String, dynamic>) {
      final profile = result['profile'] as Map<String, dynamic>;
      setState(() {
        _firstNameController.text = profile['first_name']?.toString() ?? '';
        _lastNameController.text = profile['last_name']?.toString() ?? '';
        _phoneController.text = profile['mobile_number']?.toString() ?? '';
        _email = profile['email']?.toString() ?? '';
        _username = profile['username']?.toString() ?? '';
        _profilePictureUrl = profile['profile_picture_url']?.toString();
        _imageLoadFailed = false; // Reset so the new URL gets a fresh attempt
      });
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  // --- Logic ---

  void _checkRequirements() {
    final pass = _newPasswordController.text;
    setState(() {
      _hasMinLength = pass.length >= 12;
      _hasUpperLower = pass.contains(RegExp(r'[A-Z]')) && pass.contains(RegExp(r'[a-z]'));
      _hasNumberSymbol = pass.contains(RegExp(r'[0-9]')) && pass.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>+_-]'));
    });
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.redAccent : const Color(0xFF4DB6AC),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _toggleEdit() async {
    if (_isEditing) {
      setState(() => _isSavingProfile = true);
      final result = await ApiService.put(
        '/user/profile',
        body: {
          'username': _username,
          'mobile_number': _phoneController.text.trim(),
        },
      );
      if (!mounted) return;
      setState(() => _isSavingProfile = false);
      if (result['success'] == true) {
        _showSnackBar("Profile updated successfully");
      } else {
        _showSnackBar(result['message']?.toString() ?? 'Failed to update profile', isError: true);
        return;
      }
    }
    setState(() => _isEditing = !_isEditing);
  }

  // --- Profile Picture Upload ---
  // [OWASP A04] Image is validated server-side (JPEG/JPG/PNG only, 2 MB max).
  // [DPA / Data Minimization] Profile picture is proportional data for user identification.
  Future<void> _pickAndUploadProfilePicture() async {
    // Show a bottom sheet for the user to choose camera or gallery
    final ImageSource? source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("Update Profile Picture",
                style: GoogleFonts.poppins(
                    fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Text("Choose where to get your photo from.",
                style: GoogleFonts.albertSans(
                    fontSize: 13, color: Colors.grey)),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildPickerOption(
                  icon: Icons.camera_alt_outlined,
                  label: "Camera",
                  onTap: () => Navigator.pop(ctx, ImageSource.camera),
                ),
                _buildPickerOption(
                  icon: Icons.photo_library_outlined,
                  label: "Gallery",
                  onTap: () => Navigator.pop(ctx, ImageSource.gallery),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );

    if (source == null) return; // User dismissed

    try {
      final XFile? pickedFile = await _imagePicker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );

      if (pickedFile == null) return; // User cancelled the picker

      setState(() => _isUploadingPicture = true);

      // [OWASP A01] Authenticated multipart upload to the profile endpoint
      final result = await ApiService.multipartPut(
        '/user/profile',
        filePath: pickedFile.path,
        fileField: 'profile_picture',
      );

      if (!mounted) return;
      setState(() => _isUploadingPicture = false);

      if (result['success'] == true) {
        // Refresh the profile data to pick up the new URL
        await _loadProfile();
        _showSnackBar("Profile picture updated successfully");
      } else {
        _showSnackBar(
            result['message']?.toString() ?? 'Failed to upload picture',
            isError: true);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isUploadingPicture = false);
      _showSnackBar("Could not process the selected image.", isError: true);
    }
  }

  Widget _buildPickerOption({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF4DB6AC).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 28, color: const Color(0xFF4DB6AC)),
          ),
          const SizedBox(height: 8),
          Text(label,
              style: GoogleFonts.poppins(
                  fontSize: 13, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  void _saveNewPassword() {
    if (!(_hasMinLength && _hasUpperLower && _hasNumberSymbol)) {
      _showSnackBar("Password must meet all security requirements", isError: true);
      return;
    }

    if (_newPasswordController.text != _confirmPasswordController.text) {
      _showSnackBar("New passwords do not match!", isError: true);
      return;
    }

    setState(() {
      _isChangingPassword = false;
      _currentPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();
      _obscureCurrent = true;
      _obscureNew = true;
      _obscureConfirm = true;
    });

    _showSnackBar("Password changed successfully");
  }

  // --- Logout Logic ---
  void _handleLogout() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Logout", style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
        content: const Text("Are you sure you want to log out of ALAGA?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Cancel", style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () {
              ApiService.post('/auth/logout');
              SessionManager.clearSession();
              // This clears the navigation history so the user can't "Go Back" into the profile
              Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
            },
            child: const Text("Logout", style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final titleStyle = GoogleFonts.poppins(
      fontWeight: FontWeight.bold,
      fontSize: 24,
      color: const Color(0xFF2D3436),
    );

    final String displayName =
        (_firstNameController.text.isEmpty && _lastNameController.text.isEmpty)
            ? (_username.isEmpty ? 'User' : _username)
            : '${_firstNameController.text} ${_lastNameController.text}'.trim();

    final String initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (_isEditing)
            TextButton(
              onPressed: () => setState(() => _isEditing = false),
              child: const Text("Cancel", style: TextStyle(color: Colors.grey)),
            ),
          Padding(
            padding: const EdgeInsets.only(right: 16, left: 8),
            child: TextButton.icon(
              onPressed: _isSavingProfile ? null : _toggleEdit,
              icon: Icon(_isEditing ? Icons.check : Icons.edit_outlined, size: 18, color: Colors.white),
              label: Text(
                _isSavingProfile ? "Saving..." : (_isEditing ? "Save Changes" : "Edit Profile"),
                style: const TextStyle(color: Colors.white),
              ),
              style: TextButton.styleFrom(
                backgroundColor: const Color(0xFF4DB6AC),
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
            Text("Profile", style: titleStyle),
            Text("Manage your account information", style: GoogleFonts.poppins(color: Colors.grey, fontSize: 14)),
            const SizedBox(height: 25),

            // 1. Header Card with Profile Picture
            _buildSectionCard(
              child: Row(
                children: [
                  // Profile Avatar with upload action
                  GestureDetector(
                    onTap: _isUploadingPicture ? null : _pickAndUploadProfilePicture,
                    child: Stack(
                      children: [
                        _buildProfileAvatar(initial, radius: 40),
                        // Camera overlay icon
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF4DB6AC),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                            child: _isUploadingPicture
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Icon(Icons.camera_alt,
                                    size: 14, color: Colors.white),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(displayName,
                          style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        _iconLabel(Icons.email_outlined, _email),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // 2. Personal Information
            _buildSectionHeader("Personal Information", Icons.person_outline),
            _buildSectionCard(
              child: Column(
                children: [
                  _buildDataField(label: "First Name", controller: _firstNameController, isEditable: _isEditing),
                  const SizedBox(height: 15),
                  _buildDataField(label: "Last Name", controller: _lastNameController, isEditable: _isEditing),
                  const SizedBox(height: 15),
                  _buildDataField(label: "Email Address", value: _email, isEditable: false),
                  const SizedBox(height: 15),
                  _buildDataField(label: "Phone Number", controller: _phoneController, isEditable: _isEditing),
                ],
              ),
            ),

            // 3. Security
            _buildSectionHeader("Security", Icons.shield_outlined),
            _buildSectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!_isChangingPassword)
                    OutlinedButton.icon(
                      onPressed: () => setState(() => _isChangingPassword = true),
                      icon: const Icon(Icons.lock_outline, size: 18),
                      label: const Text("Change Password", style: TextStyle(color: Colors.black87)),
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
                                const Text("Password Requirements:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
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
                                onPressed: _saveNewPassword,
                                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF4DB6AC)),
                                child: const Text("Update Password", style: TextStyle(color: Colors.white)),
                              ),
                            ),
                            const SizedBox(width: 10),
                            TextButton(
                              onPressed: () => setState(() => _isChangingPassword = false),
                              child: const Text("Cancel", style: TextStyle(color: Colors.grey)),
                            ),
                          ],
                        ),
                      ],
                    ),
                ],
              ),
            ),

            // 4. Recent Activity
            _buildSectionHeader("Recent Activity", Icons.history),
            _buildSectionCard(
              child: Column(
                children: [
                  _activityItem("Logged in", "Manila, Philippines", "2 hours ago"),
                  const Divider(),
                  _activityItem("Updated patient record (P004)", "Manila, Philippines", "5 hours ago"),
                ],
              ),
            ),
            
            const SizedBox(height: 25),

            // --- Logout Button UI ---
            SizedBox(
              width: double.infinity,
              child: TextButton.icon(
                onPressed: _handleLogout,
                icon: const Icon(Icons.logout, color: Colors.redAccent, size: 20),
                label: Text(
                  "Logout Account",
                  style: GoogleFonts.poppins(
                    color: Colors.redAccent,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: Colors.redAccent.withOpacity(0.3)),
                  ),
                  backgroundColor: Colors.redAccent.withOpacity(0.05),
                ),
              ),
            ),
            const SizedBox(height: 50), // Extra space at the bottom
          ],
        ),
      ),
    );
  }

  // --- Profile Avatar Builder ---
  // Loads from backend URL if available, otherwise shows initials.
  // Uses serverOrigin (without /api) because static files are served at /uploads/...
  Widget _buildProfileAvatar(String initial, {double radius = 40}) {
    final String origin = ApiService.serverOrigin;

    if (_profilePictureUrl != null && _profilePictureUrl!.isNotEmpty && !_imageLoadFailed) {
      final String fullUrl = _profilePictureUrl!.startsWith('http')
          ? _profilePictureUrl!
          : '$origin$_profilePictureUrl';

      return CircleAvatar(
        radius: radius,
        backgroundColor: const Color(0xFF4DB6AC),
        backgroundImage: NetworkImage(fullUrl),
        onBackgroundImageError: (_, __) {
          // Mark as failed so we stop retrying and fall back to initials
          if (mounted) setState(() => _imageLoadFailed = true);
        },
      );
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: const Color(0xFF4DB6AC),
      child: Text(initial,
          style: TextStyle(
              color: Colors.white,
              fontSize: radius * 0.8,
              fontWeight: FontWeight.bold)),
    );
  }

  // --- UI Helpers ---

  Widget _reqItem(String text, bool isMet) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(
            isMet ? Icons.check_circle : Icons.circle_outlined, 
            size: 14, 
            color: isMet ? Colors.green : Colors.blueGrey,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text, 
              style: TextStyle(
                fontSize: 11, 
                color: isMet ? Colors.green : Colors.black87,
                fontWeight: isMet ? FontWeight.bold : FontWeight.normal,
              ),
            ),
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
          Icon(icon, size: 18, color: const Color(0xFF4DB6AC)),
          const SizedBox(width: 8),
          Text(title, style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
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
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: child,
    );
  }

  Widget _buildDataField({required String label, String? value, TextEditingController? controller, required bool isEditable}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey)),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: isEditable ? Colors.white : const Color(0xFFF1F2F6),
            borderRadius: BorderRadius.circular(8),
            border: isEditable ? Border.all(color: const Color(0xFF4DB6AC)) : null,
          ),
          child: isEditable && controller != null
              ? TextField(
                  controller: controller,
                  style: const TextStyle(fontSize: 13),
                  decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12), border: InputBorder.none),
                )
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  child: Text(value ?? controller?.text ?? "", style: const TextStyle(fontSize: 13, color: Colors.black54)),
                ),
        ),
      ],
    );
  }

  Widget _buildPasswordField({
    required String label, 
    required TextEditingController controller, 
    required bool obscure, 
    required VoidCallback onToggle
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscure,
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
          Flexible(
            child: Text(label,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ),
        ],
      ),
    );
  }

  Widget _activityItem(String title, String location, String time) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            Text(location, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ]),
          Text(time, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        ],
      ),
    );
  }
}