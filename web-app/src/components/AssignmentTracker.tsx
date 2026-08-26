import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { API_URL } from '../lib/config';
import {
    Users,
    Smartphone,
    Link as LinkIcon,
    Unlink,
    RefreshCw,
    PlusCircle,
    UserPlus,
    AlertCircle,
    ArrowRightLeft,
    MoreHorizontal,
    Search
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from './ui/input';

// Modals
import { AssignCaregiverModal } from './AssignCaregiverModal';
import { AssignDeviceModal } from './AssignDeviceModal';
import { AddNewDeviceModal } from './AddNewDevice';
import { ManageCareTeamModal } from './ManageCareTeamModal';

// --- TYPES ---
interface CaregiverObj {
    user_id: number;
    username: string;
    invite_status: string;
}

interface DeviceObj {
    serial_number: string;
    device_name: string;
}

interface PatientDB {
    patient_id: number;
    name: string;
    medical_condition: string;
    vital_device_sn: string | null;
    diaper_device_sn: string | null;
    assigned_caregiver_id: number | null;
    caregiver_name?: string;
    caregivers?: CaregiverObj[];
    devices?: DeviceObj[];
}

interface UnassignedDevice {
    serial_number: string;
    device_name: string;
    type: 'Vital Monitor' | 'Smart Diaper';
    status: 'Available';
}

interface AssignmentTrackerProps {
    onRefresh?: () => void;
}

// Expandable device list renderer component
const RenderLinkedDevices = ({ patient }: { patient: PatientDB }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const devicesList = patient.devices || [];

    let displayDevices = [...devicesList];
    if (displayDevices.length === 0) {
        if (patient.vital_device_sn) {
            displayDevices.push({ serial_number: patient.vital_device_sn, device_name: 'Vital Sign Monitor' });
        }
        if (patient.diaper_device_sn) {
            displayDevices.push({ serial_number: patient.diaper_device_sn, device_name: 'Smart Diaper Module' });
        }
    }

    if (displayDevices.length === 0) {
        return <span className="text-[10px] text-slate-400 italic">No Devices Linked</span>;
    }

    const firstDevice = displayDevices[0];
    const restDevices = displayDevices.slice(1);

    const renderDeviceBadge = (d: DeviceObj) => {
        const isDiaper = d.device_name.toLowerCase().includes('diaper') || d.serial_number.startsWith('SD');
        const badgeBg = isDiaper ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-rose-50 text-rose-700 border-rose-100';
        return (
            <Badge key={d.serial_number} variant="secondary" className={`w-fit font-mono text-[10px] ${badgeBg}`}>
                <Smartphone className="w-3 h-3 mr-1" />
                {d.serial_number}
            </Badge>
        );
    };

    return (
        <div className="flex flex-col gap-1">
            {renderDeviceBadge(firstDevice)}
            {restDevices.length > 0 && (
                <>
                    {isExpanded && (
                        <div className="flex flex-col gap-1 mt-1 animate-in fade-in duration-200">
                            {restDevices.map(renderDeviceBadge)}
                        </div>
                    )}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-[10px] text-teal-600 hover:text-teal-800 font-semibold w-fit mt-0.5 cursor-pointer focus:outline-none bg-transparent border-none p-0"
                    >
                        {isExpanded ? 'Show less' : `+ ${restDevices.length} more`}
                    </button>
                </>
            )}
        </div>
    );
};

// Expandable caregiver list renderer component
const RenderCaregiver = ({ patient, openAssignCaregiver }: { patient: PatientDB, openAssignCaregiver: (pId: number, pName: string) => void }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const caregiversList = patient.caregivers || [];

    let displayCaregivers = [...caregiversList];
    if (displayCaregivers.length === 0 && patient.assigned_caregiver_id) {
        displayCaregivers.push({
            user_id: patient.assigned_caregiver_id,
            username: patient.caregiver_name || `ID: ${patient.assigned_caregiver_id}`,
            invite_status: 'Active'
        });
    }

    if (displayCaregivers.length === 0) {
        return (
            <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                onClick={() => openAssignCaregiver(patient.patient_id, patient.name)}
            >
                <UserPlus className="w-3 h-3 mr-1" /> Assign
            </Button>
        );
    }

    const firstCaregiver = displayCaregivers[0];
    const restCaregivers = displayCaregivers.slice(1);

    const renderCaregiverRow = (c: CaregiverObj) => {
        let badgeBg = "bg-emerald-100 text-emerald-700";
        if (c.invite_status === 'Pending') {
            badgeBg = "bg-amber-100 text-amber-700";
        } else if (c.invite_status === 'Declined') {
            badgeBg = "bg-red-100 text-red-700";
        }
        return (
            <div key={c.user_id} className="flex items-center gap-1.5 text-slate-600 text-xs">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${badgeBg}`}>
                    C
                </div>
                <span>
                    {c.username}{c.invite_status === 'Pending' && ' (Pending)'}{c.invite_status === 'Declined' && ' (Declined)'}
                </span>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-1.5">
            {renderCaregiverRow(firstCaregiver)}
            {restCaregivers.length > 0 && (
                <>
                    {isExpanded && (
                        <div className="flex flex-col gap-1.5 mt-1 animate-in fade-in duration-200">
                            {restCaregivers.map(renderCaregiverRow)}
                        </div>
                    )}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-[10px] text-teal-600 hover:text-teal-800 font-semibold w-fit mt-0.5 cursor-pointer focus:outline-none bg-transparent border-none p-0"
                    >
                        {isExpanded ? 'Show less' : `+ ${restCaregivers.length} more`}
                    </button>
                </>
            )}
        </div>
    );
};

export const AssignmentTracker: React.FC<AssignmentTrackerProps> = ({ onRefresh }) => {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Data State
    const [assignments, setAssignments] = useState<PatientDB[]>([]);
    const [unassignedDevices, setUnassignedDevices] = useState<UnassignedDevice[]>([]);

    // Modal State
    const [isCaregiverModalOpen, setCaregiverModalOpen] = useState(false);
    const [isDeviceModalOpen, setDeviceModalOpen] = useState(false);
    const [isRegisterDeviceOpen, setRegisterDeviceOpen] = useState(false);
    const [isManageTeamOpen, setManageTeamOpen] = useState(false);

    // Selection for Actions
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
    const [selectedPatientName, setSelectedPatientName] = useState<string>('');

    // --- FETCH DATA ---
    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            // 1. Fetch Patients
            const resPatients = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/patients`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataPatients = await resPatients.json();

            if (dataPatients.success) {
                setAssignments(dataPatients.data);
            }

            // 2. Fetch Inventory
            const resDevices = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/available`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataDevices = await resDevices.json();

            if (dataDevices.success) {
                const mappedDevices = dataDevices.data.map((d: any) => ({
                    serial_number: d.serial_number,
                    device_name: d.device_name,
                    type: d.device_name.includes('Diaper') ? 'Smart Diaper' : 'Vital Monitor',
                    status: 'Available'
                }));
                setUnassignedDevices(mappedDevices);
            }

        } catch (error) {
            console.error("Fetch Error:", error);
            toast.error("Failed to load live data.");
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- ACTIONS ---

    const handleUnlinkDevice = async (patientId: number, type: 'vital' | 'diaper') => {
        try {
            const response = await fetch(`${API_URL}/api/caregiver/patients/${patientId}/unlink-device`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type })
            });

            const data = await response.json();
            if (data.success) {
                toast.success("Device unlinked successfully");
                fetchData();
                if (onRefresh) onRefresh();
            } else {
                toast.error(data.message || "Failed to unlink device");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error during unlink");
        }
    };

    const handleUnlinkCaregiver = async (patientId: number) => {
        try {
            const response = await fetch(`${API_URL}/api/caregiver/patients/${patientId}/unlink-caregiver`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            if (data.success) {
                toast.success("Caregiver removed from patient");
                fetchData();
                if (onRefresh) onRefresh();
            } else {
                toast.error("Failed to remove caregiver");
            }
        } catch (error) {
            toast.error("Network error");
        }
    };

    const openAssignDevice = (pId: number, pName: string) => {
        setSelectedPatientId(pId);
        setSelectedPatientName(pName);
        setDeviceModalOpen(true);
    };

    const openAssignCaregiver = (pId: number, pName: string) => {
        setSelectedPatientId(pId);
        setSelectedPatientName(pName);
        setCaregiverModalOpen(true);
    };

    const openManageTeam = (pId: number, pName: string) => {
        setSelectedPatientId(pId);
        setSelectedPatientName(pName);
        setManageTeamOpen(true);
    };

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Filter Logic
    const filteredAssignments = assignments.filter(a => {
        const q = searchQuery.toLowerCase();
        const pName = a.name?.toLowerCase() || '';
        const vDev = a.vital_device_sn?.toLowerCase() || '';
        const dDev = a.diaper_device_sn?.toLowerCase() || '';

        return pName.includes(q) || vDev.includes(q) || dDev.includes(q);
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredAssignments.length / itemsPerPage);
    const paginatedAssignments = filteredAssignments.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 pb-4 pt-2 space-y-4">
            {/* ... Header ... */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-500 rounded-lg shadow-sm">
                        <LinkIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 leading-tight">Device and User Assignments</h2>
                        <p className="text-xs text-slate-500">Manage patient-device pairings and patient-caregiver/medical staff assignments.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={fetchData} disabled={isLoading} className="h-8 text-slate-500">
                        <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT PANEL: ACTIVE ASSIGNMENTS LIST */}
                <Card className="lg:col-span-2 border-slate-200 shadow-sm flex flex-col">
                    <CardHeader className="bg-slate-50/50 border-b py-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Users className="w-4 h-4 text-teal-600" />
                                Current Assignments
                            </CardTitle>
                            <div className="relative w-48">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input
                                    placeholder="Search patient..."
                                    className="h-8 pl-8 text-xs bg-white"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Patient</th>
                                    <th className="px-4 py-3 font-medium">Linked Devices</th>
                                    <th className="px-4 py-3 font-medium">Caregiver</th>
                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedAssignments.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400">
                                            {isLoading ? "Loading patients..." : "No patients found. Enroll a patient first."}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedAssignments.map((row) => (
                                        <tr key={row.patient_id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-700">
                                                {row.name}
                                                {(!row.vital_device_sn && !row.diaper_device_sn) && (
                                                    <Badge variant="outline" className="ml-2 text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                                                        No Devices
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <RenderLinkedDevices patient={row} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <RenderCaregiver patient={row} openAssignCaregiver={openAssignCaregiver} />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                                            <MoreHorizontal className="w-4 h-4 text-slate-400" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuLabel>Manage Access</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => openManageTeam(row.patient_id, row.name)}>
                                                            <Users className="w-3.5 h-3.5 mr-2" /> Manage Assigned Caregivers
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openAssignDevice(row.patient_id, row.name)}>
                                                            <ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Assign Device
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        {row.vital_device_sn && (
                                                            <DropdownMenuItem
                                                                className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                                                                onClick={() => handleUnlinkDevice(row.patient_id, 'vital')}
                                                            >
                                                                <Unlink className="w-3.5 h-3.5 mr-2" /> Unlink Vital Mon.
                                                            </DropdownMenuItem>
                                                        )}
                                                        {row.diaper_device_sn && (
                                                            <DropdownMenuItem
                                                                className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                                                                onClick={() => handleUnlinkDevice(row.patient_id, 'diaper')}
                                                            >
                                                                <Unlink className="w-3.5 h-3.5 mr-2" /> Unlink Diaper
                                                            </DropdownMenuItem>
                                                        )}
                                                        {row.assigned_caregiver_id && (
                                                            <DropdownMenuItem
                                                                className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                                                                onClick={() => handleUnlinkCaregiver(row.patient_id)}
                                                            >
                                                                <Users className="w-3.5 h-3.5 mr-2" /> Remove Caregiver
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center p-4 border-t border-slate-100 gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 px-2"
                                >
                                    Previous
                                </Button>
                                <span className="text-xs text-slate-500 font-medium">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="h-8 px-2"
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* RIGHT PANEL: ONLY UNASSIGNED DEVICES */}
                <div className="h-[75vh]">
                    <Card className="border-slate-200 shadow-sm flex flex-col h-full">
                        <CardHeader className="bg-slate-50/50 border-b py-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-slate-500" />
                                Unassigned Devices
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-hidden relative">
                            {unassignedDevices.length > 0 ? (
                                <ScrollArea className="h-full">
                                    <div className="divide-y divide-slate-100">
                                        {unassignedDevices.map((device) => (
                                            <div key={device.serial_number} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-md ${device.type.includes('Diaper') ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                                        <Smartphone className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-700">{device.serial_number}</p>
                                                        <p className="text-[10px] text-slate-500">{device.type}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-100">
                                                    Available
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                                    <div className="bg-slate-100 p-3 rounded-full mb-2">
                                        <AlertCircle className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <h3 className="text-sm font-medium text-slate-700">No Devices Available</h3>
                                    <p className="text-xs text-slate-500 mb-4 max-w-[200px]">
                                        All devices are currently in use or none have been registered.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* --- MODALS --- */}

            <AssignDeviceModal
                isOpen={isDeviceModalOpen}
                onClose={() => setDeviceModalOpen(false)}
                patientId={selectedPatientId || 0}
                patientName={selectedPatientName}
                onSuccess={() => {
                    setDeviceModalOpen(false);
                    fetchData();
                    if (onRefresh) onRefresh();
                }}
                onOpenCreate={() => {
                    setDeviceModalOpen(false);
                    setRegisterDeviceOpen(true);
                }}
            />

            <AssignCaregiverModal
                isOpen={isCaregiverModalOpen}
                onClose={() => setCaregiverModalOpen(false)}
                patientId={selectedPatientId || 0}
                patientName={selectedPatientName}
                onSuccess={() => {
                    setCaregiverModalOpen(false);
                    fetchData();
                    if (onRefresh) onRefresh();
                }}
            />

            <AddNewDeviceModal
                isOpen={isRegisterDeviceOpen}
                onOpenChange={setRegisterDeviceOpen}
                onDeviceAdded={() => {
                    fetchData();
                    if (onRefresh) onRefresh();
                }}
            />

            <ManageCareTeamModal
                isOpen={isManageTeamOpen}
                onClose={() => setManageTeamOpen(false)}
                patientId={selectedPatientId || 0}
                patientName={selectedPatientName}
                onUpdate={() => {
                    fetchData();
                    if (onRefresh) onRefresh();
                }}
            />
        </div>
    );
};