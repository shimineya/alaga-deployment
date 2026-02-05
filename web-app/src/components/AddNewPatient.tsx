import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '../lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
    UserPlus,
    Smartphone,
    QrCode,
    Search,
    Stethoscope,
    CheckCircle,
    Loader2,
    User,
    Activity,
} from 'lucide-react';
import { toast } from 'sonner';

// --- Mock Inventory Data Removed ---

interface AddNewPatientProps {
    onSuccess: () => void;
    onCancel: () => void;
}

export const AddNewPatient: React.FC<AddNewPatientProps> = ({ onSuccess, onCancel }) => {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        medicalCondition: '',
        vsDeviceId: '',
        sdDeviceId: '',
        assignedCaregiverId: '', // [NEW] Store ID
        assignedCaregiverEmail: '',
        assignedCaregiverName: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Automatic Age Calculation
    const calculatedAge = useMemo(() => {
        if (!formData.dateOfBirth) return '';
        const birthDate = new Date(formData.dateOfBirth);
        const ageDifMs = Date.now() - birthDate.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }, [formData.dateOfBirth]);

    // [NEW] Fetch Available Devices
    const [availableDevices, setAvailableDevices] = useState<{ serial_number: string, device_name: string }[]>([]);

    React.useEffect(() => {
        const fetchDevices = async () => {
            if (!token) return;
            try {
                const response = await fetch('http://localhost:3000/api/caregiver/devices/available', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (data.success) {
                    setAvailableDevices(data.data);
                }
            } catch (err) {
                console.error("Failed to fetch devices", err);
            }
        };
        fetchDevices();
    }, [token]);

    const availableVS = availableDevices.filter(d => d.device_name.includes('Vital Sign'));
    const availableSD = availableDevices.filter(d => d.device_name.includes('Smart Diaper'));

    const handleQRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            toast.info("Processing Caregiver QR...");
            setTimeout(() => {
                setFormData(prev => ({
                    ...prev,
                    assignedCaregiverName: "Dr. Jose Rizal",
                    assignedCaregiverEmail: "j.rizal@hospital.com"
                }));
                toast.success("Caregiver Identified: Dr. Jose Rizal");
            }, 1500);
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.firstName) newErrors.firstName = "First name is required";
        if (!formData.lastName) newErrors.lastName = "Last name is required";
        if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";

        return newErrors;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const formErrors = validateForm();
        if (Object.keys(formErrors).length > 0) {
            setErrors(formErrors);
            const firstErrorField = Object.keys(formErrors)[0];
            const element = document.getElementById(firstErrorField);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            toast.error("Please fill in all required fields.");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:3000/api/caregiver/patients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: `${formData.firstName} ${formData.lastName}`,
                    birthdate: formData.dateOfBirth,
                    medicalCondition: formData.medicalCondition,
                    assignedCaregiverId: formData.assignedCaregiverId || null,
                    // [NEW] Pass Device IDs
                    vitalDeviceNo: formData.vsDeviceId,
                    diaperDeviceNo: formData.sdDeviceId
                })
            });

            const data = await response.json();

            if (data.success) {
                toast.success(`Patient ${formData.firstName} enrolled successfully.`);
                onSuccess();
            } else {
                toast.error(data.message || "Failed to enroll patient");
            }
        } catch (error) {
            console.error("Enrollment Error:", error);
            toast.error("Network Error: Could not enroll patient.");
        } finally {
            setIsLoading(false);
        }
    };

    // [NEW] Search for Caregiver
    const handleSearchCaregiver = async (query: string) => {
        if (!query || query.length < 3) return;

        try {
            const response = await fetch(`http://localhost:3000/api/caregiver/search?query=${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.data.length > 0) {
                // Auto-select the first match for simplicity in this prototype
                const user = data.data[0];
                setFormData(prev => ({
                    ...prev,
                    assignedCaregiverName: `${user.first_name} ${user.last_name}`,
                    assignedCaregiverId: user.user_id,
                    assignedCaregiverEmail: user.email // Update email to match exact record
                }));
                toast.success(`Found: ${user.first_name} ${user.last_name}`);
            } else {
                toast.error("User not found");
                setFormData(prev => ({ ...prev, assignedCaregiverName: '', assignedCaregiverId: '' }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 pb-4 pt-0 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">New Patient Enrollment</h2>
                    <p className="text-sm text-slate-500">Configure patient profile, devices, and care team.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>

                {/* --- MAIN ROW: 3 CARDS SIDE-BY-SIDE --- */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* CARD 1: PATIENT INFORMATION */}
                    <Card className="border-slate-200 shadow-sm h-full flex flex-col">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-700">
                                <div className="p-2 bg-teal-100 rounded-lg text-teal-600">
                                    <User className="w-5 h-5" />
                                </div>
                                1. Patient Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4 flex-1">
                            <div className="space-y-2">
                                <Label>First Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="firstName"
                                    placeholder="e.g. Juan"
                                    value={formData.firstName}
                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                    required
                                    className={`scroll-mt-32 ${errors.firstName ? "border-red-500" : ""}`}
                                    style={{ scrollMarginTop: '150px' }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Last Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="lastName"
                                    placeholder="e.g. Dela Cruz"
                                    value={formData.lastName}
                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    required
                                    className={`scroll-mt-32 ${errors.lastName ? "border-red-500" : ""}`}
                                    style={{ scrollMarginTop: '150px' }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Date of Birth <span className="text-red-500">*</span></Label>
                                <div className="flex gap-2 items-center">
                                    <Input
                                        id="dateOfBirth"
                                        type="date"
                                        value={formData.dateOfBirth}
                                        onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                        required
                                        className={`flex-1 scroll-mt-32 ${errors.dateOfBirth ? "border-red-500" : ""}`}
                                        style={{ scrollMarginTop: '150px' }}
                                    />
                                    {calculatedAge && (
                                        <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-sm font-medium text-slate-600 min-w-[100px] text-center">
                                            {calculatedAge}
                                        </div>
                                    )}
                                </div>
                                {errors.dateOfBirth && <span className="text-red-500 text-xs">{errors.dateOfBirth}</span>}
                            </div>
                            <div className="space-y-2">
                                <Label>Medical Notes <span className="text-slate-400 font-normal">(Optional)</span></Label>
                                <Textarea
                                    placeholder="Condition, allergies, or special requirements..."
                                    value={formData.medicalCondition}
                                    onChange={e => setFormData({ ...formData, medicalCondition: e.target.value })}
                                    className="min-h-[100px] resize-none"
                                    style={{ scrollMarginTop: '150px' }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* CARD 2: DEVICE ASSIGNMENT */}
                    <Card className="border-slate-200 shadow-sm h-full flex flex-col">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-700">
                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                    <Smartphone className="w-5 h-5" />
                                </div>
                                2. Device Assignment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6 flex-1">
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex gap-3">
                                <Activity className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-blue-700">
                                    Select devices from the dropdown. Only "Available" hardware is shown.
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                                        Vital Sign Monitor (Wrist/Chest)
                                    </Label>
                                    <Select
                                        value={formData.vsDeviceId}
                                        onValueChange={(val) => setFormData({ ...formData, vsDeviceId: val })}
                                    >
                                        <SelectTrigger className="h-12" style={{ scrollMarginTop: '150px' }}>
                                            <SelectValue placeholder="Select VS Serial Number" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableVS.map(device => (
                                                <SelectItem key={device.serial_number} value={device.serial_number}>
                                                    {device.serial_number}
                                                </SelectItem>
                                            ))}
                                            {availableVS.length === 0 && <SelectItem value="none" disabled>No Available Devices</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                        Smart Diaper Module
                                    </Label>
                                    <Select
                                        value={formData.sdDeviceId}
                                        onValueChange={(val) => setFormData({ ...formData, sdDeviceId: val })}
                                    >
                                        <SelectTrigger className="h-12" style={{ scrollMarginTop: '150px' }}>
                                            <SelectValue placeholder="Select SD Serial Number" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableSD.map(device => (
                                                <SelectItem key={device.serial_number} value={device.serial_number}>
                                                    {device.serial_number}
                                                </SelectItem>
                                            ))}
                                            {availableSD.length === 0 && <SelectItem value="none" disabled>No Available Devices</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* CARD 3: CARE TEAM */}
                    <Card className="border-slate-200 shadow-sm h-full flex flex-col">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-700">
                                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                    <Stethoscope className="w-5 h-5" />
                                </div>
                                3. Caregiver
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4 flex-1">
                            <Tabs defaultValue="manual" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-6">
                                    <TabsTrigger value="manual">Search DB</TabsTrigger>
                                    <TabsTrigger value="qr">Scan ID</TabsTrigger>
                                </TabsList>

                                <TabsContent value="manual" className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Caregiver Email / Username</Label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                className="pl-10 h-10"
                                                placeholder="search@hospital.com"
                                                value={formData.assignedCaregiverEmail}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setFormData({ ...formData, assignedCaregiverEmail: val });
                                                    // Debounce could be added here, but for now simple onBlur or manual check
                                                }}
                                                onBlur={() => handleSearchCaregiver(formData.assignedCaregiverEmail)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSearchCaregiver(formData.assignedCaregiverEmail);
                                                    }
                                                }}
                                                style={{ scrollMarginTop: '150px' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Caregiver Name (Auto-filled)</Label>
                                        <Input
                                            className="bg-slate-50"
                                            placeholder="Name appears here..."
                                            value={formData.assignedCaregiverName}
                                            readOnly
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="qr" className="space-y-4">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer relative"
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleQRUpload}
                                        />
                                        <div className="p-3 bg-white rounded-full shadow-sm">
                                            <QrCode className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-slate-600">Click to Upload QR</p>
                                            <p className="text-xs text-slate-400">Supports PNG, JPG</p>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>

                            {formData.assignedCaregiverName && (
                                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                                    <div>
                                        <p className="text-sm font-semibold text-emerald-800">Caregiver Linked</p>
                                        <p className="text-xs text-emerald-600">{formData.assignedCaregiverName}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div >

                {/* --- FOOTER ACTIONS --- */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
                    <Button variant="ghost" onClick={onCancel} type="button" className="text-slate-500 hover:text-slate-700">
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        className="bg-teal-600 hover:bg-teal-700 text-white min-w-[200px] h-11 text-base shadow-lg shadow-teal-600/20"
                        style={{ minWidth: '200px', height: '44px' }}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
                        ) : (
                            <><UserPlus className="w-4 h-4 mr-2" /> Enroll Patient</>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
};