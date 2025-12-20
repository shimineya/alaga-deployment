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

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} 
      />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/verify-email" element={<EmailVerification />} />
      <Route path="/login-verify" element={<LoginEmailVerification />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {user?.role === 'caregiver' ? (
              <CaregiverDashboardNew />
            ) : user?.role === 'medical_staff' ? (
              <MedicalStaffDashboard />
            ) : (
              <Navigate to="/login" replace />
            )}
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
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