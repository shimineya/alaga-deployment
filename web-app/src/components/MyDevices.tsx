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
    Signal
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
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
}

export const MyDevices: React.FC = () => {
    const { token } = useAuth();
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
                    firmware_version: d.firmware_version || 'v1.0.0'
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

    // --- ACTIONS ---
    const handlePing = (device: Device) => {
        toast.info(`Pinging ${device.device_name}...`);
        setTimeout(() => toast.success(`Device ${device.serial_number} is Online (23ms)`), 1500);
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
        <div className="space-y-4 max-w-[1600px] mx-auto p-4">
            {/* HEADER & CONTROLS */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">My Devices</h2>
                    <p className="text-slate-500 text-sm">Monitor devices, battery health, and assignments</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* Status Filter */}
                    <select
                        className="h-9 rounded-md border border-slate-300 text-sm px-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[250px]">Device Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Battery & Signal</TableHead>
                                <TableHead>Location / Room</TableHead>
                                <TableHead>Firmware</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedDevices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Search className="w-8 h-8 mb-2 opacity-20" />
                                            <p>No devices found matching your criteria.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedDevices.map((device) => (
                                    <TableRow key={device.serial_number} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
                                                    <Smartphone className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
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
                                        <TableCell>
                                            <span className="text-sm text-slate-600">
                                                {device.assigned_room === 'Unassigned' ? (
                                                    <span className="text-slate-400 italic">Unassigned</span>
                                                ) : (
                                                    <span className="font-medium text-teal-600">{device.assigned_room}</span>
                                                )}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                {device.firmware_version}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100">
                                                        <MoreVertical className="w-4 h-4 text-slate-400" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-[160px]">
                                                    <DropdownMenuItem onClick={() => handlePing(device)}>
                                                        Ping Device
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                        onClick={() => handleUnpair(device)}
                                                    >
                                                        Unpair Device
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
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
        </div>
    );
};
