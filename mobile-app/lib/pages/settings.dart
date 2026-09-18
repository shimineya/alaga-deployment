import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// [INTEGRATION] Import API service to fetch and persist settings
import '../services/api_service.dart';
import '../services/app_preferences.dart';
import '../services/schedule_reminder_service.dart';
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
  bool _isCheckingFirmware = false;

  // Notification States (loaded from backend)
  bool criticalAlerts = true;
  bool warningAlerts = true;

  // Security Settings (loaded from encrypted local storage)
  bool _isBiometricEnabled = false;
  bool _isBiometricAvailable = false;

  // Dropdown Values
  String selectedDateFormat = "MM/DD/YYYY";
  String selectedAppearance = "System Default";
  String selectedDataRefresh = "Automatic";
  String selectedAlertTone = "System Default";
  double alertVolume = 1.0;
  List<Map<String, String>> _phoneTones = const [
    {'title': 'System Default', 'uri': ''}
  ];

  String _text(String english, String _) => english;

  // [INTEGRATION] Live system info fetched from backend
  String _appVersion = "Loading...";
  String _dbStatus = "Checking...";
  String _activeDevices = "...";
  String _lastBackup = "Not available";
  String _firmwareStatus = "Not checked";

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  // [INTEGRATION] Fetches user notification preferences and system info
  // from GET /api/user/profile (preferences) and GET /api/caregiver/devices (device count).
  Future<void> _loadSettings() async {
    setState(() => _isLoading = true);

    await AppPreferences.load();
    List<Map<String, String>> phoneTones;
    try {
      phoneTones = await ScheduleReminderService.getPhoneTones();
      if (phoneTones.isEmpty) {
        phoneTones = const [
          {'title': 'System Default', 'uri': ''}
        ];
      }
    } catch (_) {
      phoneTones = const [
        {'title': 'System Default', 'uri': ''}
      ];
    }

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
      selectedDateFormat = AppPreferences.dateFormat.value;
      selectedAppearance = AppPreferences.appearance.value;
      selectedDataRefresh = AppPreferences.dataRefresh.value;
      selectedAlertTone = AppPreferences.alertTone.value;
      alertVolume = AppPreferences.alertVolume.value;
      _phoneTones = phoneTones;
      if (!_phoneTones.any((tone) => tone['title'] == selectedAlertTone)) {
        selectedAlertTone = _phoneTones.first['title']!;
      }
      // App version is read from compile-time constant (package_info_plus would
      // be the ideal approach in production). For this prototype, the version
      // is declared here and matches the pubspec.yaml version field.
      // [TECHNICAL DEBT] Replace with PackageInfo.fromPlatform() in production.
      _appVersion = "v1.0.8";

      if (profileResult['success'] == true &&
          profileResult['profile'] != null) {
        // [INTEGRATION] notification_preferences is stored as a PostgreSQL TEXT[]
        // containing the names of ENABLED preferences (e.g. ['critical_alerts', 'email_notifications']).
        final rawPrefs = profileResult['profile']['notification_preferences'];
        final List<String> enabledPrefs =
            rawPrefs is List ? List<String>.from(rawPrefs) : <String>[];

        criticalAlerts =
            enabledPrefs.contains('critical_alerts') || enabledPrefs.isEmpty;
        warningAlerts =
            enabledPrefs.contains('warning_alerts') || enabledPrefs.isEmpty;
        _dbStatus = "Connected";
      } else {
        // [OWASP A10] Do not expose raw error from server; show a generic status
        _dbStatus = "Unavailable";
      }

      if (devicesResult['success'] == true) {
        final devices = (devicesResult['data'] as List?) ?? [];
        final onlineCount =
            devices.where((d) => d['status'] == 'ACTIVE').length;
        _activeDevices =
            "$onlineCount device${onlineCount == 1 ? '' : 's'} online";
      } else {
        _activeDevices = "Unavailable";
      }

      // [OWASP A07] Biometric availability and user preference loaded from
      // AES-encrypted local storage. Never read from a plain key-value store.
      _isBiometricAvailable = canCheck && isSupported && available.isNotEmpty;
      _isBiometricEnabled = biometricEnabled;

      _isLoading = false;
    });
  }

  // [INTEGRATION] Persists notification preferences via PUT /api/user/profile.
  // [DPA / Data Minimization] Only enabled preference key strings are sent.
  // The backend stores this as a PostgreSQL TEXT[] column.
  Future<void> _saveSettings() async {
    setState(() => _isSaving = true);
    Map<String, dynamic> result = {'success': false};
    try {
      await AppPreferences.save(
        dateFormatValue: selectedDateFormat,
        appearanceValue: selectedAppearance,
        dataRefreshValue: selectedDataRefresh,
        alertToneValue: selectedAlertTone,
        alertVolumeValue: alertVolume,
      );
      final selectedTone = _phoneTones.firstWhere(
          (tone) => tone['title'] == selectedAlertTone,
          orElse: () => const {'title': 'System Default', 'uri': ''});
      final toneUri = selectedTone['uri'] ?? '';
      try {
        await ScheduleReminderService.configureAlertSound(
            selectedAlertTone, toneUri, alertVolume);
      } catch (_) {
        // Local preferences still save when native alert support is unavailable.
      }
      final enabledPrefs = <String>[
        if (criticalAlerts) 'critical_alerts',
        if (warningAlerts) 'warning_alerts',
      ];
      result = await ApiService.put('/user/profile',
          body: {'notification_preferences': enabledPrefs});
    } catch (_) {
      result = {'success': false, 'message': 'Failed to save settings.'};
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        // [OWASP A10] Show generic success/failure without exposing internals
        content: Text(
          result['success'] == true
              ? _text("Settings saved successfully.",
                  "Matagumpay na na-save ang mga setting.")
              : result['message'] ??
                  _text("Failed to save settings.",
                      "Hindi na-save ang mga setting."),
          style: GoogleFonts.albertSans(),
        ),
        backgroundColor: result['success'] == true
            ? const Color(0xFF4DB6AC)
            : Colors.redAccent,
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
        reason: _text('Confirm your fingerprint to enable biometric login',
            'Kumpirmahin ang iyong fingerprint upang paganahin ang biometric login'),
      );

      if (!mounted) return;

      if (authenticated) {
        final enrollment = await ApiService.enrollBiometric();
        if (!mounted) return;
        if (enrollment['success'] != true) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(
                enrollment['message'] ?? 'Could not enable biometric login.'),
            backgroundColor: Colors.redAccent,
          ));
          return;
        }
        // [OWASP A07] Write to AES-encrypted storage only after the OS confirms identity.
        await SessionManager.enableBiometrics(
          biometricToken: enrollment['biometricToken'] as String?,
        );
        if (!mounted) return;
        setState(() => _isBiometricEnabled = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                _text('Biometric login has been enabled.',
                    'Pinagana na ang biometric login.'),
                style: GoogleFonts.albertSans()),
            backgroundColor: const Color(0xFF4DB6AC),
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else {
        // Scan failed or was cancelled; keep the toggle off.
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _text('Biometric scan was not completed. No changes were made.',
                  'Hindi nakumpleto ang biometric scan. Walang ginawang pagbabago.'),
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
          content: Text(
              _text('Biometric login has been disabled.',
                  'Hindi na pinagana ang biometric login.'),
              style: GoogleFonts.albertSans()),
          backgroundColor: Colors.grey.shade700,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // Checks the shared backend for firmware built from the Arduino sketches in
  // device-code/, then lets the user push/queue it to their authorized devices.
  Future<void> _checkFirmwareUpdate() async {
    setState(() => _isCheckingFirmware = true);
    final result = await ApiService.get('/caregiver/firmware/check');

    if (!mounted) return;
    setState(() => _isCheckingFirmware = false);

    if (result['success'] != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ??
              _text('Unable to check device firmware.',
                  'Hindi masuri ang firmware ng device.')),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final rawUpdates = result['updates'];
    final updates = rawUpdates is List
        ? rawUpdates.whereType<Map>().map(Map<String, dynamic>.from).toList()
        : <Map<String, dynamic>>[];
    if (updates.isEmpty) {
      setState(() => _firmwareStatus =
          _text('No update published', 'Walang inilabas na update'));
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(
              _text('No firmware available', 'Walang available na firmware')),
          content: Text(
            _text(
                'No compiled Arduino firmware has been published by an administrator yet.',
                'Wala pang inilalabas na compiled Arduino firmware ang administrator.'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(_text('OK', 'Sige')),
            ),
          ],
        ),
      );
      return;
    }

    final versions = updates
        .map((update) => (update['version'] ?? 'Unknown').toString())
        .toSet();
    final releaseSummary = updates.map((update) {
      final type = update['deviceType'] == 'wetness_sensor'
          ? 'Wetness sensor'
          : 'Vital signs';
      return '$type: ${update['version'] ?? 'Unknown'}\n${update['features'] ?? 'Firmware improvements'}';
    }).join('\n\n');
    setState(() => _firmwareStatus = '${updates.length} package(s) available');

    final install = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Device firmware available'),
        content: Text(
            '$releaseSummary\n\nQueue the correct package for each authorized ALAGA device?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Later'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Update devices'),
          ),
        ],
      ),
    );

    if (install != true || !mounted) return;
    setState(() => _isCheckingFirmware = true);
    final updateResult = await ApiService.post('/caregiver/firmware/update');
    if (!mounted) return;
    setState(() {
      _isCheckingFirmware = false;
      if (updateResult['success'] == true) {
        _firmwareStatus = 'Queued: ${versions.join(', ')}';
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          updateResult['message'] ??
              (updateResult['success'] == true
                  ? 'Device firmware update started.'
                  : 'Device firmware update failed.'),
        ),
        backgroundColor: updateResult['success'] == true
            ? const Color(0xFF4DB6AC)
            : Colors.redAccent,
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
        backgroundColor: Color(0xFFF5F5F0),
        body:
            Center(child: CircularProgressIndicator(color: Color(0xFF4DB6AC))),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
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
              _text("System Configuration", "Kompigurasyon ng Sistema"),
              style: GoogleFonts.poppins(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF80CBC4),
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 4),
            Text(_text("SETTINGS", "MGA SETTING"), style: headerStyle),
            Text(
                _text("Manage your application preferences.",
                    "Pamahalaan ang mga kagustuhan ng iyong application."),
                style:
                    GoogleFonts.albertSans(color: Colors.black, fontSize: 14)),
            const SizedBox(height: 25),

            // 1. General Settings
            _buildSectionCard(
              title: _text("General Settings", "Pangkalahatang Setting"),
              icon: Icons.settings_outlined,
              children: [
                _buildDropdown(
                    "Appearance",
                    selectedAppearance,
                    const ["System Default"],
                    (val) => setState(() => selectedAppearance = val!)),
                _buildDropdown(
                    _text("Date Format", "Format ng Petsa"),
                    selectedDateFormat,
                    const ["MM/DD/YYYY", "DD/MM/YYYY"],
                    (val) => setState(() => selectedDateFormat = val!)),
                _buildDropdown(
                    "Data Refresh",
                    selectedDataRefresh,
                    const ["Automatic", "Manual", "Every 5 Mins"],
                    (val) => setState(() => selectedDataRefresh = val!)),
              ],
            ),

            // 2. Notification Preferences
            _buildSectionCard(
              title:
                  _text("Notification Preferences", "Mga Kagustuhan sa Abiso"),
              icon: Icons.notifications_none_outlined,
              children: [
                _buildSwitchTile(
                    _text("Critical Alerts", "Kritikal na Babala"),
                    _text("Extreme fever, heart rate anomalies",
                        "Matinding lagnat, hindi normal na tibok ng puso"),
                    criticalAlerts,
                    (val) => setState(() => criticalAlerts = val)),
                _buildSwitchTile(
                    _text("Warning Alerts", "Mga Babala"),
                    _text("Elevated vitals, moisture detection",
                        "Mataas na vital signs, natukoy na pagkabasa"),
                    warningAlerts,
                    (val) => setState(() => warningAlerts = val)),
                const Divider(height: 30),
                _buildDropdown("Tone", selectedAlertTone,
                    _phoneTones.map((tone) => tone['title']!).toList(),
                    (val) async {
                  if (val == null) return;
                  setState(() => selectedAlertTone = val);
                  final tone =
                      _phoneTones.firstWhere((item) => item['title'] == val);
                  try {
                    await ScheduleReminderService.previewAlertSound(
                        tone['uri'] ?? '', alertVolume);
                  } catch (_) {
                    // Preview is unavailable on unsupported platforms.
                  }
                }),
                Text("Volume", style: labelStyle),
                Row(
                  children: [
                    const Icon(Icons.volume_down, color: Colors.grey),
                    Expanded(
                      child: Slider(
                        value: alertVolume,
                        min: 0,
                        max: 1,
                        divisions: 10,
                        activeColor: const Color(0xFF4DB6AC),
                        label: "${(alertVolume * 100).round()}%",
                        onChanged: (value) =>
                            setState(() => alertVolume = value),
                      ),
                    ),
                    const Icon(Icons.volume_up, color: Color(0xFF4DB6AC)),
                    SizedBox(
                      width: 42,
                      child: Text("${(alertVolume * 100).round()}%",
                          textAlign: TextAlign.end,
                          style: const TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
                const Text(
                  "Controls the sound used for alerts sent through this phone.",
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),

            // 3. Read-only AI baseline information
            _buildSectionCard(
              title: "AI Normal Standard",
              icon: Icons.shield_outlined,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE3F2FD),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "These read-only values show the standard healthy baseline used by the AI when evaluating patient vital signs. They cannot be changed in Settings.",
                        style: GoogleFonts.albertSans(
                            fontSize: 12, color: Colors.blue.shade800),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _buildBaselineField("Heart rate minimum (bpm)", "50"),
                _buildBaselineField("Heart rate maximum (bpm)", "120"),
                _buildBaselineField("Temperature minimum (°C)", "36"),
                _buildBaselineField("Temperature maximum (°C)", "37.5"),
                _buildBaselineField("SpO₂ minimum (%)", "90"),
              ],
            ),

            // 4. Security Settings
            _buildSectionCard(
              title: _text("Security", "Seguridad"),
              icon: Icons.lock_outline,
              children: [
                _isBiometricAvailable
                    ? _buildSwitchTile(
                        _text(
                            "Biometric Login", "Pag-login gamit ang Biometric"),
                        _text(
                            "Use your fingerprint to log in instead of your password.",
                            "Gamitin ang fingerprint sa pag-login sa halip na password."),
                        _isBiometricEnabled,
                        _toggleBiometric,
                      )
                    : Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          _text(
                              "Biometric login is not available on this device.",
                              "Hindi available ang biometric login sa device na ito."),
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: Colors.grey,
                          ),
                        ),
                      ),
              ],
            ),

            // 5. Arduino device firmware update
            _buildSectionCard(
              title: _text("Device Firmware", "Firmware ng Device"),
              icon: Icons.system_update_outlined,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_text("Arduino firmware", "Firmware ng Arduino"),
                              style: labelStyle),
                          Text(_firmwareStatus,
                              style: const TextStyle(
                                  fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed:
                          _isCheckingFirmware ? null : _checkFirmwareUpdate,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4DB6AC),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                      child: _isCheckingFirmware
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(_text("Check Update", "Tingnan ang Update"),
                              style: const TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.bold)),
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
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    child: _isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : Text(
                            _text("Save Changes", "I-save ang mga Pagbabago"),
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 15),
                TextButton(
                  onPressed: _loadSettings,
                  child: Text(_text("Reset to Defaults", "Ibalik sa Default"),
                      style: const TextStyle(color: Colors.black54)),
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
      {required String title,
      required IconData icon,
      required List<Widget> children}) {
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
                  style: GoogleFonts.poppins(
                      fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 20),
          ...children,
        ],
      ),
    );
  }

  Widget _buildDropdown(String label, String value, List<String> items,
      Function(String?) onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: GoogleFonts.poppins(
                  fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: value,
            isExpanded: true,
            style: GoogleFonts.albertSans(fontSize: 14, color: Colors.black87),
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFFF1F2F6),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide.none),
            ),
            items: items
                .map((i) => DropdownMenuItem(
                    value: i,
                    child: Text(i,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.albertSans(fontSize: 14))))
                .toList(),
            selectedItemBuilder: (context) => items
                .map((i) => Align(
                      alignment: Alignment.centerLeft,
                      child: Text(i,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.albertSans(
                              fontSize: 14, color: Colors.black87)),
                    ))
                .toList(),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildBaselineField(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: GoogleFonts.albertSans(
                    fontSize: 13, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: 16),
          Container(
            width: 82,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F2F6),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Text(value,
                textAlign: TextAlign.center,
                style: GoogleFonts.albertSans(
                    fontSize: 14, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _buildSwitchTile(
      String title, String? subtitle, bool value, Function(bool) onChanged) {
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      title: Text(title,
          style:
              GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500)),
      subtitle: subtitle != null
          ? Text(subtitle, style: const TextStyle(fontSize: 12))
          : null,
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
        Text(_text("System Information", "Impormasyon ng Sistema"),
            style:
                GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 15),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _infoItem(_text("Application Version", "Bersyon ng Application"),
                _appVersion),
            _infoItem(
                _text("Database Status", "Kalagayan ng Database"),
                _text(_dbStatus,
                    _dbStatus == "Connected" ? "Konektado" : "Hindi available"),
                isStatus: _dbStatus == "Connected"),
          ],
        ),
        const SizedBox(height: 15),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // [TECHNICAL DEBT] Last Backup date requires a dedicated /api/sysadmin/backup-status
            // endpoint. Currently not available in this prototype version.
            _infoItem(_text("Last Backup", "Huling Backup"),
                _text(_lastBackup, "Hindi available")),
            _infoItem(
                _text("Active Devices", "Mga Aktibong Device"), _activeDevices),
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
