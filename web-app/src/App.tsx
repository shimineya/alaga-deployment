import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { CaregiverLanguageProvider } from './lib/caregiver-language-context';
import { LoginPage } from './components/LoginPage';
import { LoginEmailVerification } from './components/LoginEmailVerification';
import { SignUp } from './components/SignUp';
import { UserTypeSelection } from './components/UserTypeSelection';
import { EmailVerification } from './components/EmailVerification';
import { Toaster } from './components/ui/sonner';

// [OWASP A01] Unified Layout — single source of truth for authenticated navigation
import MainLayout from './components/layout/MainLayout';

// [Hub Architecture] Centralized feature Hubs — each Hub owns its own RBAC tab logic
import OverviewHub from './components/hubs/OverviewHub';
import PatientRecordsHub from './components/hubs/PatientRecordsHub';
import DeviceManagementHub from './components/hubs/DeviceManagementHub';
import StaffManagementHub from './components/hubs/StaffManagementHub';
import SecurityAccessHub from './components/hubs/SecurityAccessHub';
import AlertsHub from './components/hubs/AlertsHub';
import ReportsHub from './components/hubs/ReportsHub';
import SettingsHub from './components/hubs/SettingsHub';
import AssignmentCommandCenter from './components/AssignmentCommandCenter';
import ArchiveHub from './components/hubs/ArchiveHub';

// [OWASP A01] Role-Based Route Guard
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm animate-pulse">Loading session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, isAuthenticated } = useAuth();

  // [OWASP A01] Normalize role string for consistent comparison
  const role = user?.role?.toLowerCase() || '';
  const isSysAdmin = role === 'system_admin' || role === 'admin' || role === 'sysadmin';
  const isFacilityAdmin = role === 'facility_admin';
  const isClinical = role === 'caregiver' || role === 'medical_staff';

  // Determine the correct post-login redirect target
  const defaultAuthRedirect = '/dashboard';

  return (
    <Routes>
      {/* ============================================================ */}
      {/* PUBLIC ROUTES                                                 */}
      {/* ============================================================ */}
      <Route
        path="/login"
        element={
          isAuthenticated
            ? <Navigate to={defaultAuthRedirect} replace />
            : <LoginPage />
        }
      />
      <Route path="/signup" element={<UserTypeSelection />} />
      <Route path="/registration" element={<SignUp />} />
      <Route path="/verify-email" element={<EmailVerification />} />
      <Route path="/login-verify" element={<LoginEmailVerification />} />

      {/* ============================================================ */}
      {/* PROTECTED HUB ROUTES — Wrapped in MainLayout + ProtectedRoute */}
      {/* [OWASP A01] All child routes inherit the AuthGuard. RBAC is   */}
      {/* enforced at the Hub component level via tab visibility logic.  */}
      {/* ============================================================ */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Overview Hub: /dashboard — All authenticated roles */}
        <Route path="/dashboard" element={<OverviewHub />} />

        {/* Patient Records Hub: /patients — Clinical + SysAdmin */}
        <Route path="/patients" element={<PatientRecordsHub />} />

        {/* Device Management Hub: /devices — All admin tiers + Clinical */}
        <Route path="/devices" element={<DeviceManagementHub />} />

        {/* Staff Management Hub: /staff — Facility Admin + SysAdmin */}
        <Route path="/staff" element={<StaffManagementHub />} />

        {/* Assignment Command Center: /assignments — Caregivers + Med Staff */}
        <Route path="/assignments" element={<AssignmentCommandCenter />} />

        {/* Security & Access Hub: /security — SysAdmin + Facility Admin (if overridden) */}
        <Route path="/security" element={<SecurityAccessHub />} />

        {/* Alerts Hub: /alerts — Clinical + Facility Admin + SysAdmin */}
        <Route path="/alerts" element={<AlertsHub />} />

        {/* Reports Hub: /reports — Clinical + SysAdmin */}
        <Route path="/reports" element={<ReportsHub />} />

        {/* Archive Hub: /archives — SysAdmin + Facility Admin */}
        <Route path="/archives" element={<ArchiveHub />} />

        {/* Settings Hub: /settings — All authenticated roles */}
        <Route path="/settings" element={<SettingsHub />} />
      </Route>

      {/* ============================================================ */}
      {/* REDIRECTS                                                     */}
      {/* Root and catch-all route to /dashboard                       */}
      {/* ============================================================ */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <CaregiverLanguageProvider>
          <AppContent />
          <Toaster />
        </CaregiverLanguageProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;