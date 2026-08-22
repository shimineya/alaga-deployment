import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { UserPlus, Cpu, RotateCcw, Search, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';

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
    // Patient form state
    const [form, setForm] = useState({ first_name: '', last_name: '', age: '', gender: 'Male', diagnosis: '' });
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

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    const handleRegister = async () => {
        if (!form.first_name || !form.last_name || !form.age || !form.diagnosis) {
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
                setForm({ first_name: '', last_name: '', age: '', gender: 'Male', diagnosis: '' });
                setConsentConfirmed(false);
                fetchPatients();
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

    // Filter logic
    const filteredPatients = patients.filter(p => {
        const query = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(query) ||
               (p.baseline_data?.diagnosis || '').toLowerCase().includes(query) ||
               p.patient_id.toString().includes(query);
    });

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

            {/* Scoped Patient List Table */}
            <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
                <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    <div>
                        <CardTitle className="text-sm font-bold text-slate-800">
                            Patients Registered and Assigned
                        </CardTitle>
                        <CardDescription className="text-[10px] text-slate-400">
                            Patients you added that are assigned to caregivers, or patients assigned to users you gave accounts to.
                        </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                            placeholder="Search patients..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 rounded-lg"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto min-h-0">
                    {filteredPatients.length === 0 ? (
                        <div className="text-center py-12 italic text-slate-400 text-xs">
                            {isLoading ? 'Loading patient list...' : 'No scoped patients found.'}
                        </div>
                    ) : (
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                                        <th className="p-3">Patient ID</th>
                                        <th className="p-3">Name</th>
                                        <th className="p-3">Gender</th>
                                        <th className="p-3">Diagnosis</th>
                                        <th className="p-3">Paired Device(s)</th>
                                        <th className="p-3">Assigned Caregivers / Staff</th>
                                        <th className="p-3">Created At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPatients.map((pat) => (
                                        <tr key={pat.patient_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 font-mono font-semibold text-slate-700">#{pat.patient_id}</td>
                                            <td className="p-3 font-bold text-slate-800">{pat.name}</td>
                                            <td className="p-3 text-slate-600">{pat.baseline_data?.gender || 'N/A'}</td>
                                            <td className="p-3 text-slate-600 max-w-xs truncate" title={pat.baseline_data?.diagnosis || ''}>
                                                {pat.baseline_data?.diagnosis || 'N/A'}
                                            </td>
                                            <td className="p-3">
                                                {pat.paired_devices.length === 0 ? (
                                                    <span className="text-[10px] text-slate-400 italic">None</span>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        {pat.paired_devices.map(dev => (
                                                            <div key={dev.serial_number} className="flex items-center gap-1.5">
                                                                <Badge className="bg-teal-50 text-teal-700 border-none font-normal text-[8px] hover:bg-teal-100 px-1 py-0 h-4">
                                                                    {dev.serial_number}
                                                                </Badge>
                                                                <span className="text-[9px] text-slate-400">({dev.device_name || 'Device'})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                {pat.assigned_users.length === 0 ? (
                                                    <span className="text-[10px] text-slate-400 italic">None</span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5 max-w-sm">
                                                        {pat.assigned_users.map(u => (
                                                            <Badge key={u.user_id} className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none font-medium text-[9px] py-0 h-5 flex items-center gap-1 px-1.5">
                                                                <span>{u.first_name} {u.last_name}</span>
                                                                <span className="text-slate-400">({u.relationship})</span>
                                                                {u.invite_status === 'Pending' && (
                                                                    <span className="text-amber-600 font-bold ml-1 text-[8px] animate-pulse">Pending</span>
                                                                )}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-slate-400 font-mono text-[10px]">{pat.created_at}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
