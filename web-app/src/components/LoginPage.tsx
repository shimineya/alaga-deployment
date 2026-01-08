import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Activity, ShieldAlert, Lock } from 'lucide-react';
import { toast } from 'sonner';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Attempt Login via AuthContext
      const response = await login(username, password);

      // [FIX] Check response strictly
      if (response && response.success) {
        const user = response.user;

        // [Security Control] BLOCK Unverified Users
        if (user.account_status === 'Pending_Review') {
          setError('Your account is currently under review by the Administrator. Please wait for approval.');
          return; // Stop here, don't navigate
        }

        if (user.account_status === 'Suspended') {
          setError('Your account has been suspended. Contact support.');
          return;
        }

        toast.success(`Welcome back, ${user.username}!`);
        
        // [UX] Role-Based Redirection
        switch (user.role.toLowerCase()) {
          case 'medical_staff':
            navigate('/dashboard/medical');
            break;
          case 'caregiver':
            navigate('/dashboard/caregiver');
            break;
          case 'admin':
            navigate('/admin');
            break;
          default:
            navigate('/dashboard');
        }
      } else {
        // Handle case where login returns false/null but no error threw
        setError('Invalid credentials.');
      }

    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.message && err.message.includes('Too many')) {
        setError('Too many login attempts. Please try again later.');
      } else {
        setError('Invalid username or password.');
      }
    } finally {
      // [CRITICAL FIX] ALWAYS turn off the loading spinner
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F0FAF9' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#7DD3C0', boxShadow: '0 0 30px rgba(125, 211, 192, 0.4)' }}
          >
            <Activity className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#2C3E50' }}>ALAGA</h1>
          <p className="text-gray-600">Secure Patient Monitoring System</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-center text-xl" style={{ color: '#2C3E50' }}>Sign In</CardTitle>
            <CardDescription className="text-center">
              Access your professional dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username or Email</Label>
                <Input
                  id="username"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="bg-gray-50"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Password</Label>
                  <a href="#" className="text-xs text-teal-600 hover:underline">Forgot password?</a>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-gray-50"
                />
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription className="ml-2">{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full text-white font-medium h-11" 
                style={{ backgroundColor: '#7DD3C0' }}
                disabled={loading}
              >
                {loading ? 'Verifying Credentials...' : 'Sign In'}
              </Button>

              <div className="text-center pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <a 
                    href="/signup" 
                    className="font-medium hover:underline"
                    style={{ color: '#7DD3C0' }}
                  >
                    Register here
                  </a>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 mt-8 text-xs text-gray-400">
          <Lock className="w-3 h-3" />
          <p>Protected by 256-bit Encryption & JWT Auth</p>
        </div>
      </div>
    </div>
  );
};