import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { LoginPage } from './components/LoginPage';
import { LoginEmailVerification } from './components/LoginEmailVerification';
import { SignUp } from './components/SignUp';
import { UserTypeSelection } from './components/UserTypeSelection';
import { EmailVerification } from './components/EmailVerification';
import { CaregiverDashboardNew } from './components/CaregiverDashboardNew';
import { MedicalStaffDashboard } from './components/MedicalStaffDashboard';
import { Toaster } from './components/ui/sonner';

// [Admin Module] Imports — Legacy admin module (backward compatible)
import AdminLayout from './components/admin/AdminLayout';
import ComplianceHub from './components/admin/ComplianceHub';
import DeviceGovernance from './components/admin/DeviceGovernance';
import SystemOverview from './components/admin/SystemOverview';
import UserManagement from './components/admin/UserManagement';
import SystemSettings from './components/admin/SystemSettings';
import InventoryManagement from './components/admin/InventoryManagement';
import SecurityControls from './components/admin/SecurityControls';

// [OWASP A01] System Admin (CISO / IT Operations tier)
import SysAdminLayout from './components/sysadmin/SysAdminLayout';
import CommandCenter from './components/sysadmin/CommandCenter';
import GlobalSecurity from './components/sysadmin/GlobalSecurity';
import FirmwareManagement from './components/sysadmin/FirmwareManagement';
import ForensicAuditTrails from './components/sysadmin/ForensicAuditTrails';
import SysAdminPatientCare from './components/sysadmin/SysAdminPatientCare';

// [OWASP A01] Facility Admin (Ward Operations tier)
import FacilityAdminLayout from './components/facility-admin/FacilityAdminLayout';
import FacilityDashboard from './components/facility-admin/FacilityDashboard';
import WardStaffManagement from './components/facility-admin/WardStaffManagement';
import PatientOnboarding from './components/facility-admin/PatientOnboarding';
import AlertConfiguration from './components/facility-admin/AlertConfiguration';
import ReadOnlyDiagnostics from './components/facility-admin/ReadOnlyDiagnostics';
import PatientCaregiverAssignment from './components/facility-admin/PatientCaregiverAssignment';


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, isAuthenticated } = useAuth();

  // Helper to normalize role checking
  const role = user?.role || '';
  const isMedical = role === 'Medical Staff' || role === 'medical_staff';
  const isCaregiver = role === 'Caregiver' || role === 'caregiver';
  // [OWASP A01] Distinguish between the two admin tiers
  const isSysAdmin = role === 'system_admin' || role === 'admin';
  const isFacilityAdmin = role === 'facility_admin';
  const isAdmin = isSysAdmin || isFacilityAdmin;

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          isAuthenticated
            ? (isSysAdmin
              ? <Navigate to="/sysadmin" replace />
              : isFacilityAdmin
                ? <Navigate to="/facility-admin" replace />
                : <Navigate to="/dashboard" replace />)
            : <LoginPage />
        }
      />
      <Route path="/signup" element={<UserTypeSelection />} />
      <Route path="/registration" element={<SignUp />} />
      <Route path="/verify-email" element={<EmailVerification />} />
      <Route path="/login-verify" element={<LoginEmailVerification />} />

      {/* Protected Routes */}
      {/* Logic: Redirects to the correct dashboard based on Role */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {isCaregiver ? (
              <CaregiverDashboardNew />
            ) : isMedical ? (
              <MedicalStaffDashboard />
            ) : isSysAdmin ? (
              <Navigate to="/sysadmin" replace />
            ) : isFacilityAdmin ? (
              <Navigate to="/facility-admin" replace />
            ) : (
              <Navigate to="/login" replace />
            )}
          </ProtectedRoute>
        }
      />

      {/* LEGACY ADMIN ROUTE TREE — backward compatible */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<SystemOverview />} />
        <Route path="compliance" element={<ComplianceHub />} />
        <Route path="devices" element={<DeviceGovernance />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="settings" element={<SystemSettings />} />
        <Route path="inventory" element={<InventoryManagement />} />
        <Route path="security" element={<SecurityControls />} />
      </Route>

      {/* [OWASP A01] SYSTEM ADMIN ROUTE TREE — SysAdminLayout enforces system_admin or admin role */}
      <Route path="/sysadmin" element={<SysAdminLayout />}>
        <Route index element={<CommandCenter />} />
        <Route path="security" element={<GlobalSecurity />} />
        <Route path="firmware" element={<FirmwareManagement />} />
        <Route path="audit" element={<ForensicAuditTrails />} />
        {/* PHI Zone routes (access gated by break-glass UX in SysAdminSidebar) */}
        <Route path="phi">
          <Route path="devices" element={<SysAdminPatientCare />} />
          <Route path="calendar" element={<SysAdminPatientCare />} />
          <Route path="reports" element={<SysAdminPatientCare />} />
          <Route path="bulletin" element={<SysAdminPatientCare />} />
        </Route>
      </Route>

      {/* [OWASP A01] FACILITY ADMIN ROUTE TREE — FacilityAdminLayout enforces facility_admin role + RLS */}
      <Route path="/facility-admin" element={<FacilityAdminLayout />}>
        <Route index element={<FacilityDashboard />} />
        <Route path="staff" element={<WardStaffManagement />} />
        <Route path="staff/assignments" element={<PatientCaregiverAssignment />} />
        <Route path="patients" element={<PatientOnboarding />} />
        <Route path="alerts" element={<AlertConfiguration />} />
        <Route path="diagnostics" element={<ReadOnlyDiagnostics />} />
      </Route>

      {/* Root path redirecting to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;