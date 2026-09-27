import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../lib/auth-context';
import { API_URL } from '../lib/config';
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
    Search,
    Stethoscope,
    Activity,
    Loader2,
    User,
    PlusCircle,
    RefreshCw,
    CheckCircle,
    Mail,
    Heart,
    Thermometer,
    Droplets,
    BookOpen,
    Info,
    RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { AddNewDeviceModal } from './AddNewDevice'; // [UX] Integrated for workflow continuity
import { BaselineGuideModal, BaselinePreset } from './BaselineGuideModal';

// --- SHARED FORM COMPONENT ---
interface PatientFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

const PatientRegistrationForm: React.FC<PatientFormProps> = ({ onSuccess, onCancel }) => {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    // [UX] State for the nested "Add Device" modal and "Baseline Guide" modal
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
    const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
    const [isBaselineGuideOpen, setIsBaselineGuideOpen] = useState(false);

    // Existing patient lookup state
    const [existingPatientId, setExistingPatientId] = useState('');
    const [loadedPatientId, setLoadedPatientId] = useState<number | null>(null);
    const [isSearchingPatient, setIsSearchingPatient] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        primaryDiagnosis: '',
        conditions: '',
        emergencyContact: '',
        vsDeviceId: '',
        sdDeviceId: '',
        assignedCaregiverId: '',
        assignedCaregiverEmail: '',
        assignedCaregiverName: '',
        ward: '',
        room: '',
        bed: '',
        // Normal Standard Baselines
        heartRate: 75,
        temperature: 36.8,
        spo2: 98,
        moistureThreshold: 30
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const calculatedAge = useMemo(() => {
        if (!formData.dateOfBirth) return '';
        const birthDate = new Date(formData.dateOfBirth);
        if (birthDate > new Date()) return '';
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
            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/available`, {
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
    };

    // Lookup existing patient by Patient ID
    const handleLookupPatient = async () => {
        const id = existingPatientId.trim();
        if (!id) {
            toast.error("Please enter a Patient ID to load.");
            return;
        }
        setIsSearchingPatient(true);
        try {
            const res = await fetch(`${API_URL}/api/caregiver/patients/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.data) {
                const p = data.data;
                const base = p.baseline_data || {};
                const nameParts = (p.name || '').trim().split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                setFormData(prev => ({
                    ...prev,
                    firstName: firstName || prev.firstName,
                    lastName: lastName || prev.lastName,
                    dateOfBirth: p.birthdate ? p.birthdate.split('T')[0] : prev.dateOfBirth,
                    primaryDiagnosis: base.diagnosis || base.condition || prev.primaryDiagnosis,
                    conditions: base.condition || base.medicalCondition || prev.conditions,
                    emergencyContact: base.emergencyContact || prev.emergencyContact,
                    ward: base.ward || prev.ward,
                    room: base.room || prev.room || 'Room 1',
                    bed: base.bed || prev.bed,
                    heartRate: Number(base.heart_rate || base.heartRate) || 75,
                    temperature: Number(base.temperature) || 36.8,
                    spo2: Number(base.spo2) || 98,
                    moistureThreshold: Number(base.moisture_threshold || base.moistureThreshold) || 30
                }));
                setLoadedPatientId(p.patient_id);
                toast.success(`Found patient #${p.patient_id} (${p.name}). Baseline & info loaded.`);
            } else {
                toast.error(data.message || `Patient #${id} not found.`);
            }
        } catch (err) {
            console.error("Patient lookup error:", err);
            toast.error("Could not load patient record.");
        } finally {
            setIsSearchingPatient(false);
        }
    };

    const handleClearLoadedPatient = () => {
        setLoadedPatientId(null);
        setExistingPatientId('');
        setFormData({
            firstName: '',
            lastName: '',
            dateOfBirth: '',
            primaryDiagnosis: '',
            conditions: '',
            emergencyContact: '',
            vsDeviceId: '',
            sdDeviceId: '',
            assignedCaregiverId: '',
            assignedCaregiverEmail: '',
            assignedCaregiverName: '',
            ward: '',
            room: '',
            bed: '',
            heartRate: 75,
            temperature: 36.8,
            spo2: 98,
            moistureThreshold: 30
        });
        toast.info("Cleared patient selection. In new patient registration mode.");
    };

    const handleApplyPreset = (preset: BaselinePreset) => {
        setFormData(prev => ({
            ...prev,
            heartRate: preset.heartRate,
            temperature: preset.temperature,
            spo2: preset.spo2,
            moistureThreshold: preset.moistureThreshold
        }));
        toast.success("Applied standard physiological baseline preset.");
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
        if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
        if (!formData.dateOfBirth) {
            newErrors.dateOfBirth = "Birthdate is required";
        } else {
            const birthDate = new Date(formData.dateOfBirth);
            if (birthDate > new Date()) {
                newErrors.dateOfBirth = "Cannot be in the future";
            }
        }
        if (!formData.room.trim()) newErrors.room = "Room name is required";
        return newErrors;
    };

    const handleSubmit = async () => {
        const formErrors = validateForm();
        if (Object.keys(formErrors).length > 0) {
            setErrors(formErrors);
            toast.error("Please fill in all required fields properly.");
            return;
        }

        setIsLoading(true);
        try {
            if (loadedPatientId) {
                // UPDATE EXISTING PATIENT BASELINE
                const response = await fetch(`${API_URL}/api/caregiver/patients/${loadedPatientId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
                        birthdate: formData.dateOfBirth || null,
                        medicalCondition: formData.conditions || formData.primaryDiagnosis || null,
                        ward: formData.ward || null,
                        room: formData.room.trim(),
                        bed: formData.bed.trim() || null,
                        heart_rate: Number(formData.heartRate),
                        temperature: Number(formData.temperature),
                        spo2: Number(formData.spo2),
                        moisture_threshold: Number(formData.moistureThreshold)
                    })
                });

                const data = await response.json();
                if (data.success) {
                    toast.success(`Patient #${loadedPatientId} baselines updated successfully.`);
                    onSuccess();
                } else {
                    toast.error(data.message || "Failed to update patient baselines.");
                }
            } else {
                // REGISTER NEW PATIENT WITH BASELINES
                const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/patients`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
                        birthdate: formData.dateOfBirth,
                        medicalCondition: formData.conditions, // backwards-compatible field
                        illness: formData.primaryDiagnosis || null,
                        conditions: formData.conditions || null,
                        emergencyContact: formData.emergencyContact || null,
                        assignedCaregiverEmail: formData.assignedCaregiverEmail || null,
                        vitalDeviceNo: formData.vsDeviceId,
                        diaperDeviceNo: formData.sdDeviceId,
                        ward: formData.ward || null,
                        room: formData.room.trim(),
                        bed: formData.bed.trim() || null,
                        heart_rate: Number(formData.heartRate),
                        temperature: Number(formData.temperature),
                        spo2: Number(formData.spo2),
                        moisture_threshold: Number(formData.moistureThreshold)
                    })
                });

                const data = await response.json();
                if (data.success) {
                    toast.success(`Patient ${formData.firstName} enrolled with normal standard baselines.`);
                    onSuccess();
                } else {
                    toast.error(data.message || "Failed to enroll patient");
                }
            }
        } catch (error) {
            console.error("Enrollment/Update Error:", error);
            toast.error("Network Error: Could not save patient.");
        } finally {
            setIsLoading(false);
        }
    };

const handleSearchCaregiver = async (query: string) => {
    if (!query || query.length < 3) return;
    try {
        const response = await fetch(`${API_URL}/api/caregiver/search?query=${query}`, {
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
        <div className="flex flex-col min-h-[560px] max-h-[85vh]">
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
                                    {step === 1 ? 'Details & Baseline' : step === 2 ? 'Caregiver' : 'Devices'}
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
                <div className="flex-1 overflow-y-auto p-6 space-y-4">

                    {/* STEP 1: PATIENT DETAILS & BASELINES */}
                    {currentStep === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                            {/* Existing Patient ID Lookup */}
                            <div className="p-3 bg-slate-50/90 border border-slate-200/90 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <Search className="w-3.5 h-3.5 text-teal-600" />
                                        Existing Patient ID Lookup
                                        <span className="text-[10px] font-normal text-slate-400">(Optional: configure existing patient baselines)</span>
                                    </Label>
                                    {loadedPatientId && (
                                        <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" />
                                            Patient #{loadedPatientId} Loaded
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Enter Patient ID (e.g. 12)..."
                                        value={existingPatientId}
                                        onChange={e => setExistingPatientId(e.target.value.replace(/[^0-9]/g, ''))}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLookupPatient(); } }}
                                        className="h-8 text-xs bg-white flex-1"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleLookupPatient}
                                        disabled={isSearchingPatient || !existingPatientId.trim()}
                                        className="h-8 text-xs px-3 bg-slate-800 hover:bg-slate-900 text-white font-medium"
                                    >
                                        {isSearchingPatient ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
                                        Load Patient
                                    </Button>
                                    {loadedPatientId && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={handleClearLoadedPatient}
                                            className="h-8 text-xs px-2.5 text-slate-600 hover:text-red-600 border-slate-200 hover:bg-red-50"
                                            title="Clear and register a new patient"
                                        >
                                            <RotateCcw className="w-3 h-3 mr-1" />
                                            New Patient
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-600">First Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder="Juan"
                                            value={formData.firstName}
                                            onChange={e => setFormData({ ...formData, firstName: e.target.value.replace(/[^a-zA-Z\s'-]/g, '') })}
                                            className={`h-9 text-sm ${errors.firstName ? "border-red-500" : ""}`}
                                            autoFocus
                                        />
                                        {errors.firstName && <p className="text-[10px] text-red-500">{errors.firstName}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-600">Last Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder="Dela Cruz"
                                            value={formData.lastName}
                                            onChange={e => setFormData({ ...formData, lastName: e.target.value.replace(/[^a-zA-Z\s'-]/g, '') })}
                                            className={`h-9 text-sm ${errors.lastName ? "border-red-500" : ""}`}
                                        />
                                        {errors.lastName && <p className="text-[10px] text-red-500">{errors.lastName}</p>}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-600">Birthdate <span className="text-red-500">*</span></Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="date"
                                            value={formData.dateOfBirth}
                                            onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                            max={new Date().toISOString().split('T')[0]}
                                            className={`flex-1 h-9 text-sm ${errors.dateOfBirth ? "border-red-500" : ""}`}
                                        />
                                        {calculatedAge !== '' && (
                                            <div className="px-3 flex items-center bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-600 min-w-[70px] justify-center">
                                                {calculatedAge} yrs
                                            </div>
                                        )}
                                    </div>
                                    {errors.dateOfBirth && (
                                        <p className="text-xs text-red-500 mt-1">{errors.dateOfBirth}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-600">Primary Diagnosis</Label>
                                    <Input
                                        placeholder="e.g. Hypertension"
                                        value={formData.primaryDiagnosis}
                                        onChange={e => setFormData({ ...formData, primaryDiagnosis: e.target.value })}
                                        className="h-9 text-sm"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-600">Conditions</Label>
                                    <Input
                                        placeholder="e.g. Diabetes, Asthma"
                                        value={formData.conditions}
                                        onChange={e => setFormData({ ...formData, conditions: e.target.value })}
                                        className="h-9 text-sm"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-600">Emergency Contact</Label>
                                    <Input
                                        placeholder="e.g. Juan Santos (Son) - +63 912 345 6789"
                                        value={formData.emergencyContact}
                                        onChange={e => setFormData({ ...formData, emergencyContact: e.target.value })}
                                        className="h-9 text-sm"
                                    />
                                </div>

                                <div className="border-t border-slate-100 pt-3 mt-3">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Location Assignment</h4>
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-600">
                                                Ward Name <span className="text-slate-400 font-normal">(Optional)</span>
                                            </Label>
                                            <Input
                                                placeholder="e.g. Pediatrics (Optional)"
                                                value={formData.ward}
                                                onChange={e => setFormData({ ...formData, ward: e.target.value })}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-slate-600">Room Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    placeholder="e.g. Room 101"
                                                    value={formData.room}
                                                    onChange={e => setFormData({ ...formData, room: e.target.value })}
                                                    className={`h-9 text-sm ${errors.room ? "border-red-500" : ""}`}
                                                />
                                                {errors.room && <p className="text-[10px] text-red-500">{errors.room}</p>}
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-slate-600">
                                                    Bed Name <span className="text-slate-400 font-normal">(Optional)</span>
                                                </Label>
                                                <Input
                                                    placeholder="e.g. Bed A (Optional)"
                                                    value={formData.bed}
                                                    onChange={e => setFormData({ ...formData, bed: e.target.value })}
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* NORMAL STANDARD BASELINES SECTION */}
                                <div className="border-t border-slate-200/80 pt-3 mt-3 bg-slate-50/70 p-3.5 rounded-xl border">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1.5">
                                            <Heart className="w-4 h-4 text-rose-500" />
                                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                                NORMAL STANDARD BASELINES
                                            </h4>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsBaselineGuideOpen(true)}
                                            className="h-6 px-2.5 text-[10px] font-bold text-teal-700 bg-teal-50 border-teal-300 hover:bg-teal-100 hover:text-teal-800 flex items-center gap-1.5 shadow-2xs rounded-lg cursor-pointer"
                                        >
                                            <BookOpen className="w-3 h-3 text-teal-600" />
                                            BASELINE GUIDE
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-3 leading-snug">
                                        Configured standard physiological baseline for AI anomaly scoring & personalized suppression.
                                    </p>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                                                <Heart className="w-3 h-3 text-rose-500" />
                                                Heart Rate (bpm)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={40}
                                                max={200}
                                                value={formData.heartRate}
                                                onChange={e => setFormData({ ...formData, heartRate: Number(e.target.value) || 75 })}
                                                className="h-8 text-xs font-bold bg-white"
                                            />
                                            <span className="text-[9.5px] text-slate-400">Adult standard: 60-100 bpm</span>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                                                <Thermometer className="w-3 h-3 text-amber-500" />
                                                Temperature (°C)
                                            </Label>
                                            <Input
                                                type="number"
                                                step={0.1}
                                                min={33.0}
                                                max={42.0}
                                                value={formData.temperature}
                                                onChange={e => setFormData({ ...formData, temperature: Number(e.target.value) || 36.8 })}
                                                className="h-8 text-xs font-bold bg-white"
                                            />
                                            <span className="text-[9.5px] text-slate-400">Normothermia: 36.5-37.5°C</span>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                                                <Activity className="w-3 h-3 text-blue-500" />
                                                SpO₂ (%)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={70}
                                                max={100}
                                                value={formData.spo2}
                                                onChange={e => setFormData({ ...formData, spo2: Number(e.target.value) || 98 })}
                                                className="h-8 text-xs font-bold bg-white"
                                            />
                                            <span className="text-[9.5px] text-slate-400">Target sat: 95-100%</span>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                                                <Droplets className="w-3 h-3 text-cyan-500" />
                                                Moisture Limit (%)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={5}
                                                max={95}
                                                value={formData.moistureThreshold}
                                                onChange={e => setFormData({ ...formData, moistureThreshold: Number(e.target.value) || 30 })}
                                                className="h-8 text-xs font-bold bg-white"
                                            />
                                            <span className="text-[9.5px] text-slate-400">Alert threshold: ≥ 30%</span>
                                        </div>
                                    </div>
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
                                    <p className="text-xs font-semibold text-blue-800">Invite Caregiver/Medical Staff</p>
                                    <p className="text-[10px] text-blue-600 leading-tight">Optional. Enter the email address of the caregiver/medical staff you want to invite to this patient's care team.</p>
                                </div>
                            </div>

                            <div className="space-y-3 mt-0">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-600">Caregiver/Medical Staff Email Address</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="pl-9 h-9 text-sm"
                                            placeholder="nurse@hospital.com"
                                            value={formData.assignedCaregiverEmail}
                                            onChange={e => setFormData({ ...formData, assignedCaregiverEmail: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
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

            {/* Baseline Guide Modal Overlay */}
            <BaselineGuideModal
                isOpen={isBaselineGuideOpen}
                onClose={() => setIsBaselineGuideOpen(false)}
                onApplyPreset={handleApplyPreset}
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