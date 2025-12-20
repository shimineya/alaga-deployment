import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Activity, Upload, Eye, EyeOff, Check, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'role-select' | 'form'>('role-select');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'medical_staff' | 'caregiver' | null>(null);
  
  const [formData, setFormData] = useState({
    // Section 1: Common Fields
    firstName: '',
    middleInitial: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    mobileNumber: '',
    
    // Section 2: Medical Staff Fields
    professionalTitle: '',
    licenseNumber: '',
    practiceType: '',
    practiceAddress: '',
    idDocument: null as File | null,
    soloPractitioner: false,
    
    // Section 2: Caregiver Fields
    relationshipToPatient: '',
    primaryWorkArea: '',
    yearsExperience: '',
    workShift: '',
    notificationStyle: [] as string[],
    caregiverIdDocument: null as File | null,
  });

  const handleRoleSelect = (role: 'medical_staff' | 'caregiver') => {
    setSelectedRole(role);
    setStep('form');
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationToggle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      notificationStyle: prev.notificationStyle.includes(style)
        ? prev.notificationStyle.filter(s => s !== style)
        : [...prev.notificationStyle, style]
    }));
  };

  const handleFileUpload = (field: string, file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  const validateForm = () => {
    // Section 1 Validation
    if (!formData.firstName || !formData.lastName || !formData.email || 
        !formData.username || !formData.password || !formData.mobileNumber) {
      toast.error('Please fill all required fields');
      return false;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }

    if (!formData.mobileNumber.match(/^\+63\s?\d{3}\s?\d{3}\s?\d{4}$/)) {
      toast.error('Invalid mobile number format. Use: +63 XXX XXX XXXX');
      return false;
    }

    // Role-specific validation
    if (selectedRole === 'medical_staff') {
      if (!formData.professionalTitle || !formData.licenseNumber || 
          !formData.practiceType || !formData.practiceAddress || !formData.idDocument) {
        toast.error('Please fill all medical staff required fields');
        return false;
      }
    }

    if (selectedRole === 'caregiver') {
      if (!formData.relationshipToPatient || !formData.primaryWorkArea || 
          !formData.yearsExperience || !formData.workShift || !formData.caregiverIdDocument) {
        toast.error('Please fill all caregiver required fields');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    // Store form data in sessionStorage for verification page
    sessionStorage.setItem('signupData', JSON.stringify({
      ...formData,
      role: selectedRole,
      idDocument: formData.idDocument?.name,
      caregiverIdDocument: formData.caregiverIdDocument?.name,
    }));

    toast.success('Sending verification code to your email...');
    navigate('/verify-email');
  };

  const renderRoleSelection = () => (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F0FAF9' }}>
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
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>M.I.</Label>
                  <Input
                    placeholder="M.I."
                    maxLength={1}
                    value={formData.middleInitial}
                    onChange={(e) => handleInputChange('middleInitial', e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  placeholder="name@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  placeholder="Choose a unique username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Password *</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters with symbols/numbers"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {formData.password && formData.password.length < 8 && (
                  <p className="text-xs text-red-600">Password must be at least 8 characters</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Mobile Number *</Label>
                <Input
                  placeholder="+63 XXX XXX XXXX"
                  value={formData.mobileNumber}
                  onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                />
                <p className="text-xs" style={{ color: '#7F8C8D' }}>
                  Required for urgent medical SMS alerts
                </p>
              </div>
            </div>

            {/* Section 2: Role-Specific Fields */}
            {selectedRole === 'medical_staff' && (
              <div className="space-y-6">
                <div className="pb-2 border-b">
                  <h3 className="text-lg" style={{ color: '#2C3E50' }}>Section 2: Professional Information</h3>
                  <p className="text-sm" style={{ color: '#7F8C8D' }}>Medical staff credentials</p>
                </div>

                <div className="space-y-2">
                  <Label>Professional Title *</Label>
                  <Select value={formData.professionalTitle} onValueChange={(v) => handleInputChange('professionalTitle', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your title" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private_physician">Private Physician</SelectItem>
                      <SelectItem value="independent_nurse">Independent Nurse</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Medical License Number *</Label>
                  <Input
                    placeholder="e.g., PRC License or Board ID"
                    value={formData.licenseNumber}
                    onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type of Practice *</Label>
                  <Select value={formData.practiceType} onValueChange={(v) => handleInputChange('practiceType', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select practice type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solo">Solo/Private Practice</SelectItem>
                      <SelectItem value="clinic">Clinic-Affiliated</SelectItem>
                      <SelectItem value="home_health">Independent Home-Health</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Practice/Office Address *</Label>
                  <Textarea
                    placeholder="Physical location of your medical services"
                    value={formData.practiceAddress}
                    onChange={(e) => handleInputChange('practiceAddress', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Identity Verification *</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{ borderColor: '#E8F6F3' }}>
                    <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: '#7DD3C0' }} />
                    <p className="text-sm mb-2" style={{ color: '#2C3E50' }}>
                      {formData.idDocument ? formData.idDocument.name : 'Upload Professional ID/License'}
                    </p>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload('idDocument', e.target.files?.[0] || null)}
                      className="hidden"
                      id="med-id-upload"
                    />
                    <label htmlFor="med-id-upload">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => document.getElementById('med-id-upload')?.click()}
                      >
                        Choose File
                      </Button>
                    </label>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="solo-practitioner"
                    checked={formData.soloPractitioner}
                    onChange={(e) => handleInputChange('soloPractitioner', e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: '#7DD3C0' }}
                  />
                  <label htmlFor="solo-practitioner" className="text-sm" style={{ color: '#2C3E50' }}>
                    I am operating independently without a company/facility
                  </label>
                </div>
              </div>
            )}

            {selectedRole === 'caregiver' && (
              <div className="space-y-6">
                <div className="pb-2 border-b">
                  <h3 className="text-lg" style={{ color: '#2C3E50' }}>Section 2: Caregiver Information</h3>
                  <p className="text-sm" style={{ color: '#7F8C8D' }}>Your caregiving details</p>
                </div>

                <div className="space-y-2">
                  <Label>Relationship to Patient *</Label>
                  <Select value={formData.relationshipToPatient} onValueChange={(v) => handleInputChange('relationshipToPatient', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="hired_help">Private Hired Help</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Primary Work Area *</Label>
                  <Input
                    placeholder="e.g., Home Address, Room Number, or Specific Residence"
                    value={formData.primaryWorkArea}
                    onChange={(e) => handleInputChange('primaryWorkArea', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Years of Experience *</Label>
                  <Input
                    type="number"
                    placeholder="Number of years in caregiving role"
                    value={formData.yearsExperience}
                    onChange={(e) => handleInputChange('yearsExperience', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Primary Work Shift *</Label>
                  <Select value={formData.workShift} onValueChange={(v) => handleInputChange('workShift', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                      <SelectItem value="24_7">24/7 Live-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notification Style *</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="notif-alarm"
                        checked={formData.notificationStyle.includes('alarm')}
                        onChange={() => handleNotificationToggle('alarm')}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: '#7DD3C0' }}
                      />
                      <label htmlFor="notif-alarm" className="text-sm" style={{ color: '#2C3E50' }}>
                        High-Volume Alarm
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="notif-push"
                        checked={formData.notificationStyle.includes('push')}
                        onChange={() => handleNotificationToggle('push')}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: '#7DD3C0' }}
                      />
                      <label htmlFor="notif-push" className="text-sm" style={{ color: '#2C3E50' }}>
                        Silent Push Notification
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="notif-sms"
                        checked={formData.notificationStyle.includes('sms')}
                        onChange={() => handleNotificationToggle('sms')}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: '#7DD3C0' }}
                      />
                      <label htmlFor="notif-sms" className="text-sm" style={{ color: '#2C3E50' }}>
                        SMS Only
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Identity Verification *</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{ borderColor: '#E8F6F3' }}>
                    <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: '#7DD3C0' }} />
                    <p className="text-sm mb-2" style={{ color: '#2C3E50' }}>
                      {formData.caregiverIdDocument ? formData.caregiverIdDocument.name : 'Upload ID Document'}
                    </p>
                    <p className="text-xs mb-3" style={{ color: '#7F8C8D' }}>
                      Caregiver ID, Facility ID, or Government ID
                    </p>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload('caregiverIdDocument', e.target.files?.[0] || null)}
                      className="hidden"
                      id="caregiver-id-upload"
                    />
                    <label htmlFor="caregiver-id-upload">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => document.getElementById('caregiver-id-upload')?.click()}
                      >
                        Choose File
                      </Button>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-6">
              <Button 
                onClick={handleSubmit}
                className="w-full text-white"
                style={{ backgroundColor: '#7DD3C0' }}
              >
                <Check className="w-4 h-4 mr-2" />
                Continue to Email Verification
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
