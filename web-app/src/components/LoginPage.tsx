import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Heart, Activity, Droplets } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // CHANGED: State is now 'username', not 'email'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // CALL THE REAL BACKEND via auth-context
      const success = await login(username, password);

      if (success) {
        // SUCCESS: Go straight to dashboard (Bypassing OTP for testing)
        // Adjust this path if your main dashboard route is different
        navigate('/dashboard'); 
      } else {
        setError('Invalid username or password.');
      }
    } catch (err) {
      setError('Server connection failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, var(--teal-50) 0%, var(--teal-200) 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4" style={{ backgroundColor: 'var(--teal-500)' }}>
            <Heart className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl mb-2" style={{ color: 'var(--teal-900)' }}>Alaga</h1>
          <p className="text-sm" style={{ color: 'var(--teal-700)' }}>Smart Patient Monitoring System</p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-1" style={{ color: 'var(--teal-600)' }}>
              <Activity className="w-4 h-4" />
              <span className="text-xs">Vital Signs</span>
            </div>
            <div className="flex items-center gap-1" style={{ color: 'var(--teal-600)' }}>
              <Droplets className="w-4 h-4" />
              <span className="text-xs">Smart Diaper Moisture Sensor</span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                {/* CHANGED LABEL TO USERNAME */}
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="bg-input-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-input-background"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="text-center pt-4">
                <p className="text-sm" style={{ color: 'var(--teal-700)' }}>
                  Don't have an account?{' '}
                  <a 
                    href="/signup" 
                    className="underline hover:no-underline"
                    style={{ color: 'var(--teal-600)' }}
                  >
                    Sign Up
                  </a>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--teal-700)' }}>
          © 2025 Alaga System. Compliant with Data Privacy Act of 2012.
        </p>
      </div>
    </div>
  );
};