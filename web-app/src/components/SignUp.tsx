import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Loader2, UserPlus, Stethoscope, Eye, EyeOff, ShieldAlert } from 'lucide-react';
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.username.trim()) newErrors.username = "Username is required";
    
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
      toast.error("Please fill in all required fields and satisfy password requirements.");
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
          role: selectedRole
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