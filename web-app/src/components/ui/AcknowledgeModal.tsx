import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog';
import { Button } from './button';
import { Textarea } from './textarea';
import { Activity, ShieldAlert } from 'lucide-react';

interface AcknowledgeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAcknowledge: (actionTaken: string) => void;
    alertDetails?: {
        message: string;
        patient_name?: string;
        severity: string;
    };
}

export const AcknowledgeModal: React.FC<AcknowledgeModalProps> = ({
    isOpen,
    onClose,
    onAcknowledge,
    alertDetails
}) => {
    const [actionTaken, setActionTaken] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!actionTaken || actionTaken.trim().length < 5) {
            setError('Please provide a specific action taken (min 5 characters) for the audit trail.');
            return;
        }
        onAcknowledge(actionTaken);
        setActionTaken('');
        setError('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <Activity className="h-5 w-5" />
                        Clinical Alert Acknowledgment
                    </DialogTitle>
                    <DialogDescription>
                        This action will be logged for HIPAA compliance. Please state exactly what action was taken to resolve the alert.
                    </DialogDescription>
                </DialogHeader>

                {alertDetails && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-md text-sm mb-4">
                        <div className="font-semibold text-red-900">{alertDetails.patient_name || 'Patient'}</div>
                        <div className="text-red-800 mt-1">{alertDetails.message}</div>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Action Taken <span className="text-red-500">*</span>
                        </label>
                        <Textarea
                            placeholder="e.g., Administered medication, Changed diaper, Repositioned patient..."
                            value={actionTaken}
                            onChange={(e) => {
                                setActionTaken(e.target.value);
                                if (e.target.value.length >= 5) setError('');
                            }}
                            className={error ? 'border-red-500' : ''}
                        />
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg flex items-start gap-3 border border-slate-200">
                        <ShieldAlert className="h-5 w-5 text-slate-500 mt-0.5" />
                        <div className="text-xs text-slate-600 leading-relaxed">
                            <strong>Compliance Note:</strong> By clicking acknowledge, your Name, User ID, and timestamp will be permanently cryptographically bound to this alert response in our audit trail per DPA/HIPAA regulations.
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="destructive" onClick={handleSubmit}>Complete Acknowledgment</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
