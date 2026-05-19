import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Define the User Shape based on your Database
interface User {
  user_id: number;
  username: string;
  email: string;
  // [OWASP A01] All five role tiers recognised by the backend
  role: 'admin' | 'system_admin' | 'facility_admin' | 'medical_staff' | 'caregiver';
  account_status: string;
  facility_id?: number | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  // [RBAC] Flat permission map loaded from the backend on login.
  // Key = module_id (e.g. 'my-patients'), Value = true/false.
  // An absent key means "follow role default" (treated as granted).
  permissions: Record<string, boolean>;
  // [RBAC] True when the logged-in account is a system admin tier.
  // SysAdmins are always exempt from permission restrictions.
  isSysAdmin: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<{
    success: boolean;
    user?: User;
    message?: string;
    // [OWASP A07] Surfaces unverified-account state so the login page can
    // redirect the user to /verify-email instead of showing a generic error.
    requiresOtp?: boolean;
    user_id?: number;
    email?: string;
  }>;
  logout: () => void;
  isLoading: boolean;
  token: string | null;
  updateToken: (newToken: string) => void;
  // [RBAC] Re-fetch permissions (call after a sysadmin updates their own account, if needed)
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  // [RBAC] Permissions are NOT persisted to localStorage — they are always
  // fetched fresh from the backend on login / page load.
  // This ensures a revoked permission takes effect on the next session,
  // without stale data surviving a browser refresh.
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isSysAdmin, setIsSysAdmin] = useState(false);

  // [OWASP A01] Fetch the logged-in user's effective permission map from the backend.
  // This merges role_permissions (defaults) + user_permission_overrides (per-user).
  const fetchPermissions = useCallback(async (activeToken: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/my-permissions`, {
        headers: { 'Authorization': `Bearer ${activeToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setPermissions(data.permissions || {});
        setIsSysAdmin(data.isSysAdmin === true);
      }
    } catch {
      // [OWASP A10] Network failure on permission fetch — fail open for prototype.
      // In production, this should fail closed (deny all) until the fetch succeeds.
      // TECHNICAL DEBT: replace with fail-closed logic before commercial release.
      setPermissions({});
    }
  }, []);

  // Public refresh function exposed via context (for edge-case use)
  const refreshPermissions = useCallback(async () => {
    const activeToken = localStorage.getItem('token');
    if (activeToken) await fetchPermissions(activeToken);
  }, [fetchPermissions]);

  // 1. Check for existing session on page load (Auto-Login + Permission Restore)
  useEffect(() => {
    const checkLogin = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser  = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
          // [RBAC] Fetch permissions every page load so revocations take effect on refresh
          await fetchPermissions(storedToken);
        } catch (e) {
          console.error('Failed to restore session', e);
          localStorage.clear();
        }
      }
      setIsLoading(false);
    };
    checkLogin();
  }, [fetchPermissions]);

  // [Kill Switch] Global 401 interceptor to enforce session revocation
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const cloned = response.clone();
        try {
          const body = await cloned.json();
          if (body.message && body.message.toLowerCase().includes('session has been terminated')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
        } catch { /* non-JSON response, ignore */ }
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  // 2. Login Function
  const login = async (usernameOrEmail: string, password: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameOrEmail, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setToken(data.token);
        // [RBAC] Fetch this user's effective permissions immediately after login
        await fetchPermissions(data.token);
        return { success: true, user: data.user };
      }

      // [OWASP A07] Surface the unverified-account state so LoginPage can
      // redirect to /verify-email instead of showing a generic error message.
      return {
        success: false,
        message: data.message || 'Login failed',
        requiresOtp: data.requiresOtp || false,
        user_id: data.user_id,
        email: data.email,
      };
    } catch (error) {
      return { success: false, message: 'Server connection failed. Is the backend running?' };
    }
  };

  const logout = async () => {
    try {
      const t = localStorage.getItem('token');
      if (t) {
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        });
      }
    } catch { /* Proceed with local logout regardless */ }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    setPermissions({});
    setIsSysAdmin(false);
    window.location.href = '/login';
  };

  const updateToken = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isLoading,
      isAuthenticated: !!user,
      permissions,
      isSysAdmin,
      token,
      updateToken,
      refreshPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};