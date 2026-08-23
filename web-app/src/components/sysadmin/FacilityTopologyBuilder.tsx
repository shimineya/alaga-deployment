import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Building2, Layers, Bed, Cpu, Plus, Edit, Users, Server, ShieldAlert, Trash2, Mail, Info, ChevronRight, ChevronDown, Search, ArrowRight, UserCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface BedNode {
    name: string;
    patientId: number | null;
}

interface RoomNode {
    name: string;
    beds: BedNode[];
}

interface WardNode {
    name: string;
    classification: 'general' | 'pediatrics' | 'icu';
    rooms: RoomNode[];
}

interface Facility {
    facility_id: number;
    facility_name: string;
    address: string | null;
    topology: WardNode[] | null;
    created_at: string;
}

interface ScopedPatient {
    patient_id: number;
    name: string;
    birthdate: string;
    baseline_data: {
        gender?: string;
        diagnosis?: string;
    };
    created_at: string;
    facility_id: number | null;
    device_serial_number: string | null;
}

export default function FacilityTopologyBuilder() {
    const { user } = useAuth();
    
    // Core Data
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [patients, setPatients] = useState<ScopedPatient[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [facilityAdmins, setFacilityAdmins] = useState<{ [facId: number]: string }>({});

    // Selection
    const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

    // Tree collapse states
    const [expandedFacilities, setExpandedFacilities] = useState<{ [id: number]: boolean }>({});
    const [expandedWards, setExpandedWards] = useState<{ [id: string]: boolean }>({});
    const [expandedRooms, setExpandedRooms] = useState<{ [id: string]: boolean }>({});

    // Search & Filter (Facility Details search)
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Facility Modals
    const [isCreateFacilityOpen, setIsCreateFacilityOpen] = useState(false);
    const [isEditFacilityOpen, setIsEditFacilityOpen] = useState(false);
    const [isDecommissionFacilityOpen, setIsDecommissionFacilityOpen] = useState(false);
    const [facilityName, setFacilityName] = useState('');
    const [facilityAddress, setFacilityAddress] = useState('');
    const [deleteConfirmName, setDeleteConfirmName] = useState('');

    // Admin Account input fields
    const [adminUsername, setAdminUsername] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');

    // Topology Add Modals
    const [isAddWardOpen, setIsAddWardOpen] = useState(false);
    const [wardForm, setWardForm] = useState({ name: '', classification: 'general' as any });

    const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
    const [roomForm, setRoomForm] = useState({ name: '', wardName: '' });
    const [wardSuggestions, setWardSuggestions] = useState<string[]>([]);
    const [showWardSuggestions, setShowWardSuggestions] = useState(false);

    const [isAddBedOpen, setIsAddBedOpen] = useState(false);
    const [bedForm, setBedForm] = useState({ name: '', roomName: '', wardName: '', patientId: '' as string });
    const [roomSuggestions, setRoomSuggestions] = useState<string[]>([]);
    const [showRoomSuggestions, setShowRoomSuggestions] = useState(false);

    const SYSADMIN_API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
    const PATIENT_API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
    const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

    // Fetch Database data
    const fetchData = useCallback(async () => {
        try {
            const [facRes, patRes, userRes] = await Promise.all([
                fetch(`${SYSADMIN_API}/facilities`, { headers: getAuth() }),
                fetch(`${PATIENT_API}/patients-added-and-assigned`, { headers: getAuth() }),
                fetch(`${SYSADMIN_API}/users`, { headers: getAuth() })
            ]);

            const facData = await facRes.json();
            const patData = await patRes.json();
            const userData = await userRes.json();

            if (facData.success) {
                setFacilities(facData.data);
                // Keep selected facility in sync
                if (selectedFacility) {
                    const updated = facData.data.find((f: Facility) => f.facility_id === selectedFacility.facility_id);
                    if (updated) setSelectedFacility(updated);
                } else if (facData.data.length > 0) {
                    setSelectedFacility(facData.data[0]);
                }
            }
            if (patData.success) setPatients(patData.data);

            if (userData.success && Array.isArray(userData.data)) {
                setUsers(userData.data);
                // Map administrators to facilities
                const adminMap: { [facId: number]: string } = {};
                userData.data.forEach((u: any) => {
                    if (u.role === 'facility_admin' && u.facility_id) {
                        adminMap[u.facility_id] = u.username;
                    }
                });
                setFacilityAdmins(adminMap);
            }
        } catch {
            toast.error("Failed to load infrastructure data");
        }
    }, [SYSADMIN_API, PATIENT_API, selectedFacility]);

    useEffect(() => {
        fetchData();
    }, []);

    // Search matches inside Facility Details search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSuggestions([]);
            return;
        }
        const matches = facilities
            .filter(f => f.facility_name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(f => f.facility_name);
        setSuggestions(matches.slice(0, 5));
    }, [searchQuery, facilities]);

    // Ward suggestions for Add Room
    useEffect(() => {
        if (!selectedFacility || !selectedFacility.topology) return;
        const query = roomForm.wardName.toLowerCase();
        const matches = selectedFacility.topology
            .filter(w => w.name.toLowerCase().includes(query))
            .map(w => w.name);
        setWardSuggestions(matches);
    }, [roomForm.wardName, selectedFacility]);

    // Room suggestions for Add Bed
    useEffect(() => {
        if (!selectedFacility || !selectedFacility.topology) return;
        const ward = selectedFacility.topology.find(w => w.name.toLowerCase() === bedForm.wardName.toLowerCase());
        if (!ward) {
            setRoomSuggestions([]);
            return;
        }
        const query = bedForm.roomName.toLowerCase();
        const matches = ward.rooms
            .filter(r => r.name.toLowerCase().includes(query))
            .map(r => r.name);
        setRoomSuggestions(matches);
    }, [bedForm.roomName, bedForm.wardName, selectedFacility]);

    // DB calls
    const handleRegisterFacilityAndAdmin = async () => {
        if (!facilityName.trim()) return toast.error("Facility Name is required");
        if (!adminUsername.trim()) return toast.error("Administrator Username is required");
        if (!adminEmail.trim()) return toast.error("Administrator Email is required");
        if (!adminPassword.trim()) return toast.error("Administrator Password is required");

        try {
            const res = await fetch(`${SYSADMIN_API}/users`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({
                    username: adminUsername.trim(),
                    email: adminEmail.trim(),
                    password: adminPassword.trim(),
                    role: 'facility_admin',
                    facility_name: facilityName.trim()
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Facility '${facilityName}' and administrator account registered successfully!`);
                setIsCreateFacilityOpen(false);
                setFacilityName('');
                setAdminUsername('');
                setAdminEmail('');
                setAdminPassword('');
                fetchData();
            } else {
                toast.error(data.message || "Failed to create facility and user");
            }
        } catch {
            toast.error("Network error registering facility");
        }
    };

    const handleUpdateFacility = async () => {
        if (!selectedFacility) return;
        if (!facilityName.trim()) return toast.error("Name is required");

        try {
            const res = await fetch(`${SYSADMIN_API}/facilities/${selectedFacility.facility_id}`, {
                method: 'PUT',
                headers: getAuth(),
                body: JSON.stringify({
                    facility_name: facilityName.trim(),
                    address: facilityAddress.trim()
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Facility details updated successfully!");
                setIsEditFacilityOpen(false);
                fetchData();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error("Failed to update facility");
        }
    };

    const handleDecommissionFacility = async () => {
        if (!selectedFacility) return;
        if (deleteConfirmName !== selectedFacility.facility_name) {
            return toast.error("Confirmation name does not match.");
        }

        try {
            const res = await fetch(`${SYSADMIN_API}/facilities/${selectedFacility.facility_id}`, {
                method: 'DELETE',
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                toast.warning(`Facility '${selectedFacility.facility_name}' decommissioned successfully.`);
                setIsDecommissionFacilityOpen(false);
                setSelectedFacility(null);
                setDeleteConfirmName('');
                fetchData();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error("Failed to decommission facility");
        }
    };

    const saveTopology = async (newTopology: WardNode[]) => {
        if (!selectedFacility) return;
        try {
            const res = await fetch(`${SYSADMIN_API}/facilities/${selectedFacility.facility_id}/topology`, {
                method: 'PUT',
                headers: getAuth(),
                body: JSON.stringify({ topology: newTopology })
            });
            const data = await res.json();
            if (data.success) {
                fetchData();
            } else {
                toast.error(data.message || "Failed to update topology");
            }
        } catch {
            toast.error("Network error saving topology configuration");
        }
    };

    // Add Ward
    const handleAddWard = () => {
        if (!selectedFacility) return;
        if (!wardForm.name.trim()) return toast.error("Ward Name is required");

        const currentTopology = selectedFacility.topology || [];
        if (currentTopology.some(w => w.name.toLowerCase() === wardForm.name.toLowerCase())) {
            return toast.error("A ward with this name already exists");
        }

        const updated: WardNode[] = [
            ...currentTopology,
            { name: wardForm.name.trim(), classification: wardForm.classification, rooms: [] }
        ];

        saveTopology(updated);
        setIsAddWardOpen(false);
        setWardForm({ name: '', classification: 'general' });
        toast.success("Ward added successfully!");
    };

    // Add Room
    const handleAddRoom = () => {
        if (!selectedFacility) return;
        if (!roomForm.name.trim()) return toast.error("Room Name is required");
        if (!roomForm.wardName.trim()) return toast.error("Ward target selection is required");

        const currentTopology = [...(selectedFacility.topology || [])];
        const targetWard = currentTopology.find(w => w.name.toLowerCase() === roomForm.wardName.toLowerCase());
        if (!targetWard) return toast.error("Selected ward classification not found in facility topology");

        if (targetWard.rooms.some(r => r.name.toLowerCase() === roomForm.name.toLowerCase())) {
            return toast.error("A room with this name already exists in this ward");
        }

        targetWard.rooms.push({ name: roomForm.name.trim(), beds: [] });
        saveTopology(currentTopology);
        setIsAddRoomOpen(false);
        setRoomForm({ name: '', wardName: '' });
        toast.success("Room provisioned successfully!");
    };

    // Add Bed
    const handleAddBed = () => {
        if (!selectedFacility) return;
        if (!bedForm.name.trim()) return toast.error("Bed Name is required");
        if (!bedForm.roomName.trim()) return toast.error("Room target selection is required");
        if (!bedForm.wardName.trim()) return toast.error("Ward target selection is required");

        const currentTopology = [...(selectedFacility.topology || [])];
        const targetWard = currentTopology.find(w => w.name.toLowerCase() === bedForm.wardName.toLowerCase());
        if (!targetWard) return toast.error("Selected ward not found");

        const targetRoom = targetWard.rooms.find(r => r.name.toLowerCase() === bedForm.roomName.toLowerCase());
        if (!targetRoom) return toast.error("Selected room not found");

        if (targetRoom.beds.some(b => b.name.toLowerCase() === bedForm.name.toLowerCase())) {
            return toast.error("A bed with this name already exists in this room");
        }

        targetRoom.beds.push({
            name: bedForm.name.trim(),
            patientId: bedForm.patientId ? parseInt(bedForm.patientId) : null
        });

        saveTopology(currentTopology);
        setIsAddBedOpen(false);
        setBedForm({ name: '', roomName: '', wardName: '', patientId: '' });
        toast.success("Bed provisioned successfully!");
    };

    // Calculations for Details Card
    const topology = selectedFacility?.topology || [];
    const totalWards = topology.length;
    const totalRooms = topology.reduce((sum, w) => sum + w.rooms.length, 0);
    const totalBeds = topology.reduce((sum, w) => sum + w.rooms.reduce((s, r) => s + r.beds.length, 0), 0);

    // Facility specific metrics
    const facilityCaregivers = selectedFacility 
        ? users.filter(u => u.role === 'caregiver' && u.facility_id === selectedFacility.facility_id).length 
        : 0;
    const facilityMedStaff = selectedFacility 
        ? users.filter(u => u.role === 'medical_staff' && u.facility_id === selectedFacility.facility_id).length 
        : 0;
    const facilityPatients = selectedFacility 
        ? patients.filter(p => p.facility_id === selectedFacility.facility_id).length 
        : 0;

    // System-wide calculations (for the 5 status cards)
    const systemWards = facilities.reduce((sum, f) => sum + (f.topology || []).length, 0);
    const systemRooms = facilities.reduce((sum, f) => sum + (f.topology || []).reduce((s, w) => s + w.rooms.length, 0), 0);
    const systemBeds = facilities.reduce((sum, f) => sum + (f.topology || []).reduce((s, w) => s + w.rooms.reduce((bSum, r) => bSum + r.beds.length, 0), 0), 0);

    return (
        <div className="space-y-6">
            
            {/* Header Banner */}
            <div className="flex justify-between items-end shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-teal-900 tracking-tight dark:text-teal-100">Hospital &amp; Facility Infrastructure</h2>
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-1">
                        <Server className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        Multi-Tenant Infrastructure Management. SYS_ADMIN Zone.
                    </p>
                </div>
            </div>

            {/* Five System-wide Status Cards (Fits to layout sizes without overflowing) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-sky-50 rounded-lg text-sky-600">
                        <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Registered Facilities</p>
                        <p className="text-base font-black text-slate-900 leading-tight">{facilities.length}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Layers className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Wards</p>
                        <p className="text-base font-black text-slate-900 leading-tight">{systemWards}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                        <Server className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Rooms</p>
                        <p className="text-base font-black text-slate-900 leading-tight">{systemRooms}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                        <Bed className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Beds</p>
                        <p className="text-base font-black text-slate-900 leading-tight">{systemBeds}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
                    <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
                        <Users className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Patients</p>
                        <p className="text-base font-black text-slate-900 leading-tight">{patients.length}</p>
                    </div>
                </div>
            </div>

            {/* Split Panel Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
                
                {/* LEFT COLUMN: Clean Table directory tree (5/12 width) */}
                <Card className="lg:col-span-5 border-slate-200 shadow-sm overflow-hidden bg-white flex flex-col h-full">
                    <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between space-y-0 flex-shrink-0">
                        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-teal-600" /> Facilities Directory Tree
                        </CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setFacilityName('');
                                setAdminUsername('');
                                setAdminEmail('');
                                setAdminPassword('');
                                setIsCreateFacilityOpen(true);
                            }}
                            className="h-7 text-[10px] border-slate-200 hover:bg-slate-50 font-semibold cursor-pointer"
                        >
                            <Plus className="w-3 h-3 mr-1" /> Register Facility
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-left">
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
                                {facilities.map((fac) => {
                                    const isFacExpanded = !!expandedFacilities[fac.facility_id];
                                    const currentTopology = fac.topology || [];

                                    return (
                                        <React.Fragment key={fac.facility_id}>
                                            <tr
                                                className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${selectedFacility?.facility_id === fac.facility_id ? 'bg-teal-50/30' : ''}`}
                                                onClick={() => setSelectedFacility(fac)}
                                            >
                                                <td className="px-4 py-3.5 w-10">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleFacility(fac.facility_id);
                                                        }}
                                                        className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                                                    >
                                                        {isFacExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                                <td className="px-2 py-3.5 flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-teal-600" />
                                                    <span className={`text-slate-900 ${selectedFacility?.facility_id === fac.facility_id ? 'font-bold text-teal-700' : 'font-semibold'}`}>{fac.facility_name}</span>
                                                </td>
                                            </tr>

                                            {/* Wards collapse */}
                                            {isFacExpanded && currentTopology.map((ward, wIdx) => {
                                                const wardId = `fac-${fac.facility_id}-w-${wIdx}`;
                                                const isWardExpanded = !!expandedWards[wardId];

                                                return (
                                                    <React.Fragment key={wardId}>
                                                        <tr className="bg-slate-50/30 hover:bg-slate-50/70 transition-colors">
                                                            <td className="px-4 py-2.5 pl-8">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleWard(wardId);
                                                                    }}
                                                                    className="p-0.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                                                                >
                                                                    {isWardExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                </button>
                                                            </td>
                                                            <td className="px-2 py-2.5 flex items-center gap-2 pl-4">
                                                                <Layers className="w-3.5 h-3.5 text-slate-400" />
                                                                <span className="font-semibold text-slate-700">{ward.name}</span>
                                                            </td>
                                                        </tr>

                                                        {/* Rooms collapse */}
                                                        {isWardExpanded && ward.rooms.map((room, rIdx) => {
                                                            const roomId = `${wardId}-r-${rIdx}`;
                                                            const isRoomExpanded = !!expandedRooms[roomId];

                                                            return (
                                                                <React.Fragment key={roomId}>
                                                                    <tr className="bg-slate-100/10 hover:bg-slate-100/30 transition-colors">
                                                                        <td className="px-4 py-2 pl-14">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleRoom(roomId);
                                                                                }}
                                                                                className="p-0.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                                                                            >
                                                                                {isRoomExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                        </td>
                                                                        <td className="px-2 py-2 pl-6 text-slate-600 font-medium">
                                                                            {room.name}
                                                                        </td>
                                                                    </tr>

                                                                    {/* Beds list */}
                                                                    {isRoomExpanded && room.beds.map((bed, bIdx) => {
                                                                        const pairedPatient = bed.patientId ? patients.find(p => p.patient_id === bed.patientId) : null;
                                                                        return (
                                                                            <tr key={bIdx} className="bg-slate-100/30 border-l-2 border-l-teal-500 hover:bg-slate-100/50 transition-colors">
                                                                                <td className="px-4 py-1.5 pl-20"></td>
                                                                                <td className="px-2 py-1.5 pl-8 flex items-center gap-2">
                                                                                    <Bed className="w-3 h-3 text-teal-600" />
                                                                                    <span className="font-semibold text-slate-800">{bed.name}</span>
                                                                                    {pairedPatient ? (
                                                                                        <>
                                                                                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                                                                            <span className="font-bold text-slate-900">{pairedPatient.name}</span>
                                                                                            {pairedPatient.device_serial_number && (
                                                                                                <Badge className="bg-teal-50 text-teal-700 font-mono text-[8px] h-3.5 border-none font-semibold">
                                                                                                    {pairedPatient.device_serial_number}
                                                                                                </Badge>
                                                                                            )}
                                                                                        </>
                                                                                    ) : (
                                                                                        <span className="text-[10px] text-slate-400 italic">(Empty Bed)</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
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
                    </CardContent>
                </Card>

                {/* RIGHT COLUMN: Facility Details Card + search/autosuggest + add actions (7/12 width) */}
                <div className="lg:col-span-7 flex flex-col space-y-6">
                    
                    {/* Real-time search inside the Details card container */}
                    <div className="relative w-full max-w-md shrink-0">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search/Switch Facility..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            className="pl-10 h-9 text-xs border-slate-200 bg-white shadow-sm rounded-lg"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                                {suggestions.map((name, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            const fac = facilities.find(f => f.facility_name === name);
                                            if (fac) setSelectedFacility(fac);
                                            setSearchQuery('');
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

                    {selectedFacility ? (
                        <Card className="border-slate-200 shadow-sm bg-white flex flex-col h-full">
                            <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between space-y-0 flex-shrink-0">
                                <div>
                                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                        <Building2 className="w-4 h-4 text-teal-600" /> Facility Profile Details
                                    </CardTitle>
                                    <CardDescription className="text-[10px] text-slate-400">
                                        Active configurations for {selectedFacility.facility_name}.
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
                                        onClick={() => {
                                            setFacilityName(selectedFacility.facility_name);
                                            setFacilityAddress(selectedFacility.address || '');
                                            setIsEditFacilityOpen(true);
                                        }}
                                    >
                                        <Edit className="w-3 h-3 mr-1" /> Edit Profile
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] border-red-200 text-red-600 hover:bg-red-50 cursor-pointer font-semibold"
                                        onClick={() => {
                                            setIsDecommissionFacilityOpen(true);
                                        }}
                                    >
                                        <Trash2 className="w-3 h-3 mr-1" /> Archive Facility
                                    </Button>
                                </div>
                            </CardHeader>
                            
                            <CardContent className="p-6 space-y-6 flex-1">
                                {/* Dynamic Add triggers */}
                                <div className="grid grid-cols-3 gap-3">
                                    <Button
                                        size="sm"
                                        onClick={() => setIsAddWardOpen(true)}
                                        className="h-8 text-[10px] bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer rounded-lg shadow-sm flex items-center justify-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Ward
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => setIsAddRoomOpen(true)}
                                        className="h-8 text-[10px] bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer rounded-lg shadow-sm flex items-center justify-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Room
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => setIsAddBedOpen(true)}
                                        className="h-8 text-[10px] bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer rounded-lg shadow-sm flex items-center justify-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Bed
                                    </Button>
                                </div>

                                {/* Details layout */}
                                <div className="grid grid-cols-2 gap-y-4 gap-x-8 border-t pt-6 border-slate-100 text-xs">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facility ID</span>
                                        <p className="font-mono text-slate-900 font-bold bg-slate-50 px-2 py-1 rounded w-max border">#{selectedFacility.facility_id}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facility Administrator</span>
                                        <p className="font-semibold text-slate-700">{facilityAdmins[selectedFacility.facility_id] || 'None assigned'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Wards</span>
                                        <p className="font-semibold text-slate-700">{totalWards} Wards registered</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rooms</span>
                                        <p className="font-semibold text-slate-700">{totalRooms} Rooms provisioned</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Beds</span>
                                        <p className="font-semibold text-slate-700">{totalBeds} Bed slots configured</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address Location</span>
                                        <p className="font-semibold text-slate-700">{selectedFacility.address || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Caregivers Count</span>
                                        <p className="font-semibold text-slate-700">{facilityCaregivers} Caregivers registered</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Medical Staff Count</span>
                                        <p className="font-semibold text-slate-700">{facilityMedStaff} Staff members</p>
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patients Registered</span>
                                        <p className="font-semibold text-slate-700">{facilityPatients} Patients registered</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                            <Building2 className="w-10 h-10 text-slate-300 mb-2 animate-bounce" />
                            <p className="text-xs font-semibold text-slate-400">Select a facility to inspect details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ======================= ADD WARD MODAL ======================= */}
            <Dialog open={isAddWardOpen} onOpenChange={setIsAddWardOpen}>
                <DialogContent className="bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle>Add New Ward</DialogTitle>
                        <DialogDescription className="text-xs">
                            Define a new ward boundary inside the facility.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-600">Ward Name</Label>
                            <Input value={wardForm.name} onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })} className="h-8 text-xs border-slate-200" placeholder="e.g. Pediatrics Ward" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-600">Ward Classification</Label>
                            <select
                                value={wardForm.classification}
                                onChange={(e) => setWardForm({ ...wardForm, classification: e.target.value as any })}
                                className="w-full h-8 text-xs px-2.5 border border-slate-200 rounded-md bg-slate-50 text-slate-700 outline-none"
                            >
                                <option value="general">General</option>
                                <option value="pediatrics">Pediatrics</option>
                                <option value="icu">ICU</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsAddWardOpen(false)} className="h-8 text-xs border-slate-200 text-slate-600 cursor-pointer">Cancel</Button>
                        <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white cursor-pointer" onClick={handleAddWard}>Add Ward</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================= ADD ROOM MODAL ======================= */}
            <Dialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
                <DialogContent className="bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle>Add New Room</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-600">Room Name</Label>
                            <Input value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} className="h-8 text-xs border-slate-200" placeholder="e.g. Room 101" />
                        </div>
                        <div className="space-y-1 relative">
                            <Label className="text-xs font-semibold text-slate-600">Ward Name</Label>
                            <Input
                                value={roomForm.wardName}
                                onChange={(e) => {
                                    setRoomForm({ ...roomForm, wardName: e.target.value });
                                    setShowWardSuggestions(true);
                                }}
                                onFocus={() => setShowWardSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowWardSuggestions(false), 200)}
                                className="h-8 text-xs border-slate-200"
                                placeholder="Type matching Ward name..."
                            />
                            {showWardSuggestions && wardSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                                    {wardSuggestions.map((name, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setRoomForm(prev => ({ ...prev, wardName: name }));
                                                setShowWardSuggestions(false);
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-600"
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsAddRoomOpen(false)} className="h-8 text-xs border-slate-200 text-slate-600 cursor-pointer">Cancel</Button>
                        <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white cursor-pointer" onClick={handleAddRoom}>Add Room</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================= ADD BED MODAL ======================= */}
            <Dialog open={isAddBedOpen} onOpenChange={setIsAddBedOpen}>
                <DialogContent className="bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle>Add New Bed</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-600">Bed Name</Label>
                            <Input value={bedForm.name} onChange={(e) => setBedForm({ ...bedForm, name: e.target.value })} className="h-8 text-xs border-slate-200" placeholder="e.g. Bed A" />
                        </div>
                        <div className="space-y-1 relative">
                            <Label className="text-xs font-semibold text-slate-600">Ward Name</Label>
                            <Input
                                value={bedForm.wardName}
                                onChange={(e) => {
                                    setBedForm(prev => ({ ...prev, wardName: e.target.value, roomName: '' }));
                                    setShowWardSuggestions(true);
                                }}
                                onFocus={() => setShowWardSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowWardSuggestions(false), 200)}
                                className="h-8 text-xs border-slate-200"
                                placeholder="Type matching Ward name..."
                            />
                            {showWardSuggestions && wardSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                                    {wardSuggestions.map((name, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setBedForm(prev => ({ ...prev, wardName: name }));
                                                setShowWardSuggestions(false);
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-600"
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-1 relative">
                            <Label className="text-xs font-semibold text-slate-600">Room Name</Label>
                            <Input
                                value={bedForm.roomName}
                                onChange={(e) => {
                                    setBedForm(prev => ({ ...prev, roomName: e.target.value }));
                                    setShowRoomSuggestions(true);
                                }}
                                onFocus={() => setShowRoomSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowRoomSuggestions(false), 200)}
                                className="h-8 text-xs border-slate-200"
                                placeholder="Type matching Room name..."
                                disabled={!bedForm.wardName}
                            />
                            {showRoomSuggestions && roomSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                                    {roomSuggestions.map((name, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setBedForm(prev => ({ ...prev, roomName: name }));
                                                setShowRoomSuggestions(false);
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-600"
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-600">Assign Patient (Optional)</Label>
                            <select
                                value={bedForm.patientId}
                                onChange={(e) => setBedForm({ ...bedForm, patientId: e.target.value })}
                                className="w-full h-8 text-xs px-2.5 border border-slate-200 rounded-md bg-slate-50 text-slate-700 outline-none"
                            >
                                <option value="">-- Unassigned --</option>
                                {patients
                                    .filter(p => p.facility_id === selectedFacility?.facility_id)
                                    .map(p => (
                                        <option key={p.patient_id} value={p.patient_id}>
                                            {p.name} (#{p.patient_id})
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsAddBedOpen(false)} className="h-8 text-xs border-slate-200 text-slate-600 cursor-pointer">Cancel</Button>
                        <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white cursor-pointer" onClick={handleAddBed}>Add Bed</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================= REGISTER FACILITY & ADMIN MODAL ======================= */}
            <Dialog open={isCreateFacilityOpen} onOpenChange={setIsCreateFacilityOpen}>
                <DialogContent className="bg-white border-slate-200 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Register New Facility & Facility Administrator</DialogTitle>
                        <DialogDescription className="text-xs">
                            Define a new facility domain and create its main Facility Administrator credentials.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3.5 py-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-600">Facility Name</Label>
                            <Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} className="h-8 text-xs border-slate-200" placeholder="e.g. Alaga Medical Center" />
                        </div>
                        <div className="border-t border-slate-100 my-2 pt-2">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Facility Administrator Account Registration</h4>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-slate-600">Facility Administrator Username</Label>
                                    <Input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} className="h-8 text-xs border-slate-200" placeholder="e.g. central_admin" autoComplete="new-username" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-slate-600">Facility Administrator Email</Label>
                                    <Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="h-8 text-xs border-slate-200" placeholder="e.g. facility_admin@facilityname.com" autoComplete="new-email" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-slate-600">Facility Administrator Password</Label>
                                    <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="h-8 text-xs border-slate-200" placeholder="e.g. min 12 chars (a-z, A-Z, 0-9, symbol)" autoComplete="new-password" />
                                    <p className="text-[9px] text-slate-400 font-medium leading-normal mt-0.5">
                                        At least 12 characters: 1 small letter, 1 capital letter, 1 number, and 1 symbol.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsCreateFacilityOpen(false)} className="h-8 text-xs border-slate-200 text-slate-600 cursor-pointer">Cancel</Button>
                        <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white cursor-pointer" onClick={handleRegisterFacilityAndAdmin}>Register Facility</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================= EDIT FACILITY MODAL ======================= */}
            <Dialog open={isEditFacilityOpen} onOpenChange={setIsEditFacilityOpen}>
                <DialogContent className="bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle>Edit Facility Settings</DialogTitle>
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
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsEditFacilityOpen(false)} className="h-8 text-xs border-slate-200 text-slate-600 cursor-pointer">Cancel</Button>
                        <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white cursor-pointer" onClick={handleUpdateFacility}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================= DECOMMISSION FACILITY MODAL ======================= */}
            <Dialog open={isDecommissionFacilityOpen} onOpenChange={setIsDecommissionFacilityOpen}>
                <DialogContent className="bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Danger: Decommission Facility</DialogTitle>
                        <DialogDescription className="text-xs mt-2 bg-red-50 p-3 rounded border border-red-100 text-red-800 flex items-start gap-2">
                            <Info className="w-4 h-4 mt-0.5 shrink-0" />
                            This will archive the facility and detach all active patient and administrator accounts linked to it.
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
