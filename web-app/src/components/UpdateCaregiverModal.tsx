import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { X } from 'lucide-react';

interface UpdateCaregiverModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: string;
    caregiver: {
        user_id: string;
        first_name: string;
        last_name: string;
        relationship: string;
        access_level: string;
    } | null;
    onSuccess: () => void;
}

export const UpdateCaregiverModal: React.FC<UpdateCaregiverModalProps> = ({
    isOpen,
    onClose,
    patientId,
    caregiver,
    onSuccess
}) => {
    const { token } = useAuth();
    const [relationship, setRelationship] = useState('');
    const [accessLevel, setAccessLevel] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (caregiver) {
            setRelationship(caregiver.relationship);
            setAccessLevel(caregiver.access_level);
        }
    }, [caregiver]);

    const handleUpdate = async () => {
        if (!caregiver) return;

        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/assignments/caregiver/permissions`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patient_id: patientId,
                    target_user_id: caregiver.user_id,
                    relationship: relationship,
                    access_level: accessLevel
                })
            });

            const data = await response.json();

            if (data.success) {
                toast.success(`Permissions updated for ${caregiver.first_name}`);
                onSuccess();
                onClose();
            } else {
                toast.error(data.message || "Failed to update permissions");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !caregiver) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Update Permissions</h3>
                        <p className="text-xs text-slate-500">{caregiver.first_name} {caregiver.last_name}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="relation">Relationship</Label>
                        <Select value={relationship} onValueChange={setRelationship}>
                            <SelectTrigger id="relation">
                                <SelectValue placeholder="Select relationship" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Primary Caregiver">Primary Caregiver</SelectItem>
                                <SelectItem value="Secondary Caregiver">Secondary Caregiver</SelectItem>
                                <SelectItem value="Nurse">Nurse / Medical Staff</SelectItem>
                                <SelectItem value="Family Member">Family Member</SelectItem>
                                <SelectItem value="Guardian">Guardian</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="access">Access Level</Label>
                        <Select value={accessLevel} onValueChange={setAccessLevel}>
                            <SelectTrigger id="access">
                                <SelectValue placeholder="Select access level" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="View">View Only (Read-Only)</SelectItem>
                                <SelectItem value="Edit">Edit (Can manage devices/alerts)</SelectItem>
                                <SelectItem value="Admin">Admin (Full Control)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            <strong>View:</strong> Can see vital signs and reports.<br />
                            <strong>Edit:</strong> Can link devices and resolve alerts.<br />
                            <strong>Admin:</strong> Can manage other caregivers.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleUpdate} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {loading ? 'Updating...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};
