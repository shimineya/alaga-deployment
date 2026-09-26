import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  UserPlus,
  Plus,
  Check,
  Trash2,
  ArrowRightLeft,
  Users,
  Eye,
  EyeOff,
  Building,
  Heart,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/config';
import { AccountManager, SavedAccount } from '@/lib/account-manager';

export const AccountSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Sign Up Form State
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'caregiver' | 'parent' | 'medical_staff'>('caregiver');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const currentUserId = user?.id || user?.user_id;

  useEffect(() => {
    refreshAccounts();
  }, [user]);

  const refreshAccounts = () => {
    setAccounts(AccountManager.getSavedAccounts());
  };

  const handleSwitch = (userId: number) => {
    if (userId === currentUserId) return;
    toast.loading('Switching active account...');
    AccountManager.switchAccount(userId);
  };

  const handleRemove = (userId: number, username: string) => {
    if (userId === currentUserId) {
      toast.error('Cannot remove your currently active account.');
      return;
    }
    const updated = AccountManager.removeSavedAccount(userId);
    setAccounts(updated);
    toast.success(`Account @${username} removed from switch list.`);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) {
      setLoginError('Please enter both username/email and password.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.user && data.token) {
        // Link the account to saved accounts list without changing current active user!
        AccountManager.addSavedAccount({
          user: data.user,
          token: data.token,
        });

        refreshAccounts();
        setIsModalOpen(false);
        setLoginUsername('');
        setLoginPassword('');
        toast.success(`Account @${data.user.username} linked successfully! You can switch to it anytime.`);
      } else {
        setLoginError(data.message || 'Authentication failed. Please check credentials.');
      }
    } catch {
      setLoginError('Network error connecting to authentication server.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim() || !regPassword) {
      setSignupError('Email and password are required.');
      return;
    }

    setIsSigningUp(true);
    setSignupError(null);

    const safeUsername = regUsername.trim() || regEmail.trim().split('@')[0];

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: regFirstName.trim(),
          last_name: regLastName.trim(),
          email: regEmail.trim().toLowerCase(),
          username: safeUsername,
          mobile_number: regPhone.trim(),
          password: regPassword,
          role: regRole,
          has_facility: false,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Try authenticating to obtain session token for saved list
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: safeUsername,
            password: regPassword,
          }),
        });

        const loginData = await loginRes.json();

        if (loginRes.ok && loginData.success && loginData.user && loginData.token) {
          AccountManager.addSavedAccount({
            user: loginData.user,
            token: loginData.token,
          });
          refreshAccounts();
          setIsModalOpen(false);
          resetSignupForm();
          toast.success(`New account @${loginData.user.username} registered & added!`);
        } else {
          // If login requires OTP or email verification
          toast.info(data.message || 'Account registered! Please sign in with your credentials to link it.');
          setActiveTab('login');
          setLoginUsername(safeUsername);
          setLoginPassword(regPassword);
        }
      } else {
        setSignupError(data.message || 'Registration failed.');
      }
    } catch {
      setSignupError('Network error connecting to registration server.');
    } finally {
      setIsSigningUp(false);
    }
  };

  const resetSignupForm = () => {
    setRegFirstName('');
    setRegLastName('');
    setRegEmail('');
    setRegUsername('');
    setRegPhone('');
    setRegPassword('');
  };

  const formatRole = (role?: string) => {
    if (!role) return 'User';
    switch (role.toLowerCase()) {
      case 'system_admin':
      case 'sysadmin':
      case 'admin':
        return 'System Admin';
      case 'facility_admin':
        return 'Facility Admin';
      case 'medical_staff':
        return 'Medical Staff';
      case 'caregiver':
        return 'Caregiver';
      case 'parent':
      case 'guardian':
        return 'Parent / Guardian';
      default:
        return role.charAt(0).toUpperCase() + role.slice(1);
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'system_admin':
      case 'sysadmin':
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'facility_admin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'medical_staff':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'parent':
      case 'guardian':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-teal-100 text-teal-800 border-teal-200';
    }
  };

  return (
    <>
      <Card className={`shadow-sm border-slate-100 bg-white ${className}`}>
        <CardHeader className="py-3 px-4 border-b border-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              <div>
                <CardTitle className="text-xs sm:text-sm font-bold text-slate-800">
                  Switch Account
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Link multiple accounts on this device and switch with one click
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setLoginError(null);
                setSignupError(null);
                setIsModalOpen(true);
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs h-8 px-3 rounded-lg flex items-center gap-1 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Account</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4 space-y-2.5">
          {accounts.map(acc => {
            const accUserId = acc.user.id || acc.user.user_id;
            const isCurrent = accUserId === currentUserId;
            const displayName = acc.user.name || (acc.user.first_name ? `${acc.user.first_name} ${acc.user.last_name || ''}`.trim() : acc.user.username);
            const avatarUrl = acc.user.profilePictureUrl || acc.user.profile_picture_url;

            return (
              <div
                key={accUserId}
                className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-teal-50/60 border-teal-200 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl.startsWith('http') ? avatarUrl : `${API_URL}${avatarUrl}`}
                        alt={acc.user.username}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                        isCurrent ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {(acc.user.username || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    {isCurrent && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                        {displayName}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-bold ${getRoleBadgeStyle(acc.user.role)}`}
                      >
                        {formatRole(acc.user.role)}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      @{acc.user.username} • {acc.user.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  {isCurrent ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </Badge>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSwitch(accUserId)}
                        className="h-7 px-2.5 text-xs font-semibold border-teal-300 text-teal-700 hover:bg-teal-50 rounded-lg flex items-center gap-1"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Switch</span>
                      </Button>
                      {accounts.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemove(accUserId, acc.user.username)}
                          title="Remove from switch list"
                          className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <Button
            variant="outline"
            onClick={() => {
              setLoginError(null);
              setSignupError(null);
              setIsModalOpen(true);
            }}
            className="w-full mt-2 border-dashed border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-400 text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Another Account</span>
          </Button>
        </CardContent>
      </Card>

      {/* Add Account Modal (Log In or Sign Up) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md w-[92vw] sm:w-full p-0 overflow-hidden rounded-2xl border-slate-200 shadow-2xl bg-white">
          <DialogHeader className="p-4 sm:p-5 bg-gradient-to-r from-teal-800 to-teal-700 text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 rounded-xl">
                <UserPlus className="w-5 h-5 text-teal-200" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-white">
                  Add Another Account
                </DialogTitle>
                <DialogDescription className="text-teal-100 text-xs">
                  Link an existing account or create a new one to switch anytime.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5">
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'login' | 'signup')}>
              <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl mb-4">
                <TabsTrigger value="login" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-teal-900 shadow-none">
                  Log In
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-teal-900 shadow-none">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: LOG IN */}
              <TabsContent value="login" className="space-y-3 mt-0">
                {loginError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                    {loginError}
                  </div>
                )}
                <form onSubmit={handleLoginSubmit} className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Username or Email</Label>
                    <Input
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                      placeholder="e.g. nurse_jane or jane@example.com"
                      className="h-9 text-xs mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-slate-700">Password</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="h-9 text-xs pr-9"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Your current account will stay active. This adds the new account to your switch list.
                  </p>

                  <Button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-9 rounded-xl mt-2"
                  >
                    {isLoggingIn ? 'Verifying & Linking...' : 'Log In & Add Account'}
                  </Button>
                </form>
              </TabsContent>

              {/* TAB 2: SIGN UP */}
              <TabsContent value="signup" className="space-y-3 mt-0">
                {signupError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                    {signupError}
                  </div>
                )}
                <form onSubmit={handleSignupSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {/* Role Selection */}
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Account Role</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setRegRole('caregiver')}
                        className={`p-2 rounded-xl border text-left text-xs transition-all ${
                          regRole === 'caregiver'
                            ? 'bg-teal-50 border-teal-500 text-teal-900 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <Heart className="w-3.5 h-3.5 text-teal-600 mb-1" />
                        Caregiver
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegRole('parent')}
                        className={`p-2 rounded-xl border text-left text-xs transition-all ${
                          regRole === 'parent'
                            ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600 mb-1" />
                        Parent / Guardian
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-medium text-slate-700">First Name</Label>
                      <Input
                        value={regFirstName}
                        onChange={e => setRegFirstName(e.target.value)}
                        placeholder="First name"
                        className="h-8 text-xs mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Last Name</Label>
                      <Input
                        value={regLastName}
                        onChange={e => setRegLastName(e.target.value)}
                        placeholder="Last name"
                        className="h-8 text-xs mt-1"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-slate-700">Email Address</Label>
                    <Input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="e.g. user@example.com"
                      className="h-8 text-xs mt-1"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Username</Label>
                      <Input
                        value={regUsername}
                        onChange={e => setRegUsername(e.target.value)}
                        placeholder="Optional"
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Phone</Label>
                      <Input
                        value={regPhone}
                        onChange={e => setRegPhone(e.target.value)}
                        placeholder="+63 912 345 6789"
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-slate-700">Password</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="h-8 text-xs pr-8"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSigningUp}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-9 rounded-xl mt-2"
                  >
                    {isSigningUp ? 'Registering...' : 'Register & Link Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
