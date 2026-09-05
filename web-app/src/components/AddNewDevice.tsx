import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Smartphone, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// --- SHARED FORM COMPONENT ---
interface DeviceFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    isModal?: boolean;
}

const DeviceRegistrationForm: React.FC<DeviceFormProps> = ({ onSuccess, onCancel, isModal = false }) => {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [choice, setChoice] = useState<'both' | 'diaper' | 'vital'>('both');
    const [vitalDeviceNo, setVitalDeviceNo] = useState("");
    const [diaperDeviceNo, setDiaperDeviceNo] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        const isDiaperRequired = choice === 'both' || choice === 'diaper';
        const isVitalRequired = choice === 'both' || choice === 'vital';

        if (isVitalRequired) {
            if (!vitalDeviceNo.trim()) {
                newErrors.vitalDeviceNo = "Vital Signs Device serial number is required";
            } else if (!/^VS-\d{4}-\d{3,}$/.test(vitalDeviceNo.trim())) {
                newErrors.vitalDeviceNo = "Format: VS-YYYY-XXXX (e.g. VS-2026-0001)";
            }
        }

        if (isDiaperRequired) {
            if (!diaperDeviceNo.trim()) {
                newErrors.diaperDeviceNo = "Smart Diaper Device serial number is required";
            } else if (!/^SD-\d{4}-\d{3,}$/.test(diaperDeviceNo.trim())) {
                newErrors.diaperDeviceNo = "Format: SD-YYYY-XXXX (e.g. SD-2026-0001)";
            }
        }

        if (isVitalRequired && isDiaperRequired && vitalDeviceNo && diaperDeviceNo && vitalDeviceNo === diaperDeviceNo) {
            newErrors.diaperDeviceNo = "Device IDs cannot be the same";
        }

        return newErrors;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const formErrors = validateForm();
        if (Object.keys(formErrors).length > 0) {
            setErrors(formErrors);
            toast.error("Please check device numbers format.");
            return;
        }

        setIsLoading(true);

        const isDiaperRequired = choice === 'both' || choice === 'diaper';
        const isVitalRequired = choice === 'both' || choice === 'vital';

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    vitalDeviceNo: isVitalRequired ? vitalDeviceNo.trim() : null,
                    diaperDeviceNo: isDiaperRequired ? diaperDeviceNo.trim() : null
                })
            });

            const data = await response.json();

            if (data.success) {
                toast.success("Devices registered successfully.");
                onSuccess();
            } else {
                toast.error(data.message || "Failed to register devices");
            }
        } catch (error) {
            console.error("Device Reg Error:", error);
            toast.error("Network Error: Could not register devices");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="deviceChoice" className="text-slate-700 font-semibold text-xs">Devices to Register</Label>
                    <select
                        id="deviceChoice"
                        value={choice}
                        onChange={(e) => {
                            setChoice(e.target.value as any);
                            setErrors({});
                        }}
                        className="w-full h-9 rounded-md border border-slate-300 text-sm px-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    >
                        <option value="both">Partnered Devices</option>
                        <option value="diaper">Smart Diaper Device Only</option>
                        <option value="vital">Vital Signs Device Only</option>
                    </select>
                </div>

                {(choice === 'both' || choice === 'diaper') && (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                        <Label htmlFor="diaperDeviceNo" className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase">
                            <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                            Smart Diaper Device <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="diaperDeviceNo"
                            placeholder="e.g. SD-2026-0001"
                            value={diaperDeviceNo}
                            onChange={(e) => {
                                setDiaperDeviceNo(e.target.value.toUpperCase());
                                if (errors.diaperDeviceNo) setErrors({ ...errors, diaperDeviceNo: '' });
                            }}
                            className={`font-mono text-sm h-9 uppercase ${errors.diaperDeviceNo ? 'border-red-500' : ''}`}
                        />
                        {errors.diaperDeviceNo && <span className="text-red-500 text-[10px]">{errors.diaperDeviceNo}</span>}
                    </div>
                )}

                {(choice === 'both' || choice === 'vital') && (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                        <Label htmlFor="vitalDeviceNo" className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase">
                            <Smartphone className="w-3.5 h-3.5 text-rose-500" />
                            Vital Signs Device <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="vitalDeviceNo"
                            placeholder="e.g. VS-2026-0001"
                            value={vitalDeviceNo}
                            onChange={(e) => {
                                setVitalDeviceNo(e.target.value.toUpperCase());
                                if (errors.vitalDeviceNo) setErrors({ ...errors, vitalDeviceNo: '' });
                            }}
                            className={`font-mono text-sm h-9 uppercase ${errors.vitalDeviceNo ? 'border-red-500' : ''}`}
                        />
                        {errors.vitalDeviceNo && <span className="text-red-500 text-[10px]">{errors.vitalDeviceNo}</span>}
                    </div>
                )}
            </div>

            <div className={`grid grid-cols-2 gap-3 ${isModal ? 'pt-2' : 'pt-4'}`}>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full border-slate-200 h-9 text-xs"
                    onClick={onCancel}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    className="w-full bg-teal-600 hover:bg-teal-700 h-9 text-xs text-white"
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <CheckCircle className="w-3.5 h-3.5 mr-2" />}
                    Register
                </Button>
            </div>
        </form>
    );
};

// --- EXPORT 1: COMPACT PAGE VERSION ---
interface AddNewDeviceProps {
    onDeviceAdded: () => void;
    onCancel: () => void;
}

export const AddNewDevice: React.FC<AddNewDeviceProps> = ({ onDeviceAdded, onCancel }) => {
    return (
        <div className="w-full max-w-lg mx-auto mt-8">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-100 rounded-lg">
                            <Smartphone className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg text-slate-800">New Device Registration</CardTitle>
                            <CardDescription className="text-xs">
                                Register hardware to the ALAGA network.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <DeviceRegistrationForm onSuccess={onDeviceAdded} onCancel={onCancel} />
                </CardContent>
            </Card>
        </div>
    );
};

// --- EXPORT 2: MODAL POPUP VERSION ---
interface AddNewDeviceModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onDeviceAdded: () => void;
}

export const AddNewDeviceModal: React.FC<AddNewDeviceModalProps> = ({ isOpen, onOpenChange, onDeviceAdded }) => {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden bg-white">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-teal-600" />
                        <DialogTitle className="text-base font-semibold text-slate-800">Add New Device</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="p-6">
                    <DialogDescription className="hidden">Register a new device</DialogDescription>
                    <DeviceRegistrationForm
                        onSuccess={() => {
                            onDeviceAdded();
                            onOpenChange(false);
                        }}
                        onCancel={() => onOpenChange(false)}
                        isModal={true}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};