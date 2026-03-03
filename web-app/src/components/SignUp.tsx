import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Loader2, UserPlus, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'caregiver' | 'medical_staff'>('caregiver');

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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName) newErrors.firstName = "Required";
    if (!formData.lastName) newErrors.lastName = "Required";
    if (!formData.email) newErrors.email = "Required";
    if (!formData.username) newErrors.username = "Required";
    if (!formData.password) newErrors.password = "Required";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Mismatch";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please correct the errors in the form.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          role: selectedRole
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Registration failed");

      toast.success("Account created! Please login.");
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error on type
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-[500px] shadow-lg border-0">
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

            {/* Role Selection (Compact Toggle) */}
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

            {/* Row 1: Names */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-5 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">First Name</Label>
                <Input className={`h-8 text-xs ${errors.firstName ? 'border-red-400' : ''}`} value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">M.I.</Label>
                <Input className="h-8 text-xs text-center" maxLength={2} value={formData.middleInitial} onChange={(e) => handleChange('middleInitial', e.target.value)} />
              </div>
              <div className="col-span-5 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Last Name</Label>
                <Input className={`h-8 text-xs ${errors.lastName ? 'border-red-400' : ''}`} value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} />
              </div>
            </div>

            {/* Row 2: Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Email</Label>
                <Input type="email" className={`h-8 text-xs ${errors.email ? 'border-red-400' : ''}`} value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Mobile No.</Label>
                <Input className="h-8 text-xs" value={formData.mobileNumber} onChange={(e) => handleChange('mobileNumber', e.target.value)} />
              </div>
            </div>

            {/* Row 3: Account */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Username</Label>
              <Input className={`h-8 text-xs ${errors.username ? 'border-red-400' : ''}`} value={formData.username} onChange={(e) => handleChange('username', e.target.value)} />
            </div>

            {/* Row 4: Passwords */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Password</Label>
                <Input type="password" className={`h-8 text-xs ${errors.password ? 'border-red-400' : ''}`} value={formData.password} onChange={(e) => handleChange('password', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Confirm</Label>
                <Input type="password" className={`h-8 text-xs ${errors.confirmPassword ? 'border-red-400' : ''}`} value={formData.confirmPassword} onChange={(e) => handleChange('confirmPassword', e.target.value)} />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-9 bg-teal-600 hover:bg-teal-700 text-white mt-4 text-xs font-medium"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
              Register
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};