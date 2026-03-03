import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Link2, Link2Off, RefreshCw, Box, Search, Filter } from "lucide-react";

// Types matching the API response
interface InventoryItem {
    mac_address: string;
    device_name: string;
    status: string;
    assigned_patient_id: number | null;
    first_name?: string; // Patient name
    last_name?: string; // Patient name
    last_serviced_at: string;
}

interface PatientOption {
    patient_id: number;
    first_name: string;
    last_name: string;
}

export default function InventoryManagement() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Modal State
    const [patients, setPatients] = useState<PatientOption[]>([]);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedMac, setSelectedMac] = useState<string | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<string>("");

    // 1. Fetch Inventory
    const fetchInventory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/inventory`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setItems(data.data);
                setFilteredItems(data.data);
            }
        } catch (err) {
            toast.error("Failed to load inventory");
        } finally {
            setLoading(false);
        }
    };

    // 2. Fetch Active Patients (for Dropdown)
    const fetchPatients = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/patients/active`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setPatients(data.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    // [Feature] Filter Logic
    useEffect(() => {
        let result = items;

        // 1. Text Search
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            result = result.filter(item =>
                item.device_name.toLowerCase().includes(lower) ||
                item.mac_address.toLowerCase().includes(lower) ||
                (item.first_name && item.first_name.toLowerCase().includes(lower)) ||
                (item.last_name && item.last_name.toLowerCase().includes(lower))
            );
        }

        // 2. Status Filter
        if (statusFilter !== "all") {
            if (statusFilter === "in_use") {
                result = result.filter(item => item.assigned_patient_id !== null);
            } else if (statusFilter === "available") {
                result = result.filter(item => item.assigned_patient_id === null);
            }
        }

        setFilteredItems(result);
    }, [searchQuery, statusFilter, items]);

    // Handler: Open Assign Modal
    const openAssignModal = (mac: string) => {
        setSelectedMac(mac);
        fetchPatients(); // Refresh list to show only unassigned patients
        setIsAssignOpen(true);
    };

    // Handler: Submit Assignment
    const handleAssign = async () => {
        if (!selectedPatient || !selectedMac) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/inventory/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    mac_address: selectedMac,
                    patient_id: parseInt(selectedPatient)
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success("Device Assigned Successfully");
                setIsAssignOpen(false);
                setSelectedPatient("");
                fetchInventory(); // Refresh table
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            toast.error("Assignment Failed");
        }
    };

    // Handler: Unassign (Quick Action)
    const handleUnassign = async (mac: string) => {
        if (!confirm("Are you sure? This will disconnect the patient from the device.")) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/inventory/unassign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ mac_address: mac })
            });

            const data = await res.json();
            if (data.success) {
                toast.success("Device Unassigned");
                fetchInventory();
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            toast.error("Action Failed");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Inventory & Assignments</h2>
                    <p className="text-muted-foreground">Manage hardware allocation to patients.</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {/* Search Input */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by MAC, Name..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px]">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                <SelectValue placeholder="Status" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Devices</SelectItem>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="in_use">In Use</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon" onClick={fetchInventory} title="Refresh">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Device Allocation ({filteredItems.length})</CardTitle>
                    <CardDescription>
                        Link physical ESP32 units to patient records.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Device Details</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Assigned To</TableHead>
                                <TableHead>Last Serviced</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No devices match your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item) => (
                                    <TableRow key={item.mac_address}>
                                        <TableCell>
                                            <div className="font-medium flex items-center gap-2">
                                                <Box className="w-4 h-4 text-slate-500" />
                                                {item.device_name}
                                            </div>
                                            <div className="text-xs font-mono text-muted-foreground ml-6">
                                                {item.mac_address}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {item.assigned_patient_id ? (
                                                <Badge className="bg-teal-600 hover:bg-teal-700">In Use</Badge>
                                            ) : (
                                                <Badge variant="secondary">Available</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.assigned_patient_id ? (
                                                <div className="text-sm font-medium">
                                                    {item.first_name} {item.last_name}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs italic">Unassigned</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {item.last_serviced_at ? new Date(item.last_serviced_at).toLocaleDateString() : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {item.assigned_patient_id ? (
                                                <Button
                                                    size="sm" variant="destructive"
                                                    onClick={() => handleUnassign(item.mac_address)}
                                                >
                                                    <Link2Off className="w-4 h-4 mr-2" /> Unassign
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm" className="bg-teal-600 hover:bg-teal-700"
                                                    onClick={() => openAssignModal(item.mac_address)}
                                                >
                                                    <Link2 className="w-4 h-4 mr-2" /> Assign
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* ASSIGNMENT MODAL */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Device to Patient</DialogTitle>
                        <DialogDescription>
                            Select an active patient to link with device <b>{selectedMac}</b>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <Select onValueChange={setSelectedPatient} value={selectedPatient}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Patient..." />
                            </SelectTrigger>
                            <SelectContent>
                                {patients.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">No unassigned patients found</div>
                                ) : (
                                    patients.map(p => (
                                        <SelectItem key={p.patient_id} value={p.patient_id.toString()}>
                                            {p.first_name} {p.last_name}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssign} disabled={!selectedPatient}>Confirm Assignment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}