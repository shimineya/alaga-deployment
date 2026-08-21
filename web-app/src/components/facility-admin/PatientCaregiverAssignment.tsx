import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link2, Link2Off, Search, X, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AssignCaregiverModal } from '../AssignCaregiverModal';

// [OWASP A01] All API calls scoped to facility_admin routes
const API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface StaffMember {
    user_id: number; username: string; email: string; role: string;
}

interface CaregiverRef {
    user_id: number; username: string; invite_status?: string;
}

interface Patient {
    patient_id: number; patient_name: string;
    caregivers: CaregiverRef[];
}

export default function PatientCaregiverAssignment() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [allCaregivers, setAllCaregivers] = useState<StaffMember[]>([]);
    const [search, setSearch] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
    const [selectedPatientName, setSelectedPatientName] = useState('');

    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (val.trim().length > 0) {
            const matches = patients
                .map(p => p.patient_name)
                .filter(name => name.toLowerCase().includes(val.toLowerCase()));
            setSuggestions(Array.from(new Set(matches)));
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };
    const [assignments, setAssignments] = useState<Record<number, number>>({});

    const fetchPatients = async () => {
        try {
            const res = await fetch(`${API}/patients`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) setPatients(data.data);
        } catch { toast.error('Failed to load patients.'); }
    };

    const fetchCaregivers = async () => {
        try {
            const res = await fetch(`${API}/staff`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                setAllCaregivers(data.data.filter((s: StaffMember) => s.role.toLowerCase() === 'caregiver'));
            }
        } catch { toast.error('Failed to load staff.'); }
    };

    useEffect(() => { fetchPatients(); fetchCaregivers(); }, []);

    // Assign a caregiver (additive -- multiple allowed)
    const handleAssign = async (patientId: number) => {
        const caregiverId = assignments[patientId];
        if (!caregiverId) return toast.error('Select a caregiver first.');
        try {
            const res = await fetch(`${API}/patients/${patientId}/assign-staff`, {
                method: 'PUT', headers: getAuth(),
                body: JSON.stringify({ caregiver_id: caregiverId })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setAssignments(prev => { const next = { ...prev }; delete next[patientId]; return next; });
                fetchPatients();
            } else {
                toast.error(data.message);
            }
        } catch { toast.error('Assignment failed.'); }
    };

    // Remove a specific caregiver from a patient
    const handleUnassign = async (patientId: number, caregiverId: number, caregiverName: string, patientName: string) => {
        if (!confirm(`Remove ${caregiverName} from ${patientName}?`)) return;
        try {
            const res = await fetch(`${API}/patients/${patientId}/unassign-staff`, {
                method: 'DELETE', headers: getAuth(),
                body: JSON.stringify({ caregiver_id: caregiverId })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchPatients();
            } else toast.error(data.message);
        } catch { toast.error('Failed to unassign caregiver.'); }
    };

    const filtered = patients.filter(p =>
        p.patient_name.toLowerCase().includes(search.toLowerCase())
    );

    // For the dropdown, exclude caregivers already assigned to that patient
    const getAvailableCaregivers = (patient: Patient) => {
        const assignedIds = new Set(patient.caregivers.map(c => c.user_id));
        return allCaregivers.filter(c => !assignedIds.has(c.user_id));
    };

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-bold text-teal-900 tracking-tight">Patient-Caregiver Assignment</h2>
                <p className="text-[10px] font-medium text-slate-500">
                    Link one or more caregivers to each patient for shift coverage. Caregivers can only view records of their assigned patients.
                </p>
            </div>

            <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-teal-600" />
                            <div>
                                <CardTitle className="text-sm text-slate-800">Assignment Table</CardTitle>
                                <CardDescription className="text-[10px] text-slate-500 mt-0.5">
                                    Multiple caregivers can be assigned per patient to support shift rotations.
                                </CardDescription>
                            </div>
                        </div>
                        <Button 
                            onClick={() => {
                                setSelectedPatientId(-1); // indicating general modal
                                setSelectedPatientName('');
                                setIsAssignOpen(true);
                            }}
                            className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8"
                        >
                            <UserPlus className="w-3.5 h-3.5 mr-1" /> Invite Caregiver
                        </Button>
                    </div>
                    <div className="relative w-full">
                        <div className="flex items-center gap-2 mt-2">
                            <Search className="w-4 h-4 text-slate-400" />
                            <Input
                                value={search}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)}
                                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                placeholder="Search patients by name..."
                                className="h-8 text-sm border-0 border-b border-slate-200 rounded-none focus-visible:ring-0 px-0 w-full"
                            />
                        </div>
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                {suggestions.map((sug) => (
                                    <button
                                        key={sug}
                                        onClick={() => {
                                            setSearch(sug);
                                            setShowSuggestions(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 hover:text-teal-700 text-slate-700 transition-colors"
                                    >
                                        {sug}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 text-xs text-slate-500">
                                <th className="text-left px-4 py-2 font-medium">Patient</th>
                                <th className="text-left px-4 py-2 font-medium">Assigned Caregivers</th>
                                <th className="text-left px-4 py-2 font-medium">Add Caregiver</th>
                                <th className="text-left px-4 py-2 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0
                                ? (
                                    <tr>
                                        <td colSpan={4} className="text-center text-xs text-slate-400 py-8">
                                            {patients.length === 0 ? 'No patients registered in this facility.' : 'No patients match your search.'}
                                        </td>
                                    </tr>
                                )
                                : filtered.map(p => {
                                    const available = getAvailableCaregivers(p);
                                    return (
                                        <tr key={p.patient_id} className="border-b border-slate-50 hover:bg-slate-50 align-top">
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-slate-800">{p.patient_name}</p>
                                                        <p className="text-[10px] text-slate-400">ID: {p.patient_id}</p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedPatientId(p.patient_id);
                                                            setSelectedPatientName(p.patient_name);
                                                            setIsAssignOpen(true);
                                                        }}
                                                        className="h-7 text-[10px] text-teal-600 hover:text-teal-800 hover:bg-teal-50"
                                                    >
                                                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Invite
                                                    </Button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {p.caregivers.length === 0
                                                    ? <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                                                    : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {p.caregivers.map(c => {
                                                                let badgeClass = "text-xs flex items-center gap-1 pr-1 ";
                                                                let statusText = "";
                                                                if (c.invite_status === 'Pending') {
                                                                    badgeClass += "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100";
                                                                    statusText = " (Pending)";
                                                                } else if (c.invite_status === 'Declined') {
                                                                    badgeClass += "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
                                                                    statusText = " (Declined)";
                                                                } else {
                                                                    badgeClass += "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
                                                                }
                                                                return (
                                                                    <Badge
                                                                        key={c.user_id}
                                                                        variant="outline"
                                                                        className={badgeClass}
                                                                    >
                                                                        <span>{c.username}{statusText}</span>
                                                                        <button
                                                                            onClick={() => handleUnassign(p.patient_id, c.user_id, c.username, p.patient_name)}
                                                                            className="ml-0.5 rounded-full hover:bg-slate-200 p-0.5 transition-colors text-slate-400 hover:text-slate-600"
                                                                            title={`Remove ${c.username}`}
                                                                        >
                                                                            <X className="w-3 h-3" />
                                                                        </button>
                                                                    </Badge>
                                                                );
                                                            })}
                                                        </div>
                                                    )
                                                }
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {available.length === 0
                                                    ? <span className="text-[10px] text-slate-400 italic">All caregivers assigned</span>
                                                    : (
                                                        <select
                                                            value={assignments[p.patient_id] || ''}
                                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                                                setAssignments(prev => ({ ...prev, [p.patient_id]: parseInt(e.target.value) }))
                                                            }
                                                            className="h-7 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 w-full max-w-[180px]"
                                                        >
                                                            <option value="">-- Select Caregiver --</option>
                                                            {available.map(c => (
                                                                <option key={c.user_id} value={c.user_id}>
                                                                    {c.username}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )
                                                }
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleAssign(p.patient_id)}
                                                    disabled={!assignments[p.patient_id]}
                                                    className="h-7 text-xs text-teal-600 hover:text-teal-800 hover:bg-teal-50 gap-1 disabled:opacity-40"
                                                >
                                                    <Link2 className="w-3 h-3" /> Assign
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
            {selectedPatientId !== null && (
                <AssignCaregiverModal
                    isOpen={isAssignOpen}
                    onClose={() => setIsAssignOpen(false)}
                    patientId={selectedPatientId}
                    patientName={selectedPatientName}
                    onSuccess={() => {
                        setIsAssignOpen(false);
                        fetchPatients();
                    }}
                />
            )}
        </div>
    );
}
