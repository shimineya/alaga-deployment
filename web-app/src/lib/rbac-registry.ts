// ================================================================
// MASTER MODULE REGISTRY
// This is the single source of truth for what hub tabs / features
// can be toggled per-user. Keep this list in sync with the Hub
// components that check permissions on the frontend.
// ================================================================
export const MODULE_REGISTRY: { group: string; modules: { id: string; label: string; description: string }[] }[] = [
    {
        group: 'Dashboard (Overview Hub)',
        modules: [
            { id: 'dashboard', label: 'System Admin Dashboard', description: 'Global telemetry command center view.' },
            { id: 'facility-dashboard', label: 'Facility Admin Dashboard', description: 'Ward-level operational dashboard.' },
            { id: 'caregiver-dashboard', label: 'Caregiver Dashboard', description: 'Live patient vitals monitoring view.' },
        ]
    },
    {
        group: 'Patient Records Hub',
        modules: [
            { id: 'my-patients', label: 'Patient Roster', description: 'View the list of assigned patients.' },
            { id: 'add-patient', label: 'Admission / Onboarding', description: 'Register new patients into the system.' },
            { id: 'patients-registered-assigned', label: 'Patients Registered and Assigned', description: 'View and manage all registered patients.' },
            { id: 'unassigned-patients', label: 'Unassigned Patients', description: 'Manage patients without caregiver assignments.' },
        ]
    },
    {
        group: 'Device Management Hub',
        modules: [
            { id: 'device-status', label: "Patients' Devices", description: 'View sensors assigned to this user\'s patients.' },
            { id: 'add-device', label: 'Add New Device', description: 'Pair a new ESP32 sensor to the system whitelists.' },
            { id: 'assign-device', label: 'Assign Device to Patient', description: 'Pair Smart Diaper or Vital Signs devices to a patient.' },
            { id: 'sys-device-assignment', label: 'System-wide Device Assignment', description: 'Manage device linkages and assignments across all patients.' },
            { id: 'diagnostics', label: 'Ward Diagnostics', description: 'Network stability and battery health matrix.' },
            { id: 'topology', label: 'Network Topology', description: 'Build and manage facility hardware topology.' },
            { id: 'firmware-ota', label: 'Firmware OTA Updates', description: 'Push over-the-air updates to ESP32 devices.' },
        ]
    },
    {
        group: 'Staff Management Hub',
        modules: [
            { id: 'ward-staff', label: 'Department Staff Management', description: 'Manage personnel accounts and sessions.' },
            { id: 'patient-assignments', label: 'Patient Assignments (PHI)', description: 'Assign caregivers to patients.' },
        ]
    },
    {
        group: 'Security & Access Hub',
        modules: [
            { id: 'security-operations', label: 'Security Operations (SIEM)', description: 'Threat feed and brute-force monitoring.' },
            { id: 'audit-logs', label: 'Forensic Audit Trails', description: 'HIPAA-compliant PHI access logging.' },
            { id: 'rbac_management', label: 'User Permissions Manager', description: 'Toggle per-user module access rights.' },
        ]
    },
    {
        group: 'Alerts Hub',
        modules: [
            { id: 'alerts', label: 'Live Patient Alerts (PHI)', description: 'Real-time clinical notification feed.' },
            { id: 'alert-config', label: 'Threshold Configurations', description: 'Set minimum/maximum alarm boundaries.' },
        ]
    },
    {
        group: 'Reports Hub',
        modules: [
            { id: 'reports', label: 'All Clinical Reports (PHI)', description: 'Daily summary, anomaly log, moisture tracker, weekly trends, data export.' },
        ]
    },
    {
        group: 'Settings Hub',
        modules: [
            { id: 'settings_profile', label: 'Account Profile', description: 'Update username, password, email, and contact number.' },
            { id: 'settings_preferences', label: 'Preferences', description: 'Update alert tones, visual settings, and calibration baselines.' },
            { id: 'system-settings', label: 'System Overrides', description: 'Global application configuration.' },
            { id: 'compliance', label: 'Privacy & Compliance Controls', description: 'DPA data retention and GDPR controls.' },
        ]
    },
];

// ================================================================
// ROLE DEFAULT CALCULATOR
//
// This function answers: "What does a user with role X see by default,
// before any sysadmin override is applied?"
//
// It mirrors the EXACT boolean role logic used in EVERY Hub component
// and AppSidebar so that UserRBACManager toggles always reflect the
// real state the user sees when they log in — regardless of whether
// the role_permissions table is seeded in the database.
//
// Source of truth priority when resolving final access:
//   1. user_permission_overrides (sysadmin sets via UserRBACManager)
//   2. role_permissions DB table (optional explicit row for this role)
//   3. computeRoleDefaults()  <-- this function (always-accurate fallback)
//
// If you add a new Hub tab, add its module_id here as well.
// ================================================================
export function computeRoleDefaults(role: string): Record<string, boolean> {
    const r               = role.toLowerCase();
    // [OWASP A01] 'parent' is the consumer-facing home-monitoring role.
    // Backend caregiverRoutes.js explicitly permits parent for device registration,
    // patient enrollment, and patient/device removal alongside 'admin'.
    const isParent        = r === 'parent';
    const isClinical      = r === 'caregiver' || r === 'medical_staff' || isParent;
    const isFacilityAdmin = r === 'facility_admin';
    const isAdminTier     = r === 'system_admin' || r === 'admin' || r === 'sysadmin';

    return {
        // --- Dashboard (Overview Hub) ---
        'dashboard':               isAdminTier,
        'facility-dashboard':      isFacilityAdmin || isAdminTier,
        'caregiver-dashboard':     isClinical || isAdminTier,

        // --- Patient Records Hub ---
        // PatientRecordsHub: canSeeRoster      = isClinical || isAdminTier
        //                    canSeeOnboarding  = isFacilityAdmin || isParent || isAdminTier
        // [OWASP A01] Parent can enroll their own child as a patient.
        // Backend guard: caregiverRoutes.js /patients/new allows admin | medical_staff | parent.
        'my-patients':             isClinical || isAdminTier,
        'add-patient':             isFacilityAdmin || isParent || isClinical || isAdminTier,
        'patients-registered-assigned': isFacilityAdmin || isAdminTier,
        'unassigned-patients':     isFacilityAdmin || isAdminTier,

        // --- Device Management Hub ---
        // DeviceManagementHub: canSeeMyDevices   = isClinical || isFacilityAdmin || isAdminTier
        //                      canSeeAddDevice   = isClinical || isFacilityAdmin || isAdminTier
        //                      canSeeDiagnostics = isFacilityAdmin || isAdminTier
        //                      canSeeTopology    = isAdminTier
        //                      canSeeOTA         = isAdminTier (same flag as topology)
        'device-status':           isClinical || isFacilityAdmin || isAdminTier,
        'add-device':              isClinical || isFacilityAdmin || isAdminTier,
        'assign-device':           isFacilityAdmin || isAdminTier,
        'sys-device-assignment':   isAdminTier,
        'diagnostics':             isFacilityAdmin || isAdminTier,
        'topology':                isAdminTier,
        'firmware-ota':            isAdminTier,

        // --- Staff Management Hub (route: /staff) ---
        // StaffManagementHub: canSeeWardStaff       = isFacilityAdmin || isAdminTier
        //                     canSeeAssignmentsAdmin = isFacilityAdmin || isAdminTier
        //                     canSeeMyAssignments    = isClinical
        // patient-assignments covers both the admin view and the caregiver "My Assignments" view
        'ward-staff':              isFacilityAdmin || isAdminTier,
        'patient-assignments':     isFacilityAdmin || isClinical || isAdminTier,

        // --- Security & Access Hub (route: /security) ---
        // SecurityAccessHub: canSeeSystemSecurity = isAdminTier
        //                    canSeeAuditTrails    = isAdminTier
        //                    canSeeRBACManager    = isAdminTier
        'security-operations':     isAdminTier,
        'audit-logs':              isAdminTier,
        'rbac_management':         isAdminTier,

        // --- Alerts Hub ---
        // AlertsHub: canSeeLiveAlerts = isFacilityAdmin || isClinical || isAdminTier
        //            canSeeConfig     = isFacilityAdmin || isAdminTier
        'alerts':                  isFacilityAdmin || isClinical || isAdminTier,
        'alert-config':            isFacilityAdmin || isAdminTier,

        // --- Reports Hub ---
        // Clinical Reports (PHI): accessible strictly to Facility Admin, Medical Staff, and System Admin
        'reports':                 isFacilityAdmin || isMedStaff || isAdminTier,

        // --- Settings Hub ---
        'settings_profile':        true,
        'settings_preferences':    true,
        'system-settings':         isAdminTier,
        'compliance':              isFacilityAdmin || isAdminTier,
    };
}
