import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, UserPlus, Trash2, Edit, Check, ShieldAlert, Users, Layers, Mail, Calendar, UserCheck } from 'lucide-react';
import { Badge } from '../ui/badge';

interface ScopedPatient {
    patient_id: number;
    name: string;
    birthdate: string;
    baseline_data: {
        gender?: string;
        diagnosis?: string;
        ward?: string;
        room?: string;
        bed?: string;
    };
    created_at: string;
    facility_name: string | null;
    device_serial_number: string | null;
    paired_devices: {
        serial_number: string;
        device_name: string;
        status: string;
    }[];
    assigned_users?: {
        user_id: number;
        username: string;
        first_name: string;
        last_name: string;
        email: string;
        role: string;
        relationship: string;
        invite_status: string;
    }[];
    assigned_staff?: {
        username: string;
        name: string;
        role: string;
    }[];
}

interface Props {
    mode?: 'assigned' | 'unassigned';
}

export default function SystemAdminPatientDirectory({ mode }: Props) {
    const [localActiveTab, setLocalActiveTab] = useState<'assigned' | 'unassigned'>('assigned');
    const activeTab = mode || localActiveTab;
    const setActiveTab = setLocalActiveTab;
    const [assignedPatients, setAssignedPatients] = useState<ScopedPatient[]>([]);
    const [unassignedPatients, setUnassignedPatients] = useState<ScopedPatient[]>([]);
    
    // Search states
    const [assignedSearch, setAssignedSearch] = useState('');
    const [assignedSuggestions, setAssignedSuggestions] = useState<string[]>([]);
    const [showAssignedSuggestions, setShowAssignedSuggestions] = useState(false);
    
    const [unassignedSearch, setUnassignedSearch] = useState('');
    const [unassignedSuggestions, setUnassignedSuggestions] = useState<string[]>([]);
    const [showUnassignedSuggestions, setShowUnassignedSuggestions] = useState(false);

    // Edit Patient Profile modal state
    const [editingPatient, setEditingPatient] = useState<ScopedPatient | null>(null);
    const [editForm, setEditForm] = useState({ name: '', gender: 'Male', diagnosis: '', ward: '', room: '', bed: '' });

    // Assign staff by email state
    const [assigningEmails, setAssigningEmails] = useState<{ [patientId: number]: string }>({});

    const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
    const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

    // Fetch Lists
    const fetchAssigned = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/patients-added-and-assigned`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                setAssignedPatients(data.data);
            }
        } catch {
            toast.error("Failed to load assigned patients");
        }
    }, [API_BASE]);

    const fetchUnassigned = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/unassigned-patients`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                setUnassignedPatients(data.data);
            }
        } catch {
            toast.error("Failed to load unassigned patients");
        }
    }, [API_BASE]);

    useEffect(() => {
        fetchAssigned();
        fetchUnassigned();
    }, [fetchAssigned, fetchUnassigned]);

    // Handle Autosuggest Lists
    useEffect(() => {
        if (!assignedSearch.trim()) {
            setAssignedSuggestions([]);
            return;
        }
        const matches = assignedPatients
            .filter(p => p.name.toLowerCase().includes(assignedSearch.toLowerCase()))
            .map(p => p.name)
            .slice(0, 5);
        setAssignedSuggestions(Array.from(new Set(matches)));
    }, [assignedSearch, assignedPatients]);

    useEffect(() => {
        if (!unassignedSearch.trim()) {
            setUnassignedSuggestions([]);
            return;
        }
        const matches = unassignedPatients
            .filter(p => p.name.toLowerCase().includes(unassignedSearch.toLowerCase()))
            .map(p => p.name)
            .slice(0, 5);
        setUnassignedSuggestions(Array.from(new Set(matches)));
    }, [unassignedSearch, unassignedPatients]);

    // Assign Caregiver / Staff by Email
    const handleAssignStaff = async (patientId: number) => {
        const email = assigningEmails[patientId]?.trim();
        if (!email) return toast.error("Please enter a caregiver or staff email address");

        try {
            const res = await fetch(`${API_BASE}/patients/${patientId}/assign-staff-by-email`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Staff member assigned successfully!");
                setAssigningEmails(prev => ({ ...prev, [patientId]: '' }));
                fetchAssigned();
                fetchUnassigned();
            } else {
                toast.error(data.message || "Failed to assign staff member");
            }
        } catch {
            toast.error("Network error during assignment");
        }
    };

    // Edit Patient Profile
    const handleStartEdit = (patient: ScopedPatient) => {
        setEditingPatient(patient);
        setEditForm({
            name: patient.name,
            gender: patient.baseline_data?.gender || 'Male',
            diagnosis: patient.baseline_data?.diagnosis || '',
            ward: patient.baseline_data?.ward || '',
            room: patient.baseline_data?.room || '',
            bed: patient.baseline_data?.bed || ''
        });
    };

    const handleUpdatePatient = async () => {
        if (!editingPatient) return;
        if (!editForm.name.trim()) return toast.error("Name is required");
        if (!editForm.room.trim() || !editForm.bed.trim()) return toast.error("Room name and Bed name are required");

        try {
            const res = await fetch(`${API_BASE}/patients/${editingPatient.patient_id}`, {
                method: 'PUT',
                headers: getAuth(),
                body: JSON.stringify(editForm)
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Patient profile updated successfully!");
                setEditingPatient(null);
                fetchAssigned();
                fetchUnassigned();
            } else {
                toast.error(data.message || "Failed to update patient");
            }
        } catch {
            toast.error("Failed to update patient profile");
        }
    };

    // Soft-delete/Archive Patient
    const handleArchivePatient = async (patientId: number) => {
        if (!confirm("Are you sure you want to archive this patient? Doing so will automatically unpair all active sensors.")) return;

        try {
            const res = await fetch(`${API_BASE}/patients/${patientId}`, {
                method: 'DELETE',
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Patient archived successfully!");
                fetchAssigned();
                fetchUnassigned();
            } else {
                toast.error(data.message || "Failed to archive patient");
            }
        } catch {
            toast.error("Failed to archive patient");
        }
    };

    // Filters
    const filteredAssigned = assignedPatients.filter(p => {
        const query = assignedSearch.toLowerCase();
        return (
            p.name.toLowerCase().includes(query) ||
            p.patient_id.toString().includes(query) ||
            (p.baseline_data?.diagnosis || '').toLowerCase().includes(query) ||
            (p.facility_name || '').toLowerCase().includes(query)
        );
    });

    const filteredUnassigned = unassignedPatients.filter(p => {
        const query = unassignedSearch.toLowerCase();
        return (
            p.name.toLowerCase().includes(query) ||
            p.patient_id.toString().includes(query) ||
            (p.baseline_data?.diagnosis || '').toLowerCase().includes(query) ||
            (p.facility_name || '').toLowerCase().includes(query)
        );
    });

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-6">
            <Tabs value={activeTab} onValueChange={(val) => !mode && setActiveTab(val as any)} className="w-full flex-1 flex flex-col min-h-0">
                {!mode && (
                    <div className="border-b border-slate-200 mb-6 flex justify-between items-center shrink-0">
                        <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start">
                            <TabsTrigger 
                                value="assigned" 
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                            >
                                <UserCheck className="w-4 h-4" /> Patients Registered and Assigned
                            </TabsTrigger>
                            <TabsTrigger 
                                value="unassigned" 
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                            >
                                <Users className="w-4 h-4" /> Unassigned Patients
                            </TabsTrigger>
                        </TabsList>
                    </div>
                )}

                {/* --- TAB 1: ASSIGNED PATIENTS --- */}
                <TabsContent value="assigned" className="mt-0 flex-1 flex flex-col min-h-0 outline-none">
                    <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-0 bg-white">
                        <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                            <div>
                                <CardTitle className="text-sm font-bold text-slate-800">
                                    Patients Directory
                                </CardTitle>
                                <CardDescription className="text-[10px] text-slate-400">
                                    Browse all registered patients and active caregivers across the entire database.
                                </CardDescription>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input
                                    placeholder="Search patients..."
                                    value={assignedSearch}
                                    onChange={(e) => {
                                        setAssignedSearch(e.target.value);
                                        setShowAssignedSuggestions(true);
                                    }}
                                    onFocus={() => setShowAssignedSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowAssignedSuggestions(false), 200)}
                                    className="pl-9 h-8 text-xs border-slate-200 bg-slate-50/50 focus:bg-white transition-all rounded-lg"
                                />
                                {showAssignedSuggestions && assignedSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                                        {assignedSuggestions.map((name, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setAssignedSearch(name);
                                                    setShowAssignedSuggestions(false);
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-600 transition-colors"
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-auto">
                            {filteredAssigned.length === 0 ? (
                                <div className="py-16 text-center">
                                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs font-semibold text-slate-500">No patients found</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Try matching name, diagnosis, or facility name.</p>
                                </div>
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <div className="overflow-hidden">
                                        <table className="min-w-full divide-y divide-slate-100 text-left">
                                            <thead className="bg-slate-50/70 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-4 py-3">Facility</th>
                                                    <th className="px-4 py-3">Patient ID</th>
                                                    <th className="px-4 py-3">Name</th>
                                                    <th className="px-4 py-3">Gender</th>
                                                    <th className="px-4 py-3">Diagnosis</th>
                                                    <th className="px-4 py-3">Location (Ward/Room/Bed)</th>
                                                    <th className="px-4 py-3">Paired Device(s)</th>
                                                    <th className="px-4 py-3">Assigned Caregivers</th>
                                                    <th className="px-4 py-3">Created At</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
                                                {filteredAssigned.map((p) => (
                                                    <tr key={p.patient_id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-slate-800">
                                                            {p.facility_name || <span className="text-slate-400 italic">n/a</span>}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono font-bold text-slate-500">
                                                            #{p.patient_id}
                                                        </td>
                                                        <td className="px-4 py-3 font-bold text-slate-900">
                                                            {p.name}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Badge className="bg-slate-100 text-slate-800 border-none font-semibold text-[10px]">
                                                                {p.baseline_data?.gender || 'Male'}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3 max-w-[150px] truncate" title={p.baseline_data?.diagnosis}>
                                                            {p.baseline_data?.diagnosis || 'N/A'}
                                                        </td>
                                                        <td className="px-4 py-3 font-semibold">
                                                            {p.baseline_data?.room ? (
                                                                <span>
                                                                    {p.baseline_data.ward ? `${p.baseline_data.ward} - ` : ''}
                                                                    {p.baseline_data.room} (Bed {p.baseline_data.bed})
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 italic">None</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-1">
                                                                {p.paired_devices && p.paired_devices.length > 0 ? (
                                                                    p.paired_devices.map((dev, i) => (
                                                                        <Badge key={i} className="bg-teal-50 text-teal-700 border-teal-200/50 font-semibold font-mono text-[9px] w-max">
                                                                            {dev.serial_number}
                                                                        </Badge>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400">None paired</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-1 max-w-[160px]">
                                                                {p.assigned_users && p.assigned_users.length > 0 ? (
                                                                    p.assigned_users.map((u, i) => (
                                                                        <div key={i} className="text-[10px] truncate">
                                                                            <span className="font-semibold text-slate-800">{u.first_name} {u.last_name}</span>{" "}
                                                                            <span className="text-slate-400">({u.role === 'caregiver' ? 'CG' : 'Staff'})</span>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400">No staff assigned</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                                                            {new Date(p.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end gap-1.5">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleStartEdit(p)}
                                                                    className="w-7 h-7 border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                                                                >
                                                                    <Edit className="w-3.5 h-3.5 text-slate-500" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleArchivePatient(p.patient_id)}
                                                                    className="w-7 h-7 border-slate-200 hover:border-red-300 hover:bg-red-50 cursor-pointer"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-600" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- TAB 2: UNASSIGNED PATIENTS --- */}
                <TabsContent value="unassigned" className="mt-0 flex-1 flex flex-col min-h-0 outline-none">
                    <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-0 bg-white">
                        <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                            <div>
                                <CardTitle className="text-sm font-bold text-slate-800">
                                    Unassigned Patients
                                </CardTitle>
                                <CardDescription className="text-[10px] text-slate-400">
                                    Browse patients with no assigned staff and directly assign caregiver email addresses.
                                </CardDescription>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input
                                    placeholder="Search unassigned..."
                                    value={unassignedSearch}
                                    onChange={(e) => {
                                        setUnassignedSearch(e.target.value);
                                        setShowUnassignedSuggestions(true);
                                    }}
                                    onFocus={() => setShowUnassignedSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowUnassignedSuggestions(false), 200)}
                                    className="pl-9 h-8 text-xs border-slate-200 bg-slate-50/50 focus:bg-white transition-all rounded-lg"
                                />
                                {showUnassignedSuggestions && unassignedSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                                        {unassignedSuggestions.map((name, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setUnassignedSearch(name);
                                                    setShowUnassignedSuggestions(false);
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-600 transition-colors"
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-auto">
                            {filteredUnassigned.length === 0 ? (
                                <div className="py-16 text-center">
                                    <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs font-semibold text-slate-500">No unassigned patients found</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Try matching name, diagnosis, or facility name.</p>
                                </div>
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <div className="overflow-hidden">
                                        <table className="min-w-full divide-y divide-slate-100 text-left">
                                            <thead className="bg-slate-50/70 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-4 py-3">Facility</th>
                                                    <th className="px-4 py-3">Patient ID</th>
                                                    <th className="px-4 py-3">Name</th>
                                                    <th className="px-4 py-3">Gender</th>
                                                    <th className="px-4 py-3">Diagnosis</th>
                                                    <th className="px-4 py-3">Location (Ward/Room/Bed)</th>
                                                    <th className="px-4 py-3">Paired Device(s)</th>
                                                    <th className="px-4 py-3 min-w-[200px]">Assign Caregiver / Staff</th>
                                                    <th className="px-4 py-3">Created At</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
                                                {filteredUnassigned.map((p) => (
                                                    <tr key={p.patient_id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-slate-800">
                                                            {p.facility_name || <span className="text-slate-400 italic">n/a</span>}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono font-bold text-slate-500">
                                                            #{p.patient_id}
                                                        </td>
                                                        <td className="px-4 py-3 font-bold text-slate-900">
                                                            {p.name}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Badge className="bg-slate-100 text-slate-800 border-none font-semibold text-[10px]">
                                                                {p.baseline_data?.gender || 'Male'}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3 max-w-[150px] truncate" title={p.baseline_data?.diagnosis}>
                                                            {p.baseline_data?.diagnosis || 'N/A'}
                                                        </td>
                                                        <td className="px-4 py-3 font-semibold">
                                                            {p.baseline_data?.room ? (
                                                                <span>
                                                                    {p.baseline_data.ward ? `${p.baseline_data.ward} - ` : ''}
                                                                    {p.baseline_data.room} (Bed {p.baseline_data.bed})
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 italic">None</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-1">
                                                                {p.paired_devices && p.paired_devices.length > 0 ? (
                                                                    p.paired_devices.map((dev, i) => (
                                                                        <Badge key={i} className="bg-teal-50 text-teal-700 border-teal-200/50 font-semibold font-mono text-[9px] w-max">
                                                                            {dev.serial_number}
                                                                        </Badge>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400">None paired</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <Input
                                                                    placeholder="staff-email@alaga.local"
                                                                    value={assigningEmails[p.patient_id] || ''}
                                                                    onChange={(e) => setAssigningEmails(prev => ({ ...prev, [p.patient_id]: e.target.value }))}
                                                                    className="h-7 text-[10px] border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-300 transition-colors w-40"
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleAssignStaff(p.patient_id)}
                                                                    className="h-7 px-2.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-semibold cursor-pointer rounded-md flex items-center gap-1 shadow-sm"
                                                                >
                                                                    <Mail className="w-3 h-3" /> Assign
                                                                </Button>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                                                            {p.created_at}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end gap-1.5">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleStartEdit(p)}
                                                                    className="w-7 h-7 border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                                                                >
                                                                    <Edit className="w-3.5 h-3.5 text-slate-500" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleArchivePatient(p.patient_id)}
                                                                    className="w-7 h-7 border-slate-200 hover:border-red-300 hover:bg-red-50 cursor-pointer"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-600" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit Patient Modal */}
            {editingPatient && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md mx-4 shadow-2xl border-slate-200 bg-white">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-slate-800 text-sm flex items-center gap-2">
                                <Edit className="w-4 h-4 text-teal-600" /> Edit Patient Profile
                            </CardTitle>
                            <CardDescription className="text-[10px] text-slate-400">
                                Modify administrative details for Patient #{editingPatient.patient_id}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                                <Input
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="h-8 text-xs bg-slate-50 border-slate-200"
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender</label>
                                <select
                                    value={editForm.gender}
                                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                                    className="w-full h-8 text-xs px-2.5 border border-slate-200 rounded-md bg-slate-50 text-slate-700 outline-none"
                                >
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Diagnosis</label>
                                <Input
                                    value={editForm.diagnosis}
                                    onChange={(e) => setEditForm({ ...editForm, diagnosis: e.target.value })}
                                    className="h-8 text-xs bg-slate-50/50 border-slate-200"
                                    placeholder="Enter primary medical condition..."
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ward Name (Optional)</label>
                                <Input
                                    value={editForm.ward}
                                    onChange={(e) => setEditForm({ ...editForm, ward: e.target.value })}
                                    className="h-8 text-xs bg-slate-50/50 border-slate-200"
                                    placeholder="e.g. Ward A (Optional)"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room Name</label>
                                    <Input
                                        value={editForm.room}
                                        onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                                        className="h-8 text-xs bg-slate-50/50 border-slate-200"
                                        placeholder="e.g. Room 101"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bed Name</label>
                                    <Input
                                        value={editForm.bed}
                                        onChange={(e) => setEditForm({ ...editForm, bed: e.target.value })}
                                        className="h-8 text-xs bg-slate-50/50 border-slate-200"
                                        placeholder="e.g. Bed A"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <Button variant="outline" size="sm" onClick={() => setEditingPatient(null)} className="h-8 text-xs border-slate-200 text-slate-600 cursor-pointer">
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleUpdatePatient} className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white cursor-pointer">
                                    Save Changes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
