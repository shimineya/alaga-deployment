import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioReceiver, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AssignDeviceToPatient() {
    const [patientName, setPatientName] = useState('');
    const [assignmentOption, setAssignmentOption] = useState('both devices'); // 'both devices', 'smart diaper device only', 'vital signs device only'
    const [smartDiaperSn, setSmartDiaperSn] = useState('');
    const [vitalSignsSn, setVitalSignsSn] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientName.trim()) {
            toast.error('Patient name is required');
            return;
        }

        // Validate formats
        if (assignmentOption === 'both devices' || assignmentOption === 'smart diaper device only') {
            if (!smartDiaperSn.trim()) {
                toast.error('Smart Diaper Device serial number is required');
                return;
            }
            if (!smartDiaperSn.trim().toUpperCase().startsWith('SD-')) {
                toast.error('Smart Diaper Device must start with "SD-" (e.g. SD-2026-0001)');
                return;
            }
        }

        if (assignmentOption === 'both devices' || assignmentOption === 'vital signs device only') {
            if (!vitalSignsSn.trim()) {
                toast.error('Vital Signs Device serial number is required');
                return;
            }
            if (!vitalSignsSn.trim().toUpperCase().startsWith('VS-')) {
                toast.error('Vital Signs Device must start with "VS-" (e.g. VS-2026-0001)');
                return;
            }
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const apiBase = (import.meta as any).env?.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/caregiver/devices/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patientName: patientName.trim(),
                    smartDiaperSn: (assignmentOption === 'both devices' || assignmentOption === 'smart diaper device only') ? smartDiaperSn.trim().toUpperCase() : null,
                    vitalSignsSn: (assignmentOption === 'both devices' || assignmentOption === 'vital signs device only') ? vitalSignsSn.trim().toUpperCase() : null
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Devices assigned successfully.');
                setPatientName('');
                setSmartDiaperSn('');
                setVitalSignsSn('');
            } else {
                toast.error(data.message || 'Failed to assign devices.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error during device assignment.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card className="bg-white border-slate-200 shadow-sm max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                    <RadioReceiver className="w-4 h-4 text-teal-600 animate-pulse" />
                    Assign Device to Patient
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                    Map registered sensors and hardware transmitters to a registered patient's monitoring profile.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Patient Name */}
                    <div className="space-y-1">
                        <Label htmlFor="patient-name" className="text-xs font-semibold text-slate-600">Patient Name</Label>
                        <Input
                            id="patient-name"
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            placeholder="Enter Patient Full Name"
                            className="h-9 text-sm"
                            required
                        />
                    </div>

                    {/* Assignment Option Dropdown */}
                    <div className="space-y-1">
                        <Label htmlFor="assignment-option" className="text-xs font-semibold text-slate-600">Device Assignment Option</Label>
                        <select
                            id="assignment-option"
                            value={assignmentOption}
                            onChange={(e) => setAssignmentOption(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-600 focus-visible:border-teal-600 cursor-pointer"
                        >
                            <option value="both devices">both devices</option>
                            <option value="smart diaper device only">smart diaper device only</option>
                            <option value="vital signs device only">vital signs device only</option>
                        </select>
                    </div>

                    {/* Smart Diaper Input */}
                    {(assignmentOption === 'both devices' || assignmentOption === 'smart diaper device only') && (
                        <div className="space-y-1">
                            <Label htmlFor="diaper-sn" className="text-xs font-semibold text-slate-600">Smart Diaper Device</Label>
                            <Input
                                id="diaper-sn"
                                value={smartDiaperSn}
                                onChange={(e) => setSmartDiaperSn(e.target.value)}
                                placeholder="SD-2026-0001"
                                className="h-9 text-sm font-mono"
                                required
                            />
                        </div>
                    )}

                    {/* Vital Signs Input */}
                    {(assignmentOption === 'both devices' || assignmentOption === 'vital signs device only') && (
                        <div className="space-y-1">
                            <Label htmlFor="vitals-sn" className="text-xs font-semibold text-slate-600">Vital Signs Device</Label>
                            <Input
                                id="vitals-sn"
                                value={vitalSignsSn}
                                onChange={(e) => setVitalSignsSn(e.target.value)}
                                placeholder="VS-2026-0001"
                                className="h-9 text-sm font-mono"
                                required
                            />
                        </div>
                    )}

                    <div className="pt-2">
                        <Button 
                            type="submit" 
                            disabled={submitting} 
                            className="w-full h-9 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Assigning Devices...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Assign Devices
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
