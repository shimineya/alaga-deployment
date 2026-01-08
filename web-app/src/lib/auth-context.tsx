import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('alaga_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('alaga_user');
        localStorage.removeItem('alaga_token'); 
      }
    }
  }, []);

  // --- SECURE LOGIN INTEGRATION ---
  const login = async (username: string, password: string): Promise<any> => {
    try {
      // Use 127.0.0.1 to avoid "localhost" network ambiguity
      const response = await fetch('http://127.0.0.1:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        
        // [SECURITY PATCH] Gatekeeper: Check Status BEFORE saving session
        // This ensures unverified users never get a valid session state.
        if (data.user.account_status === 'Pending_Review' || data.user.account_status === 'Suspended') {
            // We return the data so LoginPage can display the specific error,
            // BUT we explicitly do NOT save to localStorage or update State.
            return data;
        }

        // [Success] Only save session if Account is Active
        if (data.token) {
            localStorage.setItem('alaga_token', data.token);
        }

        setUser(data.user);
        localStorage.setItem('alaga_user', JSON.stringify(data.user));
        
        return data; 
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login Process Error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('alaga_user');
    localStorage.removeItem('alaga_token');
    window.location.href = '/login'; 
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
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