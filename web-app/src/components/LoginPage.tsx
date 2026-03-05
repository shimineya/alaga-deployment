import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Activity, ShieldAlert, Lock, Loader2 } from 'lucide-react';
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

    if (!username || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const result = await login(username, password);

      if (result.success && result.user) {
        toast.success("Welcome back!");

        // [OWASP A01] Route to the correct dashboard based on role
        const role = result.user.role;
        if (role === 'system_admin' || role === 'admin') {
          navigate('/sysadmin', { replace: true });
        } else if (role === 'facility_admin') {
          navigate('/facility-admin', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        // Login returned a failure — display the server message
        setError(result.message || "Invalid credentials");
        toast.error(result.message || "Login failed");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-[360px] shadow-lg border-0">
        <CardHeader className="text-center pb-2 space-y-1 pt-6">
          <div className="mx-auto w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center mb-1">
            <Activity className="w-6 h-6 text-teal-600" />
          </div>
          <CardTitle className="text-lg font-bold text-slate-800">Alaga Login</CardTitle>
          <CardDescription className="text-xs">Secure access for Caregivers & Staff</CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <Alert variant="destructive" className="py-2 px-3 text-xs bg-red-50 text-red-700 border-red-200">
                <ShieldAlert className="h-3 w-3 mr-2" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <Label htmlFor="username" className="text-xs font-semibold text-slate-500 uppercase">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter username"
                className="h-9 text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-500 uppercase">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                className="h-9 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-9 bg-teal-600 hover:bg-teal-700 text-white font-medium mt-2 text-xs"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Lock className="w-3 h-3 mr-2" />}
              {loading ? 'Verifying...' : 'Sign In'}
            </Button>

            <div className="text-center mt-3">
              <p className="text-xs text-gray-500">
                New user?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="font-medium text-teal-600 hover:underline"
                >
                  Create account
                </button>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};