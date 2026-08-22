import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle 
} from '../ui/dialog';
import { 
    Cpu, 
    Search, 
    RefreshCw, 
    Unlink, 
    Link, 
    Building, 
    User, 
    Clock,
    X,
    CheckCircle
} from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface DeviceAssignment {
    serial_number: string;
    device_name: string;
    status: string;
    patient_id: number;
    patient_name: string;
    facility_name: string | null;
    assigned_by_username: string | null;
}

interface UnassignedDevice {
    serial_number: string;
    device_name: string;
    status: string;
    facility_name: string | null;
    added_by_username: string | null;
    created_at: string;
}

interface PatientOption {
    patient_id: number;
    name: string;
    birthdate: string;
}

export default function SystemAdminDeviceAssignment() {
    const { token } = useAuth();
    
    // Lists
    const [assignments, setAssignments] = useState<DeviceAssignment[]>([]);
    const [unassignedList, setUnassignedList] = useState<UnassignedDevice[]>([]);
    const [patients, setPatients] = useState<PatientOption[]>([]);
    
    // UI states
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Assignment Form states
    const [selectedDeviceSn, setSelectedDeviceSn] = useState<string | null>(null);
    const [patientSearch, setPatientSearch] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/device-assignments`, { headers: getAuth() });
            const data = await res.json();
            if (data.success && data.data) {
                setAssignments(data.data.assignments || []);
                setUnassignedList(data.data.unassigned || []);
                setPatients(data.data.patients || []);
            }
        } catch {
            toast.error('Failed to load system device assignments data.');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenLinkModal = (sn: string) => {
        setSelectedDeviceSn(sn);
        setPatientSearch('');
        setSelectedPatientId(null);
    };

    const handleUnlink = async (sn: string) => {
        if (!window.confirm(`Are you sure you want to unassign/unlink device ${sn}?`)) return;
        try {
            const res = await fetch(`${API}/devices/unlink`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({ serial_number: sn })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Device unassigned successfully.');
                fetchData();
            } else {
                toast.error(data.message || 'Failed to unassign device.');
            }
        } catch {
            toast.error('Server error unassigning device.');
        }
    };

    const handleSaveLink = async () => {
        if (!selectedDeviceSn || !selectedPatientId) {
            toast.error('Please select a patient to link the device to.');
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch(`${API}/devices/link`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({
                    patient_id: selectedPatientId,
                    serial_number: selectedDeviceSn
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Device linked successfully.');
                setSelectedDeviceSn(null);
                fetchData();
            } else {
                toast.error(data.message || 'Failed to link device.');
            }
        } catch {
            toast.error('Server error linking device.');
        } finally {
            setIsSaving(false);
        }
    };

    // Patient autosuggestion filtering
    const patientSuggestions = patientSearch.trim() === ''
        ? []
        : patients.filter(p => 
            p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
            p.patient_id.toString().includes(patientSearch)
          ).slice(0, 5);

    // Search filter for Current Assignments
    const filteredAssignments = assignments.filter(a => {
        const query = searchQuery.toLowerCase();
        return a.patient_name.toLowerCase().includes(query) ||
               a.serial_number.toLowerCase().includes(query) ||
               (a.device_name || '').toLowerCase().includes(query) ||
               (a.facility_name || '').toLowerCase().includes(query);
    });

    // Search filter for Unassigned Devices
    const filteredUnassigned = unassignedList.filter(u => {
        const query = searchQuery.toLowerCase();
        return u.serial_number.toLowerCase().includes(query) ||
               (u.device_name || '').toLowerCase().includes(query) ||
               (u.facility_name || '').toLowerCase().includes(query);
    });

    return (
        <div className="space-y-6 flex flex-col min-h-0">
            {/* Header section with Filter controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-teal-600 animate-pulse" />
                        System Device Assignment Control
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium">
                        Assign, unassign, and manage logical device linkages to patients globally across all users and facilities.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-60">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                            placeholder="Filter devices or patients..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-white border-slate-200 rounded-lg"
                        />
                    </div>
                    <Button size="sm" variant="outline" onClick={fetchData} disabled={isLoading} className="h-8 gap-1 bg-white cursor-pointer shrink-0">
                        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Current Assignments Card */}
            <Card className="border-slate-200 shadow-sm flex flex-col min-h-[300px]">
                <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
                    <div>
                        <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            Current Device Assignments
                        </CardTitle>
                        <CardDescription className="text-[9px] text-slate-400">Devices currently paired to patient monitoring profiles.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto">
                    {filteredAssignments.length === 0 ? (
                        <div className="text-center py-12 italic text-slate-400 text-xs">No active assignments found.</div>
                    ) : (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-10">
                                <tr>
                                    <th className="p-3">Patient</th>
                                    <th className="p-3">Linked Device</th>
                                    <th className="p-3">Facility Location</th>
                                    <th className="p-3">Connection Status</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAssignments.map((a) => {
                                    const isOnline = a.status === 'ACTIVE';
                                    return (
                                        <tr key={a.serial_number} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-slate-400" />
                                                    <div>
                                                        <span className="font-bold text-slate-800 block">{a.patient_name}</span>
                                                        <span className="text-[9px] text-slate-400 block font-medium">ID: #{a.patient_id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-mono font-bold text-slate-700">{a.serial_number}</div>
                                                <div className="text-[9px] text-slate-400 font-medium leading-none">{a.device_name}</div>
                                            </td>
                                            <td className="p-3 font-semibold text-teal-800">
                                                <span className="flex items-center gap-1">
                                                    <Building className="w-3.5 h-3.5 text-slate-400" />
                                                    {a.facility_name || 'Global / Direct'}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <Badge className={`border-none font-bold text-[8px] px-1.5 py-0.5 h-5 ${
                                                    isOnline 
                                                        ? 'bg-emerald-50 text-emerald-700' 
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {isOnline ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => handleOpenLinkModal(a.serial_number)} className="h-7 text-[10px] gap-1 cursor-pointer">
                                                        <Link className="w-3 h-3" /> Reassign
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleUnlink(a.serial_number)} className="h-7 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 cursor-pointer">
                                                        <Unlink className="w-3 h-3" /> Unassign
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {/* Unassigned Devices Card */}
            <Card className="border-slate-200 shadow-sm flex flex-col min-h-[250px]">
                <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
                    <div>
                        <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-slate-500" />
                            Unassigned Devices
                        </CardTitle>
                        <CardDescription className="text-[9px] text-slate-400">Available hardware components not linked to any active patient profile.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto">
                    {filteredUnassigned.length === 0 ? (
                        <div className="text-center py-12 italic text-slate-400 text-xs">No unassigned devices whitelisted.</div>
                    ) : (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-10">
                                <tr>
                                    <th className="p-3">Device Serial</th>
                                    <th className="p-3">Device Name</th>
                                    <th className="p-3">Facility</th>
                                    <th className="p-3">Added By</th>
                                    <th className="p-3">Added Date</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUnassigned.map((u) => (
                                    <tr key={u.serial_number} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-3 font-mono font-bold text-slate-700">{u.serial_number}</td>
                                        <td className="p-3 font-semibold text-slate-800">{u.device_name}</td>
                                        <td className="p-3 text-slate-600">
                                            <span className="flex items-center gap-1">
                                                <Building className="w-3.5 h-3.5 text-slate-400" />
                                                {u.facility_name || 'Global / Direct'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-500 font-medium">@{u.added_by_username || 'System'}</td>
                                        <td className="p-3 text-slate-400 font-mono text-[10px]">{u.created_at}</td>
                                        <td className="p-3 text-right">
                                            <Button size="sm" onClick={() => handleOpenLinkModal(u.serial_number)} className="h-7 text-[10px] bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1 cursor-pointer">
                                                <Link className="w-3 h-3" /> Assign to Patient
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {/* DEVICE ASSIGNMENT LINK DIALOG */}
            {selectedDeviceSn && (
                <Dialog open={true} onOpenChange={() => setSelectedDeviceSn(null)}>
                    <DialogContent className="bg-white">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800">Assign Device to Patient Profile</DialogTitle>
                            <DialogDescription className="text-xs">
                                Establish logical linkage for device serial number <strong className="font-mono">{selectedDeviceSn}</strong>.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2 text-xs relative">
                            {/* Patient Search Input */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-700">Search Patient (Autosuggestion)</label>
                                <div className="relative">
                                    <Input
                                        placeholder="Type patient name or ID..."
                                        value={patientSearch}
                                        onChange={(e) => {
                                            setPatientSearch(e.target.value);
                                            setSelectedPatientId(null); // Reset selection on change
                                        }}
                                        className="h-9 text-xs"
                                    />
                                    {selectedPatientId && (
                                        <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-emerald-600 font-bold text-[10px] flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded">
                                            Selected
                                        </div>
                                    )}
                                </div>
                                
                                {/* Autosuggest Dropdown List */}
                                {patientSuggestions.length > 0 && !selectedPatientId && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                        {patientSuggestions.map(p => (
                                            <div
                                                key={p.patient_id}
                                                onClick={() => {
                                                    setSelectedPatientId(p.patient_id);
                                                    setPatientSearch(p.name);
                                                }}
                                                className="p-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex justify-between items-center text-xs"
                                            >
                                                <div>
                                                    <span className="font-bold text-slate-800">{p.name}</span>
                                                    <span className="text-[10px] text-slate-400 block font-medium">DOB: {new Date(p.birthdate).toLocaleDateString()}</span>
                                                </div>
                                                <Badge className="bg-slate-100 text-slate-600 border-none font-semibold text-[8px] h-4">
                                                    ID #{p.patient_id}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 border-t flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedDeviceSn(null)} className="h-8 text-xs">Cancel</Button>
                                <Button 
                                    onClick={handleSaveLink} 
                                    disabled={isSaving || !selectedPatientId} 
                                    className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                                >
                                    {isSaving ? 'Linking...' : 'Confirm Linkage'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
