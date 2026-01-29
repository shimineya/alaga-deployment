import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { LoginPage } from './components/LoginPage';
import { LoginEmailVerification } from './components/LoginEmailVerification';
import { SignUp } from './components/SignUp';
import { EmailVerification } from './components/EmailVerification';
import { CaregiverDashboardNew } from './components/CaregiverDashboardNew';
import { MedicalStaffDashboard } from './components/MedicalStaffDashboard';
import { Toaster } from './components/ui/sonner';

// [Admin Module] Imports
import AdminLayout from './components/admin/AdminLayout';
import ComplianceHub from './components/admin/ComplianceHub';
import DeviceGovernance from './components/admin/DeviceGovernance';
import SystemOverview from './components/admin/SystemOverview';
import UserManagement from './components/admin/UserManagement';
import SystemSettings from './components/admin/SystemSettings';
import InventoryManagement from './components/admin/InventoryManagement';
import SecurityControls from './components/admin/SecurityControls';


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
  const isAdmin = role === 'admin'; // [Security] Check for admin role

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={
            isAuthenticated 
            ? (isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />) 
            : <LoginPage />
        } 
      />
      <Route path="/signup" element={<SignUp />} />
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
            ) : isAdmin ? (
              // [UX] Admins shouldn't be here, send them to their layout
              <Navigate to="/admin" replace />
            ) : (
              // If role is missing or unknown, go to login to clear state
              <Navigate to="/login" replace />
            )}
          </ProtectedRoute>
        }
      />

      {/* 🚀 ADMIN MODULE ROUTES */}
      {/* This layout wrapper enforces "Admins Only" via AdminLayout.tsx */}
<Route path="/admin" element={<AdminLayout />}>
    {/* 2. Replace the placeholder div with this: */}
    <Route index element={<SystemOverview />} />
    
    <Route path="compliance" element={<ComplianceHub />} />
    <Route path="devices" element={<DeviceGovernance />} />
    <Route path="users" element={<UserManagement />} />
    <Route path="settings" element={<SystemSettings />} />
    <Route path="inventory" element={<InventoryManagement />} />
    <Route path="security" element={<SecurityControls />} />
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