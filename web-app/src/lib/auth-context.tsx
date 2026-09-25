import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Define the User Shape based on your Database
interface User {
  id?: number;
  user_id: number;
  username: string;
  email: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role: 'admin' | 'system_admin' | 'facility_admin' | 'medical_staff' | 'caregiver' | 'parent';
  account_status: string;
  facility_id?: number | null;
  facility_name?: string | null;
  profile_picture_url?: string | null;
  profilePictureUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  permissions: Record<string, boolean>;
  isSysAdmin: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<{
    success: boolean;
    user?: User;
    message?: string;
    requiresOtp?: boolean;
    user_id?: number;
    email?: string;
  }>;
  logout: () => void;
  isLoading: boolean;
  token: string | null;
  updateToken: (newToken: string) => void;
  refreshPermissions: () => Promise<void>;
  refreshUser: () => void;
}

import { API_URL } from './config';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isSysAdmin, setIsSysAdmin] = useState(false);

  const fetchPermissions = useCallback(async (activeToken: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/my-permissions`, {
        headers: { 'Authorization': `Bearer ${activeToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setPermissions(data.permissions || {});
        setIsSysAdmin(data.isSysAdmin === true);
      }
    } catch {
      setPermissions({});
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    const activeToken = localStorage.getItem('token');
    if (activeToken) await fetchPermissions(activeToken);
  }, [fetchPermissions]);

  useEffect(() => {
    const checkLogin = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser  = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setToken(storedToken);
          await fetchPermissions(storedToken);

          // Proactively hydrate latest user & facility details from backend
          fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${storedToken}` }
          })
            .then(res => res.json())
            .then(data => {
              if (data.success && data.user) {
                const merged = { ...parsedUser, ...data.user };
                setUser(merged);
                localStorage.setItem('user', JSON.stringify(merged));
              }
            })
            .catch(() => {});
        } catch (e) {
          console.error('Failed to restore session', e);
          localStorage.clear();
        }
      }
      setIsLoading(false);
    };
    checkLogin();
  }, [fetchPermissions]);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : '';
      const isLoginRequest = url.toLowerCase().includes('/api/auth/login') || url.toLowerCase().includes('/login');
 
      const response = await originalFetch(...args);
      if (response.status === 503 || (response.status === 401 && !isLoginRequest)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
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
        await fetchPermissions(data.token);
        return { success: true, user: data.user };
      }

      return {
        success: false,
        message: data.message || 'Login failed',
        requiresOtp: data.requiresOtp || false,
        user_id: data.user_id,
        email: data.email,
      };
    } catch (error) {
      return { success: false, message: 'Your Wi-Fi might not be connected or the application is down.' };
    }
  };

  const logout = async () => {
    const t = localStorage.getItem('token');
    if (t) {
      fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
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

  const refreshUser = () => {
    const activeToken = localStorage.getItem('token');
    if (activeToken) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setUser(prev => {
              const updated = { ...prev, ...data.user };
              localStorage.setItem('user', JSON.stringify(updated));
              return updated;
            });
          }
        })
        .catch(() => {
          try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) setUser(JSON.parse(storedUser));
          } catch {}
        });
    } else {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
      } catch {}
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!token,
      permissions,
      isSysAdmin,
      login,
      logout,
      isLoading,
      token,
      updateToken,
      refreshPermissions,
      refreshUser
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