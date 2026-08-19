import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { Smartphone, Loader2, Link as LinkIcon, Plus } from 'lucide-react';

interface Device {
    serial_number: string;
    device_name: string;
    type: string;
}

interface AssignDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: number;
    patientName: string;
    onSuccess: () => void;
    onOpenCreate?: () => void; // Link to create new device
}

export const AssignDeviceModal: React.FC<AssignDeviceModalProps> = ({
    isOpen,
    onClose,
    patientId,
    patientName,
    onSuccess,
    onOpenCreate
}) => {
    const { token } = useAuth();
    const [devices, setDevices] = useState<Device[]>([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFetching(true);
            const fetchDevices = async () => {
                try {
                    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/available`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.success) {
                        setDevices(data.data.map((d: any) => ({
                            serial_number: d.serial_number,
                            device_name: d.device_name,
                            type: d.device_name.includes('Diaper') ? 'Diaper' : 'Vital'
                        })));
                    }
                } catch (err) {
                    toast.error("Failed to load devices");
                } finally {
                    setFetching(false);
                }
            };
            fetchDevices();
        } else {
            setSelectedDevice('');
        }
    }, [isOpen, token]);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const handleAssign = async () => {
    if (!selectedDevice) return;
    setLoading(true);
    try {
        const response = await fetch(`${API_URL}/api/caregiver/patients/${patientId}/assign-device`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ serialNumber: selectedDevice })
        });

        const data = await response.json();

        if (data.success) {
            toast.success(`Assigned ${selectedDevice} to ${patientName}`);
            onSuccess();
        } else {
            toast.error(data.message || "Failed to assign device");
        }
    } catch (error) {
        console.error(error);
        toast.error("Network error: Failed to assign device");
    } finally {
        setLoading(false);
    }
};

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-800">
                        <Smartphone className="w-5 h-5 text-teal-600" />
                        Link Device
                    </DialogTitle>
                    <DialogDescription>
                        Assign a monitoring device to <strong>{patientName}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Select Available Device</Label>
                        {fetching ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500 h-10 px-3 border rounded-md bg-slate-50">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading inventory...
                            </div>
                        ) : devices.length > 0 ? (
                            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select device S/N..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {devices.map((dev) => (
                                        <SelectItem key={dev.serial_number} value={dev.serial_number}>
                                            <span className="font-mono">{dev.serial_number}</span> - {dev.device_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="text-center p-4 border-2 border-dashed rounded-lg bg-slate-50">
                                <p className="text-sm text-slate-500 mb-3">No available devices found.</p>
                                {onOpenCreate && (
                                    <Button size="sm" variant="outline" onClick={onOpenCreate} className="w-full border-teal-200 text-teal-700">
                                        <Plus className="w-4 h-4 mr-2" /> Register New Device
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button
                        onClick={handleAssign}
                        disabled={loading || !selectedDevice}
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Link Device
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};