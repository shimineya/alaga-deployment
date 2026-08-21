import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { UserPlus, Loader2, Mail, FileText } from 'lucide-react';

interface AssignCaregiverModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: number;
    patientName: string;
    onSuccess: () => void;
}

export const AssignCaregiverModal: React.FC<AssignCaregiverModalProps> = ({
    isOpen,
    onClose,
    patientId,
    patientName,
    onSuccess
}) => {
    const { token } = useAuth();
    const [caregiverEmail, setCaregiverEmail] = useState('');
    const [patientNameInput, setPatientNameInput] = useState('');
    const [loading, setLoading] = useState(false);

    // Sync input when modal opens/changes
    useEffect(() => {
        if (isOpen) {
            setPatientNameInput(patientName || '');
            setCaregiverEmail('');
        }
    }, [isOpen, patientName]);

    const handleSendInvitation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!caregiverEmail.trim()) {
            toast.error("Caregiver email is required");
            return;
        }
        if (!patientNameInput.trim()) {
            toast.error("Patient name is required");
            return;
        }

        const API_BASE = import.meta.env.VITE_API_URL || '';
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/caregiver/patients/invite-by-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    caregiverEmail: caregiverEmail.trim(),
                    patientName: patientNameInput.trim()
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success(data.message || "Invitation sent successfully.");
                onSuccess();
            } else {
                toast.error(data.message || "Failed to send invitation");
            }
        } catch (error) {
            console.error("Invite error:", error);
            toast.error("Network error: Failed to send invitation");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-800">
                        <UserPlus className="w-5 h-5 text-teal-600" />
                        Invite Caregiver
                    </DialogTitle>
                    <DialogDescription>
                        Send an invitation to join the patient's care team. The caregiver will need to accept the invite.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSendInvitation} className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="caregiverEmail">Caregiver Email Address</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                id="caregiverEmail"
                                type="email"
                                placeholder="nurse@hospital.com"
                                value={caregiverEmail}
                                onChange={(e) => setCaregiverEmail(e.target.value)}
                                className="pl-9 h-9 text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="patientName">Patient Name</Label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                id="patientName"
                                placeholder="Patient Name"
                                value={patientNameInput}
                                onChange={(e) => setPatientNameInput(e.target.value)}
                                className="pl-9 h-9 text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                "Send Invite"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};