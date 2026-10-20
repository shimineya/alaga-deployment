import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/table";
import {
    Smartphone,
    Battery,
    Wifi,
    Search,
    RefreshCw,
    MoreVertical,
    Activity,
    Signal,
    Cpu,
    Link2,
    RotateCw,
    XCircle,
    Lock,
    Copy,
    Check,
    Eye,
    EyeOff
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { AddNewDeviceModal } from './AddNewDevice';

// --- TYPES ---
interface Device {
    serial_number: string;
    device_name: string;
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'STANDBY';
    is_online?: boolean;
    last_heartbeat: string;
    battery_level?: number | null;
    signal_strength?: string;
    assigned_room?: string; // Optional: To be populated if available
    firmware_version?: string;
    pending_firmware_version?: string | null;
    assigned_patient_id?: number | null;
    assigned_patient_baseline?: any;
    assigned_patient_name?: string;
    setup_password?: string;
}

export const MyDevices: React.FC = () => {
    const { token, user, isSysAdmin } = useAuth();
    const isSystemAdmin = isSysAdmin || (['system_admin', 'sysadmin', 'admin'].includes(user?.role?.toLowerCase() || '') && user?.role?.toLowerCase() !== 'facility_admin');
    const [devices, setDevices] = useState<Device[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        setCurrentPage(1);
        if (val.trim().length > 0) {
            const matches = devices
                .map(d => d.device_name)
                .filter(name => name.toLowerCase().includes(val.toLowerCase()));
            setSuggestions(Array.from(new Set(matches)));
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    // [HIPAA Audit Trail] Fetching device logs for oversight
    const fetchInventory = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                const mappedDevices = data.data.map((d: any) => {
                    const isOnline = d.status === 'ACTIVE' || Boolean(d.is_online);
                    return {
                        ...d,
                        device_name: d.device_name || 'Unknown Device',
                        status: (d.status || 'INACTIVE').toUpperCase(),
                        is_online: isOnline,
                        battery_level: d.battery_level !== undefined && d.battery_level !== null ? Number(d.battery_level) : null,
                        signal_strength: isOnline ? (d.signal_strength || 'Good') : 'No Signal',
                        assigned_patient_id: d.assigned_patient_id || null,
                        assigned_patient_name: d.assigned_patient_name || null,
                        assigned_room: d.assigned_patient_name ? `Patient: ${d.assigned_patient_name}` : 'Unassigned',
                        firmware_version: d.firmware_version || 'v1.0.0',
                        pending_firmware_version: d.pending_firmware_version || null,
                        assigned_patient_baseline: d.assigned_patient_baseline || null,
                        setup_password: d.setup_password || '@Password123'
                    };
                });
                setDevices(mappedDevices);
            }
        } catch (err) {
            if (showLoading) toast.error("Failed to sync device inventory.");
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    useEffect(() => { 
        fetchInventory(true);

        const handleRealtimeSync = (e: any) => {
            const detail = e?.detail;
            if (!detail) return;
            if (detail.type === 'device_status_update' || detail.type === 'patient_telemetry_update') {
                const sn = detail.serial_number;
                const newStatus = (detail.status || 'ACTIVE').toUpperCase();
                const newBattery = detail.battery_level !== undefined && detail.battery_level !== null ? Number(detail.battery_level) : undefined;
                const newSignal = detail.signal_strength;

                if (sn) {
                    setDevices(prev => prev.map(dev => {
                        if (dev.serial_number === sn) {
                            const isOnline = newStatus === 'ACTIVE';
                            return {
                                ...dev,
                                status: newStatus as any,
                                is_online: isOnline,
                                battery_level: newBattery !== undefined ? newBattery : dev.battery_level,
                                signal_strength: isOnline ? (newSignal || dev.signal_strength || 'Good') : 'No Signal',
                                last_heartbeat: detail.timestamp || new Date().toISOString()
                            };
                        }
                        return dev;
                    }));
                }
                // Silent refresh to fetch updated inventory without flickering
                fetchInventory(false);
            }
        };

        window.addEventListener('alaga_alert_update', handleRealtimeSync);
        const poll = setInterval(() => fetchInventory(false), 3000);

        return () => {
            window.removeEventListener('alaga_alert_update', handleRealtimeSync);
            clearInterval(poll);
        };
    }, [token]);

    // --- STATE ---
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'>('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isHotspotModalOpen, setIsHotspotModalOpen] = useState(false);
    const [selectedHotspotDevice, setSelectedHotspotDevice] = useState<Device | null>(null);

    // --- ACTIONS ---
    const handlePing = async (device: Device) => {
        const toastId = toast.loading(`Pinging ${device.device_name} (${device.serial_number})...`);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/${device.serial_number}/ping`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            toast.dismiss(toastId);
            if (data.success && data.is_online) {
                toast.success(data.message || `Device ${device.serial_number} is Online (${data.latencyMs ?? 20}ms)`);
            } else {
                toast.error(data.message || `Device ${device.serial_number} is Offline.`);
            }
            // Immediately refresh device inventory so status badge reflects real connection state!
            fetchInventory();
        } catch (err) {
            toast.dismiss(toastId);
            toast.error(`Error pinging device ${device.serial_number}`);
        }
    };

    const handleUpdateDeviceFirmware = async (device: Device) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/${device.serial_number}/update-firmware`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    targetVersion: device.pending_firmware_version || 'v2.4.0'
                })
            });
            const data = await res.json();
            if (data.success) {
                if (data.updatedNow) {
                    toast.success(data.message || `Firmware updated immediately on active device ${device.serial_number}!`);
                } else {
                    toast.info(data.message || `Device is offline. Firmware queued for auto-update when reconnected.`);
                }
                fetchInventory();
            } else {
                toast.error(data.message || "Failed to update firmware");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error updating firmware");
        }
    };

    const handleUpdateAllActiveDevices = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/update-all-active`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success) {
                if (data.updatedCount > 0) {
                    toast.success(`Pushed firmware update to ${data.updatedCount} active device(s)!`);
                } else {
                    toast.info("All active devices are already up to date.");
                }
                fetchInventory();
            } else {
                toast.error(data.message || "Failed to update active devices");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error updating active devices");
        }
    };

    const handleUnpairToChange = async (device: Device) => {
        const patientName = device.assigned_patient_name || 'the patient';
        if (!confirm(`Unpair ${device.device_name} (SN: ${device.serial_number}) for replacement?\n\nThis will place the device on Standby (e.g. low battery or faulty). It will remain saved in ${patientName}'s device list so you can re-pair or change it.`)) return;

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/unpair`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    serialNumber: device.serial_number,
                    action: 'change',
                    reason: 'Device faulty or low battery - standby for replacement'
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || "Device set to Standby for replacement. It remains saved to the patient record.");
                fetchInventory();
            } else {
                toast.error(data.message || "Failed to unpair device for replacement");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error during unpair to change");
        }
    };

    const handleUnpairPermanently = async (device: Device) => {
        const patientName = device.assigned_patient_name || 'the patient';
        if (!confirm(`Are you sure you want to permanently unpair ${device.device_name} (SN: ${device.serial_number})?\n\nThis will completely remove this device from ${patientName}'s device list.`)) return;

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/unpair`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    serialNumber: device.serial_number,
                    action: 'permanent'
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || "Device permanently removed from patient's device list.");
                fetchInventory();
            } else {
                toast.error(data.message || "Failed to permanently unpair device");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error during permanent unpair");
        }
    };

    const handlePairDevice = async (device: Device) => {
        // [USER REQUIREMENT] The pair device action is ONLY for devices that are already assigned to the patient!
        if (!device.assigned_patient_id) {
            toast.error("Cannot pair: This device is not currently assigned to any patient. Only devices already assigned to a patient can be paired.");
            return;
        }

        const patientName = device.assigned_patient_name || 'the patient';
        if (!confirm(`Pair ${device.device_name} (SN: ${device.serial_number}) to ${patientName}?\n\nThis will activate real-time vital signs and health monitoring for this patient.`)) return;

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/pair`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    serialNumber: device.serial_number,
                    patientId: device.assigned_patient_id
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || `Device paired successfully to ${patientName}! Readings will be captured seamlessly.`);
                fetchInventory();
            } else {
                toast.error(data.message || "Failed to pair device");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error during pair device");
        }
    };

    const handleArchive = async (device: Device) => {
        if (!confirm(`Are you sure you want to archive ${device.device_name} (SN: ${device.serial_number})? This will permanently remove the device from the whitelist registry.`)) return;

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/archive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ serialNumber: device.serial_number })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Device archived successfully");
                fetchInventory(); // Refresh list
            } else {
                toast.error(data.message || "Failed to archive device");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error during archival");
        }
    };

    // --- FILTERING & PAGINATION ---
    const filteredDevices = devices.filter(d => {
        const matchesSearch = (d.device_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (d.serial_number?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
    const paginatedDevices = filteredDevices.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="space-y-4 max-w-[1600px] mx-auto p-4 flex flex-col">
            {/* CONTROLS (Plain div, no card wrapper, kept in one line) */}
            <div className="flex flex-col sm:flex-row justify-end items-center gap-2 w-full pb-2">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* Status Filter */}
                    <select
                        className="h-9 rounded-md border border-slate-300 text-sm px-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                    >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="MAINTENANCE">Maintenance</option>
                    </select>

                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search devices..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onFocus={() => setShowSuggestions(suggestions.length > 0)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            className="pl-10 h-9"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                {suggestions.map((sug) => (
                                    <button
                                        key={sug}
                                        onClick={() => {
                                            setSearchQuery(sug);
                                            setCurrentPage(1);
                                            setShowSuggestions(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 hover:text-teal-700 text-slate-700 transition-colors"
                                    >
                                        {sug}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Refresh */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchInventory}
                        className="h-9 w-9 p-0"
                        title="Refresh List"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>

                    {/* Update All Active Devices */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUpdateAllActiveDevices}
                        className="h-9 border-blue-200 text-blue-700 hover:bg-blue-50 font-medium cursor-pointer"
                        title="Push latest firmware to all online active devices"
                    >
                        <Cpu className="w-4 h-4 mr-1.5 text-blue-600" />
                        Update All Active
                    </Button>

                    {/* Assign to Patient - for clinical, facility admin, and parent roles only */}
                    {!isSystemAdmin && (
                        <Button
                            size="sm"
                            onClick={() => setIsAssignModalOpen(true)}
                            className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                        >
                            <Activity className="w-4 h-4 mr-2" /> Assign to Patient
                        </Button>
                    )}

                    {/* Quick Add */}
                    <Button
                        size="sm"
                        onClick={() => setIsAddModalOpen(true)}
                        className="h-9 bg-teal-600 hover:bg-teal-700 text-white"
                    >
                        <Smartphone className="w-4 h-4 mr-2" /> Register Device
                    </Button>
                </div>
            </div>

            {/* TABLE */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/20">
                    <CardTitle className="text-xl font-bold text-slate-800">Patients' Devices</CardTitle>
                    <p className="text-slate-500 text-xs mt-1">Monitor devices, battery health, and assignments</p>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[230px]">Device Name</TableHead>
                                <TableHead>Assigned Patient</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Battery & Signal</TableHead>
                                {!isSystemAdmin && <TableHead>Location (Ward/Room/Bed)</TableHead>}
                                <TableHead>Firmware</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedDevices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={isSystemAdmin ? 6 : 7} className="text-center py-12 text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Search className="w-8 h-8 mb-2 opacity-20" />
                                            <p>No devices found matching your criteria.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedDevices.map((device) => {
                                    const isUnpaired = !device.assigned_patient_baseline && !device.assigned_patient_name && (!device.assigned_room || device.assigned_room === 'Unassigned');
                                    const isInactive = device.status === 'INACTIVE';
                                    const canArchive = !isSystemAdmin || (isUnpaired && isInactive);

                                    return (
                                        <TableRow key={device.serial_number} className="hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
                                                        <Smartphone className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col text-left">
                                                        <span className="text-slate-900 font-semibold">{device.device_name}</span>
                                                        <span className="text-[10px] text-slate-500 font-mono">SN: {device.serial_number}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {device.assigned_patient_name ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-200 shadow-xs">
                                                            {isSystemAdmin ? 'P' : device.assigned_patient_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex flex-col text-left">
                                                            <span className="font-semibold text-slate-900 text-sm">
                                                                {isSystemAdmin
                                                                    ? (device.assigned_patient_id ? `Patient #${device.assigned_patient_id} (De-identified)` : 'Assigned Patient (Protected)')
                                                                    : device.assigned_patient_name}
                                                            </span>
                                                            {device.status === 'STANDBY' && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-300 w-fit">
                                                                    Standby (Changing)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-sm">Unassigned</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`
                                                    ${device.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        device.status === 'STANDBY' ? 'bg-amber-50 text-amber-700 border-amber-300 font-medium' :
                                                        device.status === 'INACTIVE' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                                            'bg-amber-50 text-amber-700 border-amber-200'}
                                                `}>
                                                    {device.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5 tooltip-container" title={device.is_online ? `Battery Level: ${device.battery_level !== null && device.battery_level !== undefined ? `${device.battery_level}%` : 'Reading...'}` : 'Device Offline'}>
                                                        <Battery className={`w-4 h-4 ${!device.is_online ? 'text-slate-400' : (device.battery_level || 0) < 20 ? 'text-red-500' : 'text-emerald-500'}`} />
                                                        <span className={`text-xs font-medium ${device.is_online ? 'text-slate-700' : 'text-slate-400'}`}>
                                                            {device.battery_level !== null && device.battery_level !== undefined ? `${device.battery_level}%` : '--'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5" title={device.is_online ? `WiFi Signal: ${device.signal_strength || 'Online'}` : 'Device Offline / Powered Down'}>
                                                        <Signal className={`w-3.5 h-3.5 ${device.is_online ? 'text-blue-500' : 'text-slate-400'}`} />
                                                        <span className={`text-xs ${device.is_online ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                                                            {device.is_online ? (device.signal_strength || 'Good') : 'Offline'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            {!isSystemAdmin && (
                                                <TableCell>
                                                    <span className="text-sm text-slate-600">
                                                        {device.assigned_patient_baseline ? (
                                                            <span className="font-medium text-teal-600">
                                                                {device.assigned_patient_baseline.ward ? `${device.assigned_patient_baseline.ward} - ` : ''}
                                                                {device.assigned_patient_baseline.room} (Bed {device.assigned_patient_baseline.bed})
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic">Unassigned</span>
                                                        )}
                                                    </span>
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <div className="flex flex-col gap-1 items-start">
                                                    <Badge variant="secondary" className="font-mono text-[10px]">
                                                        {device.firmware_version}
                                                    </Badge>
                                                    {device.pending_firmware_version && (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-mono text-[9px] flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                            Pending {device.pending_firmware_version}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 ml-auto flex items-center justify-center">
                                                            <MoreVertical className="w-4 h-4 text-slate-400" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[230px]">
                                                        <DropdownMenuItem onClick={() => handlePing(device)}>
                                                            Ping Device
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => {
                                                            setSelectedHotspotDevice(device);
                                                            setIsHotspotModalOpen(true);
                                                        }}>
                                                            <Wifi className="w-3.5 h-3.5 mr-2 text-indigo-600" />
                                                            Wi-Fi Hotspot & Setup
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleUpdateDeviceFirmware(device)}>
                                                            <Cpu className="w-3.5 h-3.5 mr-2 text-blue-600" />
                                                            Push Firmware Update
                                                        </DropdownMenuItem>
                                                        {!isSystemAdmin && (
                                                            <>
                                                                {/* Pair Device: ONLY for devices already assigned to this patient */}
                                                                {device.assigned_patient_name && device.assigned_patient_id && device.status !== 'ACTIVE' && (
                                                                    <DropdownMenuItem
                                                                        className="text-teal-700 focus:text-teal-700 focus:bg-teal-50 font-semibold"
                                                                        onClick={() => handlePairDevice(device)}
                                                                    >
                                                                        <Link2 className="w-3.5 h-3.5 mr-2 text-teal-600" />
                                                                        Pair Device (Activate)
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {/* Unpair Device to Change (Faulty / Low Battery) */}
                                                                {device.assigned_patient_name && (
                                                                    <DropdownMenuItem
                                                                        className="text-amber-700 focus:text-amber-700 focus:bg-amber-50 font-medium"
                                                                        onClick={() => handleUnpairToChange(device)}
                                                                    >
                                                                        <RotateCw className="w-3.5 h-3.5 mr-2 text-amber-600" />
                                                                        Unpair Device to Change
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {/* Unpair Permanently */}
                                                                {device.assigned_patient_name && (
                                                                    <DropdownMenuItem
                                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50 font-medium"
                                                                        onClick={() => handleUnpairPermanently(device)}
                                                                    >
                                                                        <XCircle className="w-3.5 h-3.5 mr-2 text-red-500" />
                                                                        Unpair Permanently
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </>
                                                        )}
                                                        {canArchive && (
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600 focus:bg-red-50 font-semibold"
                                                                onClick={() => handleArchive(device)}
                                                            >
                                                                Archive Device
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* PAGINATION CONTROLS */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-2"
                    >
                        Previous
                    </Button>
                    <span className="text-xs text-slate-500 font-medium">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2"
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* QUICK ADD MODAL */}
            {/* Import AddNewDeviceModal first */}
            <AddNewDeviceModal
                isOpen={isAddModalOpen}
                onOpenChange={setIsAddModalOpen}
                onDeviceAdded={() => {
                    fetchInventory();
                    toast.success("Device list updated");
                }}
            />

            {/* ASSIGN DEVICE MODAL */}
            <AssignDeviceModal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                onSuccess={() => {
                    fetchInventory();
                }}
            />

            {/* HOTSPOT SETUP & PASSWORD MODAL */}
            <HotspotSetupModal
                isOpen={isHotspotModalOpen}
                onClose={() => {
                    setIsHotspotModalOpen(false);
                    setSelectedHotspotDevice(null);
                }}
                device={selectedHotspotDevice}
                onSuccess={() => {
                    fetchInventory();
                }}
            />
        </div>
    );
};

// --- ASSIGN DEVICE MODAL COMPONENT ---
interface AssignDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const AssignDeviceModal: React.FC<AssignDeviceModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { token } = useAuth();
    const [patientName, setPatientName] = useState('');
    const [choice, setChoice] = useState<'both' | 'diaper' | 'vital'>('both');
    const [smartDiaperSn, setSmartDiaperSn] = useState('');
    const [vitalSignsSn, setVitalSignsSn] = useState('');
    const [loading, setLoading] = useState(false);

    // Autocomplete states
    const [patientsList, setPatientsList] = useState<any[]>([]);
    const [patientSuggestions, setPatientSuggestions] = useState<any[]>([]);
    const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);

    const [devicesList, setDevicesList] = useState<any[]>([]);
    const [diaperSuggestions, setDiaperSuggestions] = useState<any[]>([]);
    const [showDiaperSuggestions, setShowDiaperSuggestions] = useState(false);
    const [vitalSuggestions, setVitalSuggestions] = useState<any[]>([]);
    const [showVitalSuggestions, setShowVitalSuggestions] = useState(false);

    // Reset when modal opens and fetch patient records under user's access scope
    useEffect(() => {
        if (isOpen) {
            setPatientName('');
            setChoice('both');
            setSmartDiaperSn('');
            setVitalSignsSn('');
            setPatientSuggestions([]);
            setShowPatientSuggestions(false);
            setDiaperSuggestions([]);
            setShowDiaperSuggestions(false);
            setVitalSuggestions([]);
            setShowVitalSuggestions(false);

            if (token) {
                const fetchPatientsAndDevices = async () => {
                    try {
                        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/patients`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const data = await res.json();
                        if (data.success && Array.isArray(data.data)) {
                            setPatientsList(data.data);
                        }
                    } catch (err) {
                        console.error("Error fetching patients list for autocomplete:", err);
                    }

                    try {
                        const resDev = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const dataDev = await resDev.json();
                        if (dataDev.success && Array.isArray(dataDev.data)) {
                            setDevicesList(dataDev.data);
                        }
                    } catch (err) {
                        console.error("Error fetching devices list for autocomplete:", err);
                    }
                };
                fetchPatientsAndDevices();
            }
        }
    }, [isOpen, token]);

    const handlePatientNameChange = (val: string) => {
        setPatientName(val);
        if (val.trim().length > 0) {
            const filtered = patientsList.filter(p =>
                p.name.toLowerCase().includes(val.toLowerCase())
            );
            setPatientSuggestions(filtered);
            setShowPatientSuggestions(true);
        } else {
            setPatientSuggestions([]);
            setShowPatientSuggestions(false);
        }
    };

    const handleDiaperChange = (val: string) => {
        setSmartDiaperSn(val);
        if (val.trim().length > 0) {
            const filtered = devicesList.filter(d =>
                (d.serial_number.toUpperCase().includes(val.toUpperCase()) ||
                d.device_name.toLowerCase().includes(val.toLowerCase())) &&
                d.serial_number.toUpperCase().startsWith('SD-')
            );
            if (filtered.length > 0) {
                setDiaperSuggestions(filtered);
            } else {
                setDiaperSuggestions(devicesList.filter(d =>
                    d.serial_number.toUpperCase().includes(val.toUpperCase()) ||
                    d.device_name.toLowerCase().includes(val.toLowerCase())
                ));
            }
            setShowDiaperSuggestions(true);
        } else {
            setDiaperSuggestions([]);
            setShowDiaperSuggestions(false);
        }
    };

    const handleVitalChange = (val: string) => {
        setVitalSignsSn(val);
        if (val.trim().length > 0) {
            const filtered = devicesList.filter(d =>
                (d.serial_number.toUpperCase().includes(val.toUpperCase()) ||
                d.device_name.toLowerCase().includes(val.toLowerCase())) &&
                d.serial_number.toUpperCase().startsWith('VS-')
            );
            if (filtered.length > 0) {
                setVitalSuggestions(filtered);
            } else {
                setVitalSuggestions(devicesList.filter(d =>
                    d.serial_number.toUpperCase().includes(val.toUpperCase()) ||
                    d.device_name.toLowerCase().includes(val.toLowerCase())
                ));
            }
            setShowVitalSuggestions(true);
        } else {
            setVitalSuggestions([]);
            setShowVitalSuggestions(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientName.trim()) {
            toast.error("Patient name is required");
            return;
        }

        const isDiaperRequired = choice === 'both' || choice === 'diaper';
        const isVitalRequired = choice === 'both' || choice === 'vital';

        if (isDiaperRequired && !smartDiaperSn.trim()) {
            toast.error("Smart Diaper Moisture Sensor serial number is required");
            return;
        }
        if (isVitalRequired && !vitalSignsSn.trim()) {
            toast.error("Vital Signs Sensor serial number is required");
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patientName: patientName.trim(),
                    smartDiaperSn: isDiaperRequired ? smartDiaperSn.trim() : null,
                    vitalSignsSn: isVitalRequired ? vitalSignsSn.trim() : null
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || "Devices assigned successfully!");
                onSuccess();
                onClose();
            } else {
                toast.error(data.message || "Failed to assign devices");
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Network error: Failed to assign devices");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-800 font-bold">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        Assign Devices to Patient
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Assign Smart Diaper Moisture Sensor and/or Vital Signs Sensor devices to a patient by their registered name.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-1.5 relative">
                        <Label htmlFor="patientName" className="text-slate-700 font-semibold">Patient Name</Label>
                        <Input
                            id="patientName"
                            placeholder="e.g. Juan Dela Cruz"
                            value={patientName}
                            onChange={(e) => handlePatientNameChange(e.target.value)}
                            onFocus={() => setShowPatientSuggestions(patientSuggestions.length > 0)}
                            onBlur={() => setTimeout(() => setShowPatientSuggestions(false), 200)}
                            required
                            className="h-9 text-sm"
                            autoComplete="off"
                        />
                        {showPatientSuggestions && patientSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                                {patientSuggestions.map((pat) => (
                                    <button
                                        key={pat.patient_id}
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            setPatientName(pat.name);
                                            setShowPatientSuggestions(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-colors border-b border-slate-50 last:border-b-0"
                                    >
                                        <span className="font-semibold">{pat.name}</span>
                                        <span className="text-[10px] text-slate-400 ml-2">(ID: {pat.patient_id})</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="deviceChoice" className="text-slate-700 font-semibold">Devices to Pair</Label>
                        <select
                            id="deviceChoice"
                            value={choice}
                            onChange={(e) => setChoice(e.target.value as any)}
                            className="w-full h-9 rounded-md border border-slate-300 text-sm px-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            <option value="both">Partnered Devices</option>
                            <option value="diaper">Smart Diaper Moisture Sensor Only</option>
                            <option value="vital">Vital Signs Sensor Only</option>
                        </select>
                    </div>

                    {(choice === 'both' || choice === 'diaper') && (
                        <div className="space-y-1.5 relative animate-in fade-in duration-200">
                            <Label htmlFor="smartDiaperSn" className="text-slate-700 font-semibold">Smart Diaper Moisture Sensor</Label>
                            <Input
                                id="smartDiaperSn"
                                placeholder="e.g. SD-2026-0001"
                                value={smartDiaperSn}
                                onChange={(e) => handleDiaperChange(e.target.value)}
                                onFocus={() => setShowDiaperSuggestions(diaperSuggestions.length > 0)}
                                onBlur={() => setTimeout(() => setShowDiaperSuggestions(false), 200)}
                                required
                                className="h-9 text-sm font-mono"
                                autoComplete="off"
                            />
                            {showDiaperSuggestions && diaperSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                                    {diaperSuggestions.map((d) => {
                                        const isAssigned = !!d.assigned_patient_name;
                                        return (
                                            <button
                                                key={d.serial_number}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    if (isAssigned) {
                                                        e.preventDefault();
                                                        return;
                                                    }
                                                    e.preventDefault();
                                                    setSmartDiaperSn(d.serial_number);
                                                    setShowDiaperSuggestions(false);
                                                }}
                                                disabled={isAssigned}
                                                className={`w-full text-left px-3 py-2 text-xs border-b border-slate-50 last:border-b-0 transition-colors ${
                                                    isAssigned 
                                                        ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60' 
                                                        : 'hover:bg-indigo-50 hover:text-indigo-700 text-slate-700'
                                                }`}
                                            >
                                                <span className="font-semibold font-mono">{d.serial_number}</span>
                                                <span className="text-[10px] ml-2">
                                                    {isAssigned 
                                                        ? `(Assigned to ${d.assigned_patient_name})` 
                                                        : `(${d.device_name})`
                                                    }
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {(choice === 'both' || choice === 'vital') && (
                        <div className="space-y-1.5 relative animate-in fade-in duration-200">
                            <Label htmlFor="vitalSignsSn" className="text-slate-700 font-semibold">Vital Signs Sensor</Label>
                            <Input
                                id="vitalSignsSn"
                                placeholder="e.g. VS-2026-0001"
                                value={vitalSignsSn}
                                onChange={(e) => handleVitalChange(e.target.value)}
                                onFocus={() => setShowVitalSuggestions(vitalSuggestions.length > 0)}
                                onBlur={() => setTimeout(() => setShowVitalSuggestions(false), 200)}
                                required
                                className="h-9 text-sm font-mono"
                                autoComplete="off"
                            />
                            {showVitalSuggestions && vitalSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                                    {vitalSuggestions.map((d) => {
                                        const isAssigned = !!d.assigned_patient_name;
                                        return (
                                            <button
                                                key={d.serial_number}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    if (isAssigned) {
                                                        e.preventDefault();
                                                        return;
                                                    }
                                                    e.preventDefault();
                                                    setVitalSignsSn(d.serial_number);
                                                    setShowVitalSuggestions(false);
                                                }}
                                                disabled={isAssigned}
                                                className={`w-full text-left px-3 py-2 text-xs border-b border-slate-50 last:border-b-0 transition-colors ${
                                                    isAssigned 
                                                        ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60' 
                                                        : 'hover:bg-indigo-50 hover:text-indigo-700 text-slate-700'
                                                }`}
                                            >
                                                <span className="font-semibold font-mono">{d.serial_number}</span>
                                                <span className="text-[10px] ml-2">
                                                    {isAssigned 
                                                        ? `(Assigned to ${d.assigned_patient_name})` 
                                                        : `(${d.device_name})`
                                                    }
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="h-9 text-xs">
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-9 text-xs" disabled={loading}>
                            {loading ? "Assigning..." : "Assign Device"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

// --- HOTSPOT SETUP MODAL COMPONENT ---
interface HotspotSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: Device | null;
    onSuccess: () => void;
}

export const HotspotSetupModal: React.FC<HotspotSetupModalProps> = ({ isOpen, onClose, device, onSuccess }) => {
    const { token } = useAuth();
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (device) {
            setPassword(device.setup_password || '@Password123');
            setNewPassword('');
            setIsEditing(false);
            setCopied(false);
            setShowPassword(false);
            setShowNewPassword(false);
        }
    }, [device, isOpen]);

    if (!device) return null;

    const hotspotSSID = `ALAGA-${device.serial_number}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        toast.success("Hotspot password copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSavePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPassword || newPassword.trim().length < 8) {
            toast.error("Password must be at least 8 characters long (WPA2 standard).");
            return;
        }

        setIsUpdating(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/${device.serial_number}/setup-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ setupPassword: newPassword.trim() })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(data.message || "Hotspot setup password updated!");
                setPassword(newPassword.trim());
                setIsEditing(false);
                setNewPassword('');
                onSuccess();
            } else {
                toast.error(data.message || "Failed to update hotspot password");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error updating hotspot password");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg w-[95vw] bg-white p-0 gap-0 overflow-hidden max-h-[88vh] flex flex-col rounded-2xl shadow-2xl">
                <DialogHeader className="px-6 py-4 pr-12 bg-slate-50/90 border-b border-slate-100 flex flex-row items-center gap-3 shrink-0">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                        <Wifi className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-base font-bold text-slate-800">
                            Device Setup Wi-Fi & Hotspot
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 truncate">
                            {device.device_name} &bull; <span className="font-mono">{device.serial_number}</span>
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
                    {/* Hotspot Credentials Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Setup Hotspot SSID</span>
                            <Badge variant="outline" className="font-mono text-[11px] bg-white border-slate-300 text-slate-700">
                                WPA2-PSK
                            </Badge>
                        </div>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg font-mono text-sm font-bold text-indigo-600 select-all">
                            {hotspotSSID}
                        </div>

                        <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hotspot Password</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                                    >
                                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copied ? "Copied" : "Copy"}
                                    </button>
                                </div>
                            </div>
                            <div className="p-2.5 bg-white border border-slate-200 rounded-lg font-mono text-sm text-slate-800 flex items-center justify-between">
                                <span>{showPassword ? password : "••••••••••••"}</span>
                                <Badge className="text-[10px] bg-slate-100 text-slate-600 hover:bg-slate-100 font-normal">
                                    Device Password
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Change Hotspot Password Section */}
                    <div className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-bold text-slate-800">Change Setup Hotspot Password</span>
                            </div>
                            {!isEditing ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                    onClick={() => setIsEditing(true)}
                                >
                                    Edit Password
                                </Button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => { setIsEditing(false); setNewPassword(''); }}
                                    className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 mb-3">
                            You can customize the password required when connecting your phone or PC to this device from your Wi-Fi list during setup.
                        </p>

                        {isEditing && (
                            <form onSubmit={handleSavePassword} className="space-y-3 pt-2">
                                <div className="space-y-1">
                                    <Label htmlFor="newHotspotPass" className="text-xs font-semibold text-slate-700">New Hotspot Password (min 8 chars)</Label>
                                    <div className="relative">
                                        <Input
                                            id="newHotspotPass"
                                            type={showNewPassword ? "text" : "password"}
                                            placeholder="Enter new 8+ char password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="h-9 text-xs pr-10 font-mono"
                                            minLength={8}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setIsEditing(false); setNewPassword(''); }}
                                        className="h-8 text-xs"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={isUpdating || newPassword.trim().length < 8}
                                        className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        {isUpdating ? "Saving..." : "Save Password"}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Step-by-Step Standalone Battery Guide */}
                    <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 space-y-2.5">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                            🔋 How to Connect Device on Battery (No Cable)
                        </span>
                        <ol className="text-[11px] text-emerald-900/90 list-decimal list-inside space-y-1.5 leading-relaxed">
                            <li>Disconnect USB cable and switch the device <b>ON</b> using its battery power.</li>
                            <li>Open Wi-Fi on your phone or PC and connect to <b>{hotspotSSID}</b>.</li>
                            <li>Enter the hotspot password above (default: <code>@Password123</code>).</li>
                            <li>Open your browser and navigate to <a href="http://192.168.4.1/setup" target="_blank" rel="noreferrer" className="font-bold underline text-emerald-700 hover:text-emerald-900">http://192.168.4.1/setup</a>.</li>
                            <li>Select your home Wi-Fi and save. The device will auto-reconnect and transmit live telemetry to ALAGA!</li>
                        </ol>
                    </div>
                </div>

                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                    <Button onClick={onClose} variant="outline" className="h-9 text-xs">
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
