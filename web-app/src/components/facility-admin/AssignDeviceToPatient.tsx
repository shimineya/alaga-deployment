import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioReceiver, Loader2, CheckCircle2, PlusCircle, Database } from 'lucide-react';
import { toast } from 'sonner';

interface AvailableDevice {
    serial_number: string;
    device_name?: string;
    status: string;
}

export default function AssignDeviceToPatient() {
    const [patientName, setPatientName] = useState('');
    const [deviceMode, setDeviceMode] = useState<'new' | 'existing'>('new'); // 'new' | 'existing'
    const [assignmentOption, setAssignmentOption] = useState('partnered devices'); // 'partnered devices', 'smart diaper device only', 'vital signs device only'
    const [smartDiaperSn, setSmartDiaperSn] = useState('');
    const [vitalSignsSn, setVitalSignsSn] = useState('');
    const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>([]);
    const [isLoadingDevices, setIsLoadingDevices] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Fetch existing available devices
    const fetchAvailableDevices = async () => {
        setIsLoadingDevices(true);
        try {
            const token = localStorage.getItem('token');
            const apiBase = (import.meta as any).env?.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/caregiver/devices/available`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setAvailableDevices(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch available devices:', err);
        } finally {
            setIsLoadingDevices(false);
        }
    };

    useEffect(() => {
        fetchAvailableDevices();
    }, []);

    const diaperAvailableList = availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('SD-'));
    const vitalAvailableList = availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('VS-'));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientName.trim()) {
            toast.error('Patient name is required');
            return;
        }

        // Validate formats
        if (assignmentOption === 'partnered devices' || assignmentOption === 'smart diaper device only') {
            if (!smartDiaperSn.trim()) {
                toast.error('Smart Diaper Device serial number is required');
                return;
            }
            if (!smartDiaperSn.trim().toUpperCase().startsWith('SD-')) {
                toast.error('Smart Diaper Device must start with "SD-" (e.g. SD-2026-0001)');
                return;
            }
        }

        if (assignmentOption === 'partnered devices' || assignmentOption === 'vital signs device only') {
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
                    smartDiaperSn: (assignmentOption === 'partnered devices' || assignmentOption === 'smart diaper device only') ? smartDiaperSn.trim().toUpperCase() : null,
                    vitalSignsSn: (assignmentOption === 'partnered devices' || assignmentOption === 'vital signs device only') ? vitalSignsSn.trim().toUpperCase() : null,
                    registerNew: deviceMode === 'new'
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Devices assigned successfully.');
                setPatientName('');
                setSmartDiaperSn('');
                setVitalSignsSn('');
                fetchAvailableDevices();
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
                    Register a new hardware device or pair an existing registered device to a patient profile.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Mode Selection: Register New Device vs Pair Existing Device */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                        <Label className="text-xs font-semibold text-slate-700 block">Device Registration Mode</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label 
                                className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-all ${
                                    deviceMode === 'new' 
                                        ? 'bg-teal-50 border-teal-500 text-teal-900 font-medium' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <input 
                                    type="checkbox"
                                    name="deviceMode" 
                                    checked={deviceMode === 'new'} 
                                    onChange={() => {
                                        setDeviceMode('new');
                                        setSmartDiaperSn('');
                                        setVitalSignsSn('');
                                    }}
                                    className="accent-teal-600 cursor-pointer" 
                                />
                                <PlusCircle className="w-4 h-4 text-teal-600 shrink-0" />
                                <span className="text-xs">Register a new device to patient</span>
                            </label>

                            <label 
                                className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-all ${
                                    deviceMode === 'existing' 
                                        ? 'bg-teal-50 border-teal-500 text-teal-900 font-medium' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <input 
                                    type="checkbox"
                                    name="deviceMode" 
                                    checked={deviceMode === 'existing'} 
                                    onChange={() => {
                                        setDeviceMode('existing');
                                        setSmartDiaperSn('');
                                        setVitalSignsSn('');
                                        fetchAvailableDevices();
                                    }}
                                    className="accent-teal-600 cursor-pointer" 
                                />
                                <Database className="w-4 h-4 text-teal-600 shrink-0" />
                                <span className="text-xs">Register an existing device to a patient</span>
                            </label>
                        </div>
                    </div>

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
                            <option value="partnered devices">partnered devices</option>
                            <option value="smart diaper device only">smart diaper device only</option>
                            <option value="vital signs device only">vital signs device only</option>
                        </select>
                    </div>

                    {/* Smart Diaper Input */}
                    {(assignmentOption === 'partnered devices' || assignmentOption === 'smart diaper device only') && (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="diaper-sn" className="text-xs font-semibold text-slate-600">Smart Diaper Device Serial Number</Label>
                                {deviceMode === 'existing' && diaperAvailableList.length > 0 && (
                                    <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium">
                                        {diaperAvailableList.length} Available in Inventory
                                    </span>
                                )}
                            </div>

                            {deviceMode === 'existing' && diaperAvailableList.length > 0 ? (
                                <div className="space-y-1.5">
                                    <select
                                        value={smartDiaperSn}
                                        onChange={(e) => setSmartDiaperSn(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm font-mono cursor-pointer"
                                        required
                                    >
                                        <option value="">-- Select Available Smart Diaper Device --</option>
                                        {diaperAvailableList.map((d) => (
                                            <option key={d.serial_number} value={d.serial_number}>
                                                {d.serial_number} {d.device_name ? `(${d.device_name})` : ''} - AVAILABLE
                                            </option>
                                        ))}
                                    </select>
                                    <Input
                                        value={smartDiaperSn}
                                        onChange={(e) => setSmartDiaperSn(e.target.value)}
                                        placeholder="Or type serial number (e.g. SD-2026-0001)"
                                        className="h-8 text-xs font-mono"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <Input
                                        id="diaper-sn"
                                        value={smartDiaperSn}
                                        onChange={(e) => setSmartDiaperSn(e.target.value)}
                                        placeholder="e.g. SD-2026-0001"
                                        className="h-9 text-sm font-mono"
                                        required
                                    />
                                    {deviceMode === 'existing' && diaperAvailableList.length === 0 && !isLoadingDevices && (
                                        <p className="text-[10px] text-amber-600 mt-1">
                                            No unassigned diaper devices found in inventory. You can enter the serial number directly or switch to "Register a new device".
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Vital Signs Input */}
                    {(assignmentOption === 'partnered devices' || assignmentOption === 'vital signs device only') && (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="vitals-sn" className="text-xs font-semibold text-slate-600">Vital Signs Device Serial Number</Label>
                                {deviceMode === 'existing' && vitalAvailableList.length > 0 && (
                                    <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium">
                                        {vitalAvailableList.length} Available in Inventory
                                    </span>
                                )}
                            </div>

                            {deviceMode === 'existing' && vitalAvailableList.length > 0 ? (
                                <div className="space-y-1.5">
                                    <select
                                        value={vitalSignsSn}
                                        onChange={(e) => setVitalSignsSn(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm font-mono cursor-pointer"
                                        required
                                    >
                                        <option value="">-- Select Available Vital Signs Device --</option>
                                        {vitalAvailableList.map((d) => (
                                            <option key={d.serial_number} value={d.serial_number}>
                                                {d.serial_number} {d.device_name ? `(${d.device_name})` : ''} - AVAILABLE
                                            </option>
                                        ))}
                                    </select>
                                    <Input
                                        value={vitalSignsSn}
                                        onChange={(e) => setVitalSignsSn(e.target.value)}
                                        placeholder="Or type serial number (e.g. VS-2026-0001)"
                                        className="h-8 text-xs font-mono"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <Input
                                        id="vitals-sn"
                                        value={vitalSignsSn}
                                        onChange={(e) => setVitalSignsSn(e.target.value)}
                                        placeholder="e.g. VS-2026-0001"
                                        className="h-9 text-sm font-mono"
                                        required
                                    />
                                    {deviceMode === 'existing' && vitalAvailableList.length === 0 && !isLoadingDevices && (
                                        <p className="text-[10px] text-amber-600 mt-1">
                                            No unassigned vital signs devices found in inventory. You can enter the serial number directly or switch to "Register a new device".
                                        </p>
                                    )}
                                </div>
                            )}
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
                                    {deviceMode === 'new' ? 'Register & Assign New Device' : 'Assign Existing Device'}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
