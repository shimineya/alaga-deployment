import React, { useState } from 'react';
import { Patient, VitalSign } from '../types';
import { useAuth } from '../lib/auth-context';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/table";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "./ui/dialog";
import {
    Search,
    Activity,
    Thermometer,
    Heart,
    Eye,
    UserPlus,
    Pencil,
    Archive,
    Loader2,
} from "lucide-react";
import { toast } from 'sonner';
// [NEW] Import the Create modal
import { AddNewPatientModal } from './AddNewPatient';

interface PatientListProps {
    patients: Patient[];
    onSelectPatient: (patient: Patient) => void;
    vitalSigns: VitalSign[];
    onRefresh?: () => void;
}

export const PatientList: React.FC<PatientListProps> = ({ patients, onSelectPatient, vitalSigns, onRefresh }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'active'>('all');

    // --- Create Modal State ---
    const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);

    // --- Edit Modal State ---
    const [editTarget, setEditTarget] = useState<Patient | null>(null);
    const [editName, setEditName] = useState('');
    const [editBirthdate, setEditBirthdate] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editWard, setEditWard] = useState('');
    const [editRoom, setEditRoom] = useState('');
    const [editBed, setEditBed] = useState('');
    const [isEditLoading, setIsEditLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        if (val.trim().length > 0) {
            const matches = patients
                .map(p => p.name)
                .filter(name => name.toLowerCase().includes(val.toLowerCase()));
            setSuggestions(Array.from(new Set(matches)));
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    // --- Archive Confirmation State ---
    const [archiveTarget, setArchiveTarget] = useState<Patient | null>(null);
    const [isArchiveLoading, setIsArchiveLoading] = useState(false);

    const { token, user } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    // Filter Logic
    const filteredPatients = patients.filter(patient => {
        const matchesSearch = patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            patient.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase());
        const isActive = patient.deviceConnected || patient.status === 'Critical' || patient.status === 'Warning';
        const matchesTab = activeTab === 'all' ? true : isActive;
        return matchesSearch && matchesTab && !patient.deleted && !patient.archived;
    });

    const getLatestVital = (patientId: string) => {
        const patientVitals = vitalSigns.filter(v => v.patientId === patientId);
        return patientVitals.length > 0 ? patientVitals[patientVitals.length - 1] : null;
    };

    // ---- OPEN EDIT MODAL ----
    const openEditModal = (e: React.MouseEvent, patient: Patient) => {
        e.stopPropagation();
        setEditTarget(patient);
        setEditName(patient.name || '');
        // Attempt to parse birthdate from patient if available
        setEditBirthdate('');
        setEditNotes(
            // [DPA] Only prefill if the field actually contains PHI we already fetched.
            // medicalConditions is an array; join for display in the textarea.
            patient.medicalConditions?.join(', ') || ''
        );
        setEditWard(patient.baseline_data?.ward || '');
        setEditRoom(patient.baseline_data?.room || '');
        setEditBed(patient.baseline_data?.bed || '');
    };

    // ---- SUBMIT EDIT ----
    const handleEditSubmit = async () => {
        if (!editTarget || !editName.trim()) {
            toast.error('Patient name is required.');
            return;
        }
        if (!editRoom.trim() || !editBed.trim()) {
            toast.error('Room name and Bed name are required.');
            return;
        }
        setIsEditLoading(true);
        try {
            // [OWASP A01] The backend verifies the caller's access level for this patient_id.
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || ''}/api/caregiver/patients/${editTarget.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        // [OWASP A07] Bearer token required for all mutations.
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        name: editName.trim(),
                        birthdate: editBirthdate || undefined,
                        // [DPA] Medical notes are PHI — send only if the user explicitly changed them.
                        medicalCondition: editNotes.trim() || undefined,
                        ward: editWard.trim() || null,
                        room: editRoom.trim(),
                        bed: editBed.trim()
                    }),
                }
            );
            const data = await response.json();
            if (data.success) {
                toast.success(`${editName} updated successfully.`);
                setEditTarget(null);
                if (onRefresh) onRefresh();
            } else {
                // [OWASP A10] surface the backend's generic error message only.
                toast.error(data.message || 'Failed to update patient record.');
            }
        } catch (err) {
            // [OWASP A10] Network-level error — generic user-facing message.
            toast.error('Network error: could not update the patient record.');
        } finally {
            setIsEditLoading(false);
        }
    };

    // ---- OPEN ARCHIVE CONFIRMATION ----
    const openArchiveModal = (e: React.MouseEvent, patient: Patient) => {
        e.stopPropagation();
        setArchiveTarget(patient);
    };

    // ---- CONFIRM ARCHIVE (SOFT DELETE) ----
    const handleArchiveConfirm = async () => {
        if (!archiveTarget) return;
        setIsArchiveLoading(true);
        try {
            // [GDPR] Archive = is_archived flag. Permanent erasure requires a separate workflow.
            // [OWASP A01] Backend enforces Edit/Admin access before allowing archive.
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || ''}/api/caregiver/patients/${archiveTarget.id}/archive`,
                {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                toast.success(`${archiveTarget.name} has been archived.`);
                setArchiveTarget(null);
                if (onRefresh) onRefresh();
            } else {
                toast.error(data.message || 'Failed to archive patient record.');
            }
        } catch (err) {
            toast.error('Network error: could not archive this patient record.');
        } finally {
            setIsArchiveLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Patient List</h2>
                    <p className="text-slate-500">Manage and monitor all assigned patients</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search name or room..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onFocus={() => setShowSuggestions(suggestions.length > 0)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            className="pl-10"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                {suggestions.map((sug) => (
                                    <button
                                        key={sug}
                                        onClick={() => {
                                            setSearchQuery(sug);
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
                    {/* CREATE — Add Patient button (Admins, Medical Staff, Parents/Guardians) */}
                    {(isSysAdmin || ['system_admin', 'admin', 'sysadmin', 'facility_admin', 'medical_staff', 'parent'].includes(role) || role !== 'caregiver') && (
                        <Button
                            onClick={() => setIsAddPatientOpen(true)}
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                            id="btn-add-patient"
                        >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Add Patient
                        </Button>
                    )}
                </div>
            </div>

            <Tabs defaultValue="all" onValueChange={(val) => setActiveTab(val as 'all' | 'active')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="all">All Patients</TabsTrigger>
                    <TabsTrigger value="active">Active Monitoring</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                    <PatientTable
                        patients={filteredPatients}
                        getLatestVital={getLatestVital}
                        onSelectPatient={onSelectPatient}
                        onEdit={openEditModal}
                        onArchive={openArchiveModal}
                    />
                </TabsContent>
                <TabsContent value="active" className="mt-4">
                    <PatientTable
                        patients={filteredPatients}
                        getLatestVital={getLatestVital}
                        onSelectPatient={onSelectPatient}
                        onEdit={openEditModal}
                        onArchive={openArchiveModal}
                    />
                </TabsContent>
            </Tabs>

            {/* =================== CREATE MODAL =================== */}
            <AddNewPatientModal
                isOpen={isAddPatientOpen}
                onOpenChange={setIsAddPatientOpen}
                onSuccess={() => {
                    setIsAddPatientOpen(false);
                    if (onRefresh) onRefresh();
                }}
            />

            {/* =================== EDIT (UPDATE) MODAL =================== */}
            <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
                <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800">Edit Patient Record</DialogTitle>
                        {/*
                            [DPA] The tooltip below reminds the operator that they are editing
                            Protected Health Information (PHI) — Sensitive Personal Information
                            under the Data Privacy Act of 2012.
                        */}
                        <DialogDescription className="text-xs text-slate-500">
                            You are editing Protected Health Information (PHI). Only update fields
                            that require correction. All changes are logged for audit compliance.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-600">
                                Full Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="edit-patient-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="e.g. Juan Dela Cruz"
                                className="h-9 text-sm"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-600">
                                Date of Birth
                            </Label>
                            {/*
                                Tooltip suggestion: "Leave blank to keep the existing birthdate on file."
                            */}
                            <Input
                                id="edit-patient-birthdate"
                                type="date"
                                value={editBirthdate}
                                onChange={(e) => setEditBirthdate(e.target.value)}
                                className="h-9 text-sm"
                            />
                            <p className="text-[10px] text-slate-400">
                                Leave blank to keep the existing birthdate on file.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-600">
                                Medical Notes
                            </Label>
                            <Textarea
                                id="edit-patient-notes"
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Brief medical notes or conditions..."
                                className="min-h-[60px] resize-none text-sm"
                            />
                            <p className="text-[10px] text-slate-400">
                                Enter only what is clinically necessary. Avoid unnecessary personal details.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-600">
                                Ward Name (Optional)
                            </Label>
                            <Input
                                id="edit-patient-ward"
                                value={editWard}
                                onChange={(e) => setEditWard(e.target.value)}
                                placeholder="e.g. Ward A (Optional)"
                                className="h-9 text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-600">
                                    Room Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="edit-patient-room"
                                    value={editRoom}
                                    onChange={(e) => setEditRoom(e.target.value)}
                                    placeholder="e.g. Room 101"
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-600">
                                    Bed Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="edit-patient-bed"
                                    value={editBed}
                                    onChange={(e) => setEditBed(e.target.value)}
                                    placeholder="e.g. Bed A"
                                    className="h-9 text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setEditTarget(null)}
                            className="text-slate-500"
                        >
                            Cancel
                        </Button>
                        <Button
                            id="btn-confirm-edit-patient"
                            onClick={handleEditSubmit}
                            disabled={isEditLoading}
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                        >
                            {isEditLoading
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Saving...</>
                                : 'Save Changes'
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* =================== ARCHIVE (SOFT DELETE) CONFIRMATION MODAL =================== */}
            <Dialog open={!!archiveTarget} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
                <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800">Archive Patient Record</DialogTitle>
                        <DialogDescription className="text-sm text-slate-600">
                            You are about to archive <span className="font-semibold text-slate-800">{archiveTarget?.name}</span>.
                            <br /><br />
                            {/*
                                [GDPR / DPA] Archiving hides the record from active views but does NOT
                                permanently delete the data. The record is retained per the system's
                                1-year data retention policy before automated deletion.
                                Tooltip suggestion: "Archived records are hidden from your list but are
                                kept securely for the required audit period before permanent deletion."
                            */}
                            This will hide the record from your active patient list. It will be retained
                            securely for the mandatory audit period per our data retention policy and will
                            not be immediately deleted.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setArchiveTarget(null)}
                            className="text-slate-500"
                        >
                            Cancel
                        </Button>
                        <Button
                            id="btn-confirm-archive-patient"
                            onClick={handleArchiveConfirm}
                            disabled={isArchiveLoading}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isArchiveLoading
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Archiving...</>
                                : 'Yes, Archive Record'
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// Inline Expandable helper for one-line cells with multiple values
const ExpandableList: React.FC<{ items: React.ReactNode[]; emptyLabel?: string }> = ({ items, emptyLabel = 'None' }) => {
    const [expanded, setExpanded] = useState(false);
    if (!items || items.length === 0) {
        return <span className="text-[10px] text-slate-400 italic">{emptyLabel}</span>;
    }
    if (items.length === 1) {
        return <div className="truncate">{items[0]}</div>;
    }
    return (
        <div className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-1.5 max-w-full">
                <span className="truncate">{items[0]}</span>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                    className="text-[10px] font-semibold text-teal-600 hover:text-teal-800 bg-teal-50 px-1 py-0.5 rounded shrink-0 border border-teal-200"
                >
                    {expanded ? 'Hide' : `+${items.length - 1} more`}
                </button>
            </div>
            {expanded && (
                <div className="flex flex-col gap-1 mt-1 pl-1 border-l-2 border-teal-200">
                    {items.slice(1).map((item, idx) => (
                        <div key={idx} className="truncate">{item}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

// =================== PATIENT TABLE COMPONENT ===================
interface PatientTableProps {
    patients: Patient[];
    getLatestVital: (id: string) => VitalSign | null;
    onSelectPatient: (patient: Patient) => void;
    onEdit: (e: React.MouseEvent, patient: Patient) => void;
    onArchive: (e: React.MouseEvent, patient: Patient) => void;
}

const PatientTable: React.FC<PatientTableProps> = ({
    patients,
    getLatestVital,
    onSelectPatient,
    onEdit,
    onArchive,
}) => {
    if (patients.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                <p className="text-slate-500">No patients found matching your criteria.</p>
            </div>
        );
    }

    return (
        <Card className="shadow-sm border-slate-200">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        {/* [MODIFIED] Removed old "Actions" column. Replaced with "Manage" for clarity. */}
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="w-[200px]">Patient Name</TableHead>
                            <TableHead>Location (Ward/Room/Bed)</TableHead>
                            <TableHead>Assigned Caregivers</TableHead>
                            <TableHead>Active Device(s)</TableHead>
                            <TableHead>Wetness Status</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Heart Rate</TableHead>
                            <TableHead className="text-center">Temp</TableHead>
                            <TableHead className="text-center">SpO2</TableHead>
                            {/* Renamed from "Actions" to "Manage" for plain-language compliance */}
                            <TableHead className="text-right pr-4">Manage</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {patients.map((patient) => {
                            const vital = getLatestVital(patient.id);
                            const isOffline = !patient.deviceConnected;

                            let statusColor = "bg-slate-100 text-slate-800";
                            let statusText = "Stable";

                            if (isOffline) {
                                statusColor = "bg-slate-100 text-slate-500";
                                statusText = "Offline";
                            } else if (patient.status === 'Critical') {
                                statusColor = "bg-red-100 text-red-700 border-red-200";
                                statusText = "Critical";
                            } else if (patient.status === 'Warning') {
                                statusColor = "bg-amber-100 text-amber-700 border-amber-200";
                                statusText = "Warning";
                            } else {
                                statusColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
                                statusText = "Stable";
                            }

                            return (
                                <TableRow
                                    key={patient.id}
                                    className="cursor-pointer hover:bg-slate-50/50"
                                    onClick={() => onSelectPatient(patient)}
                                >
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span className="text-slate-900 font-semibold">{patient.name}</span>
                                            <span className="text-xs text-slate-500">ID: {patient.id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-semibold text-xs text-slate-700">
                                        {patient.baseline_data?.room ? (
                                            <span>
                                                {patient.baseline_data.ward ? `${patient.baseline_data.ward} - ` : ''}
                                                {patient.baseline_data.room} (Bed {patient.baseline_data.bed})
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 italic">None</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <ExpandableList
                                            items={((patient as any).caregivers || [])
                                                .filter((c: any) => c.invite_status === 'Active' || !c.invite_status)
                                                .map((c: any, i: number) => (
                                                    <Badge key={i} variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-medium">
                                                        {c.username || c.name || `User #${c.user_id}`}
                                                    </Badge>
                                                ))}
                                            emptyLabel="Unassigned"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <ExpandableList
                                            items={(patient.active_devices || []).map((sn: string, idx: number) => (
                                                <Badge key={idx} className="bg-teal-50 text-teal-700 border-none font-semibold font-mono text-[9px]">
                                                    {sn}
                                                </Badge>
                                            ))}
                                            emptyLabel="None"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {patient.latest_telemetry ? (
                                            <Badge variant="outline" className={`
                                                ${patient.latest_telemetry.moisture >= 70 
                                                    ? 'bg-red-50 text-red-700 border-red-200 font-bold animate-pulse' 
                                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                                }
                                            `}>
                                                {patient.latest_telemetry.moisture >= 70 ? 'WET' : 'DRY'} ({patient.latest_telemetry.moisture}%)
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">--</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`${statusColor} border`}>
                                            {statusText}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {vital && !isOffline ? (
                                            <div className="flex items-center justify-center gap-1 font-medium text-slate-700">
                                                <Heart className="w-3 h-3 text-rose-500" />
                                                {Math.round(vital.heartRate)}
                                            </div>
                                        ) : <span className="text-slate-400">--</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {vital && !isOffline ? (
                                            <div className="flex items-center justify-center gap-1 font-medium text-slate-700">
                                                <Thermometer className="w-3 h-3 text-amber-500" />
                                                {vital.temperature.toFixed(1)}°
                                            </div>
                                        ) : <span className="text-slate-400">--</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {vital && !isOffline ? (
                                            <div className="flex items-center justify-center gap-1 font-medium text-slate-700">
                                                <Activity className="w-3 h-3 text-blue-500" />
                                                {Math.round(vital.spo2)}%
                                            </div>
                                        ) : <span className="text-slate-400">--</span>}
                                    </TableCell>

                                    {/*
                                      [MODIFIED] New CRUD action cell.
                                      - READ  : Eye button  → opens Patient Profile (existing behaviour)
                                      - UPDATE: Pencil icon → opens Edit Patient modal
                                      - DELETE: Archive icon → opens Archive confirmation modal
                                      CREATE is handled at the list level via the "Add Patient" button.
                                    */}
                                    <TableCell>
                                        <div
                                            className="flex items-center justify-end gap-1 pr-1"
                                            // Prevent the row's onClick from firing when clicking buttons
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {/* READ — View Patient Profile */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                id={`btn-view-patient-${patient.id}`}
                                                title="View patient profile"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectPatient(patient);
                                                }}
                                                className="h-8 w-8 p-0 text-slate-500 hover:text-teal-600 hover:bg-teal-50"
                                            >
                                                <Eye className="w-4 h-4" />
                                                <span className="sr-only">View {patient.name}</span>
                                            </Button>

                                            {/* UPDATE — Edit Patient Details */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                id={`btn-edit-patient-${patient.id}`}
                                                title="Edit patient details"
                                                onClick={(e) => onEdit(e, patient)}
                                                className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                            >
                                                <Pencil className="w-4 h-4" />
                                                <span className="sr-only">Edit {patient.name}</span>
                                            </Button>

                                            {/* DELETE (Soft) — Archive Patient Record */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                id={`btn-archive-patient-${patient.id}`}
                                                title="Archive patient record"
                                                onClick={(e) => onArchive(e, patient)}
                                                className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                            >
                                                <Archive className="w-4 h-4" />
                                                <span className="sr-only">Archive {patient.name}</span>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};