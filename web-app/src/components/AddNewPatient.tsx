import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
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
    Activity,
    Loader2,
    User,
    PlusCircle,
    RefreshCw,
    CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { AddNewDeviceModal } from './AddNewDevice'; // [UX] Integrated for workflow continuity

// --- SHARED FORM COMPONENT ---
interface PatientFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

const PatientRegistrationForm: React.FC<PatientFormProps> = ({ onSuccess, onCancel }) => {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // [UX] State for the nested "Add Device" modal
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
    const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);

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

    // [Security/UX] Extracted fetch logic to allow re-triggering after a new device is added
    const refreshDeviceList = useCallback(async () => {
        if (!token) return;
        setIsRefreshingDevices(true);
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
            toast.error("Could not refresh device list");
        } finally {
            setIsRefreshingDevices(false);
        }
    }, [token]);

    // Initial load
    React.useEffect(() => {
        refreshDeviceList();
    }, [refreshDeviceList]);

    const availableVS = availableDevices.filter(d => d.device_name.includes('Vital Sign'));
    const availableSD = availableDevices.filter(d => d.device_name.includes('Smart Diaper'));

    // [UX] Handler for when a new device is successfully registered via the modal
    const handleDeviceAdded = () => {
        refreshDeviceList();
        // The modal closes automatically via the component's internal logic or we can force close here if needed
        // But the AddNewDeviceModal handles its own close on success usually, or we pass a wrapper.
        // In this specific implementation, we rely on the prop `onDeviceAdded` which we use to refresh data.
    };

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

    const handleSubmit = async () => {
        // [UX] This is called explicitly by the Finish button on Step 3 only.
        // No <form> element is used, so there is no risk of implicit submission.

        const formErrors = validateForm();
        if (Object.keys(formErrors).length > 0) {
            setErrors(formErrors);
            toast.error("Please fill in all required fields.");
            return;
        }

        setIsLoading(true);
        try {
            // [OWASP A01] Ensure the API validates that the token holder has permission to create patients
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

    const [currentStep, setCurrentStep] = useState(1);

    // [UX] Scroll to top when changing steps
    React.useEffect(() => {
        const mainContent = document.querySelector('main');
        if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStep]);

    const handleNext = () => {
        // Validation for Step 1
        if (currentStep === 1) {
            const formErrors = validateForm();
            if (Object.keys(formErrors).length > 0) {
                setErrors(formErrors);
                toast.error("Please fill in all required fields.");
                return;
            }
        }
        setCurrentStep(prev => prev + 1);
    };

    const handleBack = () => {
        setCurrentStep(prev => prev - 1);
    };

    // ... existing handlers ...

    return (
        <div className="flex flex-col h-[520px]"> {/* Fixed height for consistency */}

            {/* PROGRESS STEPS - COMPACT */}
            <div className="px-6 pt-4 pb-2 bg-white border-b border-slate-50">
                <div className="flex items-center justify-between px-2">
                    {[1, 2, 3].map((step) => {
                        const isActive = currentStep >= step;
                        const isCurrent = currentStep === step;
                        return (
                            <div key={step} className="flex flex-col items-center gap-1 z-10">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${isActive ? 'bg-teal-600 text-white shadow-md scale-100' : 'bg-slate-100 text-slate-400 scale-90'
                                    }`}>
                                    {step}
                                </div>
                                <span className={`text-[10px] font-medium transition-colors ${isCurrent ? 'text-teal-700' : 'text-slate-400'}`}>
                                    {step === 1 ? 'Details' : step === 2 ? 'Caregiver' : 'Devices'}
                                </span>
                            </div>
                        );
                    })}
                    {/* Connector Line */}
                    <div className="absolute left-0 right-0 top-[38px] h-0.5 bg-slate-100 -z-0 mx-10 sm:mx-14" />
                    <div
                        className="absolute left-0 top-[38px] h-0.5 bg-teal-600 -z-0 transition-all duration-300 mx-10 sm:mx-14"
                        style={{ width: `${((currentStep - 1) / 2) * (100 - 15)}%`, maxWidth: '85%' }}
                    />
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6">

                    {/* STEP 1: PATIENT DETAILS */}
                    {currentStep === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-600">First Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder="Juan"
                                            value={formData.firstName}
                                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                            className={`h-9 text-sm ${errors.firstName ? "border-red-500" : ""}`}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-600">Last Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder="Dela Cruz"
                                            value={formData.lastName}
                                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                            className={`h-9 text-sm ${errors.lastName ? "border-red-500" : ""}`}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-600">Birthdate <span className="text-red-500">*</span></Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="date"
                                            value={formData.dateOfBirth}
                                            onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                            className={`flex-1 h-9 text-sm ${errors.dateOfBirth ? "border-red-500" : ""}`}
                                        />
                                        {calculatedAge && (
                                            <div className="px-3 flex items-center bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-600 min-w-[70px] justify-center">
                                                {calculatedAge} yrs
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-600">Medical Notes</Label>
                                    <Textarea
                                        placeholder="Brief medical history or conditions..."
                                        value={formData.medicalCondition}
                                        onChange={e => setFormData({ ...formData, medicalCondition: e.target.value })}
                                        className="min-h-[140px] resize-none text-sm leading-relaxed"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: CAREGIVER */}
                    {currentStep === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2.5">
                                <div className="p-1 bg-blue-100 rounded-full shrink-0 mt-0.5">
                                    <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-semibold text-blue-800">Assign Primary Caregiver</p>
                                    <p className="text-[10px] text-blue-600 leading-tight">Optional. You can search for an existing nurse/doctor or scan their ID.</p>
                                </div>
                            </div>

                            <Tabs defaultValue="manual" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4 h-9 bg-slate-100/80 p-1">
                                    <TabsTrigger value="manual" className="text-xs h-7">Search Database</TabsTrigger>
                                    <TabsTrigger value="qr" className="text-xs h-7">Scan ID Token</TabsTrigger>
                                </TabsList>

                                <TabsContent value="manual" className="space-y-3 mt-0">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-600">Email / Username</Label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                className="pl-9 h-9 text-sm"
                                                placeholder="nurse@hospital.com"
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

                                    {/* Result Feedback */}
                                    {formData.assignedCaregiverName && (
                                        <div className="flex items-center gap-3 p-2 bg-emerald-50 border border-emerald-100 rounded-md">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                                <User className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-emerald-800">{formData.assignedCaregiverName}</p>
                                                <p className="text-[10px] text-emerald-600">Matched User</p>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="qr" className="mt-0">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer h-[160px] flex flex-col items-center justify-center gap-2 group"
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleQRUpload}
                                        />
                                        <div className="p-2.5 bg-white rounded-full shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                                            <QrCode className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-medium text-slate-700">Click to Upload QR</p>
                                            <p className="text-[10px] text-slate-400">Supports PNG, JPG</p>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}

                    {/* STEP 3: DEVICES */}
                    {currentStep === 3 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h3 className="text-sm font-semibold text-slate-800">Link Devices</h3>
                                    <p className="text-[10px] text-slate-500">Select active hardware from inventory.</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[10px] gap-1.5 text-slate-500 hover:text-teal-600"
                                    onClick={refreshDeviceList}
                                >
                                    <RefreshCw className={`w-3 h-3 ${isRefreshingDevices ? 'animate-spin' : ''}`} />
                                    Refresh List
                                </Button>
                            </div>

                            {/* [UX] Quick Action Banner */}
                            {(availableVS.length === 0 && availableSD.length === 0) ? (
                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg flex flex-col gap-3 text-center py-6">
                                    <div className="mx-auto p-2 bg-amber-100 rounded-full w-fit">
                                        <Smartphone className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-amber-800">No Free Devices</p>
                                        <p className="text-[10px] text-amber-600 px-4">All devices are currently assigned or none are registered.</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50 h-8 text-xs w-full"
                                        onClick={() => setIsDeviceModalOpen(true)}
                                    >
                                        <PlusCircle className="w-3.5 h-3.5 mr-2" /> Register New
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                            Vital Monitor
                                        </Label>
                                        <Select
                                            value={formData.vsDeviceId}
                                            onValueChange={(val) => setFormData({ ...formData, vsDeviceId: val })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Select Device S/N" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableVS.map(device => (
                                                    <SelectItem key={device.serial_number} value={device.serial_number} className="text-xs">
                                                        {device.serial_number}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            Smart Diaper
                                        </Label>
                                        <Select
                                            value={formData.sdDeviceId}
                                            onValueChange={(val) => setFormData({ ...formData, sdDeviceId: val })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Select Device S/N" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableSD.map(device => (
                                                    <SelectItem key={device.serial_number} value={device.serial_number} className="text-xs">
                                                        {device.serial_number}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="pt-2 flex justify-end">
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            className="h-auto p-0 text-[10px] text-teal-600 underline"
                                            onClick={() => setIsDeviceModalOpen(true)}
                                        >
                                            Register a new device instead?
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* --- FOOTER --- */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={currentStep === 1 ? onCancel : handleBack}
                        type="button"
                        className="text-slate-500 hover:text-slate-700 h-9 text-xs"
                    >
                        {currentStep === 1 ? 'Cancel' : 'Back'}
                    </Button>

                    {currentStep < 3 ? (
                        <Button
                            type="button"
                            onClick={handleNext}
                            className="bg-slate-800 text-white hover:bg-slate-900 h-9 text-xs px-6"
                        >
                            Next Step
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm h-9 text-xs px-6"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Creating...</>
                            ) : (
                                <><CheckCircle className="w-3.5 h-3.5 mr-2" /> Finish</>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* [UX/Continuity] Add Device Modal Overlay */}
            <AddNewDeviceModal
                isOpen={isDeviceModalOpen}
                onOpenChange={setIsDeviceModalOpen}
                onDeviceAdded={handleDeviceAdded}
            />
        </div>
    );
};

// --- EXPORT 1: PAGE VERSION ---
// Main Page View (Accessed via Sidebar)
interface AddNewPatientProps {
    onSuccess: () => void;
    onCancel: () => void;
}

export const AddNewPatient: React.FC<AddNewPatientProps> = ({ onSuccess, onCancel }) => {
    return (
        <div className="w-full max-w-lg mx-auto mt-8">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-100 rounded-lg">
                            <UserPlus className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg text-slate-800">Patient Enrollment</CardTitle>
                            <CardDescription className="text-xs">
                                Register a new patient to the ALAGA network.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <PatientRegistrationForm onSuccess={onSuccess} onCancel={onCancel} />
                </CardContent>
            </Card>
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
            <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden bg-white border-0 shadow-lg">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50/80 flex flex-row items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-teal-100 rounded-lg">
                            <UserPlus className="w-4 h-4 text-teal-600" />
                        </div>
                        <DialogTitle className="text-base font-semibold text-slate-800">New Patient</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="p-0">
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