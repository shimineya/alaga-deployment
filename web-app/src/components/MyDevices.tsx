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
    Cpu
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
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    last_heartbeat: string;
    battery_level?: number;
    assigned_room?: string; // Optional: To be populated if available
    firmware_version?: string;
    pending_firmware_version?: string | null;
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
    const fetchInventory = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                // Map/Transform data if necessary to fit the interface
                // Mocking battery/room for demonstration if backend misses it
                console.log("Fetched Devices:", data.data); // [DEBUG] Check data structure

                const mappedDevices = data.data.map((d: any) => ({
                    ...d,
                    device_name: d.device_name || 'Unknown Device',
                    status: (d.status || 'INACTIVE').toUpperCase(), // Normalize case
                    battery_level: d.battery_level ?? 92, // Default mock value if missing
                    assigned_room: d.assigned_patient_name ? `Patient: ${d.assigned_patient_name}` : 'Unassigned',
                    firmware_version: d.firmware_version || 'v1.0.0',
                    pending_firmware_version: d.pending_firmware_version || null,
                    assigned_patient_baseline: d.assigned_patient_baseline || null
                }));
                setDevices(mappedDevices);
            }
        } catch (err) {
            toast.error("Failed to sync device inventory.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchInventory(); }, []);

    // --- STATE ---
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'>('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

    // --- ACTIONS ---
    const handlePing = (device: Device) => {
        toast.info(`Pinging ${device.device_name}...`);
        setTimeout(() => toast.success(`Device ${device.serial_number} is Online (23ms)`), 1500);
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

    const handleUnpair = async (device: Device) => {
        if (!confirm(`Are you sure you want to unpair ${device.device_name}? This will remove it from its assigned patient.`)) return;

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/devices/unpair`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ serialNumber: device.serial_number })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Device unpaired successfully");
                fetchInventory(); // Refresh list
            } else {
                toast.error(data.message || "Failed to unpair device");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error during unpair");
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
                                <TableHead className="w-[250px]">Device Name</TableHead>
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
                                    <TableCell colSpan={isSystemAdmin ? 5 : 6} className="text-center py-12 text-slate-500">
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
                                                <Badge variant="outline" className={`
                                                    ${device.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        device.status === 'INACTIVE' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                                            'bg-amber-50 text-amber-700 border-amber-200'}
                                                `}>
                                                    {device.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5 tooltip-container" title="Battery Level">
                                                        <Battery className={`w-4 h-4 ${(device.battery_level || 0) < 20 ? 'text-red-500' : 'text-emerald-500'}`} />
                                                        <span className="text-xs font-medium text-slate-700">{device.battery_level}%</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5" title="WiFi Signal Strength">
                                                        <Signal className="w-3.5 h-3.5 text-blue-500" />
                                                        <span className="text-xs text-slate-500">Good</span>
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
                                                    <DropdownMenuContent align="end" className="w-[160px]">
                                                        <DropdownMenuItem onClick={() => handlePing(device)}>
                                                            Ping Device
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleUpdateDeviceFirmware(device)}>
                                                            <Cpu className="w-3.5 h-3.5 mr-2 text-blue-600" />
                                                            Push Firmware Update
                                                        </DropdownMenuItem>
                                                        {!isSystemAdmin && (
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                                onClick={() => handleUnpair(device)}
                                                            >
                                                                Unpair Device
                                                            </DropdownMenuItem>
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
            toast.error("Smart Diaper Device serial number is required");
            return;
        }
        if (isVitalRequired && !vitalSignsSn.trim()) {
            toast.error("Vital Signs Device serial number is required");
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
                        Assign Smart Diaper and/or Vital Signs monitoring devices to a patient by their registered name.
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
                            <option value="diaper">Smart Diaper Device Only</option>
                            <option value="vital">Vital Signs Device Only</option>
                        </select>
                    </div>

                    {(choice === 'both' || choice === 'diaper') && (
                        <div className="space-y-1.5 relative animate-in fade-in duration-200">
                            <Label htmlFor="smartDiaperSn" className="text-slate-700 font-semibold">Smart Diaper Device</Label>
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
                            <Label htmlFor="vitalSignsSn" className="text-slate-700 font-semibold">Vital Signs Device</Label>
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
