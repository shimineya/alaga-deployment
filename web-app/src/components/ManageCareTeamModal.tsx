import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { API_URL } from '../lib/config';
import { Users, Trash2, UserPlus, Shield, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { AssignCaregiverModal } from './AssignCaregiverModal';

interface CareTeamMember {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    system_role: string;
    relationship: string;
    access_level: string;
}

interface ManageCareTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: number;
    patientName: string;
    onUpdate: () => void; // Trigger refresh in parent
}

export const ManageCareTeamModal: React.FC<ManageCareTeamModalProps> = ({
    isOpen,
    onClose,
    patientId,
    patientName,
    onUpdate
}) => {
    const { token, user } = useAuth();
    const [team, setTeam] = useState<CareTeamMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAssignModalOpen, setAssignModalOpen] = useState(false);

const fetchTeam = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
        const url = `${API_URL}/api/caregiver/patients/${patientId}/care-team`;
        console.log("Fetching Care Team from:", url);
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 404) throw new Error("Endpoint not found. Restart backend?");
            throw new Error("Failed to fetch");
        }

        const data = await response.json();
        if (data.success) {
            setTeam(data.data);
        }
    } catch (error: any) {
        console.error(error);
        toast.error(error.message || "Failed to load assigned caregivers");
    } finally {
        setLoading(false);
    }
};

    useEffect(() => {
        if (isOpen) {
            fetchTeam();
        }
    }, [isOpen, patientId]);

const handleRemove = async (userId: number) => {
    if (!confirm("Are you sure you want to remove this caregiver?")) return;

    try {
        const response = await fetch(`${API_URL}/api/caregiver/patients/${patientId}/care-team/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            toast.success("Caregiver removed");
            fetchTeam();
            onUpdate();
        } else {
            toast.error(data.message);
        }
    } catch (error) {
        toast.error("Failed to remove caregiver");
    }
};

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800">
                            <Users className="w-5 h-5 text-teal-600" />
                            Assigned Caregivers
                        </DialogTitle>
                        <DialogDescription>
                            Manage caregivers assigned to <strong>{patientName}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-semibold text-slate-700">Assigned Caregivers ({team.length})</h3>
                            <Button size="sm" onClick={() => setAssignModalOpen(true)} className="bg-teal-600 text-white hover:bg-teal-700">
                                <UserPlus className="w-4 h-4 mr-2" />
                                Add Caregiver
                            </Button>
                        </div>

                        <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                                </div>
                            ) : team.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-sm">
                                    No caregivers assigned yet.
                                </div>
                            ) : (
                                team.map((member) => (
                                    <div key={member.user_id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                                {member.first_name[0]}{member.last_name[0]}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-800">
                                                    {member.first_name} {member.last_name}
                                                    {member.user_id === user?.id && <span className="text-slate-400 ml-1">(You)</span>}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500">{member.email}</span>
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1 bg-slate-100 font-normal">
                                                        {member.relationship}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Don't allow removing yourself effectively for now unless we want to allow abandoning the patient */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleRemove(member.user_id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end border-t pt-4">
                        <Button variant="ghost" onClick={onClose}>Close</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AssignCaregiverModal
                isOpen={isAssignModalOpen}
                onClose={() => setAssignModalOpen(false)}
                patientId={patientId}
                patientName={patientName}
                onSuccess={() => {
                    setAssignModalOpen(false);
                    fetchTeam(); // Refresh the team list
                    onUpdate();  // Refresh the main tracker
                }}
            />
        </>
    );
};
