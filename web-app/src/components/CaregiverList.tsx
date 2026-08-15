import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { MoreHorizontal, Shield, UserMinus, Edit, Mail, Lock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { AssignCaregiverModal } from './AssignCaregiverModal';
import { UpdateCaregiverModal } from './UpdateCaregiverModal';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';

/* 
  [Data Privacy Act] 
  We only display necessary information (Name, Role, Access Level).
  Emails are displayed for identification but should be treated as personal data.
*/

interface Caregiver {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    relationship: string;
    access_level: 'View' | 'Edit' | 'Admin';
}

interface CaregiverListProps {
    patientId: string;
    patientName: string;
    caregivers: Caregiver[];
    onRefresh: () => void;
    currentUserAccessLevel: string; // To hide actions if not allowed
}

export const CaregiverList: React.FC<CaregiverListProps> = ({
    patientId,
    patientName,
    caregivers,
    onRefresh,
    currentUserAccessLevel
}) => {
    const { token } = useAuth();
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const [selectedCaregiver, setSelectedCaregiver] = useState<Caregiver | null>(null);

    const canManage = currentUserAccessLevel === 'Edit' || currentUserAccessLevel === 'Admin';

    const handleEdit = (caregiver: Caregiver) => {
        setSelectedCaregiver(caregiver);
        setIsUpdateOpen(true);
    };

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const handleRevoke = async (caregiverId: string, caregiverName: string) => {
    if (!confirm(`Are you sure you want to remove ${caregiverName} from the care team?`)) return;

    try {
        const response = await fetch(`${API_URL}/api/assignments/caregiver/revoke`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                patient_id: patientId,
                target_user_id: caregiverId
            })
        });

        const data = await response.json();

        if (data.success) {
            toast.success(`${caregiverName} removed successfully.`);
            onRefresh();
        } else {
            toast.error(data.message || "Failed to remove caregiver.");
        }
    } catch (err) {
        console.error(err);
        toast.error("Network error.");
    }
};

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-500" /> Care Team
                    </CardTitle>
                    <CardDescription>
                        Manage who has access to {patientName}'s data.
                    </CardDescription>
                </div>
                {canManage && (
                    <Button onClick={() => setIsInviteOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Mail className="w-4 h-4 mr-2" /> Invite Caregiver
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {caregivers.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">No caregivers assigned yet.</p>
                    ) : (
                        caregivers.map((caregiver) => (
                            <div key={caregiver.user_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border border-slate-200">
                                        <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">
                                            {caregiver.first_name[0]}{caregiver.last_name[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium text-slate-900">{caregiver.first_name} {caregiver.last_name}</p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            {caregiver.email} • <span className="text-slate-600 font-semibold">{caregiver.relationship}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge
                                        variant="outline"
                                        className={`${caregiver.access_level === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                caregiver.access_level === 'Edit' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                            }`}
                                    >
                                        {caregiver.access_level} Access
                                    </Badge>

                                    {canManage && (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={() => handleEdit(caregiver)}
                                                title="Edit Permissions"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onSelect={() => handleEdit(caregiver)}>
                                                        <Edit className="w-4 h-4 mr-2" /> Edit Permissions
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onSelect={() => handleRevoke(caregiver.user_id, caregiver.first_name)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                                        <UserMinus className="w-4 h-4 mr-2" /> Remove Access
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>

            <AssignCaregiverModal
                isOpen={isInviteOpen}
                onClose={() => setIsInviteOpen(false)}
                patientId={patientId}
                patientName={patientName}
                onSuccess={onRefresh}
            />

            <UpdateCaregiverModal
                isOpen={isUpdateOpen}
                onClose={() => setIsUpdateOpen(false)}
                patientId={patientId}
                caregiver={selectedCaregiver}
                onSuccess={onRefresh}
            />
        </Card>
    );
};
