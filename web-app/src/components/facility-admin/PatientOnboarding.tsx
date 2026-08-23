import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { UserPlus, Cpu, RotateCcw, Search, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useAuth } from '@/lib/auth-context';

const API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
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

    // Patient form state
    const [form, setForm] = useState({ first_name: '', last_name: '', age: '', gender: 'Male', diagnosis: '', ward: '', room: '', bed: '' });
    const [consentConfirmed, setConsentConfirmed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lastCreatedId, setLastCreatedId] = useState<number | null>(null);

    // Device pairing state
    const [pairPatientId, setPairPatientId] = useState('');
    const [pairingType, setPairingType] = useState('both'); // 'both' | 'diaper' | 'vital'
    const [diaperSN, setDiaperSN] = useState('');
    const [vitalSN, setVitalSN] = useState('');

    // SVM reset state
    const [resetPatientId, setResetPatientId] = useState('');
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
        if (!form.first_name || !form.last_name || !form.age || !form.diagnosis || !form.room || !form.bed) {
            return toast.error('All fields are required.');
        }
        if (!consentConfirmed) {
            return toast.error('Informed consent must be confirmed before registering a patient. (DPA § 13)');
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/patients`, {
                method: 'POST', headers: getAuth(),
                body: JSON.stringify({ ...form, age: parseInt(form.age), consent_confirmed: true })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setLastCreatedId(data.patient_id);
                setForm({ first_name: '', last_name: '', age: '', gender: 'Male', diagnosis: '', ward: '', room: '', bed: '' });
                setConsentConfirmed(false);
                fetchPatients();
                fetchUnassignedPatients();
            } else toast.error(data.message);
        } catch { toast.error('Registration failed.'); }
        finally { setSubmitting(false); }
    };

    const handlePairDevice = async () => {
        if (!pairPatientId) return toast.error('Patient ID is required.');
        
        let diaperToPair = '';
        let vitalToPair = '';

        if (pairingType === 'both' || pairingType === 'diaper') {
            diaperToPair = diaperSN.trim();
            if (!diaperToPair) return toast.error('Smart Diaper Device serial number is required.');
        }
        if (pairingType === 'both' || pairingType === 'vital') {
            vitalToPair = vitalSN.trim();
            if (!vitalToPair) return toast.error('Vital Signs Device serial number is required.');
        }

        try {
            // Function to pair a single device
            const pairOne = async (sn: string, label: string) => {
                const res = await fetch(`${API}/patients/${pairPatientId}/pair-device`, {
                    method: 'POST', 
                    headers: getAuth(),
                    body: JSON.stringify({ serial_number: sn })
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

            toast.success('Device(s) paired successfully.');
            setPairPatientId('');
            setDiaperSN('');
            setVitalSN('');
            fetchPatients();
            fetchUnassignedPatients();
        } catch (err: any) {
            toast.error(err.message || 'Device pairing failed.');
        }
    };

    const handleResetBaseline = async () => {
        if (!resetPatientId) return toast.error('Patient ID is required.');
        const res = await fetch(`${API}/patients/${resetPatientId}/reset-baseline`, {
            method: 'POST', headers: getAuth(),
            body: JSON.stringify({ reason: resetReason })
        });
        const data = await res.json();
        if (data.success) { 
            toast.success(data.message); 
            setResetPatientId(''); 
            setResetReason(''); 
            fetchPatients();
        } else toast.error(data.message);
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
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">First Name</label>
                                <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className="h-8 text-xs bg-slate-50/50" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Last Name</label>
                                <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className="h-8 text-xs bg-slate-50/50" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Age</label>
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
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Diagnosis / Reason for Monitoring</label>
                            <Input value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} className="h-8 text-xs bg-slate-50/50" />
                        </div>
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
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Room Name</label>
                                        <Input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} className="h-8 text-xs bg-slate-50/50" placeholder="e.g. Room 101" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Bed Name</label>
                                        <Input value={form.bed} onChange={e => setForm(f => ({ ...f, bed: e.target.value }))} className="h-8 text-xs bg-slate-50/50" placeholder="e.g. Bed 1" />
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
                                    <option value="both">Both Devices</option>
                                    <option value="diaper">Smart Diaper Device only</option>
                                    <option value="vital">Vital Signs Device only</option>
                                </select>
                            </div>
                            
                            {(pairingType === 'both' || pairingType === 'diaper') && (
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Smart Diaper Device</label>
                                    <Input value={diaperSN} onChange={e => setDiaperSN(e.target.value)} placeholder="e.g. SD-2026-0001" className="h-8 text-xs font-mono bg-slate-50/50" />
                                </div>
                            )}

                            {(pairingType === 'both' || pairingType === 'vital') && (
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Vital Signs Device</label>
                                    <Input value={vitalSN} onChange={e => setVitalSN(e.target.value)} placeholder="e.g. VS-2026-0001" className="h-8 text-xs font-mono bg-slate-50/50" />
                                </div>
                            )}

                            <Button onClick={handlePairDevice} className="w-full h-8 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold cursor-pointer">Pair Device/s</Button>
                        </CardContent>
                    </Card>

                    {/* SVM Baseline Reset */}
                    <Card className="bg-white border-amber-200 border shadow-sm">
                        <CardHeader className="py-4">
                            <CardTitle className="text-slate-800 text-sm flex items-center gap-2"><RotateCcw className="w-4 h-4 text-amber-600" /> Reset SVM Learning Baseline</CardTitle>
                            <CardDescription className="text-[10px] text-slate-500">
                                Forces SVM algorithm to relearn patient's normal ranges.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Input value={resetPatientId} onChange={e => setResetPatientId(e.target.value)} placeholder="Patient ID" type="number" className="h-8 text-xs bg-slate-50/50" />
                            <Input value={resetReason} onChange={e => setResetReason(e.target.value)} placeholder="Clinical reason for reset" className="h-8 text-xs bg-slate-50/50" />
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
