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
    const [serialNumber, setSerialNumber] = useState('');

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
        if (!pairPatientId || !serialNumber) return toast.error('Patient ID and serial number are required.');
        const res = await fetch(`${API}/patients/${pairPatientId}/pair-device`, {
            method: 'POST', headers: getAuth(),
            body: JSON.stringify({ serial_number: serialNumber })
        });
        const data = await res.json();
        if (data.success) { toast.success(data.message); setPairPatientId(''); setSerialNumber(''); }
        else toast.error(data.message);
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
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">Patient Onboarding</h2>
                <p className="text-slate-500 text-sm mt-1">Register new patients, pair devices, and manage SVM baselines within your facility.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Patient Registration */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-800 text-base flex items-center gap-2"><UserPlus className="w-4 h-4 text-teal-600" /> Register New Patient</CardTitle>
                        <CardDescription className="text-xs text-slate-500">DPA § 13: Informed consent must be collected before health data processing begins.</CardDescription>
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

                <div className="space-y-6">
                    {/* Device Pairing */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-slate-800 text-sm flex items-center gap-2"><Cpu className="w-4 h-4 text-teal-600" /> Pair ESP32 Device to Patient</CardTitle>
                            <CardDescription className="text-xs text-slate-500">The serial number must be pre-approved by System Admin in the Device Whitelist.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Input value={pairPatientId} onChange={e => setPairPatientId(e.target.value)} placeholder="Patient ID" type="number" className="h-8 text-sm" />
                            <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Device Serial Number (e.g. ALA-001)" className="h-8 text-sm font-mono" />
                            <Button onClick={handlePairDevice} className="w-full h-8 bg-slate-700 hover:bg-slate-600 text-white text-sm">Pair Device</Button>
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
