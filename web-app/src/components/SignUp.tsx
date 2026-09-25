import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Loader2, UserPlus, Stethoscope, Eye, EyeOff, ShieldAlert, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordGuide, checkPasswordCriteria } from './ui/PasswordGuide';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userType = location.state?.userType || 'clinical';
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'caregiver' | 'medical_staff' | 'parent'>(
    userType === 'home' ? 'parent' : 'caregiver'
  );

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Facility Belonging State
  const [hasFacility, setHasFacility] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [verifiedFacility, setVerifiedFacility] = useState<{
    facility_id: number;
    facility_name: string;
    role: string;
    email?: string;
  } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    middleInitial: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Name sanitizer: only letters, spaces, hyphens, and apostrophes
  const sanitizeName = (val: string) => val.replace(/[^a-zA-Z\s'-]/g, '');

  // Password validation check
  const isPasswordValid = useMemo(() => {
    return checkPasswordCriteria(formData.password).isValid;
  }, [formData.password]);

  const handleVerifyToken = async () => {
    if (!inviteToken.trim()) {
      setTokenError("Please enter your invitation token");
      return;
    }
    setVerifyingToken(true);
    setTokenError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/verify-invite-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken.trim().toUpperCase() })
      });
      const data = await res.json();
      if (data.valid && data.success) {
        setVerifiedFacility(data);
        if (data.role === 'caregiver' || data.role === 'medical_staff') {
          setSelectedRole(data.role);
        }
        if (data.email && !formData.email) {
          setFormData(prev => ({ ...prev, email: data.email }));
        }
        toast.success(`Verified: Affiliated with ${data.facility_name}!`);
      } else {
        setVerifiedFacility(null);
        setTokenError(data.message || "Invalid or expired token");
        toast.error(data.message || "Invalid token");
      }
    } catch {
      setTokenError("Network error verifying token");
      toast.error("Failed to connect to verification server");
    } finally {
      setVerifyingToken(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.username.trim()) newErrors.username = "Username is required";

    if (hasFacility && !inviteToken.trim()) {
      newErrors.inviteToken = "Please enter your invitation token";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (!isPasswordValid) {
      newErrors.password = "Password does not meet all security criteria";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fill in all required fields correctly.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          middle_initial: formData.middleInitial.trim() || null,
          mobile_number: formData.mobileNumber.trim() || null,
          email: formData.email.trim(),
          username: formData.username.trim(),
          password: formData.password,
          role: selectedRole,
          has_facility: hasFacility,
          facility_name: verifiedFacility?.facility_name || null,
          invite_token: hasFacility && inviteToken.trim() ? inviteToken.trim().toUpperCase() : null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          if (data.message?.toLowerCase().includes('email')) {
            setErrors(prev => ({ ...prev, email: data.message }));
          } else if (data.message?.toLowerCase().includes('username')) {
            setErrors(prev => ({ ...prev, username: data.message }));
          }
        }
        throw new Error(data.message || "Registration failed");
      }

      // Store pending verification context in sessionStorage
      sessionStorage.setItem('pendingOtpVerification', JSON.stringify({
        user_id: data.user_id,
        email: data.email,
      }));

      toast.success("Account created! Please check your email for the verification code.");
      navigate('/verify-email');
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    let cleanVal = value;
    if (field === 'firstName' || field === 'lastName' || field === 'middleInitial') {
      cleanVal = sanitizeName(value);
    }
    setFormData(prev => ({ ...prev, [field]: cleanVal }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-[520px] shadow-lg border-0 my-4">
        <CardHeader className="pb-3 pt-5 px-6 border-b bg-slate-50/50">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-slate-800">Create Account</CardTitle>
              <CardDescription className="text-xs">Join the Alaga monitoring network</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="h-7 text-xs text-slate-500">
              <ArrowLeft className="w-3 h-3 mr-1" /> Back
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Role Selection */}
            {userType === 'home' ? (
              <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg mb-4 text-xs font-semibold">
                <UserPlus className="w-4 h-4 text-amber-600" />
                Registering Parent / Guardian Account (Home Use)
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg mb-4">
                <button
                  type="button"
                  onClick={() => setSelectedRole('caregiver')}
                  className={`flex items-center justify-center gap-2 text-xs font-medium py-1.5 rounded-md transition-all ${selectedRole === 'caregiver' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <UserPlus className="w-3.5 h-3.5" /> Caregiver
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('medical_staff')}
                  className={`flex items-center justify-center gap-2 text-xs font-medium py-1.5 rounded-md transition-all ${selectedRole === 'medical_staff' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Stethoscope className="w-3.5 h-3.5" /> Medical Staff
                </button>
              </div>
            )}

            {/* Facility Affiliation Question for Caregiver & Medical Staff */}
            {userType !== 'home' && (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer" htmlFor="facility-toggle">
                      <Building2 className="w-3.5 h-3.5 text-teal-600" /> Are you affiliated with a facility?
                    </Label>
                    <p className="text-[10px] text-slate-500">Enable if invited by a hospital, nursing home, or healthcare facility</p>
                  </div>
                  <input
                    id="facility-toggle"
                    type="checkbox"
                    checked={hasFacility}
                    onChange={(e) => {
                      setHasFacility(e.target.checked);
                      if (!e.target.checked) {
                        setInviteToken('');
                        setVerifiedFacility(null);
                        setTokenError(null);
                      }
                    }}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer accent-teal-600"
                  />
                </div>

                {hasFacility && (
                  <div className="space-y-2 pt-2 border-t border-slate-200/80 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-1">
                        Facility Invitation Token <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. FAC-A8B9C1D2"
                          value={inviteToken}
                          onChange={(e) => {
                            setInviteToken(e.target.value.toUpperCase());
                            setVerifiedFacility(null);
                            setTokenError(null);
                          }}
                          className={`h-8 text-xs font-mono font-bold tracking-wider uppercase ${errors.inviteToken || tokenError ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleVerifyToken}
                          disabled={verifyingToken || !inviteToken.trim()}
                          className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white shrink-0 font-semibold"
                        >
                          {verifyingToken ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify'}
                        </Button>
                      </div>
                    </div>

                    {verifiedFacility && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold">Affiliated: {verifiedFacility.facility_name}</p>
                          <p className="text-[10px] text-emerald-700 capitalize">
                            Designated Role: <strong className="font-semibold">{verifiedFacility.role.replace('_', ' ')}</strong>
                          </p>
                        </div>
                      </div>
                    )}

                    {tokenError && (
                      <p className="text-[10px] text-red-500 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {tokenError}
                      </p>
                    )}

                    {errors.inviteToken && !tokenError && (
                      <p className="text-[10px] text-red-500">{errors.inviteToken}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Row 1: Names */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-5 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-0.5">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input 
                  placeholder="Juan"
                  className={`h-8 text-xs ${errors.firstName ? 'border-red-400 focus-visible:ring-red-400' : ''}`} 
                  value={formData.firstName} 
                  onChange={(e) => handleChange('firstName', e.target.value)} 
                />
                {errors.firstName && <p className="text-[10px] text-red-500">{errors.firstName}</p>}
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-600">M.I.</Label>
                <Input 
                  className="h-8 text-xs text-center uppercase" 
                  maxLength={2} 
                  placeholder="D"
                  value={formData.middleInitial} 
                  onChange={(e) => handleChange('middleInitial', e.target.value)} 
                />
              </div>
              <div className="col-span-5 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-0.5">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input 
                  placeholder="Dela Cruz"
                  className={`h-8 text-xs ${errors.lastName ? 'border-red-400 focus-visible:ring-red-400' : ''}`} 
                  value={formData.lastName} 
                  onChange={(e) => handleChange('lastName', e.target.value)} 
                />
                {errors.lastName && <p className="text-[10px] text-red-500">{errors.lastName}</p>}
              </div>
            </div>

            {/* Row 2: Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-0.5">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input 
                  type="email" 
                  placeholder="user@example.com"
                  className={`h-8 text-xs ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`} 
                  value={formData.email} 
                  onChange={(e) => handleChange('email', e.target.value)} 
                />
                {errors.email && <p className="text-[10px] text-red-500">{errors.email}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-600">Mobile No.</Label>
                <Input 
                  placeholder="09123456789"
                  className="h-8 text-xs" 
                  value={formData.mobileNumber} 
                  onChange={(e) => handleChange('mobileNumber', e.target.value)} 
                />
                <p className="text-[10px] text-slate-500 leading-tight">
                  This will be used for multifactor authentication.
                </p>
              </div>
            </div>

            {/* Row 3: Account */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-0.5">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input 
                placeholder="juan_delacruz"
                className={`h-8 text-xs ${errors.username ? 'border-red-400 focus-visible:ring-red-400' : ''}`} 
                value={formData.username} 
                onChange={(e) => handleChange('username', e.target.value)} 
              />
              {errors.username && <p className="text-[10px] text-red-500">{errors.username}</p>}
            </div>

            {/* Row 4: Passwords */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-0.5">
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    className={`h-8 text-xs pr-8 ${errors.password ? 'border-red-400 focus-visible:ring-red-400' : ''}`} 
                    value={formData.password} 
                    onChange={(e) => handleChange('password', e.target.value)} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && <p className="text-[10px] text-red-500">{errors.password}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-0.5">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    className={`h-8 text-xs pr-8 ${errors.confirmPassword ? 'border-red-400 focus-visible:ring-red-400' : ''}`} 
                    value={formData.confirmPassword} 
                    onChange={(e) => handleChange('confirmPassword', e.target.value)} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-[10px] text-red-500">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Password Requirements Guide */}
            <PasswordGuide password={formData.password} />

            <Button
              type="submit"
              className="w-full h-9 bg-teal-600 hover:bg-teal-700 text-white mt-4 text-xs font-medium cursor-pointer"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
              Register Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};