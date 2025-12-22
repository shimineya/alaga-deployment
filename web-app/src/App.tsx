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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppContent() {
  const { user, isAuthenticated } = useAuth();

  // Helper to normalize role checking (handles "Medical Staff", "medical_staff", etc.)
  const role = user?.role || '';
  const isMedical = role === 'Medical Staff' || role === 'medical_staff';
  const isCaregiver = role === 'Caregiver' || role === 'caregiver';

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/verify-email" element={<EmailVerification />} />
      <Route path="/login-verify" element={<LoginEmailVerification />} />

      {/* Protected Routes */}
      {/* We add /dashboard explicitly since LoginPage redirects there */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {isCaregiver ? (
              <CaregiverDashboardNew />
            ) : isMedical ? (
              <MedicalStaffDashboard />
            ) : (
              // If role is missing or unknown, go to login to clear state
              <Navigate to="/login" replace />
            )}
          </ProtectedRoute>
        }
      />

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