import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { X } from 'lucide-react';

interface AssignCaregiverModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: string;
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
    const [email, setEmail] = useState('');
    const [relationship, setRelationship] = useState('Secondary Caregiver');
    const [loading, setLoading] = useState(false);

    const handleInvite = async () => {
        if (!email) {
            toast.error("Please enter an email address.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('http://localhost:3000/api/assignments/caregiver/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patient_id: patientId,
                    invite_email: email,
                    relationship: relationship,
                    access_level: 'View' // Default to View only for safety
                })
            });

            const data = await response.json();

            if (data.success) {
                toast.success(`Invitation sent to ${email}`);
                onSuccess();
                onClose();
                setEmail('');
            } else {
                toast.error(data.message || "Failed to invite caregiver");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Invite Caregiver</h3>
                        <p className="text-xs text-slate-500">For patient: {patientName}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Caregiver's Email Address</Label>
                        <Input
                            id="email"
                            placeholder="user@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">
                            The user must already have an account to be invited.
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="relation">Relationship</Label>
                        <Select value={relationship} onValueChange={setRelationship}>
                            <SelectTrigger id="relation">
                                <SelectValue placeholder="Select relationship" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Secondary Caregiver">Secondary Caregiver</SelectItem>
                                <SelectItem value="Nurse">Nurse / Medical Staff</SelectItem>
                                <SelectItem value="Family Member">Family Member</SelectItem>
                                <SelectItem value="Guardian">Guardian</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleInvite} disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white">
                        {loading ? 'Sending...' : 'Send Invitation'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
