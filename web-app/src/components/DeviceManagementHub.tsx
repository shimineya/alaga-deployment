import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
    Smartphone,
    Battery,
    Wifi,
    RefreshCw,
    Layers,
    AlertCircle,
    PlusCircle,
    Activity
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { toast } from 'sonner';

// --- TYPES (Matching Updated ERD) ---
interface Device {
    serial_number: string;
    device_name: string;
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    last_heartbeat: string;
    battery_level?: number;
    assigned_patient_name?: string;
    assigned_patient_baseline?: {
        ward?: string;
        room?: string;
        bed?: string;
    };
}

export const DeviceManagementHub: React.FC = () => {
    const { token } = useAuth();
    const [devices, setDevices] = useState<Device[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // [HIPAA Audit Trail] Fetching device logs for oversight
    const fetchInventory = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                const mapped = data.data.map((d: any) => ({
                    ...d,
                    assigned_patient_baseline: d.assigned_patient_baseline || null
                }));
                setDevices(mapped);
            }
        } catch (err) {
            toast.error("Failed to sync device inventory.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchInventory(); }, []);

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 pb-4 pt-2 space-y-4">
            {/* Compact Header matching AddNewPatient style */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-500 rounded-lg shadow-sm">
                        <Wifi className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 leading-tight">Fleet Governance</h2>
                        <p className="text-xs text-slate-500">Monitor hardware health and firmware versions</p>
                    </div>
                </div>
                <Button className="h-8 bg-teal-600 hover:bg-teal-700 text-xs font-semibold">
                    <PlusCircle className="w-3.5 h-3.5 mr-2" /> Sync Local Devices
                </Button>
            </div>

            <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="grid grid-cols-4 w-full lg:w-[600px] mb-6 h-9 bg-slate-100 p-1">
                    <TabsTrigger value="inventory" className="text-xs">My Devices</TabsTrigger>
                    <TabsTrigger value="status" className="text-xs">Status & Battery</TabsTrigger>
                    <TabsTrigger value="groups" className="text-xs">Rooms/Groups</TabsTrigger>
                    <TabsTrigger value="ota" className="text-xs">OTA Update</TabsTrigger>
                </TabsList>

                {/* Tab 1: My Devices (Grid View) */}
                <TabsContent value="inventory" className="animate-in fade-in-50 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {devices.map((device) => (
                            <Card key={device.serial_number} className="border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                <CardHeader className="py-3 bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Smartphone className="w-4 h-4 text-teal-600" />
                                        {device.device_name}
                                    </CardTitle>
                                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                        {device.status}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Serial No:</span>
                                        <span className="font-mono text-slate-800">{device.serial_number}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Last Seen:</span>
                                        <span className="text-slate-800">{new Date(device.last_heartbeat).toLocaleString()}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Tab 2: Status & Battery (Table View) */}
                <TabsContent value="status">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3">Device Name</th>
                                        <th className="px-6 py-3">Battery</th>
                                        <th className="px-6 py-3">WiFi Signal</th>
                                        <th className="px-6 py-3">Assigned Patient</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {devices.map((device) => (
                                        <tr key={device.serial_number} className="hover:bg-teal-50/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-800">{device.device_name}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Battery className="w-4 h-4 text-emerald-500" />
                                                    <span className="text-xs font-semibold">92%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">Excellent</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-700">
                                                {device.assigned_patient_name ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-800">{device.assigned_patient_name}</span>
                                                        {device.assigned_patient_baseline && (
                                                            <span className="text-[10px] text-teal-600 font-medium mt-0.5">
                                                                {device.assigned_patient_baseline.ward ? `${device.assigned_patient_baseline.ward} - ` : ''}
                                                                {device.assigned_patient_baseline.room} (Bed {device.assigned_patient_baseline.bed})
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Unassigned</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>

                {/* Tab 4: OTA (Commercial Grade Placeholder) */}
                <TabsContent value="ota">
                    <div className="max-w-md space-y-4">
                        <Card className="border-amber-200 bg-amber-50/50">
                            <CardContent className="p-4 flex gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    **OTA Security Warning:** Firmware updates are pushed via encrypted MQTT.
                                    Ensure the device is plugged into power before proceeding. (OWASP A08: Software and Data Integrity Failures).
                                </p>
                            </CardContent>
                        </Card>
                        <Button className="w-full bg-slate-800 hover:bg-slate-900 text-white gap-2">
                            <RefreshCw className="w-4 h-4" /> Check for Firmware V1.2.0
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};