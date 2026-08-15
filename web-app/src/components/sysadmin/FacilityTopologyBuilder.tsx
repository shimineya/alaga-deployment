import React, { useState, useEffect } from 'react';
import { MetricCard } from '@/components/MetricCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Building2, Layers, Bed, Cpu, Plus, Edit, Users, Server, Activity, ShieldAlert, Wifi, Battery, AlertTriangle, Fingerprint, Trash2, ArrowRightLeft, UserPlus, Info } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

type NodeType = 'facility' | 'ward' | 'room' | 'bed';

interface TopologyNode {
    id: string;
    type: NodeType;
    name: string;
    data: any;
}

interface StaffMember {
    id: string;
    name: string;
    role: string;
    status: 'Active' | 'Inactive';
    assigned_to?: string;
}

// MOCK DATA structure showing deep nesting
const MOCK_TOPOLOGY = {
    facility: {
        id: 'fcl-10492',
        name: 'North Wing Hospital',
        data: {
            admin: 'Jane Doe',
            email: 'admin@northwing.com',
            wards: 4,
            capacity: 150,
            activePatients: 84,
            complianceScore: '98%',
            subscription: 'Enterprise'
        }
    },
    ward: {
        id: 'wrd-001',
        name: 'Pediatrics',
        data: {
            headNurse: 'Maria Santos, RN',
            totalStaff: 12,
            activeSensors: 24,
            pendingAlerts: 2,
            classification: 'Pediatrics'
        }
    },
    room: {
        id: 'rm-101',
        name: 'Room 101',
        data: {
            classification: 'Intensive Care (NICU)',
            isolationStatus: 'Standard Protocols'
        }
    },
    bedA: {
        id: 'bed-a-101',
        name: 'Bed A',
        data: {
            patientInitials: 'R.M.',
            batteryLevel: '84%',
            signalStrength: 'Excellent (-42dBm)',
            lastAnomaly: '2026-03-12T08:15:00Z',
            deviceId: 'ESP32-MAC-A1B2'
        }
    },
    bedB: {
        id: 'bed-b-101',
        name: 'Bed B',
        data: {
            patientInitials: 'T.L.',
            batteryLevel: '95%',
            signalStrength: 'Good (-68dBm)',
            lastAnomaly: 'None in 72h',
            deviceId: 'ESP32-MAC-C3D4'
        }
    }
};

const MOCK_STAFF: StaffMember[] = [
    { id: 'STF-001', name: 'Maria Santos, RN', role: 'Head Nurse', status: 'Active', assigned_to: 'Pediatrics' },
    { id: 'STF-045', name: 'Juan Dela Cruz', role: 'Caregiver', status: 'Active', assigned_to: 'Pediatrics' },
    { id: 'STF-092', name: 'Elena Gomez, RN', role: 'Staff Nurse', status: 'Active', assigned_to: 'Intensive Care Unit' },
];

export default function FacilityTopologyBuilder() {
    const { user } = useAuth();
    // Default context
    const isSysAdmin = user?.role === 'sysadmin' || true; // Mock true for development
    
    const [selectedNode, setSelectedNode] = useState<TopologyNode>({
        id: MOCK_TOPOLOGY.facility.id,
        type: 'facility',
        name: MOCK_TOPOLOGY.facility.name,
        data: MOCK_TOPOLOGY.facility.data
    });

    // --- State: Modals visibility ---
    // Facility Level
    const [isCreateFacilityOpen, setIsCreateFacilityOpen] = useState(false);
    const [isEditFacilityOpen, setIsEditFacilityOpen] = useState(false);
    const [isDecommissionFacilityOpen, setIsDecommissionFacilityOpen] = useState(false);
    
    // Ward Level
    const [isAddWardOpen, setIsAddWardOpen] = useState(false);
    const [isEditWardOpen, setIsEditWardOpen] = useState(false);
    const [isDecommissionWardOpen, setIsDecommissionWardOpen] = useState(false);

    // Room Level
    const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
    const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
    const [isDecommissionRoomOpen, setIsDecommissionRoomOpen] = useState(false);

    // Bed/Sensor Level
    const [isProvisionBedOpen, setIsProvisionBedOpen] = useState(false);
    const [isEditBedOpen, setIsEditBedOpen] = useState(false);
    const [isDecommissionBedOpen, setIsDecommissionBedOpen] = useState(false);

    // Personnel Level
    const [isManageStaffOpen, setIsManageStaffOpen] = useState(false);
    const [isReassignOpen, setIsReassignOpen] = useState(false);

    // --- State: Form Inputs for Validation ---
    const [facilityName, setFacilityName] = useState('');
    const [facilityEmail, setFacilityEmail] = useState('');
    const [deleteConfirmName, setDeleteConfirmName] = useState('');
    
    const [roomName, setRoomName] = useState('');
    const [macAddress, setMacAddress] = useState('');
    const [isIsolated, setIsIsolated] = useState(false);

    // [OWASP A09: Security Logging (MOCK)]
    const logSecurityAction = async (action: string, details: string) => {
        try {
            const token = localStorage.getItem('token');
            console.log(`[OWASP A09] LOGGING TO DB -> Action: ${action} | Details: ${details}`);
            // Mock Fetch:
            // fetch('/api/sysadmin/audit-logs/log', { method: 'POST', body: JSON.stringify({ action, details }), headers: { Authorization: token } })
        } catch (error) {
            console.error("Audit Logging Error:", error);
        }
    };

    // Trigger log when viewing Bed
    useEffect(() => {
        if (selectedNode.type === 'bed') {
            logSecurityAction('READ_BED_TELEMETRY', `Viewed masking context for Bed ${selectedNode.name}`);
        }
    }, [selectedNode]);

    const handleNodeSelect = (type: NodeType, mockDataObj: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedNode({ id: mockDataObj.id, type, name: mockDataObj.name, data: mockDataObj.data });
    };

    // --- Submission Handlers & [OWASP A05] Validators ---

    const handleCreateFacility = () => {
        // [OWASP A05] Regex Validation for Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(facilityEmail)) {
            toast.error("Invalid email format. Access denied.");
            return;
        }
        logSecurityAction('CREATE_FACILITY', `Provisioned facility: ${facilityName}`);
        toast.success(`Facility '${facilityName}' created successfully.`);
        setIsCreateFacilityOpen(false);
    };

    const handleDecommission = (nodeType: string, nodeName: string, stateSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
        if (nodeType === 'facility' && deleteConfirmName !== selectedNode.name) {
            toast.error("Facility name does not match. Soft-delete aborted.");
            return;
        }
        // [HIPAA/DPA] Enforce Soft Delete
        logSecurityAction('SOFT_DELETE', `Decommissioned ${nodeType}: ${nodeName}. (is_active = false)`);
        toast.warning(`${nodeName} has been soft-deleted per GDPR/DPA retention rules.`);
        stateSetter(false);
        setDeleteConfirmName('');
    };

    const handleProvisionBed = () => {
        // [OWASP A05] Strict MAC Address Regex Validation
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(macAddress)) {
            toast.error("Invalid MAC Address format. Must be XX:XX:XX:XX:XX:XX");
            return;
        }
        logSecurityAction('PROVISION_HARDWARE', `Bound MAC ${macAddress} to new bed in ${selectedNode.name}`);
        toast.success("IoT Sensor provisioned and securely bound to bed.");
        setIsProvisionBedOpen(false);
    };

    const renderNodeDetails = () => {
        switch (selectedNode.type) {
            case 'facility':
                return (
                    <div className="flex flex-col h-full">
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm flex-1">
                            <TooltipCard label="Facility ID" value={selectedNode.id.toUpperCase()} />
                            <TooltipCard label="Primary Administrator" value={selectedNode.data.admin} />
                            <TooltipCard label="Total Wards" value={selectedNode.data.wards} />
                            <TooltipCard 
                                label="System Compliance Score" 
                                value={selectedNode.data.complianceScore} 
                                icon={<ShieldAlert className="w-3.5 h-3.5 text-emerald-500 mr-1 inline" />}
                                tooltip="Aggregate security and uptime compliance."
                            />
                            <TooltipCard label="Maximum Bed Capacity" value={selectedNode.data.capacity} />
                        </div>
                        <div className="mt-8 flex items-center gap-3">
                            <Button size="sm" className="h-8 text-xs font-medium bg-teal-700 hover:bg-teal-600" onClick={() => setIsAddWardOpen(true)}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add New Ward
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs font-medium text-slate-600" onClick={() => setIsEditFacilityOpen(true)}>
                                <Edit className="w-3.5 h-3.5 mr-1" /> Edit Configuration
                            </Button>
                        </div>
                    </div>
                );
            case 'ward':
                return (
                    <div className="flex flex-col h-full">
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm flex-1">
                            <TooltipCard label="Ward ID" value={selectedNode.id.toUpperCase()} />
                            <TooltipCard label="Assigned Head Nurse" value={selectedNode.data.headNurse} />
                            <TooltipCard 
                                label="Total Assigned Staff" 
                                value={selectedNode.data.totalStaff} 
                                icon={<Users className="w-3.5 h-3.5 text-teal-600 mr-1 inline" />}
                            />
                            <TooltipCard label="Classification" value={selectedNode.data.classification} />
                        </div>
                        <div className="mt-8 flex items-center gap-3 flex-wrap">
                            <Button size="sm" className="h-8 text-xs font-medium bg-teal-700 hover:bg-teal-600" onClick={() => setIsManageStaffOpen(true)}>
                                <Users className="w-3.5 h-3.5 mr-1" /> Manage Ward Staff
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs font-medium text-slate-600" onClick={() => setIsAddRoomOpen(true)}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add New Room
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs font-medium text-slate-600" onClick={() => setIsEditWardOpen(true)}>
                                <Edit className="w-3.5 h-3.5 mr-1" /> Edit Ward
                            </Button>
                        </div>
                    </div>
                );
            case 'room':
                return (
                    <div className="flex flex-col h-full">
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                            <TooltipCard label="Room ID" value={selectedNode.id.toUpperCase()} />
                            <TooltipCard label="Classification" value={selectedNode.data.classification} />
                            <TooltipCard 
                                label="Isolation Protocol Status" 
                                value={selectedNode.data.isolationStatus} 
                                tooltip="Infection control measures required for this physical boundary."
                            />
                        </div>
                        <div className="mt-6 flex-1">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Direct Room Personnel</h4>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                                    <UserPlus className="w-3 h-3 mr-1" /> Assign Staff to Room
                                </Button>
                            </div>
                            <div className="border border-slate-200 rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="text-[10px] font-medium py-2">ID</TableHead>
                                            <TableHead className="text-[10px] font-medium py-2">Name</TableHead>
                                            <TableHead className="text-[10px] font-medium py-2 text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="text-xs font-mono py-1.5">{MOCK_STAFF[0].id}</TableCell>
                                            <TableCell className="text-xs py-1.5">{MOCK_STAFF[0].name}</TableCell>
                                            <TableCell className="text-right py-1.5">
                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"><Trash2 className="w-3 h-3" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <Button size="sm" className="h-8 text-xs font-medium bg-teal-700 hover:bg-teal-600" onClick={() => setIsProvisionBedOpen(true)}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Provision Bed/Sensor
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs font-medium text-slate-600" onClick={() => setIsEditRoomOpen(true)}>
                                <Edit className="w-3.5 h-3.5 mr-1" /> Edit Room
                            </Button>
                        </div>
                    </div>
                );
            case 'bed':
                return (
                    <div className="flex flex-col h-full">
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm flex-1">
                            <TooltipCard label="Occupant Ref" value={selectedNode.data.patientInitials} tooltip="PHI Masked" valueClass="font-mono bg-slate-100 px-1 rounded" />
                            <TooltipCard label="Hardware MAC ID" value={selectedNode.data.deviceId} valueClass="font-mono text-slate-500" />
                            <TooltipCard label="Battery" value={selectedNode.data.batteryLevel} icon={<Battery className="w-3.5 h-3.5 text-emerald-500 mr-1 inline" />} />
                        </div>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Button size="sm" variant="outline" className="h-8 text-xs font-medium text-slate-600" onClick={() => setIsEditBedOpen(true)}>
                                <Edit className="w-3.5 h-3.5 mr-1" /> Rebind Hardware
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs font-medium text-red-600 border-red-200 hover:bg-red-50" onClick={() => setIsDecommissionBedOpen(true)}>
                                <Trash2 className="w-3.5 h-3.5 mr-1" /> Decommission Bed Node
                            </Button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end mb-2">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight dark:text-teal-100">Hospital &amp; Facility Infrastructure</h2>
                    <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                        <Server className="w-3 h-3 text-emerald-600" />
                        Multi-Tenant Infrastructure Management. SYS_ADMIN Zone.
                    </p>
                </div>
            </div>

            <TooltipProvider>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard title="Registered Facilities" value="3" icon={Building2} statusColor="#0ea5e9" className="border-l-4 border-l-sky-500 rounded-none shadow-sm" />
                    <MetricCard title="Active Wards" value="12" icon={Layers} statusColor="#6366f1" className="border-l-4 border-l-indigo-500 rounded-none shadow-sm" />
                    <MetricCard title="Total Bed Capacity" value="240" icon={Bed} statusColor="#10b981" className="border-l-4 border-l-emerald-500 rounded-none shadow-sm" />
                    <MetricCard title="Unassigned Devices" value="15" icon={Cpu} statusColor="#f59e0b" className="border-l-4 border-l-amber-500 rounded-none shadow-sm" />
                </div>
            </TooltipProvider>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Pane: Infrastructure Tree */}
                <Card className="lg:col-span-1 shadow-sm border-slate-200 flex flex-col h-full min-h-[500px]">
                    <CardHeader className="py-2 px-4 pb-2 bg-slate-50/50 border-b border-slate-100 flex-shrink-0">
                        <div className="flex flex-col space-y-2">
                            <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                <span>Infrastructure Tree</span>
                                <Badge variant="outline" className="text-[9px] text-slate-400 border-dashed">Global View</Badge>
                            </CardTitle>
                            {/* [Phase 1] SysAdmin Global Provisioning Button */}
                            {isSysAdmin && (
                                <Button size="sm" className="w-full bg-slate-800 hover:bg-slate-700 h-8 text-xs shadow" onClick={() => setIsCreateFacilityOpen(true)}>
                                    <Building2 className="w-3.5 h-3.5 mr-2" /> Register New Facility
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-2 flex-1 overflow-y-auto">
                        <Accordion type="single" collapsible className="w-full text-sm" defaultValue="facility-1">
                            <AccordionItem value="facility-1" className="border-b-0">
                                <AccordionTrigger className="font-semibold text-slate-700 hover:no-underline py-2 px-2 hover:bg-slate-50 rounded-md focus:outline-none">
                                    <div className="flex items-center gap-2 flex-1" onClick={(e: React.MouseEvent) => handleNodeSelect('facility', MOCK_TOPOLOGY.facility, e)}>
                                        <Building2 className={`w-4 h-4 ${selectedNode.id === MOCK_TOPOLOGY.facility.id ? 'text-teal-600' : 'text-slate-400'}`} />
                                        <span className={selectedNode.id === MOCK_TOPOLOGY.facility.id ? 'text-teal-700 font-bold' : ''}>{MOCK_TOPOLOGY.facility.name}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-1 pt-1 pl-4">
                                    <Accordion type="single" collapsible className="w-full" defaultValue="ward-1">
                                        <AccordionItem value="ward-1" className="border-b-0">
                                            <AccordionTrigger className="text-slate-600 hover:no-underline py-1.5 px-2 hover:bg-slate-50 rounded-md focus:outline-none">
                                                <div className="flex items-center gap-2 flex-1" onClick={(e: React.MouseEvent) => handleNodeSelect('ward', MOCK_TOPOLOGY.ward, e)}>
                                                    <Layers className={`w-3.5 h-3.5 ${selectedNode.id === MOCK_TOPOLOGY.ward.id ? 'text-teal-600' : 'text-slate-400'}`} />
                                                    <span className={selectedNode.id === MOCK_TOPOLOGY.ward.id ? 'text-teal-700 font-bold' : ''}>{MOCK_TOPOLOGY.ward.name}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-1 pt-1 pl-4">
                                                <Accordion type="single" collapsible className="w-full border-l border-slate-100 ml-2 pl-2" defaultValue="room-101">
                                                    <AccordionItem value="room-101" className="border-b-0">
                                                        <AccordionTrigger className="text-slate-500 text-xs hover:no-underline py-1 px-2 hover:bg-slate-50 rounded-md focus:outline-none">
                                                            <div className="flex items-center gap-2 flex-1" onClick={(e: React.MouseEvent) => handleNodeSelect('room', MOCK_TOPOLOGY.room, e)}>
                                                                <span className={selectedNode.id === MOCK_TOPOLOGY.room.id ? 'text-teal-700 font-bold' : ''}>{MOCK_TOPOLOGY.room.name}</span>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="pb-1 pt-1 pl-4 space-y-1">
                                                            <div className={`flex items-center gap-2 text-xs py-1 px-2 cursor-pointer rounded-md ${selectedNode.id === MOCK_TOPOLOGY.bedA.id ? 'bg-teal-50 text-teal-700 font-semibold border-l-2 border-l-teal-500' : 'text-slate-500 hover:bg-slate-50'}`} onClick={(e: React.MouseEvent) => handleNodeSelect('bed', MOCK_TOPOLOGY.bedA, e)}>
                                                                <Bed className="w-3 h-3 text-emerald-500" /> {MOCK_TOPOLOGY.bedA.name}
                                                            </div>
                                                            <div className={`flex items-center gap-2 text-xs py-1 px-2 cursor-pointer rounded-md ${selectedNode.id === MOCK_TOPOLOGY.bedB.id ? 'bg-teal-50 text-teal-700 font-semibold border-l-2 border-l-teal-500' : 'text-slate-500 hover:bg-slate-50'}`} onClick={(e: React.MouseEvent) => handleNodeSelect('bed', MOCK_TOPOLOGY.bedB, e)}>
                                                                <Bed className="w-3 h-3 text-emerald-500" /> {MOCK_TOPOLOGY.bedB.name}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                </Accordion>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>

                {/* Right Pane: Node Inspector */}
                <Card className="lg:col-span-2 shadow-sm border-slate-200 flex flex-col min-h-[500px]">
                    <CardHeader className="py-3 px-4 bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between space-y-0 flex-shrink-0">
                        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2 capitalize">
                            {selectedNode.type} Details: {selectedNode.name}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-6 flex flex-col">
                        {renderNodeDetails()}
                    </CardContent>
                </Card>
            </div>

            {/* ======================= FACILITY CLUSTER MODALS ======================= */}
            <Dialog open={isCreateFacilityOpen} onOpenChange={setIsCreateFacilityOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Register New Facility</DialogTitle>
                        <DialogDescription className="text-xs">Establish a new Data Controller domain.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <TooltipProvider><Tooltip><TooltipTrigger><Label className="text-xs font-semibold">Facility Name</Label></TooltipTrigger><TooltipContent>The official name of the hospital/clinic.</TooltipContent></Tooltip></TooltipProvider>
                            <Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <TooltipProvider><Tooltip><TooltipTrigger><Label className="text-xs font-semibold">Region / Address</Label></TooltipTrigger><TooltipContent>Physical geographical location for compliance routing.</TooltipContent></Tooltip></TooltipProvider>
                            <Input className="h-8 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Primary Contact Person</Label>
                                <Input className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Admin Email</Label>
                                <Input value={facilityEmail} onChange={(e) => setFacilityEmail(e.target.value)} className="h-8 text-sm" placeholder="admin@domain.com" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsCreateFacilityOpen(false)}>Cancel</Button>
                        <Button size="sm" className="bg-teal-700" onClick={handleCreateFacility}>Register Facility</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditFacilityOpen} onOpenChange={setIsEditFacilityOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Configuration: {selectedNode.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Facility Name</Label>
                            <Input defaultValue={selectedNode.name} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Admin Settings & Contact</Label>
                            <Input defaultValue={selectedNode.data.email} className="h-8 text-sm mt-1" />
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                                <Switch defaultChecked />
                                <Label className="text-xs">Active Status</Label>
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between items-center sm:justify-between">
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {setIsEditFacilityOpen(false); setIsDecommissionFacilityOpen(true);}}>
                            <Trash2 className="w-4 h-4 mr-1"/> Decommission Facility
                        </Button>
                        <div className="space-x-2">
                             <Button variant="outline" size="sm" onClick={() => setIsEditFacilityOpen(false)}>Cancel</Button>
                             <Button size="sm" className="bg-teal-700" onClick={() => { setIsEditFacilityOpen(false); logSecurityAction('UPDATE_FACILITY', 'Updated ' + selectedNode.name); toast.success("Configuration saved."); }}>Save Changes</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDecommissionFacilityOpen} onOpenChange={setIsDecommissionFacilityOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Danger: Decommission Facility</DialogTitle>
                        <DialogDescription className="text-xs mt-2 bg-red-50 p-3 rounded border border-red-100 text-red-800 flex items-start gap-2">
                            <Info className="w-4 h-4 mt-0.5 shrink-0" />
                            [HIPAA / DPA Compliance]: Executes a Soft-Delete. Retains historical audit logs and anonymized data per Data Privacy Act of 2012 retention mandates. Active user sessions will be terminated.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label className="text-xs font-semibold">Type <span className="font-mono text-xs bg-slate-100 px-1">{selectedNode.name}</span> to confirm.</Label>
                        <Input value={deleteConfirmName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteConfirmName(e.target.value)} className="h-8 text-sm border-red-200" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => { setIsDecommissionFacilityOpen(false); setDeleteConfirmName(''); }}>Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDecommission('facility', selectedNode.name, setIsDecommissionFacilityOpen)}>Decommission Object</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================= WARD CLUSTER MODALS ======================= */}
            <Dialog open={isAddWardOpen} onOpenChange={setIsAddWardOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>Add New Ward</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Ward Name</Label>
                            <Input className="h-8 text-sm" placeholder="e.g. Maternity Ward" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Ward Classification</Label>
                            <Select defaultValue="general">
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="general">General</SelectItem>
                                    <SelectItem value="pediatrics">Pediatrics</SelectItem>
                                    <SelectItem value="icu">Intensive Care Unit (ICU)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsAddWardOpen(false)}>Cancel</Button>
                        <Button size="sm" className="bg-teal-700" onClick={() => { setIsAddWardOpen(false); logSecurityAction('CREATE_WARD', 'Provisioned new ward.'); toast.success("Ward provisioned."); }}>Create Ward</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditWardOpen} onOpenChange={setIsEditWardOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>Edit Ward Configuration</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Ward Name</Label>
                            <Input defaultValue={selectedNode.name} className="h-8 text-sm" />
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between items-center sm:justify-between">
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => {setIsEditWardOpen(false); setIsDecommissionWardOpen(true);}}>
                            <Trash2 className="w-4 h-4 mr-1"/> Decommission
                        </Button>
                        <div className="space-x-2">
                             <Button variant="outline" size="sm" onClick={() => setIsEditWardOpen(false)}>Cancel</Button>
                             <Button size="sm" className="bg-teal-700" onClick={() => { setIsEditWardOpen(false); }}>Save Changes</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <Dialog open={isDecommissionWardOpen} onOpenChange={setIsDecommissionWardOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="text-red-600">Soft-Delete Ward</DialogTitle></DialogHeader>
                    <p className="text-xs text-slate-500">Are you sure you want to decommission the {selectedNode.name} ward? This propagates soft-deletes to all child rooms and beds.</p>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsDecommissionWardOpen(false)}>Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDecommission('ward', selectedNode.name, setIsDecommissionWardOpen)}>Decommission</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================= ROOM CLUSTER MODALS ======================= */}
            <Dialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Provision New Physical Room</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Create a new node within {selectedNode.type === 'ward' ? selectedNode.name : 'Unknown'}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                <Label className="text-right text-xs font-semibold text-slate-700">Room ID</Label>
                            </TooltipTrigger><TooltipContent>Alphanumeric identifier. No special characters allowed to prevent SQL injection.</TooltipContent></Tooltip></TooltipProvider>
                            <Input
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                className="col-span-3 text-sm h-9"
                                placeholder="e.g. ICU-04"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs font-semibold text-slate-700">Class</Label>
                            <div className="col-span-3">
                                <Select defaultValue="general">
                                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select classification" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">General Ward</SelectItem>
                                        <SelectItem value="icu">Intensive Care Unit (ICU)</SelectItem>
                                        <SelectItem value="nicu">Neonatal ICU (NICU)</SelectItem>
                                        <SelectItem value="isolation">Infectious Disease / Isolation</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs font-semibold text-slate-700 pt-1">Isolation</Label>
                            <div className="col-span-3 flex items-center space-x-2">
                                <Switch checked={isIsolated} onCheckedChange={setIsIsolated} />
                                <span className="text-xs text-slate-500">Enable Strict Isolation Protocols</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsAddRoomOpen(false)}>Cancel</Button>
                        <Button size="sm" className="bg-teal-700 hover:bg-teal-600" onClick={() => {
                            const regex = /^[a-zA-Z0-9\s-]+$/;
                            if (!regex.test(roomName)) { toast.error("Invalid chars injected."); return; }
                            logSecurityAction('CREATE_ROOM', `Provisioned room ${roomName}.`);
                            toast.success(`Room '${roomName}' provisioned securely.`);
                            setIsAddRoomOpen(false);
                            setRoomName('');
                        }}>Provision Room</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditRoomOpen} onOpenChange={setIsEditRoomOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>Edit Room Details</DialogTitle></DialogHeader>
                    <DialogFooter className="flex justify-between items-center sm:justify-between">
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => {setIsEditRoomOpen(false); setIsDecommissionRoomOpen(true);}}>
                            <Trash2 className="w-4 h-4 mr-1"/> Decommission
                        </Button>
                        <div className="space-x-2">
                             <Button variant="outline" size="sm" onClick={() => setIsEditRoomOpen(false)}>Cancel</Button>
                             <Button size="sm" className="bg-teal-700" onClick={() => setIsEditRoomOpen(false)}>Save</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDecommissionRoomOpen} onOpenChange={setIsDecommissionRoomOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="text-red-600">Soft-Delete Room</DialogTitle></DialogHeader>
                    <p className="text-xs text-slate-500">Decommissioning {selectedNode.name} suspends all sensor feeds within it.</p>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsDecommissionRoomOpen(false)}>Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDecommission('room', selectedNode.name, setIsDecommissionRoomOpen)}>Decommission</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================= BED / HARDWARE CLUSTER MODALS ======================= */}
            <Dialog open={isProvisionBedOpen} onOpenChange={setIsProvisionBedOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Provision Bed & Sensor Hardware</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Bed Identifier</Label>
                            <Input className="h-8 text-sm" placeholder="e.g. Bed C" />
                        </div>
                        <div className="space-y-1">
                            <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                <Label className="text-xs font-semibold">ESP32 Sensor MAC Address</Label>
                            </TooltipTrigger><TooltipContent className="bg-amber-100 text-amber-900 border-amber-200">Bind a physical Alaga IoT sensor. Strict format required.</TooltipContent></Tooltip></TooltipProvider>
                            <Input value={macAddress} onChange={(e) => setMacAddress(e.target.value)} className="h-8 text-sm font-mono" placeholder="00:1A:2B:3C:4D:5E" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsProvisionBedOpen(false)}>Cancel</Button>
                        <Button size="sm" className="bg-teal-700" onClick={handleProvisionBed}>Bind Hardware</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditBedOpen} onOpenChange={setIsEditBedOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Rebind ESP32 Hardware</DialogTitle></DialogHeader>
                     <div className="space-y-1 py-4">
                            <Label className="text-xs font-semibold">New MAC Address</Label>
                            <Input className="h-8 text-sm font-mono" placeholder="00:1A:2B:3C:4D:5E" />
                        </div>
                     <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsEditBedOpen(false)}>Cancel</Button>
                        <Button size="sm" className="bg-teal-700" onClick={() => { setIsEditBedOpen(false); toast.success("MAC address updated securely."); }}>Update Binding</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDecommissionBedOpen} onOpenChange={setIsDecommissionBedOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="text-red-600">Soft-Delete Hardware Node</DialogTitle></DialogHeader>
                     <p className="text-xs text-slate-500">Decommissioning {selectedNode.name} unbinds the hardware from the system. Audit trails will be preserved.</p>
                     <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsDecommissionBedOpen(false)}>Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDecommission('bed', selectedNode.name, setIsDecommissionBedOpen)}>Decommission Bed</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================= PERSONNEL MODALS ======================= */}
            <Dialog open={isManageStaffOpen} onOpenChange={setIsManageStaffOpen}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Authorized Personnel: {selectedNode.name}</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            [DPA Constraint] Personal details are hidden. Showing only explicitly mapped authorized staff.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="border border-slate-200 rounded-md overflow-hidden my-4">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="text-xs font-medium py-3">Staff ID</TableHead>
                                    <TableHead className="text-xs font-medium py-3">Full Name</TableHead>
                                    <TableHead className="text-xs font-medium py-3">Role Status</TableHead>
                                    <TableHead className="text-xs font-medium py-3 text-right">Access Controls</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {MOCK_STAFF.map(staff => (
                                    <TableRow key={staff.id}>
                                        <TableCell className="text-xs font-mono">{staff.id}</TableCell>
                                        <TableCell className="text-xs font-medium">{staff.name}</TableCell>
                                        <TableCell className="text-xs"><Badge variant="outline" className="text-[10px] bg-slate-50">{staff.role}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => { setIsReassignOpen(true); setIsManageStaffOpen(false); }}>Reassign</Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => toast.warning("Access revoked. DB transaction logged.")}><Trash2 className="w-3 h-3 mr-1" /> Revoke</Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Batch Staff Transfer</DialogTitle>
                        <DialogDescription className="text-xs text-amber-600 flex items-start gap-1 mt-1">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            [HIPAA Revocation] Transferring staff deletes their mapping to {selectedNode.name} and invalidates active sessions.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <Label className="text-xs font-semibold text-slate-700 mb-2 block">Destination Node</Label>
                        <Select>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select target Ward or Room..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="w-1">Maternity Ward</SelectItem>
                                <SelectItem value="r-1">ICU (Room 102)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsReassignOpen(false)}>Abort Change</Button>
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setIsReassignOpen(false); logSecurityAction('REASSIGN_STAFF', 'Transferred personnel.'); toast.success("Access securely revoked and reassigned."); }}>Execute Transfer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TooltipCard({ label, value, tooltip, icon, valueClass }: { label: string, value: string | number, tooltip?: string, icon?: React.ReactNode, valueClass?: string }) {
    const CardContent = (
        <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">{label}</p>
            <p className={`text-slate-700 font-medium ${valueClass || ''}`}>{icon}{value}</p>
        </div>
    );
    if (tooltip) {
        return (
            <TooltipProvider>
                <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                        <div className="cursor-help border border-transparent hover:border-slate-200 hover:bg-slate-50 p-2 -m-2 rounded transition-colors inline-block">{CardContent}</div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
    return CardContent;
}
