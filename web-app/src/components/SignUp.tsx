import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Activity, Eye, EyeOff, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'role-select' | 'form'>('role-select');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'medical_staff' | 'caregiver' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    // Section 1: Common Fields
    firstName: '',
    middleInitial: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    mobileNumber: '',

    // [Cleaned] Removed unused Section 2 fields from state to avoid confusion
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleRoleSelect = (role: 'medical_staff' | 'caregiver') => {
    setSelectedRole(role);
    setStep('form');
  };

  const handleInputChange = (field: string, value: any) => {
    if (field === 'mobileNumber') {
      if (!/^\d*$/.test(value)) return;
      if (value.length > 11) return;
    }
    if (field === 'middleInitial' && value.length > 2) return;

    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for field on change
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = 'Invalid email format';

    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.mobileNumber) newErrors.mobileNumber = 'Mobile number is required';
    else if (formData.mobileNumber.length !== 11) newErrors.mobileNumber = 'Mobile number must be 11 digits';

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.getElementById(firstErrorField); // Assuming IDs match field names
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      toast.error('Please fix the errors below.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      const payload = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        middle_initial: formData.middleInitial,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        mobile_number: formData.mobileNumber,
        role: selectedRole
      };

      const response = await fetch('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      toast.success('Account created successfully!');

      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (selectedRole === 'caregiver') {
          navigate('/dashboard/caregiver');
        } else {
          navigate('/dashboard/medical');
        }
      } else {
        navigate('/login');
      }

    } catch (error: any) {
      toast.error(error.message || 'Server connection failed');
    } finally {
      setIsLoading(false);
    }
  };

  const renderRoleSelection = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#F0FAF9' }}>
      <div className="w-full max-w-2xl mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/signup')}
          className="pl-0 hover:bg-transparent hover:text-[#7DD3C0]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
      <Card className="w-full max-w-2xl border-0" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: '#7DD3C0',
                boxShadow: '0 0 30px rgba(125, 211, 192, 0.4)'
              }}
            >
              <Activity className="w-9 h-9 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl mb-2" style={{ color: '#2C3E50' }}>Welcome to ALAGA</CardTitle>
          <CardDescription className="text-base">
            Smart Patient Monitoring System
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          <div className="text-center mb-6">
            <h3 className="text-xl mb-2" style={{ color: '#2C3E50' }}>Choose Your Role</h3>
            <p className="text-sm" style={{ color: '#7F8C8D' }}>
              Select the role that best describes your position
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => handleRoleSelect('medical_staff')}
              className="p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg"
              style={{
                borderColor: '#E8F6F3',
                backgroundColor: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#7DD3C0';
                e.currentTarget.style.backgroundColor = '#F0FAF9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E8F6F3';
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#E8F6F3' }}>
                  <Activity className="w-6 h-6" style={{ color: '#7DD3C0' }} />
                </div>
                <h4 className="text-lg mb-2" style={{ color: '#2C3E50' }}>Medical Staff</h4>
                <p className="text-sm" style={{ color: '#7F8C8D' }}>
                  Physicians, Nurses, and Medical Professionals
                </p>
              </div>
            </div>

            <div
              onClick={() => handleRoleSelect('caregiver')}
              className="p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg"
              style={{
                borderColor: '#E8F6F3',
                backgroundColor: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#7DD3C0';
                e.currentTarget.style.backgroundColor = '#F0FAF9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E8F6F3';
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#E8F6F3' }}>
                  <Activity className="w-6 h-6" style={{ color: '#7DD3C0' }} />
                </div>
                <h4 className="text-lg mb-2" style={{ color: '#2C3E50' }}>Caregiver</h4>
                <p className="text-sm" style={{ color: '#7F8C8D' }}>
                  Family Members, Hired Caregivers, and Support Staff
                </p>
              </div>
            </div>
          </div>

          <div className="text-center pt-4">
            <p className="text-sm" style={{ color: '#7F8C8D' }}>
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="underline"
                style={{ color: '#7DD3C0' }}
              >
                Log In
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderForm = () => (
    <div className="min-h-screen py-12 px-6" style={{ backgroundColor: '#F0FAF9' }}>
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => setStep('role-select')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Role Selection
        </Button>

        <Card className="border-0" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#7DD3C0' }}
              >
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle style={{ color: '#2C3E50' }}>Create Your Account</CardTitle>
                <CardDescription>
                  {selectedRole === 'medical_staff' ? 'Medical Staff Registration' : 'Caregiver Registration'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Section 1: Common Fields */}
            <div className="space-y-6">
              <div className="pb-2 border-b">
                <h3 className="text-lg" style={{ color: '#2C3E50' }}>Section 1: Account Information</h3>
                <p className="text-sm" style={{ color: '#7F8C8D' }}>Basic details for all users</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className={errors.firstName ? "border-red-500" : ""}
                    style={{ scrollMarginTop: '150px' }}
                  />
                  {errors.firstName && <span className="text-xs text-red-500">{errors.firstName}</span>}
                </div>
                <div className="space-y-2">
                  <Label>M.I.</Label>
                  <Input
                    placeholder="M.I."
                    maxLength={2}
                    value={formData.middleInitial}
                    onChange={(e) => handleInputChange('middleInitial', e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  id="lastName"
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className={errors.lastName ? "border-red-500" : ""}
                  style={{ scrollMarginTop: '150px' }}
                />
                {errors.lastName && <span className="text-xs text-red-500">{errors.lastName}</span>}
              </div>

              <div className="space-y-2">
                <Label>Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={errors.email ? "border-red-500" : ""}
                  style={{ scrollMarginTop: '150px' }}
                />
                {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
              </div>

              <div className="space-y-2">
                <Label>Username (Optional)</Label>
                <Input
                  placeholder="Choose a unique username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Mobile Number *</Label>
                <Input
                  id="mobileNumber"
                  placeholder="09xxxxxxxxx"
                  maxLength={11}
                  value={formData.mobileNumber}
                  onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                  className={errors.mobileNumber ? "border-red-500" : ""}
                  style={{ scrollMarginTop: '150px' }}
                />
                {errors.mobileNumber && <span className="text-xs text-red-500">{errors.mobileNumber}</span>}
                <p className="text-xs" style={{ color: '#7F8C8D' }}>
                  Must be 11 digits (e.g., 09171234567)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 chars"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className={errors.password ? "border-red-500" : ""}
                      style={{ scrollMarginTop: '150px' }}
                    />
                    {errors.password && <span className="text-xs text-red-500 absolute -bottom-5 block w-full">{errors.password}</span>}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className={errors.confirmPassword ? "border-red-500" : ""}
                      style={{ scrollMarginTop: '150px' }}
                    />
                    {errors.confirmPassword && <span className="text-xs text-red-500 absolute -bottom-5 block w-full">{errors.confirmPassword}</span>}
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <Button
                onClick={handleSubmit}
                className="w-full text-white"
                style={{ backgroundColor: '#7DD3C0' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {isLoading ? "Registering..." : "Register Account"}
              </Button>
            </div>

            <div className="text-center text-sm" style={{ color: '#7F8C8D' }}>
              By signing up, you agree to our Terms of Service and Privacy Policy
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return step === 'role-select' ? renderRoleSelection() : renderForm();
};

export default SignUp;