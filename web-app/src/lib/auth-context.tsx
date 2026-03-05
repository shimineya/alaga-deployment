import React, { createContext, useContext, useState, useEffect } from 'react';

// Define the User Shape based on your Database
interface User {
  user_id: number;
  username: string;
  email: string;
  // [OWASP A01] All five role tiers recognised by the backend
  role: 'admin' | 'system_admin' | 'facility_admin' | 'medical_staff' | 'caregiver';
  account_status: string;
}

interface AuthContextType {
  user: User | null;
  // [Fix] Added isAuthenticated back so App.tsx works
  isAuthenticated: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; user?: User; message?: string }>;
  logout: () => void;
  isLoading: boolean;
  token: string | null; // [Fix] Expose token
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token')); // [Fix] Initialize from LS
  const [isLoading, setIsLoading] = useState(true);

  // 1. Check for existing token on app load (Auto-Login)
  useEffect(() => {
    const checkLogin = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          setToken(token); // Ensure state matches LS
        } catch (e) {
          console.error("Failed to parse stored user", e);
          localStorage.clear();
        }
      }
      setIsLoading(false);
    };
    checkLogin();
  }, []);

  // [Kill Switch] Global 401 interceptor to enforce session revocation
  // When any API call returns 401 with the revocation message, force-logout the user
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        // Clone so the original consumer can still read the body
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

  // 2. REAL Login Function (Connected to Backend)
  const login = async (usernameOrEmail: string, password: string) => {
    console.log("🔵 AuthContext: Initiating Login for:", usernameOrEmail);

    try {
      // [API CALL] Talking to your actual backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: usernameOrEmail,
          password
        }),
      });

      const data = await response.json();
      console.log("🟢 AuthContext: Server Response:", data);

      if (response.ok && data.success) {
        // [SUCCESS] Save Data & Update State
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setToken(data.token); // [Fix] Update token state
        return { success: true, user: data.user };
      } else {
        // [FAILURE] Return server message
        return { success: false, message: data.message || "Login failed" };
      }

    } catch (error) {
      console.error("🔴 AuthContext: Network Error:", error);
      return { success: false, message: "Server connection failed. Is the backend running?" };
    }
  };

  const logout = async () => {
    // Notify server to clear online status before wiping local credentials
    try {
      const t = localStorage.getItem('token');
      if (t) {
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' }
        });
      }
    } catch { /* Network error is acceptable — still proceed with local logout */ }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isLoading,
      // [Fix] Derived state for App.tsx
      isAuthenticated: !!user,
      token // [Fix] Expose token
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