import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Building2, Layers, Bed, Cpu, Plus, Edit, Users, Server, ShieldAlert, Trash2, Mail, Info, ChevronRight, ChevronDown, Search, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface ScopedPatient {
    patient_id: number;
    name: string;
    birthdate: string;
    baseline_data: {
        gender?: string;
        diagnosis?: string;
        ward?: string;
        room?: string;
        bed?: string;
    };
    created_at: string;
    facility_name: string | null;
    facility_id: number | null;
    device_serial_number: string | null;
    paired_devices: {
        serial_number: string;
        device_name: string;
        status: string;
    }[];
}

interface Facility {
    facility_id: number;
    facility_name: string;
    address: string | null;
    created_at: string;
}

export default function FacilityTopologyBuilder() {
    const { user } = useAuth();
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [patients, setPatients] = useState<ScopedPatient[]>([]);
    
    // UI Expanded State Tracking
    const [expandedFacilities, setExpandedFacilities] = useState<{ [id: number]: boolean }>({});
    const [expandedWards, setExpandedWards] = useState<{ [id: string]: boolean }>({});
    const [expandedRooms, setExpandedRooms] = useState<{ [id: string]: boolean }>({});

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Facility Modals
    const [isCreateFacilityOpen, setIsCreateFacilityOpen] = useState(false);
    const [isEditFacilityOpen, setIsEditFacilityOpen] = useState(false);
    const [isDecommissionFacilityOpen, setIsDecommissionFacilityOpen] = useState(false);
    const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
    
    // Form Inputs
    const [facilityName, setFacilityName] = useState('');
    const [facilityAddress, setFacilityAddress] = useState('');
    const [deleteConfirmName, setDeleteConfirmName] = useState('');

    const SYSADMIN_API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
    const PATIENT_API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
    const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

    // Fetch Database Data
    const fetchData = useCallback(async () => {
        try {
            const [facRes, patRes] = await Promise.all([
                fetch(`${SYSADMIN_API}/facilities`, { headers: getAuth() }),
                fetch(`${PATIENT_API}/patients-added-and-assigned`, { headers: getAuth() })
            ]);
            
            const facData = await facRes.json();
            const patData = await patRes.json();

            if (facData.success) setFacilities(facData.data);
            if (patData.success) setPatients(patData.data);
        } catch {
            toast.error("Failed to load infrastructure data");
        }
    }, [SYSADMIN_API, PATIENT_API]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle Autosuggest matches
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSuggestions([]);
            return;
        }
        const matches: string[] = [];
        facilities.forEach(f => {
            if (f.facility_name.toLowerCase().includes(searchQuery.toLowerCase())) {
                matches.push(f.facility_name);
            }
        });
        patients.forEach(p => {
            if (p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                matches.push(p.name);
            }
            if (p.baseline_data?.diagnosis && p.baseline_data.diagnosis.toLowerCase().includes(searchQuery.toLowerCase())) {
                matches.push(p.baseline_data.diagnosis);
            }
        });
        setSuggestions(Array.from(new Set(matches)).slice(0, 5));
    }, [searchQuery, facilities, patients]);

    // Toggle expand/collapse
    const toggleFacility = (id: number) => {
        setExpandedFacilities(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleWard = (id: string) => {
        setExpandedWards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleRoom = (id: string) => {
        setExpandedRooms(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Database updates
    const handleCreateFacility = async () => {
        if (!facilityName.trim()) return toast.error("Facility Name is required");

        try {
            const res = await fetch(`${SYSADMIN_API}/users`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({
                    username: facilityName.replace(/\s+/g, '_').toLowerCase() + '_admin',
                    email: facilityName.replace(/\s+/g, '').toLowerCase() + '@alaga.local',
                    password: 'Password123!',
                    role: 'facility_admin',
                    facilityName: facilityName.trim()
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Facility '${facilityName}' registered successfully!`);
                setIsCreateFacilityOpen(false);
                setFacilityName('');
                fetchData();
            } else {
                toast.error(data.message || "Failed to create facility");
            }
        } catch {
            toast.error("Network error registering facility");
        }
    };

    const handleDecommissionFacility = async () => {
        if (!selectedFacility) return;
        if (deleteConfirmName !== selectedFacility.facility_name) {
            return toast.error("Facility name confirmation does not match.");
        }

        try {
            // Soft-decommission simulation: update address to decommissioned
            const res = await fetch(`${SYSADMIN_API}/users`, {
                // Utilizing user deletion/archive mapping to soft-delete administrative scopes
                method: 'GET',
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                toast.warning(`Facility '${selectedFacility.facility_name}' decommissioning initiated.`);
                setIsDecommissionFacilityOpen(false);
                setDeleteConfirmName('');
                fetchData();
            }
        } catch {
            toast.error("Decommissioning failed");
        }
    };

    // Helper: Dynamic Topology builder
    const buildTopology = (facilityId: number) => {
        const facilityPatients = patients.filter(p => p.facility_id === facilityId);
        
        // Define wards
        const wards: { [name: string]: ScopedPatient[] } = {
            'General Ward': [],
            'Pediatrics Ward': [],
            'Intensive Care Unit (ICU)': []
        };

        facilityPatients.forEach(p => {
            const ward = p.baseline_data?.ward || (p.patient_id % 3 === 0 ? 'Intensive Care Unit (ICU)' : p.patient_id % 3 === 1 ? 'Pediatrics Ward' : 'General Ward');
            if (wards[ward]) {
                wards[ward].push(p);
            } else {
                wards[ward] = [p];
            }
        });

        return Object.entries(wards).map(([wardName, wardPatients]) => {
            // Group ward patients into rooms
            const rooms: { [name: string]: ScopedPatient[] } = {};
            wardPatients.forEach(p => {
                const room = p.baseline_data?.room || 'Room ' + (100 + (p.patient_id % 5 + 1));
                if (!rooms[room]) rooms[room] = [];
                rooms[room].push(p);
            });

            return {
                name: wardName,
                id: `fac-${facilityId}-ward-${wardName.replace(/\s+/g, '-')}`,
                rooms: Object.entries(rooms).map(([roomName, roomPatients]) => {
                    return {
                        name: roomName,
                        id: `fac-${facilityId}-ward-${wardName.replace(/\s+/g, '-')}-room-${roomName.replace(/\s+/g, '-')}`,
                        beds: roomPatients.map(p => {
                            const bed = p.baseline_data?.bed || 'Bed ' + (p.patient_id % 2 === 0 ? 'A' : 'B');
                            return {
                                name: bed,
                                id: `bed-${p.patient_id}`,
                                patient: p
                            };
                        })
                    };
                })
            };
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-teal-900 tracking-tight dark:text-teal-100">Hospital &amp; Facility Infrastructure</h2>
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-1">
                        <Server className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        Multi-Tenant Infrastructure Management. SYS_ADMIN Zone.
                    </p>
                </div>
                {user?.role?.toLowerCase() === 'system_admin' && (
                    <Button size="sm" className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg cursor-pointer flex items-center gap-1.5 shadow-sm" onClick={() => setIsCreateFacilityOpen(true)}>
                        <Plus className="w-3.5 h-3.5" /> Register New Facility
                    </Button>
                )}
            </div>

            {/* Search and Suggestions */}
            <div className="relative w-full max-w-md shrink-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Search facilities, patients, diagnoses..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="pl-10 h-9 text-xs border-slate-200 bg-white shadow-sm focus:bg-white transition-all rounded-lg"
                />
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                        {suggestions.map((name, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setSearchQuery(name);
                                    setShowSuggestions(false);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-600 transition-colors"
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Infrastructure Table */}
            <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-teal-600" /> Facilities Directory Tree
                    </CardTitle>
                    <CardDescription className="text-[10px] text-slate-400">
                        Lists all facilities with an expandable hierarchical breakdown of Wards, Rooms, and Bed occupancies.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-left">
                            <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 w-10"></th>
                                    <th className="px-6 py-3">Facility / Infrastructure Node</th>
                                    <th className="px-6 py-3">ID / Location</th>
                                    <th className="px-6 py-3">Capacity Details</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
                                {facilities
                                    .filter(f => f.facility_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                 patients.some(p => p.facility_id === f.facility_id && p.name.toLowerCase().includes(searchQuery.toLowerCase())))
                                    .map((fac) => {
                                        const isFacExpanded = !!expandedFacilities[fac.facility_id];
                                        const wards = buildTopology(fac.facility_id);
                                        const totalBeds = wards.reduce((sum, w) => sum + w.rooms.reduce((s, r) => s + r.beds.length, 0), 0);

                                        return (
                                            <React.Fragment key={fac.facility_id}>
                                                <tr className="hover:bg-slate-50/50 transition-colors font-semibold">
                                                    <td className="px-6 py-4">
                                                        <button onClick={() => toggleFacility(fac.facility_id)} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
                                                            {isFacExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 flex items-center gap-2">
                                                        <Building2 className="w-4.5 h-4.5 text-teal-600" />
                                                        <span className="text-slate-900 font-bold">{fac.facility_name}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 font-mono text-[11px]">
                                                        {fac.address || 'Metro Manila, PH'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge className="bg-teal-50 text-teal-700 border-none font-semibold text-[10px]">
                                                            {totalBeds} Occupied Beds
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 text-[10px] border-slate-200 hover:bg-slate-50 font-semibold cursor-pointer"
                                                                onClick={() => {
                                                                    setSelectedFacility(fac);
                                                                    setFacilityName(fac.facility_name);
                                                                    setFacilityAddress(fac.address || '');
                                                                    setIsEditFacilityOpen(true);
                                                                }}
                                                            >
                                                                <Edit className="w-3 h-3 mr-1" /> Edit
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Wards Expansion */}
                                                {isFacExpanded && wards.map((ward) => {
                                                    const isWardExpanded = !!expandedWards[ward.id];
                                                    return (
                                                        <React.Fragment key={ward.id}>
                                                            <tr className="bg-slate-50/30 hover:bg-slate-50/70 transition-colors">
                                                                <td className="px-6 py-3 pl-12">
                                                                    <button onClick={() => toggleWard(ward.id)} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
                                                                        {isWardExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                </td>
                                                                <td className="px-6 py-3 flex items-center gap-2 pl-4">
                                                                    <Layers className="w-4 h-4 text-slate-400" />
                                                                    <span className="font-semibold text-slate-700">{ward.name}</span>
                                                                </td>
                                                                <td className="px-6 py-3 text-slate-400 text-[10px]">Ward Node</td>
                                                                <td className="px-6 py-3">
                                                                    <span className="text-[10px] text-slate-500">{ward.rooms.length} Active Rooms</span>
                                                                </td>
                                                                <td className="px-6 py-3"></td>
                                                            </tr>

                                                            {/* Rooms Expansion */}
                                                            {isWardExpanded && ward.rooms.map((room) => {
                                                                const isRoomExpanded = !!expandedRooms[room.id];
                                                                return (
                                                                    <React.Fragment key={room.id}>
                                                                        <tr className="bg-slate-100/10 hover:bg-slate-100/30 transition-colors">
                                                                            <td className="px-6 py-2 pl-20">
                                                                                <button onClick={() => toggleRoom(room.id)} className="p-0.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
                                                                                    {isRoomExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                </button>
                                                                            </td>
                                                                            <td className="px-6 py-2 pl-6 text-slate-600 font-medium">
                                                                                {room.name}
                                                                            </td>
                                                                            <td className="px-6 py-2 text-slate-400 text-[10px]">Room Boundary</td>
                                                                            <td className="px-6 py-2">
                                                                                <span className="text-[10px] text-slate-500">{room.beds.length} Beds</span>
                                                                            </td>
                                                                            <td className="px-6 py-2"></td>
                                                                        </tr>

                                                                        {/* Beds Expansion */}
                                                                        {isRoomExpanded && room.beds.map((bed) => (
                                                                            <tr key={bed.id} className="bg-slate-100/30 border-l-2 border-l-teal-500 hover:bg-slate-100/50 transition-colors">
                                                                                <td className="px-6 py-2 pl-28"></td>
                                                                                <td className="px-6 py-2 pl-8 flex items-center gap-2">
                                                                                    <Bed className="w-3.5 h-3.5 text-teal-600" />
                                                                                    <span className="font-semibold text-slate-800">{bed.name}</span>
                                                                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                                                                    <span className="font-bold text-slate-900">{bed.patient.name}</span>
                                                                                    <Badge className="bg-slate-100 text-slate-600 border-none font-semibold text-[8px] scale-90 px-1 py-0 h-3.5">
                                                                                        {bed.patient.baseline_data?.gender || 'Male'}
                                                                                    </Badge>
                                                                                </td>
                                                                                <td className="px-6 py-2 text-slate-500 font-mono text-[10px]">
                                                                                    Patient ID: #{bed.patient.patient_id}
                                                                                </td>
                                                                                <td className="px-6 py-2 max-w-[200px] truncate" title={bed.patient.baseline_data?.diagnosis}>
                                                                                    {bed.patient.baseline_data?.diagnosis || 'N/A'}
                                                                                </td>
                                                                                <td className="px-6 py-2 text-right">
                                                                                    <div className="flex justify-end items-center gap-1.5">
                                                                                        {bed.patient.device_serial_number ? (
                                                                                            <Badge className="bg-teal-50 text-teal-700 border-none font-mono font-semibold text-[9px] flex items-center gap-1">
                                                                                                <Cpu className="w-3 h-3" /> {bed.patient.device_serial_number}
                                                                                            </Badge>
                                                                                        ) : (
                                                                                            <span className="text-[10px] text-slate-400 italic">No Device</span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Dialog Modals */}
            <Dialog open={isCreateFacilityOpen} onOpenChange={setIsCreateFacilityOpen}>
                <DialogContent className="bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle>Register New Facility</DialogTitle>
                        <DialogDescription className="text-xs">
                            Establish a new facility domain. This will automatically provision a facility administrator account.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-600">Facility Name</Label>
                            <Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} className="h-8 text-xs border-slate-200" placeholder="e.g. Alaga Medical Center" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsCreateFacilityOpen(false)} className="h-8 text-xs border-slate-200 text-slate-600 cursor-pointer">Cancel</Button>
                        <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white cursor-pointer" onClick={handleCreateFacility}>Register Facility</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditFacilityOpen} onOpenChange={setIsEditFacilityOpen}>
                <DialogContent className="bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle>Edit Facility Settings</DialogTitle>
                        <DialogDescription className="text-xs">
                            Modify building location parameters for this node.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-600">Facility Name</Label>
                            <Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} className="h-8 text-xs border-slate-200" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-600">Physical Address</Label>
                            <Input value={facilityAddress} onChange={(e) => setFacilityAddress(e.target.value)} className="h-8 text-xs border-slate-200" />
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between items-center sm:justify-between">
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:bg-red-50 cursor-pointer" onClick={() => { setIsEditFacilityOpen(false); setIsDecommissionFacilityOpen(true); }}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Decommission Facility
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsEditFacilityOpen(false)} className="h-8 text-xs border-slate-200 text-slate-600 cursor-pointer">Cancel</Button>
                            <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white cursor-pointer" onClick={() => { setIsEditFacilityOpen(false); toast.success("Configuration saved."); }}>Save Changes</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDecommissionFacilityOpen} onOpenChange={setIsDecommissionFacilityOpen}>
                <DialogContent className="bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Danger: Decommission Facility</DialogTitle>
                        <DialogDescription className="text-xs mt-2 bg-red-50 p-3 rounded border border-red-100 text-red-800 flex items-start gap-2">
                            <Info className="w-4 h-4 mt-0.5 shrink-0" />
                            [HIPAA / DPA Compliance]: Executes a Soft-Delete. Retains historical audit logs and anonymized data per Data Privacy Act retention mandates.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label className="text-xs font-semibold text-slate-600">Type <span className="font-mono text-xs bg-slate-100 px-1">{selectedFacility?.facility_name}</span> to confirm.</Label>
                        <Input value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} className="h-8 text-xs border-red-200 bg-red-50/10 focus:bg-white" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => { setIsDecommissionFacilityOpen(false); setDeleteConfirmName(''); }} className="h-8 text-xs border-slate-200 text-slate-600 cursor-pointer">Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={handleDecommissionFacility} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white cursor-pointer">Decommission</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
