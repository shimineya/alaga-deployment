import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  // CHANGED: 'email' to 'username' to match your Backend requirement
  login: (username: string, password: string) => Promise<boolean>;
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
      }
    }
  }, []);

  // --- REAL LOGIN INTEGRATION ---
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // We use 127.0.0.1 to avoid "localhost" network ambiguity
      const response = await fetch('http://127.0.0.1:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Save the real user data from Postgres
        setUser(data.user);
        localStorage.setItem('alaga_user', JSON.stringify(data.user));
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Login Connection Error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('alaga_user');
    window.location.href = '/login'; // Force redirect
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