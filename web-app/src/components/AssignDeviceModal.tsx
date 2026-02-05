import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { Wifi, X } from 'lucide-react';

interface Device {
    serial_number: string;
    device_name: string;
    status: string;
}

interface AssignDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: string;
    patientName: string;
    onSuccess: () => void;
}

export const AssignDeviceModal: React.FC<AssignDeviceModalProps> = ({
    isOpen,
    onClose,
    patientId,
    patientName,
    onSuccess
}) => {
    const { token } = useAuth();
    const [devices, setDevices] = useState<Device[]>([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // Fetch Available Devices
    useEffect(() => {
        if (isOpen) {
            setFetching(true);
            fetch('http://localhost:3000/api/caregiver/devices/available', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setDevices(data.data);
                    }
                })
                .catch(err => console.error("Failed to load devices", err))
                .finally(() => setFetching(false));
        }
    }, [isOpen, token]);

    const handleAssign = async () => {
        if (!selectedDevice) {
            toast.error("Please select a device.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('http://localhost:3000/api/assignments/device/link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patient_id: patientId,
                    serial_number: selectedDevice
                })
            });

            const data = await response.json();

            if (data.success) {
                toast.success(`Device linked to ${patientName}`);
                onSuccess();
                onClose();
                setSelectedDevice('');
            } else {
                toast.error(data.message || "Failed to link device");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Link Device</h3>
                        <p className="text-xs text-slate-500">For patient: {patientName}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="device-select">Select Available Device</Label>
                        {fetching ? (
                            <div className="p-3 text-sm text-center bg-slate-50 rounded border border-dashed text-slate-500">
                                scanning for devices...
                            </div>
                        ) : (
                            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                                <SelectTrigger id="device-select" className="w-full">
                                    <SelectValue placeholder="Choose a device..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {devices.length === 0 ? (
                                        <div className="p-2 text-sm text-gray-500 text-center">No available devices found.</div>
                                    ) : (
                                        devices.map(dev => (
                                            <SelectItem key={dev.serial_number} value={dev.serial_number}>
                                                <span className="flex items-center gap-2">
                                                    <Wifi className="w-3 h-3 text-emerald-500" />
                                                    {dev.device_name} ({dev.serial_number})
                                                </span>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                        <p className="text-xs text-slate-500">
                            Only 'Active' and unassigned devices are shown here.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleAssign} disabled={loading || !selectedDevice} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {loading ? 'Linking...' : 'Link Device'}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};
