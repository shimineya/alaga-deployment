import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { User, Mail, Phone, Lock, Camera, Save, Edit3, X, Building, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useCaregiverLanguage } from '@/lib/caregiver-language-context';
import { PasswordGuide, checkPasswordCriteria } from '../ui/PasswordGuide';

export default function UserProfile() {
    const { user, refreshUser } = useAuth();
    const { t } = useCaregiverLanguage();
    const [profile, setProfile] = useState({
        username: user?.username || '',
        email: user?.email || '',
        mobile_number: '',
        first_name: user?.name || '',
        last_name: '',
        role: user?.role || '',
        profile_picture_url: '',
        facility_name: ''
    });
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const API_BASE = import.meta.env.VITE_API_URL || '';
    
    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/user/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setProfile({
                    username: data.profile.username || '',
                    email: data.profile.email || '',
                    mobile_number: data.profile.mobile_number || '',
                    first_name: data.profile.first_name || '',
                    last_name: data.profile.last_name || '',
                    role: data.profile.role || '',
                    profile_picture_url: data.profile.profile_picture_url || '',
                    facility_name: data.profile.facility_name || ''
                });
            } else {
                toast.error(data.message || 'Failed to load profile');
            }
        } catch (err) {
            toast.error('Network error loading profile.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            
            if (!file.type.match('image/(jpeg|jpg|png)')) {
                toast.error('Only JPEG and PNG images are allowed.');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                toast.error('File size must be less than 2MB.');
                return;
            }
            
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setIsEditing(true); // Auto switch to editing mode on image upload
        }
    };

    const handleSave = async () => {
        if (password) {
            if (password !== confirmPassword) {
                toast.error('Passwords do not match');
                return;
            }
            const criteria = checkPasswordCriteria(password, 8);
            if (!criteria.isValid) {
                toast.error('Password does not meet all security criteria (8+ characters, uppercase, lowercase, number, special symbol)');
                return;
            }
        }

        setIsSaving(true);
        const token = localStorage.getItem('token');
        
        try {
            const formData = new FormData();
            formData.append('username', profile.username);
            formData.append('mobile_number', profile.mobile_number);
            if (password) {
                formData.append('password', password);
            }
            if (selectedFile) {
                formData.append('profile_picture', selectedFile);
            }

            const res = await fetch(`${API_BASE}/api/user/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                toast.success('Profile updated successfully');
                setPassword('');
                setConfirmPassword('');
                setSelectedFile(null);
                setIsEditing(false); // Switch back to view mode
                
                if (data.profile) {
                    setProfile(prev => ({
                        ...prev,
                        username: data.profile.username || prev.username,
                        mobile_number: data.profile.mobile_number || prev.mobile_number,
                        profile_picture_url: data.profile.profile_picture_url || prev.profile_picture_url
                    }));

                    // [UX] Write the updated username and profile picture back to the stored user object
                    // so that the sidebar and header reflect the change on next render
                    // without requiring a full logout and re-login cycle.
                    try {
                        const storedUser = localStorage.getItem('user');
                        if (storedUser) {
                            const parsed = JSON.parse(storedUser);
                            parsed.username = data.profile.username || parsed.username;
                            parsed.profile_picture_url = data.profile.profile_picture_url || parsed.profile_picture_url;
                            localStorage.setItem('user', JSON.stringify(parsed));
                            refreshUser(); // Sync React auth state from updated localStorage
                        }
                    } catch {
                        // Ignore parse errors; user will see update on next login
                    }
                }
            } else {
                toast.error(data.message || 'Failed to update profile');
            }
        } catch (err) {
            toast.error('Network error while saving profile.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">{t('Loading profile...', 'Kinakarga ang profile...')}</div>;
    }

    const currentImgUrl = previewUrl || (profile.profile_picture_url ? `${API_BASE}${profile.profile_picture_url}` : null);

    return (
        <div className="max-w-3xl space-y-6">
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                    <CardTitle className="text-lg text-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <User className="w-5 h-5 text-teal-600" /> {t('Account Profile', 'Profile ng Account')}
                        </div>
                        {!isEditing && (
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-8 text-xs font-semibold">
                                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> {t('Edit Profile', 'I-edit ang Profile')}
                            </Button>
                        )}
                    </CardTitle>
                    <CardDescription>
                        {isEditing ? t('Update your personal details below.', 'I-update ang iyong mga personal na detalye sa ibaba.') : t('View your personal details and security credentials.', 'Tingnan ang iyong mga personal na detalye at kredensyal sa seguridad.')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Profile Picture Section */}
                        <div className="flex flex-col items-center gap-4 border-r border-slate-100 pr-0 md:pr-4">
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 bg-slate-100 shadow-sm flex items-center justify-center">
                                    {currentImgUrl ? (
                                        <img src={currentImgUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-12 h-12 text-slate-300" />
                                    )}
                                </div>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 w-10 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-md flex items-center justify-center transition-colors transition-transform group-hover:scale-105"
                                    title={t('Upload new picture', 'Mag-upload ng bagong larawan')}
                                >
                                    <Camera className="w-4 h-4" />
                                </button>
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept="image/jpeg, image/png"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold text-slate-700">{profile.first_name || 'User'} {profile.last_name || ''}</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{profile.role.replace('_', ' ')}</p>
                            </div>
                        </div>

                        {/* Details / Form Section */}
                        <div className="md:col-span-2 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-slate-400" /> {t('Username', 'Username')}
                                    </Label>
                                    {isEditing ? (
                                        <Input 
                                            type="text" 
                                            value={profile.username}
                                            onChange={e => setProfile({...profile, username: e.target.value})}
                                            className="h-9 focus-visible:ring-teal-500"
                                        />
                                    ) : (
                                        <p className="text-sm font-medium text-slate-800">{profile.username || t('Not set', 'Hindi nakatakda')}</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {t('Email Address', 'Address ng Email')}
                                    </Label>
                                    {isEditing ? (
                                        <Input 
                                            type="email" 
                                            value={profile.email}
                                            disabled
                                            className="h-9 bg-slate-50 cursor-not-allowed text-slate-500"
                                            title={t('Email cannot be changed', 'Hindi maaaring baguhin ang email')}
                                        />
                                    ) : (
                                        <p className="text-sm font-medium text-slate-800">{profile.email}</p>
                                    )}
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label className="text-xs text-slate-500 flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {t('Contact Number', 'Numero ng Telepono')}
                                    </Label>
                                    {isEditing ? (
                                        <Input 
                                            type="tel" 
                                            value={profile.mobile_number}
                                            onChange={e => setProfile({...profile, mobile_number: e.target.value})}
                                            className="h-9 focus-visible:ring-teal-500"
                                            placeholder="+63 900 000 0000"
                                        />
                                    ) : (
                                        <p className="text-sm font-medium text-slate-800">{profile.mobile_number || t('Not set', 'Hindi nakatakda')}</p>
                                    )}
                                </div>
                                {(profile.role?.toLowerCase() === 'facility_admin' || profile.role?.toLowerCase() === 'medical_staff') && (
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <Label className="text-xs text-slate-500 flex items-center gap-1.5">
                                            <Building className="w-3.5 h-3.5 text-slate-400" /> {t('Facility', 'Pasilidad')}
                                        </Label>
                                        <p className="text-sm font-medium text-slate-800">{profile.facility_name || t('Not Assigned', 'Walang Pasilidad')}</p>
                                    </div>
                                )}
                            </div>

                            {isEditing && (
                                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                    <hr className="my-5 border-slate-100" />
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                            <Lock className="w-4 h-4 text-slate-400" /> {t('Change Password', 'Baguhin ang Password')}
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-600">{t('New Password', 'Bagong Password')}</Label>
                                                <div className="relative">
                                                    <Input 
                                                        type={showPassword ? "text" : "password"} 
                                                        placeholder={t('Leave blank to keep current', 'Iwanang blanko para panatilihin ang kasalukuyan')}
                                                        value={password}
                                                        onChange={e => setPassword(e.target.value)}
                                                        className="h-9 pr-9 focus-visible:ring-teal-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                                    >
                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-600">{t('Confirm Password', 'Kumpirmahin ang Password')}</Label>
                                                <div className="relative">
                                                    <Input 
                                                        type={showConfirmPassword ? "text" : "password"} 
                                                        placeholder={t('Confirm new password', 'Kumpirmahin ang bagong password')}
                                                        value={confirmPassword}
                                                        onChange={e => setConfirmPassword(e.target.value)}
                                                        className="h-9 pr-9 focus-visible:ring-teal-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                                    >
                                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        {password.length > 0 && (
                                            <PasswordGuide password={password} className="mt-3" />
                                        )}
                                    </div>
                                </div>
                            )}

                            {isEditing && (
                                <div className="pt-6 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
                                    <Button 
                                        variant="ghost" 
                                        onClick={() => {
                                            setIsEditing(false);
                                            setPassword('');
                                            setConfirmPassword('');
                                            fetchProfile(); // Reset to backend state
                                        }} 
                                        disabled={isSaving}
                                        className="text-slate-500 hover:text-slate-700"
                                    >
                                        <X className="w-4 h-4 mr-1.5" /> {t('Cancel', 'Kanselahin')}
                                    </Button>
                                    <Button 
                                        onClick={handleSave} 
                                        disabled={isSaving}
                                        className="bg-teal-600 hover:bg-teal-700 text-white min-w-[120px]"
                                    >
                                        {isSaving ? t('Saving...', 'Nagsasave...') : (
                                            <span className="flex items-center gap-2">
                                                <Save className="w-4 h-4" /> {t('Save Changes', 'I-save ang mga Pagbabago')}
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
