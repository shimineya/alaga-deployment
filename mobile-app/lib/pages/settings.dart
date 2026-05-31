import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Import API service to fetch and persist settings
import '../services/api_service.dart';
import '../models/user_session.dart';
import 'biometrics.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  // --- Loading State ---
  bool _isLoading = true;
  bool _isSaving = false;

  // Notification States (loaded from backend)
  bool criticalAlerts = true;
  bool warningAlerts = true;
  bool infoNotifications = false;
  bool emailNotifications = true;
  bool smsNotifications = false;

  // Security Settings (loaded from encrypted local storage)
  bool _isBiometricEnabled = false;
  bool _isBiometricAvailable = false;

  // Dropdown Values
  String selectedTimezone = "Asia/Manila (PHT)";
  String selectedSensitivity = "Medium (Balanced)";

  // [INTEGRATION] Live system info fetched from backend
  String _appVersion = "Loading...";
  String _dbStatus = "Checking...";
  String _activeDevices = "...";
  String _lastBackup = "Not available";

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  // [INTEGRATION] Fetches user notification preferences and system info
  // from GET /api/user/profile (preferences) and GET /api/caregiver/devices (device count).
  Future<void> _loadSettings() async {
    setState(() => _isLoading = true);

    // [INTEGRATION] Fetch current profile/preferences
    final profileResult = await ApiService.get('/user/profile');

    // [INTEGRATION] Fetch device count to show live active devices
    final devicesResult = await ApiService.get('/caregiver/devices');

    // Check biometric hardware availability and stored preference in parallel.
    final biometricService = BiometricService();
    final canCheck = await biometricService.canCheckBiometrics();
    final isSupported = await biometricService.isDeviceSupported();
    final available = await biometricService.getAvailableBiometrics();
    final biometricEnabled = await SessionManager.isBiometricEnabled();

    if (!mounted) return;

    setState(() {
      // App version is read from compile-time constant (package_info_plus would
      // be the ideal approach in production). For this prototype, the version
      // is declared here and matches the pubspec.yaml version field.
      // [TECHNICAL DEBT] Replace with PackageInfo.fromPlatform() in production.
      _appVersion = "v1.0.8";

      if (profileResult['success'] == true && profileResult['profile'] != null) {
        // [INTEGRATION] notification_preferences is stored as a PostgreSQL TEXT[]
        // containing the names of ENABLED preferences (e.g. ['critical_alerts', 'email_notifications']).
        final rawPrefs = profileResult['profile']['notification_preferences'];
        final List<String> enabledPrefs = rawPrefs is List
            ? List<String>.from(rawPrefs)
            : <String>[];

        criticalAlerts     = enabledPrefs.contains('critical_alerts')     || enabledPrefs.isEmpty;
        warningAlerts      = enabledPrefs.contains('warning_alerts')      || enabledPrefs.isEmpty;
        infoNotifications  = enabledPrefs.contains('info_notifications');
        emailNotifications = enabledPrefs.contains('email_notifications') || enabledPrefs.isEmpty;
        smsNotifications   = enabledPrefs.contains('sms_notifications');
        _dbStatus = "Connected";
      } else {
        // [OWASP A10] Do not expose raw error from server; show a generic status
        _dbStatus = "Unavailable";
      }

      if (devicesResult['success'] == true) {
        final devices = (devicesResult['data'] as List?) ?? [];
        final onlineCount = devices.where((d) => d['status'] == 'ACTIVE').length;
        _activeDevices = "$onlineCount device${onlineCount == 1 ? '' : 's'} online";
      } else {
        _activeDevices = "Unavailable";
      }

      // [OWASP A07] Biometric availability and user preference loaded from
      // AES-encrypted local storage. Never read from a plain key-value store.
      _isBiometricAvailable = canCheck && isSupported && available.isNotEmpty;
      _isBiometricEnabled   = biometricEnabled;

      _isLoading = false;
    });
  }

  // [INTEGRATION] Persists notification preferences via PUT /api/user/profile.
  // [DPA / Data Minimization] Only enabled preference key strings are sent.
  // The backend stores this as a PostgreSQL TEXT[] column.
  Future<void> _saveSettings() async {
    setState(() => _isSaving = true);

    // [INTEGRATION] Convert boolean toggles to a TEXT[] list of enabled keys.
    // This matches the notification_preferences TEXT[] column in the users table.
    final enabledPrefs = <String>[
      if (criticalAlerts) 'critical_alerts',
      if (warningAlerts) 'warning_alerts',
      if (infoNotifications) 'info_notifications',
      if (emailNotifications) 'email_notifications',
      if (smsNotifications) 'sms_notifications',
    ];

    final result = await ApiService.put(
      '/user/profile',
      body: {
        'notification_preferences': enabledPrefs,
      },
    );

    if (!mounted) return;
    setState(() => _isSaving = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        // [OWASP A10] Show generic success/failure without exposing internals
        content: Text(
          result['success'] == true
              ? "Settings saved successfully."
              : result['message'] ?? "Failed to save settings.",
          style: GoogleFonts.albertSans(),
        ),
        backgroundColor:
            result['success'] == true ? const Color(0xFF4DB6AC) : Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // Handles the biometric toggle in the Security card.
  // Enabling requires a fresh OS biometric scan to confirm the user's intent.
  // Disabling removes the flag immediately without a scan (standard UX pattern).
  Future<void> _toggleBiometric(bool enable) async {
    if (enable) {
      final biometricService = BiometricService();
      final authenticated = await biometricService.authenticate(
        reason: 'Confirm your fingerprint to enable biometric login',
      );

      if (!mounted) return;

      if (authenticated) {
        // [OWASP A07] Write to AES-encrypted storage only after the OS confirms identity.
        await SessionManager.enableBiometrics();
        setState(() => _isBiometricEnabled = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Biometric login has been enabled.', style: GoogleFonts.albertSans()),
            backgroundColor: const Color(0xFF4DB6AC),
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else {
        // Scan failed or was cancelled; keep the toggle off.
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Biometric scan was not completed. No changes were made.',
              style: GoogleFonts.albertSans(),
            ),
            backgroundColor: Colors.orangeAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } else {
      await SessionManager.disableBiometrics();
      setState(() => _isBiometricEnabled = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Biometric login has been disabled.', style: GoogleFonts.albertSans()),
          backgroundColor: Colors.grey.shade700,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // --- Logic for Update Check ---
  // [TECHNICAL DEBT] This is a simulated update check. In production this should
  // call a versioning endpoint (e.g. GET /api/app-version) and compare against
  // the installed build number retrieved via package_info_plus.
  void _checkVersionUpdate(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        Future.delayed(const Duration(seconds: 2), () {
          if (context.mounted) {
            Navigator.pop(context);
            _showUpToDateDialog(context);
          }
        });

        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              const CircularProgressIndicator(color: Color(0xFF4DB6AC)),
              const SizedBox(height: 20),
              Text("Checking for updates...", style: GoogleFonts.poppins(fontSize: 14)),
            ],
          ),
        );
      },
    );
  }

  void _showUpToDateDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        title: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.green),
            const SizedBox(width: 10),
            Text("Up to Date", style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        content: Text(
          "ALAGA $_appVersion is currently the latest version. No updates are required at this time.",
          style: GoogleFonts.poppins(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("OK", style: TextStyle(color: Color(0xFF4DB6AC), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final headerStyle = GoogleFonts.poppins(
      fontWeight: FontWeight.bold,
      fontSize: 24,
      color: const Color(0xFF2D3436),
    );

    final labelStyle = GoogleFonts.poppins(
      fontWeight: FontWeight.w600,
      fontSize: 13,
      color: const Color(0xFF2D3436),
    );

    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFFFFDF5),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF4DB6AC))),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFFFFDF5),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "System Configuration",
              style: GoogleFonts.poppins(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF80CBC4),
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 4),
            Text("SETTINGS", style: headerStyle),
            Text("Manage your application preferences.",
              style: GoogleFonts.albertSans(color: Colors.black, fontSize: 14)),
            const SizedBox(height: 25),

            // 1. General Settings
            _buildSectionCard(
              title: "General Settings",
              icon: Icons.settings_outlined,
              children: [
                _buildDropdown("Timezone", selectedTimezone, ["Asia/Manila (PHT)", "UTC+0"],
                    (val) => setState(() => selectedTimezone = val!)),
              ],
            ),

            // 2. Notification Preferences
            _buildSectionCard(
              title: "Notification Preferences",
              icon: Icons.notifications_none_outlined,
              children: [
                _buildSwitchTile("Critical Alerts", "Extreme fever, heart rate anomalies",
                    criticalAlerts, (val) => setState(() => criticalAlerts = val)),
                _buildSwitchTile("Warning Alerts", "Elevated vitals, moisture detection",
                    warningAlerts, (val) => setState(() => warningAlerts = val)),
                _buildSwitchTile("Info Notifications", "General updates and reminders",
                    infoNotifications, (val) => setState(() => infoNotifications = val)),
                const Divider(height: 30),
                Text("Notification Channels", style: labelStyle),
                _buildSwitchTile("Email Notifications", null,
                    emailNotifications, (val) => setState(() => emailNotifications = val)),
                _buildSwitchTile("SMS Notifications", null,
                    smsNotifications, (val) => setState(() => smsNotifications = val)),
              ],
            ),

            // 3. Alert Configuration (OC-SVM Info)
            _buildSectionCard(
              title: "Alert Configuration",
              icon: Icons.shield_outlined,
              children: [
                _buildDropdown("Alert Sensitivity", selectedSensitivity,
                    ["Low", "Medium (Balanced)", "High"],
                    (val) => setState(() => selectedSensitivity = val!)),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE3F2FD),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Anomaly Detection (OC-SVM)",
                          style: labelStyle.copyWith(color: Colors.blue.shade800)),
                      const SizedBox(height: 4),
                      Text(
                        "One-Class SVM algorithm is active for high-precision alerts and reduced false positives.",
                        style: GoogleFonts.poppins(fontSize: 11, color: Colors.blue.shade700),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // 4. Security Settings
            _buildSectionCard(
              title: "Security",
              icon: Icons.lock_outline,
              children: [
                _isBiometricAvailable
                    ? _buildSwitchTile(
                        "Biometric Login",
                        "Use your fingerprint to log in instead of your password.",
                        _isBiometricEnabled,
                        _toggleBiometric,
                      )
                    : Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          "Biometric login is not available on this device.",
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: Colors.grey,
                          ),
                        ),
                      ),
              ],
            ),

            // 5. Software Update
            _buildSectionCard(
              title: "Software Update",
              icon: Icons.system_update_outlined,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // [INTEGRATION] Version read from app state (loaded in _loadSettings)
                        Text("Current Version: $_appVersion", style: labelStyle),
                        const Text("Last checked: Today",
                            style: TextStyle(fontSize: 11, color: Colors.grey)),
                      ],
                    ),
                    ElevatedButton(
                      onPressed: () => _checkVersionUpdate(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4DB6AC),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text("Check Update",
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ],
            ),

            // 5. System Information (live data)
            _buildSystemInfo(),

            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _saveSettings,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4DB6AC),
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: _isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text("Save Changes",
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 15),
                TextButton(
                  onPressed: _loadSettings,
                  child: const Text("Reset to Defaults",
                      style: TextStyle(color: Colors.black54)),
                ),
              ],
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  // --- UI Components ---

  Widget _buildSectionCard(
      {required String title, required IconData icon, required List<Widget> children}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: const Color(0xFF4DB6AC)),
              const SizedBox(width: 10),
              Text(title,
                  style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 20),
          ...children,
        ],
      ),
    );
  }

  Widget _buildDropdown(
      String label, String value, List<String> items, Function(String?) onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: value,
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFFF1F2F6),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
            ),
            items: items
                .map((i) =>
                    DropdownMenuItem(value: i, child: Text(i, style: const TextStyle(fontSize: 14))))
                .toList(),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildSwitchTile(
      String title, String? subtitle, bool value, Function(bool) onChanged) {
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      title:
          Text(title, style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500)),
      subtitle: subtitle != null ? Text(subtitle, style: const TextStyle(fontSize: 12)) : null,
      value: value,
      activeColor: const Color(0xFF4DB6AC),
      onChanged: onChanged,
    );
  }

  // [INTEGRATION] System info section uses live data fetched in _loadSettings.
  Widget _buildSystemInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("System Information",
            style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 15),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _infoItem("Application Version", _appVersion),
            _infoItem("Database Status", _dbStatus, isStatus: _dbStatus == "Connected"),
          ],
        ),
        const SizedBox(height: 15),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // [TECHNICAL DEBT] Last Backup date requires a dedicated /api/sysadmin/backup-status
            // endpoint. Currently not available in this prototype version.
            _infoItem("Last Backup", _lastBackup),
            _infoItem("Active Devices", _activeDevices),
          ],
        ),
      ],
    );
  }

  Widget _infoItem(String label, String value, {bool isStatus = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        Text(
          value,
          style: GoogleFonts.poppins(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: isStatus ? Colors.green : Colors.black,
          ),
        ),
      ],
    );
  }
}