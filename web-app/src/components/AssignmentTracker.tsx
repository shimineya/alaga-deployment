import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import {
    Users,
    Wifi,
    WifiOff,
    UserPlus,
    PlusCircle,
    Trash2,
    Shield,
    User,
    Activity,
    Unplug
} from 'lucide-react';
import { AssignCaregiverModal } from './AssignCaregiverModal';
import { AssignDeviceModal } from './AssignDeviceModal';

interface CareTeamMember {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    relationship: string;
    access_level: string;
}

interface AssignedPatient {
    patient_id: number;
    name: string;
    device_serial_number: string | null;
    access_level: string; // My access level
    relationship: string;
    care_team: CareTeamMember[];
}

export const AssignmentTracker: React.FC = () => {
    const { token, user } = useAuth();
    const [assignments, setAssignments] = useState<AssignedPatient[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [caregiverModalOpen, setCaregiverModalOpen] = useState(false);
    const [deviceModalOpen, setDeviceModalOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<{ id: string, name: string } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:3000/api/assignments/my-assignments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setAssignments(data.data);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load assignments");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const handleUnlinkDevice = async (patientId: number, serialNumber: string) => {
        if (!confirm(`Are you sure you want to unlink device ${serialNumber}?`)) return;

        try {
            const response = await fetch('http://localhost:3000/api/assignments/device/unlink', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ patient_id: patientId, serial_number: serialNumber })
            });

            const data = await response.json();
            if (data.success) {
                toast.success("Device unlinked");
                fetchData();
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const handleRevokeCaregiver = async (patientId: number, targetUserId: number) => {
        if (!confirm("Are you sure you want to remove this caregiver?")) return;

        try {
            const response = await fetch('http://localhost:3000/api/assignments/caregiver/revoke', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ patient_id: patientId, target_user_id: targetUserId })
            });

            const data = await response.json();
            if (data.success) {
                toast.success("Access revoked");
                fetchData();
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const openInviteModal = (patient: AssignedPatient) => {
        console.log("DEBUG: openInviteModal clicked for", patient.name);
        setSelectedPatient({ id: patient.patient_id.toString(), name: patient.name });
        setCaregiverModalOpen(true);
    };

    const openDeviceModal = (patient: AssignedPatient) => {
        console.log("DEBUG: openDeviceModal clicked for", patient.name);
        setSelectedPatient({ id: patient.patient_id.toString(), name: patient.name });
        setDeviceModalOpen(true);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading your ecosystem...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">My Care Ecosystem</h2>
                <p className="text-slate-500">Manage your patients, their devices, and your care team.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {assignments.map(patient => (
                    <Card key={patient.patient_id} className="border-l-4 border-l-teal-500 shadow-sm">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        {patient.name}
                                        <Badge variant="outline" className="text-xs font-normal bg-white">
                                            {patient.relationship}
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription>Patient ID: #{patient.patient_id}</CardDescription>
                                </div>
                                {patient.access_level === 'Edit' && (
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => openDeviceModal(patient)}>
                                            <Wifi className="w-4 h-4 mr-2" /> Link Device
                                        </Button>
                                        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => openInviteModal(patient)}>
                                            <UserPlus className="w-4 h-4 mr-2" /> Invite Caregiver
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 grid md:grid-cols-2 gap-6">

                            {/* SECTION: DEVICES */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-emerald-600" /> Assigned Devices
                                </h4>
                                {patient.device_serial_number ? (
                                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-full text-emerald-600">
                                                <Wifi className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-emerald-900">Active Device</p>
                                                <p className="text-xs text-emerald-700 font-mono">{patient.device_serial_number}</p>
                                            </div>
                                        </div>
                                        {patient.access_level === 'Edit' && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-100 hover:text-red-700"
                                                onClick={() => handleUnlinkDevice(patient.patient_id, patient.device_serial_number!)}>
                                                <Unplug className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-4 border border-dashed rounded-lg text-center text-gray-400 text-sm">
                                        <WifiOff className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                                        No device linked
                                    </div>
                                )}
                            </div>

                            {/* SECTION: CARE TEAM */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-600" /> Care Team
                                </h4>
                                <div className="space-y-2">
                                    {patient.care_team.map(member => (
                                        <div key={member.user_id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-md border border-transparent hover:border-slate-100 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                                    {member.first_name[0]}{member.last_name[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700">
                                                        {member.first_name} {member.last_name}
                                                        {member.user_id === user?.id && <span className="text-slate-400 text-xs ml-1">(You)</span>}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{member.relationship} • <span className="text-[10px] uppercase bg-slate-100 px-1 rounded">{member.access_level}</span></p>
                                                </div>
                                            </div>

                                            {/* Only allow removing others, not self (for now), and only if current user is Edit */}
                                            {patient.access_level === 'Edit' && member.user_id !== user?.id && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-600"
                                                    onClick={() => handleRevokeCaregiver(patient.patient_id, member.user_id)}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                ))}

                {assignments.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed">
                        <User className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-600">No Patients Found</h3>
                        <p className="text-sm text-gray-500">You are not assigned to any patients yet.</p>
                    </div>
                )}
            </div>

            {/* Render Modals */}
            {/* Render Modals - Always rendered to allow animation/state handling */}
            <AssignCaregiverModal
                isOpen={caregiverModalOpen}
                onClose={() => { setCaregiverModalOpen(false); setSelectedPatient(null); }}
                patientId={selectedPatient?.id || ''}
                patientName={selectedPatient?.name || ''}
                onSuccess={fetchData}
            />
            <AssignDeviceModal
                isOpen={deviceModalOpen}
                onClose={() => { setDeviceModalOpen(false); setSelectedPatient(null); }}
                patientId={selectedPatient?.id || ''}
                patientName={selectedPatient?.name || ''}
                onSuccess={fetchData}
            />
        </div>
    );
};
