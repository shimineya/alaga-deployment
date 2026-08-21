import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { UserPlus, Cpu, RotateCcw } from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

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
        if (data.success) { toast.success(data.message); setResetPatientId(''); setResetReason(''); }
        else toast.error(data.message);
    };

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-bold text-teal-900 tracking-tight">Patient Onboarding</h2>
                <p className="text-[10px] font-medium text-slate-500">Register new patients, pair devices, and manage SVM baselines within your facility.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Patient Registration */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-800 text-base flex items-center gap-2"><UserPlus className="w-4 h-4 text-teal-600" /> Register New Patient</CardTitle>
                        <CardDescription className="text-xs text-slate-500"></CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
                                <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className="h-8 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
                                <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className="h-8 text-sm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Age</label>
                                <Input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} className="h-8 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
                                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                    className="w-full h-8 text-sm border border-slate-200 rounded px-2 bg-white text-slate-700">
                                    <option>Male</option><option>Female</option><option>Other</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Diagnosis / Reason for Monitoring</label>
                            <Input value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        {/* [DPA] Visible consent checkbox */}
                        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <input type="checkbox" id="consent" checked={consentConfirmed} onChange={e => setConsentConfirmed(e.target.checked)}
                                className="mt-0.5 accent-teal-600" />
                            <label htmlFor="consent" className="text-xs text-blue-800 cursor-pointer">
                                I confirm that the patient or their legal guardian has provided informed consent for health data collection and processing, as required by the Data Privacy Act of 2012 (RA 10173), Section 13.
                            </label>
                        </div>
                        {lastCreatedId && (
                            <div className="text-xs bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-emerald-700">
                                Patient registered successfully. Patient ID: <strong>{lastCreatedId}</strong>. Use this ID below to pair a device.
                            </div>
                        )}
                        <Button onClick={handleRegister} disabled={submitting} className="w-full h-8 bg-teal-600 hover:bg-teal-700 text-white text-sm">
                            {submitting ? 'Registering...' : 'Register Patient'}
                        </Button>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    {/* Device Pairing */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-slate-800 text-sm flex items-center gap-2"><Cpu className="w-4 h-4 text-teal-600" /> Pair Device/s To Patient</CardTitle>
                            <CardDescription className="text-xs text-slate-500">The serial number must be pre-approved by System Admin in the Device Whitelist.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Patient ID</label>
                                <Input value={pairPatientId} onChange={e => setPairPatientId(e.target.value)} placeholder="e.g. 5" type="number" className="h-8 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Device Selection</label>
                                <select 
                                    value={pairingType} 
                                    onChange={e => setPairingType(e.target.value)}
                                    className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700"
                                >
                                    <option value="both">Both Devices</option>
                                    <option value="diaper">Smart Diaper Device only</option>
                                    <option value="vital">Vital Signs Device only</option>
                                </select>
                            </div>
                            
                            {(pairingType === 'both' || pairingType === 'diaper') && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Smart Diaper Device</label>
                                    <Input value={diaperSN} onChange={e => setDiaperSN(e.target.value)} placeholder="e.g. SD-2026-0001" className="h-8 text-sm font-mono" />
                                </div>
                            )}

                            {(pairingType === 'both' || pairingType === 'vital') && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Vital Signs Device</label>
                                    <Input value={vitalSN} onChange={e => setVitalSN(e.target.value)} placeholder="e.g. VS-2026-0001" className="h-8 text-sm font-mono" />
                                </div>
                            )}

                            <Button onClick={handlePairDevice} className="w-full h-8 bg-slate-700 hover:bg-slate-600 text-white text-sm">Pair Device/s</Button>
                        </CardContent>
                    </Card>

                    {/* SVM Baseline Reset */}
                    <Card className="bg-white border-amber-200 border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-slate-800 text-sm flex items-center gap-2"><RotateCcw className="w-4 h-4 text-amber-600" /> Reset SVM Learning Baseline</CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                                Tooltip: The SVM algorithm learns what is "normal" for each patient. Resetting the baseline forces it to relearn from scratch. Use this after a significant change in the patient's condition.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Input value={resetPatientId} onChange={e => setResetPatientId(e.target.value)} placeholder="Patient ID" type="number" className="h-8 text-sm" />
                            <Input value={resetReason} onChange={e => setResetReason(e.target.value)} placeholder="Clinical reason for reset" className="h-8 text-sm" />
                            <Button onClick={handleResetBaseline} variant="outline" className="w-full h-8 border-amber-400 text-amber-700 hover:bg-amber-50 text-sm">
                                Reset Baseline
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
