import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { UserPlus, Cpu, RotateCcw, Search, RefreshCw, PlusCircle, Database } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useAuth } from '../../lib/auth-context';
import { API_URL } from '../../lib/config';

const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface ScopedPatient {
    patient_id: number;
    name: string;
    birthdate: string;
    baseline_data: {
        gender?: string;
        diagnosis?: string;
    };
    created_at: string;
    device_serial_number: string | null;
    paired_devices: {
        serial_number: string;
        device_name: string;
        status: string;
    }[];
    assigned_users: {
        user_id: number;
        username: string;
        first_name: string;
        last_name: string;
        email: string;
        relationship: string;
        invite_status: string;
    }[];
}

export default function PatientOnboarding() {
    const { user, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';
    const isSystemAdmin = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    const isParentOrGuardian = role === 'parent' || role === 'guardian';

    const API = isFacilityAdmin 
        ? `${API_URL}/api/facility-admin` 
        : `${API_URL}/api/caregiver`;

    // Patient form state
    const [form, setForm] = useState({ 
        first_name: '', 
        last_name: '', 
        age: '', 
        gender: 'Male', 
        diagnosis: '', 
        ward: '', 
        room: isParentOrGuardian ? 'Home' : '', 
        bed: isParentOrGuardian ? '1' : '', 
        patient_type: isParentOrGuardian ? 'at_home' : 'facility', 
        facility_name: '' 
    });
    const [consentConfirmed, setConsentConfirmed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lastCreatedId, setLastCreatedId] = useState<number | null>(null);

    // Device pairing state
    const [pairPatientId, setPairPatientId] = useState('');
    const [pairMode, setPairMode] = useState<'new' | 'existing'>('new');
    const [pairingType, setPairingType] = useState('both'); // 'both' | 'diaper' | 'vital'
    const [diaperSN, setDiaperSN] = useState('');
    const [vitalSN, setVitalSN] = useState('');
    const [availableDevices, setAvailableDevices] = useState<{ serial_number: string; device_name?: string; status: string }[]>([]);

    // Fetch available devices
    const fetchAvailableDevices = async () => {
        try {
            const res = await fetch(`${API_URL}/api/caregiver/devices/available`, {
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setAvailableDevices(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch available devices:', err);
        }
    };

    useEffect(() => {
        fetchAvailableDevices();
    }, []);

    // SVM reset state
    const [resetPatientId, setResetPatientId] = useState('');
    const [resetDeviceSN, setResetDeviceSN] = useState('');
    const [resetReason, setResetReason] = useState('');

    // Patient List State
    const [patients, setPatients] = useState<ScopedPatient[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Unassigned Patient List State
    const [unassignedPatients, setUnassignedPatients] = useState<ScopedPatient[]>([]);
    const [unassignedSearchQuery, setUnassignedSearchQuery] = useState('');
    const [unassignedSuggestions, setUnassignedSuggestions] = useState<string[]>([]);
    const [showUnassignedSuggestions, setShowUnassignedSuggestions] = useState(false);
    const [isLoadingUnassigned, setIsLoadingUnassigned] = useState(false);

    // Edit Patient Profile and Care Team Assignment states
    const [editingPatient, setEditingPatient] = useState<ScopedPatient | null>(null);
    const [editForm, setEditForm] = useState({ name: '', gender: 'Male', diagnosis: '' });

    const startEditPatient = (pat: ScopedPatient) => {
        setEditingPatient(pat);
        setEditForm({
            name: pat.name,
            gender: pat.baseline_data?.gender || 'Male',
            diagnosis: pat.baseline_data?.diagnosis || ''
        });
    };

    const handleUpdatePatient = async () => {
        if (!editingPatient) return;
        try {
            const res = await fetch(`${API}/patients/${editingPatient.patient_id}`, {
                method: 'PUT',
                headers: getAuth(),
                body: JSON.stringify(editForm)
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setEditingPatient(null);
                fetchPatients();
                fetchUnassignedPatients();
            } else {
                toast.error(data.message || 'Failed to update patient.');
            }
        } catch {
            toast.error('Failed to update patient.');
        }
    };

    const handleArchivePatient = async (patientId: number) => {
        if (!window.confirm('Are you sure you want to archive this patient? Doing so will unpair any active devices.')) {
            return;
        }
        try {
            const res = await fetch(`${API}/patients/${patientId}`, {
                method: 'DELETE',
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchPatients();
                fetchUnassignedPatients();
            } else {
                toast.error(data.message || 'Failed to archive patient.');
            }
        } catch {
            toast.error('Failed to archive patient.');
        }
    };

    const handleAssignByEmail = async (patientId: number, email: string) => {
        if (!email) return toast.error('Email address is required.');
        try {
            const res = await fetch(`${API}/patients/${patientId}/assign-staff-by-email`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchPatients();
                fetchUnassignedPatients();
            } else {
                toast.error(data.message || 'Assignment failed.');
            }
        } catch {
            toast.error('Failed to assign staff.');
        }
    };

    const fetchPatients = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/patients-added-and-assigned`, {
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                setPatients(data.data || []);
            } else {
                toast.error(data.message || 'Failed to fetch patient list.');
            }
        } catch {
            toast.error('Failed to load patient list.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchUnassignedPatients = useCallback(async () => {
        setIsLoadingUnassigned(true);
        try {
            const res = await fetch(`${API}/unassigned-patients`, {
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                setUnassignedPatients(data.data || []);
            } else {
                toast.error(data.message || 'Failed to fetch unassigned patient list.');
            }
        } catch {
            toast.error('Failed to load unassigned patient list.');
        } finally {
            setIsLoadingUnassigned(false);
        }
    }, []);

    useEffect(() => {
        fetchPatients();
        fetchUnassignedPatients();
    }, [fetchPatients, fetchUnassignedPatients]);

    const handleRegister = async () => {
        if (!form.first_name || !form.last_name || !form.age || !form.diagnosis || !form.room) {
            return toast.error('Please fill in all required fields (First Name, Last Name, Age, Diagnosis, Room).');
        }
        if (isSystemAdmin && form.patient_type === 'facility' && !form.facility_name.trim()) {
            return toast.error('Facility Name is required when Care Setting is Facility.');
        }
        if (!consentConfirmed) {
            return toast.error('Informed consent must be confirmed before registering a patient. (DPA § 13)');
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/patients`, {
                method: 'POST', headers: getAuth(),
                body: JSON.stringify({ ...form, age: parseInt(form.age), bed: form.bed.trim() || null, consent_confirmed: true })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setLastCreatedId(data.patient_id);
                setForm({ first_name: '', last_name: '', age: '', gender: 'Male', diagnosis: '', ward: '', room: '', bed: '', patient_type: 'facility', facility_name: '' });
                setConsentConfirmed(false);
                fetchPatients();
                fetchUnassignedPatients();
            } else toast.error(data.message);
        } catch { toast.error('Registration failed.'); }
        finally { setSubmitting(false); }
    };

    const handlePairDevice = async () => {
        if (!pairPatientId.trim()) return toast.error('Patient ID is required.');
        
        let diaperToPair = '';
        let vitalToPair = '';

        if (pairingType === 'both' || pairingType === 'diaper') {
            diaperToPair = diaperSN.trim().toUpperCase();
            if (!diaperToPair) return toast.error('Smart Diaper Device serial number is required.');
            if (!diaperToPair.startsWith('SD-')) return toast.error('Smart Diaper serial number must start with "SD-" (e.g. SD-2026-0001)');
        }
        if (pairingType === 'both' || pairingType === 'vital') {
            vitalToPair = vitalSN.trim().toUpperCase();
            if (!vitalToPair) return toast.error('Vital Signs Device serial number is required.');
            if (!vitalToPair.startsWith('VS-')) return toast.error('Vital Signs serial number must start with "VS-" (e.g. VS-2026-0001)');
        }

        try {
            // Function to pair a single device
            const pairOne = async (sn: string, label: string) => {
                const res = await fetch(`${API}/patients/${pairPatientId.trim()}/pair-device`, {
                    method: 'POST', 
                    headers: getAuth(),
                    body: JSON.stringify({ 
                        serial_number: sn,
                        register_new: pairMode === 'new'
                    })
                });
                const data = await res.json();
                if (!data.success) {
                    throw new Error(`${label}: ${data.message}`);
                }
            };

            if (diaperToPair) {
                await pairOne(diaperToPair, 'Smart Diaper');
            }
            if (vitalToPair) {
                await pairOne(vitalToPair, 'Vital Signs');
            }

            toast.success('Device(s) paired successfully to patient.');
            setPairPatientId('');
            setDiaperSN('');
            setVitalSN('');
            fetchPatients();
            fetchUnassignedPatients();
            fetchAvailableDevices();
        } catch (err: any) {
            toast.error(err.message || 'Device pairing failed.');
        }
    };

    const handleResetBaseline = async () => {
        const cleanPatientId = resetPatientId.trim();
        const cleanDeviceSN = resetDeviceSN.trim().toUpperCase();

        if (!cleanPatientId && !cleanDeviceSN) {
            return toast.error('Patient ID or Device Serial Number is required.');
        }
        if (!resetReason.trim()) {
            return toast.error('Clinical reason for baseline reset is required.');
        }

        const targetIdentifier = cleanPatientId || cleanDeviceSN;

        try {
            const res = await fetch(`${API}/patients/${targetIdentifier}/reset-baseline`, {
                method: 'POST', 
                headers: getAuth(),
                body: JSON.stringify({ 
                    reason: resetReason.trim(),
                    device_sn: cleanDeviceSN || undefined
                })
            });
            const data = await res.json();
            if (data.success) { 
                toast.success(data.message); 
                setResetPatientId(''); 
                setResetDeviceSN('');
                setResetReason(''); 
                fetchPatients();
            } else {
                toast.error(data.message || 'Baseline reset failed.');
            }
        } catch (err: any) {
            toast.error(err.message || 'Network error during baseline reset.');
        }
    };

    // Filter patients
    const filteredPatients = patients.filter(p => {
        const query = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(query) ||
            p.patient_id.toString().includes(query) ||
            (p.baseline_data?.diagnosis || '').toLowerCase().includes(query);
    });

    // Filter unassigned patients
    const filteredUnassignedPatients = unassignedPatients.filter(p => {
        const query = unassignedSearchQuery.toLowerCase();
        return p.name.toLowerCase().includes(query) ||
            p.patient_id.toString().includes(query) ||
            (p.baseline_data?.diagnosis || '').toLowerCase().includes(query);
    });

    // Handle unassigned suggestions
    useEffect(() => {
        if (unassignedSearchQuery.trim().length > 0) {
            const matches = unassignedPatients
                .map(p => p.name)
                .filter(name => name.toLowerCase().includes(unassignedSearchQuery.toLowerCase()));
            setUnassignedSuggestions(Array.from(new Set(matches)).slice(0, 5));
        } else {
            setUnassignedSuggestions([]);
        }
    }, [unassignedSearchQuery, unassignedPatients]);

    return (
        <div className="space-y-6 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight">Patient Onboarding</h2>
                    <p className="text-[10px] font-medium text-slate-500">Register new patients, pair devices, and manage SVM baselines within your facility.</p>
                </div>
                <Button size="sm" variant="outline" onClick={fetchPatients} disabled={isLoading} className="h-9 gap-1.5 cursor-pointer">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh List
                </Button>
            </div>

            {/* Forms Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0">
                {/* Patient Registration */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="py-4">
                        <CardTitle className="text-slate-800 text-sm flex items-center gap-2"><UserPlus className="w-4 h-4 text-teal-600" /> Register New Patient</CardTitle>
                        <CardDescription className="text-[10px] text-slate-500">Add a new clinical record to the database.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                    First Name <span className="text-red-500">*</span>
                                </label>
                                <Input 
                                    value={form.first_name} 
                                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value.replace(/[^a-zA-Z\s'-]/g, '') }))} 
                                    className="h-8 text-xs bg-slate-50/50" 
                                    placeholder="Juan"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                    Last Name <span className="text-red-500">*</span>
                                </label>
                                <Input 
                                    value={form.last_name} 
                                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value.replace(/[^a-zA-Z\s'-]/g, '') }))} 
                                    className="h-8 text-xs bg-slate-50/50" 
                                    placeholder="Dela Cruz"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                    Age <span className="text-red-500">*</span>
                                </label>
                                <Input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} className="h-8 text-xs bg-slate-50/50" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Gender</label>
                                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                    className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 cursor-pointer">
                                    <option>Male</option><option>Female</option><option>Other</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                Diagnosis / Reason for Monitoring <span className="text-red-500">*</span>
                            </label>
                            <Input value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} className="h-8 text-xs bg-slate-50/50" placeholder="e.g. Hypertension" />
                        </div>

                        {isSystemAdmin && (
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Care Setting</label>
                                    <select
                                        value={form.patient_type}
                                        onChange={e => setForm(f => ({
                                            ...f,
                                            patient_type: e.target.value,
                                            facility_name: e.target.value === 'at_home' ? '' : f.facility_name
                                        }))}
                                        className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 cursor-pointer"
                                    >
                                        <option value="facility">Facility</option>
                                        <option value="at_home">At Home</option>
                                    </select>
                                </div>
                                {form.patient_type === 'facility' && (
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Facility Name <span className="text-red-500">*</span></label>
                                        <Input
                                            value={form.facility_name}
                                            onChange={e => setForm(f => ({ ...f, facility_name: e.target.value }))}
                                            placeholder="e.g. Alaga Medical Center"
                                            className="h-8 text-xs bg-slate-50/50"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="border-t border-slate-100 pt-2.5 mt-2.5">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Location Assignment</span>
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                        Ward Name <span className="text-slate-400 font-normal"> (Optional)</span>
                                    </label>
                                    <Input value={form.ward} onChange={e => setForm(f => ({ ...f, ward: e.target.value }))} className="h-8 text-xs bg-slate-50/50" placeholder="e.g. Ward A (Optional)" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                            Room Name <span className="text-red-500">*</span>
                                        </label>
                                        <Input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} className="h-8 text-xs bg-slate-50/50" placeholder="e.g. Room 101" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                            Bed Name <span className="text-slate-400 font-normal"> (Optional)</span>
                                        </label>
                                        <Input value={form.bed} onChange={e => setForm(f => ({ ...f, bed: e.target.value }))} className="h-8 text-xs bg-slate-50/50" placeholder="e.g. Bed 1 (Optional)" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* [DPA] Visible consent checkbox */}
                        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <input type="checkbox" id="consent" checked={consentConfirmed} onChange={e => setConsentConfirmed(e.target.checked)}
                                className="mt-0.5 accent-teal-600 cursor-pointer" />
                            <label htmlFor="consent" className="text-[10px] text-blue-800 cursor-pointer select-none leading-relaxed">
                                I confirm that the patient or their legal guardian has provided informed consent for health data collection and processing, as required by the Data Privacy Act of 2012 (RA 10173), Section 13.
                            </label>
                        </div>
                        {lastCreatedId && (
                            <div className="text-[10px] bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-emerald-700">
                                Patient registered successfully. Patient ID: <strong>{lastCreatedId}</strong>. Use this ID below to pair a device.
                            </div>
                        )}
                        <Button onClick={handleRegister} disabled={submitting} className="w-full h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold cursor-pointer">
                            {submitting ? 'Registering...' : 'Register Patient'}
                        </Button>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    {/* Device Pairing */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="py-4">
                            <CardTitle className="text-slate-800 text-sm flex items-center gap-2"><Cpu className="w-4 h-4 text-teal-600" /> Pair Device/s To Patient</CardTitle>
                            <CardDescription className="text-[10px] text-slate-500">Device serial number must be pre-approved in whitelist.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* Mode Selection Checkbox */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">Device Registration Option</label>
                                <div className="grid grid-cols-1 gap-1.5">
                                    <label 
                                        className={`flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all ${
                                            pairMode === 'new' 
                                                ? 'bg-teal-50 border-teal-500 text-teal-900 font-medium' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={pairMode === 'new'} 
                                            onChange={() => {
                                                setPairMode('new');
                                                setDiaperSN('');
                                                setVitalSN('');
                                            }}
                                            className="accent-teal-600 cursor-pointer" 
                                        />
                                        <PlusCircle className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                        <span>Register a new device to patient</span>
                                    </label>

                                    <label 
                                        className={`flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all ${
                                            pairMode === 'existing' 
                                                ? 'bg-teal-50 border-teal-500 text-teal-900 font-medium' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={pairMode === 'existing'} 
                                            onChange={() => {
                                                setPairMode('existing');
                                                setDiaperSN('');
                                                setVitalSN('');
                                                fetchAvailableDevices();
                                            }}
                                            className="accent-teal-600 cursor-pointer" 
                                        />
                                        <Database className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                        <span>Register an existing device to a patient</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Patient ID</label>
                                <Input value={pairPatientId} onChange={e => setPairPatientId(e.target.value)} placeholder="e.g. 5" type="number" className="h-8 text-xs bg-slate-50/50" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Device Selection</label>
                                <select 
                                    value={pairingType} 
                                    onChange={e => setPairingType(e.target.value)}
                                    className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 cursor-pointer"
                                >
                                    <option value="both">Partnered Devices (Smart Diaper & Vital Signs)</option>
                                    <option value="diaper">Smart Diaper Device only</option>
                                    <option value="vital">Vital Signs Device only</option>
                                </select>
                            </div>
                            
                            {(pairingType === 'both' || pairingType === 'diaper') && (
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[10px] font-semibold text-slate-600">Smart Diaper Device Serial Number</label>
                                        {pairMode === 'existing' && availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('SD-')).length > 0 && (
                                            <span className="text-[9px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-medium">
                                                {availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('SD-')).length} Available
                                            </span>
                                        )}
                                    </div>
                                    {pairMode === 'existing' && availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('SD-')).length > 0 ? (
                                        <div className="space-y-1">
                                            <select
                                                value={diaperSN}
                                                onChange={e => setDiaperSN(e.target.value)}
                                                className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 font-mono cursor-pointer"
                                            >
                                                <option value="">-- Select Available Diaper Device --</option>
                                                {availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('SD-')).map(d => (
                                                    <option key={d.serial_number} value={d.serial_number}>
                                                        {d.serial_number} - AVAILABLE
                                                    </option>
                                                ))}
                                            </select>
                                            <Input value={diaperSN} onChange={e => setDiaperSN(e.target.value)} placeholder="Or type serial number (e.g. SD-2026-0001)" className="h-7 text-xs font-mono bg-slate-50/50" />
                                        </div>
                                    ) : (
                                        <Input value={diaperSN} onChange={e => setDiaperSN(e.target.value)} placeholder="e.g. SD-2026-0001" className="h-8 text-xs font-mono bg-slate-50/50" />
                                    )}
                                </div>
                            )}

                            {(pairingType === 'both' || pairingType === 'vital') && (
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[10px] font-semibold text-slate-600">Vital Signs Device Serial Number</label>
                                        {pairMode === 'existing' && availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('VS-')).length > 0 && (
                                            <span className="text-[9px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-medium">
                                                {availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('VS-')).length} Available
                                            </span>
                                        )}
                                    </div>
                                    {pairMode === 'existing' && availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('VS-')).length > 0 ? (
                                        <div className="space-y-1">
                                            <select
                                                value={vitalSN}
                                                onChange={e => setVitalSN(e.target.value)}
                                                className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 font-mono cursor-pointer"
                                            >
                                                <option value="">-- Select Available Vital Signs Device --</option>
                                                {availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('VS-')).map(d => (
                                                    <option key={d.serial_number} value={d.serial_number}>
                                                        {d.serial_number} - AVAILABLE
                                                    </option>
                                                ))}
                                            </select>
                                            <Input value={vitalSN} onChange={e => setVitalSN(e.target.value)} placeholder="Or type serial number (e.g. VS-2026-0001)" className="h-7 text-xs font-mono bg-slate-50/50" />
                                        </div>
                                    ) : (
                                        <Input value={vitalSN} onChange={e => setVitalSN(e.target.value)} placeholder="e.g. VS-2026-0001" className="h-8 text-xs font-mono bg-slate-50/50" />
                                    )}
                                </div>
                            )}

                            <Button onClick={handlePairDevice} className="w-full h-8 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold cursor-pointer">
                                {pairMode === 'new' ? 'Register & Pair New Device' : 'Pair Existing Device'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* SVM Baseline Reset */}
                    <Card className="bg-white border-amber-200 border shadow-sm">
                        <CardHeader className="py-4">
                            <CardTitle className="text-slate-800 text-sm flex items-center gap-2"><RotateCcw className="w-4 h-4 text-amber-600" /> Reset SVM Learning Baseline</CardTitle>
                            <CardDescription className="text-[10px] text-slate-500">
                                Forces SVM algorithm to relearn patient's normal ranges. Validates device/patient existence.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Input value={resetPatientId} onChange={e => setResetPatientId(e.target.value)} placeholder="Patient ID (e.g. 5)" type="number" className="h-8 text-xs bg-slate-50/50" />
                            <Input value={resetDeviceSN} onChange={e => setResetDeviceSN(e.target.value)} placeholder="Device Serial Number (Optional, e.g. VS-2026-0001)" className="h-8 text-xs font-mono bg-slate-50/50" />
                            <Input value={resetReason} onChange={e => setResetReason(e.target.value)} placeholder="Clinical reason for reset (Required)" className="h-8 text-xs bg-slate-50/50" />
                            <Button onClick={handleResetBaseline} variant="outline" className="w-full h-8 border-amber-400 text-amber-700 hover:bg-amber-50 text-xs font-semibold cursor-pointer">
                                Reset Baseline
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>


        </div>
    );
}
