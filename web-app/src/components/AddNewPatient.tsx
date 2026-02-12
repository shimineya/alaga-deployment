import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '../lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
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

// --- SHARED FORM COMPONENT ---
interface PatientFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

const PatientRegistrationForm: React.FC<PatientFormProps> = ({ onSuccess, onCancel }) => {
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
        assignedCaregiverId: '',
        assignedCaregiverEmail: '',
        assignedCaregiverName: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const calculatedAge = useMemo(() => {
        if (!formData.dateOfBirth) return '';
        const birthDate = new Date(formData.dateOfBirth);
        const ageDifMs = Date.now() - birthDate.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }, [formData.dateOfBirth]);

    // Fetch Devices Logic
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
        if (!formData.firstName) newErrors.firstName = "Required";
        if (!formData.lastName) newErrors.lastName = "Required";
        if (!formData.dateOfBirth) newErrors.dateOfBirth = "Required";
        return newErrors;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const formErrors = validateForm();
        if (Object.keys(formErrors).length > 0) {
            setErrors(formErrors);
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

    const handleSearchCaregiver = async (query: string) => {
        if (!query || query.length < 3) return;
        try {
            const response = await fetch(`http://localhost:3000/api/caregiver/search?query=${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                const user = data.data[0];
                setFormData(prev => ({
                    ...prev,
                    assignedCaregiverName: `${user.first_name} ${user.last_name}`,
                    assignedCaregiverId: user.user_id,
                    assignedCaregiverEmail: user.email
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
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* CARD 1: PATIENT INFORMATION */}
                <Card className="border-slate-200 shadow-sm h-full flex flex-col">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <div className="p-1.5 bg-teal-100 rounded-md text-teal-600">
                                <User className="w-4 h-4" />
                            </div>
                            1. Patient Info
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 flex-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 uppercase font-semibold">First Name</Label>
                                <Input
                                    placeholder="Juan"
                                    value={formData.firstName}
                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                    className={`h-9 ${errors.firstName ? "border-red-500" : ""}`}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 uppercase font-semibold">Last Name</Label>
                                <Input
                                    placeholder="Dela Cruz"
                                    value={formData.lastName}
                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    className={`h-9 ${errors.lastName ? "border-red-500" : ""}`}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-slate-500 uppercase font-semibold">Birthdate</Label>
                            <div className="flex gap-2 items-center">
                                <Input
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                    className={`flex-1 h-9 ${errors.dateOfBirth ? "border-red-500" : ""}`}
                                />
                                {calculatedAge && (
                                    <div className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-600 min-w-[60px] text-center">
                                        {calculatedAge} yrs
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-slate-500 uppercase font-semibold">Medical Notes</Label>
                            <Textarea
                                placeholder="Condition..."
                                value={formData.medicalCondition}
                                onChange={e => setFormData({ ...formData, medicalCondition: e.target.value })}
                                className="min-h-[80px] resize-none text-sm"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* CARD 2: DEVICE ASSIGNMENT */}
                <Card className="border-slate-200 shadow-sm h-full flex flex-col">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <div className="p-1.5 bg-indigo-100 rounded-md text-indigo-600">
                                <Smartphone className="w-4 h-4" />
                            </div>
                            2. Devices
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4 flex-1">
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md flex gap-2">
                            <Activity className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <div className="text-[11px] text-blue-700 leading-tight">
                                Select devices from the dropdown. Only "Available" hardware is shown.
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label className="flex items-center gap-2 text-xs text-slate-600 font-semibold uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    Vital Monitor
                                </Label>
                                <Select
                                    value={formData.vsDeviceId}
                                    onValueChange={(val) => setFormData({ ...formData, vsDeviceId: val })}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Select S/N" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableVS.map(device => (
                                            <SelectItem key={device.serial_number} value={device.serial_number}>
                                                {device.serial_number}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label className="flex items-center gap-2 text-xs text-slate-600 font-semibold uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    Smart Diaper
                                </Label>
                                <Select
                                    value={formData.sdDeviceId}
                                    onValueChange={(val) => setFormData({ ...formData, sdDeviceId: val })}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Select S/N" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableSD.map(device => (
                                            <SelectItem key={device.serial_number} value={device.serial_number}>
                                                {device.serial_number}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* CARD 3: CARE TEAM */}
                <Card className="border-slate-200 shadow-sm h-full flex flex-col">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <div className="p-1.5 bg-emerald-100 rounded-md text-emerald-600">
                                <Stethoscope className="w-4 h-4" />
                            </div>
                            3. Caregiver
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 flex-1">
                        <Tabs defaultValue="manual" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-3 h-8">
                                <TabsTrigger value="manual" className="text-xs">Search DB</TabsTrigger>
                                <TabsTrigger value="qr" className="text-xs">Scan ID</TabsTrigger>
                            </TabsList>

                            <TabsContent value="manual" className="space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 uppercase font-semibold">Email / Username</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                        <Input
                                            className="pl-8 h-9 text-sm"
                                            placeholder="search@hospital.com"
                                            value={formData.assignedCaregiverEmail}
                                            onChange={e => setFormData({ ...formData, assignedCaregiverEmail: e.target.value })}
                                            onBlur={() => handleSearchCaregiver(formData.assignedCaregiverEmail)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleSearchCaregiver(formData.assignedCaregiverEmail);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 uppercase font-semibold">Matched Name</Label>
                                    <Input
                                        className="bg-slate-50 h-9 text-sm font-medium text-emerald-700"
                                        placeholder="Auto-filled..."
                                        value={formData.assignedCaregiverName}
                                        readOnly
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="qr">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center gap-2 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleQRUpload}
                                    />
                                    <QrCode className="w-6 h-6 text-slate-400" />
                                    <p className="text-xs text-slate-500">Click to Upload Caregiver QR</p>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            {/* --- FOOTER ACTIONS --- */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <Button variant="ghost" onClick={onCancel} type="button" className="text-slate-500 hover:text-slate-700 h-9">
                    Cancel
                </Button>

                <Button
                    type="submit"
                    className="bg-teal-600 hover:bg-teal-700 text-white min-w-[140px] h-9 text-sm shadow-sm"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Processing...</>
                    ) : (
                        <><UserPlus className="w-3.5 h-3.5 mr-2" /> Enroll Patient</>
                    )}
                </Button>
            </div>
        </form>
    );
};

// --- EXPORT 1: PAGE VERSION ---
// Main Page View (Accessed via Sidebar)
export const AddNewPatient: React.FC<AddNewPatientProps> = ({ onSuccess, onCancel }) => {
    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 pb-4 pt-2 space-y-4">
            {/* Compact Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-500 rounded-lg shadow-sm">
                        <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 leading-tight">Patient Enrollment</h2>
                        <p className="text-xs text-slate-500">Add new patient to monitoring</p>
                    </div>
                </div>
            </div>

            <PatientRegistrationForm onSuccess={onSuccess} onCancel={onCancel} />
        </div>
    );
};

// --- EXPORT 2: MODAL POPUP VERSION ---
// Quick Action Modal (Accessed via Patient List / Dashboard)
interface AddNewPatientModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const AddNewPatientModal: React.FC<AddNewPatientModalProps> = ({ isOpen, onOpenChange, onSuccess }) => {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl w-[95vw] gap-0 p-0 overflow-hidden bg-white">
                <DialogHeader className="px-6 py-3 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-teal-600" />
                        <DialogTitle className="text-base font-semibold text-slate-800">Quick Enroll Patient</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="p-6 overflow-y-auto max-h-[85vh]">
                    <DialogDescription className="hidden">Enroll a new patient</DialogDescription>
                    <PatientRegistrationForm
                        onSuccess={() => {
                            onSuccess?.();
                            onOpenChange(false);
                        }}
                        onCancel={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};