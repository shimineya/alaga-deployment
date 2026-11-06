import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { 
    UserPlus, 
    Cpu, 
    RotateCcw, 
    Search, 
    RefreshCw, 
    PlusCircle, 
    Database, 
    Heart, 
    Thermometer, 
    Droplets, 
    Activity, 
    BookOpen, 
    CheckCircle,
    Loader2
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { useAuth } from '../../lib/auth-context';
import { API_URL } from '../../lib/config';
import { BaselineGuideModal, BaselinePreset } from '../BaselineGuideModal';

const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface ScopedPatient {
    patient_id: number;
    name: string;
    birthdate: string;
    baseline_data: {
        gender?: string;
        diagnosis?: string;
    };
    created_at: string;
    device_serial_number: string | null;
    paired_devices: {
        serial_number: string;
        device_name: string;
        status: string;
    }[];
    assigned_users: {
        user_id: number;
        username: string;
        first_name: string;
        last_name: string;
        email: string;
        relationship: string;
        invite_status: string;
    }[];
}

interface TopologyBed {
    name: string;
    patientId: number | null;
}

interface TopologyRoom {
    name: string;
    beds: TopologyBed[];
}

interface TopologyWard {
    name: string;
    classification?: string;
    rooms: TopologyRoom[];
}

interface FacilityTopologyData {
    facility_id: number;
    facility_name: string;
    topology: TopologyWard[];
    total_wards: number;
    total_rooms: number;
    total_beds: number;
    occupied_beds: number;
    available_beds: number;
    registered_patients_count: number;
    can_register_more: boolean;
}

export default function PatientOnboarding() {
    const { user, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';
    const isSystemAdmin = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    const isParentOrGuardian = role === 'parent' || role === 'guardian';

    const API = isFacilityAdmin 
        ? `${API_URL}/api/facility-admin` 
        : `${API_URL}/api/caregiver`;

    // Patient form state
    const [form, setForm] = useState({ 
        first_name: '', 
        last_name: '', 
        age: '', 
        gender: 'Male', 
        diagnosis: '', 
        ward: '', 
        room: isParentOrGuardian ? 'Home' : '', 
        bed: isParentOrGuardian ? '1' : '', 
        patient_type: isParentOrGuardian ? 'at_home' : 'facility', 
        facility_name: '',
        heart_rate: 75,
        temperature: 36.8,
        spo2: 98,
        moisture_threshold: 30
    });
    const [consentConfirmed, setConsentConfirmed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lastCreatedId, setLastCreatedId] = useState<number | null>(null);

    // Facility topology & capacity state
    const [facilityTopology, setFacilityTopology] = useState<FacilityTopologyData | null>(null);
    const [showWardSuggestions, setShowWardSuggestions] = useState(false);
    const [showRoomSuggestions, setShowRoomSuggestions] = useState(false);
    const [showBedSuggestions, setShowBedSuggestions] = useState(false);

    // Existing patient lookup state
    const [existingPatientId, setExistingPatientId] = useState('');
    const [loadedPatientId, setLoadedPatientId] = useState<number | null>(null);
    const [isSearchingExisting, setIsSearchingExisting] = useState(false);
    const [isBaselineGuideOpen, setIsBaselineGuideOpen] = useState(false);

    // Device pairing state
    const [pairPatientId, setPairPatientId] = useState('');
    const [pairMode, setPairMode] = useState<'new' | 'existing'>('new');
    const [pairingType, setPairingType] = useState('both'); // 'both' | 'diaper' | 'vital'
    const [diaperSN, setDiaperSN] = useState('');
    const [vitalSN, setVitalSN] = useState('');
    const [availableDevices, setAvailableDevices] = useState<{ serial_number: string; device_name?: string; status: string }[]>([]);

    const fetchFacilityTopology = useCallback(async (facNameOverride?: string) => {
        if (isParentOrGuardian) return;
        try {
            const facQuery = isSystemAdmin && (facNameOverride ?? form.facility_name).trim()
                ? `?facility_name=${encodeURIComponent((facNameOverride ?? form.facility_name).trim())}`
                : '';
            const res = await fetch(`${API_URL}/api/caregiver/facility-topology${facQuery}`, {
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success && data.data) {
                setFacilityTopology(data.data);
            } else {
                setFacilityTopology(null);
            }
        } catch (err) {
            console.error('Failed to fetch facility topology:', err);
        }
    }, [isParentOrGuardian, isSystemAdmin, form.facility_name]);

    // Fetch available devices
    const fetchAvailableDevices = async () => {
        try {
            const res = await fetch(`${API_URL}/api/caregiver/devices/available`, {
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setAvailableDevices(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch available devices:', err);
        }
    };

    useEffect(() => {
        fetchAvailableDevices();
        fetchFacilityTopology();
    }, [fetchFacilityTopology]);

    // SVM reset state
    const [resetPatientId, setResetPatientId] = useState('');
    const [resetDeviceSN, setResetDeviceSN] = useState('');
    const [resetReason, setResetReason] = useState('');

    // Patient List State
    const [patients, setPatients] = useState<ScopedPatient[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Unassigned Patient List State
    const [unassignedPatients, setUnassignedPatients] = useState<ScopedPatient[]>([]);
    const [unassignedSearchQuery, setUnassignedSearchQuery] = useState('');
    const [unassignedSuggestions, setUnassignedSuggestions] = useState<string[]>([]);
    const [showUnassignedSuggestions, setShowUnassignedSuggestions] = useState(false);
    const [isLoadingUnassigned, setIsLoadingUnassigned] = useState(false);

    // Edit Patient Profile and Care Team Assignment states
    const [editingPatient, setEditingPatient] = useState<ScopedPatient | null>(null);
    const [editForm, setEditForm] = useState({ name: '', gender: 'Male', diagnosis: '' });

    const startEditPatient = (pat: ScopedPatient) => {
        setEditingPatient(pat);
        setEditForm({
            name: pat.name,
            gender: pat.baseline_data?.gender || 'Male',
            diagnosis: pat.baseline_data?.diagnosis || ''
        });
    };

    const handleUpdatePatient = async () => {
        if (!editingPatient) return;
        try {
            const res = await fetch(`${API}/patients/${editingPatient.patient_id}`, {
                method: 'PUT',
                headers: getAuth(),
                body: JSON.stringify(editForm)
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setEditingPatient(null);
                fetchPatients();
                fetchUnassignedPatients();
            } else {
                toast.error(data.message || 'Failed to update patient.');
            }
        } catch {
            toast.error('Failed to update patient.');
        }
    };

    const handleArchivePatient = async (patientId: number) => {
        if (!window.confirm('Are you sure you want to archive this patient? Doing so will unpair any active devices.')) {
            return;
        }
        try {
            const res = await fetch(`${API}/patients/${patientId}`, {
                method: 'DELETE',
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchPatients();
                fetchUnassignedPatients();
            } else {
                toast.error(data.message || 'Failed to archive patient.');
            }
        } catch {
            toast.error('Failed to archive patient.');
        }
    };

    const handleAssignByEmail = async (patientId: number, email: string) => {
        if (!email) return toast.error('Email address is required.');
        try {
            const res = await fetch(`${API}/patients/${patientId}/assign-staff-by-email`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchPatients();
                fetchUnassignedPatients();
            } else {
                toast.error(data.message || 'Assignment failed.');
            }
        } catch {
            toast.error('Failed to assign staff.');
        }
    };

    const fetchPatients = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/patients-added-and-assigned`, {
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                setPatients(data.data || []);
            } else {
                toast.error(data.message || 'Failed to fetch patient list.');
            }
        } catch {
            toast.error('Failed to load patient list.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchUnassignedPatients = useCallback(async () => {
        setIsLoadingUnassigned(true);
        try {
            const res = await fetch(`${API}/unassigned-patients`, {
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                setUnassignedPatients(data.data || []);
            } else {
                toast.error(data.message || 'Failed to fetch unassigned patient list.');
            }
        } catch {
            toast.error('Failed to load unassigned patient list.');
        } finally {
            setIsLoadingUnassigned(false);
        }
    }, []);

    useEffect(() => {
        fetchPatients();
        fetchUnassignedPatients();
        const handleSync = () => {
            fetchAvailableDevices();
            fetchFacilityTopology();
            fetchPatients();
            fetchUnassignedPatients();
        };
        window.addEventListener('alaga_manual_refresh', handleSync);
        window.addEventListener('alaga_alert_update', handleSync);
        return () => {
            window.removeEventListener('alaga_manual_refresh', handleSync);
            window.removeEventListener('alaga_alert_update', handleSync);
        };
    }, [fetchPatients, fetchUnassignedPatients, fetchFacilityTopology]);

    const handleLookupExistingPatient = async () => {
        const id = existingPatientId.trim();
        if (!id) return toast.error('Please enter a Patient ID to load.');
        setIsSearchingExisting(true);
        try {
            const res = await fetch(`${API_URL}/api/caregiver/patients/${id}`, { headers: getAuth() });
            const data = await res.json();
            if (data.success && data.data) {
                const p = data.data;
                const base = p.baseline_data || {};
                const nameParts = (p.name || '').trim().split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                let ageVal = '';
                if (p.birthdate) {
                    const birthYear = new Date(p.birthdate).getFullYear();
                    ageVal = Math.max(1, new Date().getFullYear() - birthYear).toString();
                }

                setForm({
                    first_name: firstName,
                    last_name: lastName,
                    age: ageVal || '30',
                    gender: base.gender || 'Male',
                    diagnosis: base.diagnosis || base.condition || '',
                    ward: base.ward || '',
                    room: base.room || '',
                    bed: base.bed || '',
                    patient_type: p.patient_type || 'facility',
                    facility_name: p.facility_name || '',
                    heart_rate: Number(base.heart_rate || base.heartRate) || 75,
                    temperature: Number(base.temperature) || 36.8,
                    spo2: Number(base.spo2) || 98,
                    moisture_threshold: Number(base.moisture_threshold || base.moistureThreshold) || 30
                });
                if (p.facility_name) {
                    fetchFacilityTopology(p.facility_name);
                }
                setConsentConfirmed(true);
                setLoadedPatientId(p.patient_id);
                toast.success(`Loaded patient #${p.patient_id} (${p.name}). Details populated.`);
            } else {
                toast.error(data.message || `Patient #${id} not found.`);
            }
        } catch {
            toast.error('Failed to lookup patient.');
        } finally {
            setIsSearchingExisting(false);
        }
    };

    const handleClearExistingPatient = () => {
        setLoadedPatientId(null);
        setExistingPatientId('');
        setForm({
            first_name: '', last_name: '', age: '', gender: 'Male', diagnosis: '',
            ward: '', room: isParentOrGuardian ? 'Home' : '', bed: isParentOrGuardian ? '1' : '',
            patient_type: isParentOrGuardian ? 'at_home' : 'facility', facility_name: '',
            heart_rate: 75, temperature: 36.8, spo2: 98, moisture_threshold: 30
        });
        setConsentConfirmed(false);
        toast.info('Cleared patient. Ready to register new patient.');
    };

    const handleApplyPreset = (preset: BaselinePreset) => {
        setForm(prev => ({
            ...prev,
            heart_rate: preset.heartRate,
            temperature: preset.temperature,
            spo2: preset.spo2,
            moisture_threshold: preset.moistureThreshold
        }));
        toast.success('Applied standard physiological baseline preset.');
    };

    // Cascading suggestions from facility topology
    const topologyWards = facilityTopology?.topology || [];
    const matchedTopologyWard = topologyWards.find(
        w => w.name.trim().toLowerCase() === form.ward.trim().toLowerCase()
    );
    const wardSuggestionsList = topologyWards.filter(
        w => !form.ward.trim() || w.name.toLowerCase().includes(form.ward.trim().toLowerCase())
    );
    const roomSuggestionsList = (matchedTopologyWard ? matchedTopologyWard.rooms : []).filter(
        r => !form.room.trim() || r.name.toLowerCase().includes(form.room.trim().toLowerCase())
    );
    const matchedTopologyRoom = matchedTopologyWard?.rooms.find(
        r => r.name.trim().toLowerCase() === form.room.trim().toLowerCase()
    );
    const bedSuggestionsList = (matchedTopologyRoom ? matchedTopologyRoom.beds : []).filter(
        b => !form.bed.trim() || b.name.toLowerCase().includes(form.bed.trim().toLowerCase())
    );

    const isFacilityMode = !isParentOrGuardian && form.patient_type === 'facility';
    const isBedLimitReached = isFacilityMode && !loadedPatientId && facilityTopology !== null && (facilityTopology.total_beds === 0 || facilityTopology.available_beds <= 0);

    const handleRegister = async () => {
        if (!form.first_name || !form.last_name || !form.age || !form.diagnosis) {
            return toast.error('Please fill in all required fields (First Name, Last Name, Age, Diagnosis).');
        }
        if (isSystemAdmin && form.patient_type === 'facility' && !form.facility_name.trim()) {
            return toast.error('Facility Name is required when Care Setting is Facility.');
        }
        if (isFacilityMode) {
            if (!form.ward.trim() || !form.room.trim() || !form.bed.trim()) {
                return toast.error('Ward Name, Room Name, and Bed Name are required for facility patients.');
            }
            if (!loadedPatientId && facilityTopology && (facilityTopology.total_beds === 0 || facilityTopology.available_beds <= 0)) {
                return toast.error(
                    facilityTopology.total_beds === 0
                        ? `Cannot register patient anymore: No wards, rooms, or beds have been configured in ${facilityTopology.facility_name} by the System Administrator.`
                        : `Cannot register patient anymore: ${facilityTopology.facility_name} has reached its maximum capacity of ${facilityTopology.total_beds} bed(s).`
                );
            }
            if (facilityTopology && topologyWards.length > 0) {
                if (!matchedTopologyWard) {
                    return toast.error(`Ward "${form.ward}" is not registered in ${facilityTopology.facility_name}. Please select a registered Ward from the suggestion list.`);
                }
                if (!matchedTopologyRoom) {
                    return toast.error(`Room "${form.room}" is not registered under Ward "${matchedTopologyWard.name}". Please select a valid Room from the suggestion list.`);
                }
                const matchedBed = matchedTopologyRoom.beds.find(b => b.name.trim().toLowerCase() === form.bed.trim().toLowerCase());
                if (!matchedBed) {
                    return toast.error(`Bed "${form.bed}" is not registered under Room "${matchedTopologyRoom.name}". Please select a valid Bed from the suggestion list.`);
                }
                if (matchedBed.patientId && Number(matchedBed.patientId) !== Number(loadedPatientId || 0)) {
                    return toast.error(`Bed "${matchedBed.name}" in Room "${matchedTopologyRoom.name}" is already occupied. Please select an available bed.`);
                }
            }
        } else if (!form.room.trim()) {
            return toast.error('Room Name is required.');
        }
        if (!consentConfirmed) {
            return toast.error('Informed consent must be confirmed before registering a patient. (DPA § 13)');
        }
        setSubmitting(true);
        try {
            if (loadedPatientId) {
                // Update existing patient
                const res = await fetch(`${API}/patients/${loadedPatientId}`, {
                    method: 'PUT',
                    headers: getAuth(),
                    body: JSON.stringify({
                        name: `${form.first_name.trim()} ${form.last_name.trim()}`,
                        gender: form.gender,
                        diagnosis: form.diagnosis,
                        ward: form.ward.trim() || null,
                        room: form.room.trim(),
                        bed: form.bed.trim() || null,
                        heart_rate: Number(form.heart_rate),
                        temperature: Number(form.temperature),
                        spo2: Number(form.spo2),
                        moisture_threshold: Number(form.moisture_threshold)
                    })
                });
                const data = await res.json();
                if (data.success) {
                    toast.success(data.message || `Patient #${loadedPatientId} updated successfully.`);
                    fetchFacilityTopology();
                    fetchPatients();
                    fetchUnassignedPatients();
                    window.dispatchEvent(new CustomEvent('alaga_manual_refresh'));
                } else {
                    toast.error(data.message || 'Failed to update patient.');
                }
            } else {
                // Register new patient
                const res = await fetch(`${API}/patients`, {
                    method: 'POST', headers: getAuth(),
                    body: JSON.stringify({ 
                        ...form, 
                        age: parseInt(form.age), 
                        ward: form.ward.trim(),
                        room: form.room.trim(),
                        bed: form.bed.trim(), 
                        consent_confirmed: true,
                        heart_rate: Number(form.heart_rate),
                        temperature: Number(form.temperature),
                        spo2: Number(form.spo2),
                        moisture_threshold: Number(form.moisture_threshold)
                    })
                });
                const data = await res.json();
                if (data.success) {
                    toast.success(data.message);
                    setLastCreatedId(data.patient_id);
                    setForm({ 
                        first_name: '', last_name: '', age: '', gender: 'Male', diagnosis: '', 
                        ward: '', room: '', bed: '', patient_type: 'facility', facility_name: form.facility_name,
                        heart_rate: 75, temperature: 36.8, spo2: 98, moisture_threshold: 30
                    });
                    setConsentConfirmed(false);
                    fetchFacilityTopology();
                    fetchPatients();
                    fetchUnassignedPatients();
                    window.dispatchEvent(new CustomEvent('alaga_manual_refresh'));
                } else toast.error(data.message);
            }
        } catch { toast.error('Action failed.'); }
        finally { setSubmitting(false); }
    };

    const handlePairDevice = async () => {
        if (!pairPatientId.trim()) return toast.error('Patient ID is required.');
        
        let diaperToPair = '';
        let vitalToPair = '';

        if (pairingType === 'both' || pairingType === 'diaper') {
            diaperToPair = diaperSN.trim().toUpperCase();
            if (!diaperToPair) return toast.error('Smart Diaper Device serial number is required.');
            if (!diaperToPair.startsWith('SD-')) return toast.error('Smart Diaper serial number must start with "SD-" (e.g. SD-2026-0001)');
        }
        if (pairingType === 'both' || pairingType === 'vital') {
            vitalToPair = vitalSN.trim().toUpperCase();
            if (!vitalToPair) return toast.error('Vital Signs Device serial number is required.');
            if (!vitalToPair.startsWith('VS-')) return toast.error('Vital Signs serial number must start with "VS-" (e.g. VS-2026-0001)');
        }

        try {
            // Function to pair a single device
            const pairOne = async (sn: string, label: string) => {
                const res = await fetch(`${API}/patients/${pairPatientId.trim()}/pair-device`, {
                    method: 'POST', 
                    headers: getAuth(),
                    body: JSON.stringify({ 
                        serial_number: sn,
                        register_new: pairMode === 'new'
                    })
                });
                const data = await res.json();
                if (!data.success) {
                    throw new Error(`${label}: ${data.message}`);
                }
            };

            if (diaperToPair) {
                await pairOne(diaperToPair, 'Smart Diaper');
            }
            if (vitalToPair) {
                await pairOne(vitalToPair, 'Vital Signs');
            }

            toast.success('Device(s) paired successfully to patient.');
            setPairPatientId('');
            setDiaperSN('');
            setVitalSN('');
            fetchPatients();
            fetchUnassignedPatients();
            fetchAvailableDevices();
        } catch (err: any) {
            toast.error(err.message || 'Device pairing failed.');
        }
    };

    // Filter patients
    const filteredPatients = patients.filter(p => {
        const query = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(query) ||
            p.patient_id.toString().includes(query) ||
            (p.baseline_data?.diagnosis || '').toLowerCase().includes(query);
    });

    // Filter unassigned patients
    const filteredUnassignedPatients = unassignedPatients.filter(p => {
        const query = unassignedSearchQuery.toLowerCase();
        return p.name.toLowerCase().includes(query) ||
            p.patient_id.toString().includes(query) ||
            (p.baseline_data?.diagnosis || '').toLowerCase().includes(query);
    });

    // Handle unassigned suggestions
    useEffect(() => {
        if (unassignedSearchQuery.trim().length > 0) {
            const matches = unassignedPatients
                .map(p => p.name)
                .filter(name => name.toLowerCase().includes(unassignedSearchQuery.toLowerCase()));
            setUnassignedSuggestions(Array.from(new Set(matches)).slice(0, 5));
        } else {
            setUnassignedSuggestions([]);
        }
    }, [unassignedSearchQuery, unassignedPatients]);

    return (
        <div className="space-y-6 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight">Patient Onboarding</h2>
                    <p className="text-[10px] font-medium text-slate-500">Register new patients into verified facility wards/rooms/beds and pair monitoring devices.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { fetchPatients(); fetchFacilityTopology(); }} disabled={isLoading} className="h-9 gap-1.5 cursor-pointer">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh List
                </Button>
            </div>

            {/* Forms Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0">
                {/* Patient Registration & Location Assignment */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="py-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-slate-800 text-sm flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-teal-600" />
                                {loadedPatientId ? `Edit Patient #${loadedPatientId} Profile & Bed Assignment` : 'Register Patient & Normal Baselines'}
                            </CardTitle>
                            {loadedPatientId && (
                                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 text-[10px]">
                                    Existing Patient Mode
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-[10px] text-slate-500">
                            Enroll a new clinical record into a registered Ward, Room, and Bed or load an existing patient to update their profile.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Facility Bed Capacity Status Banner */}
                        {isFacilityMode && facilityTopology && (
                            <div className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 ${
                                isBedLimitReached
                                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                                    : 'bg-teal-50/70 border-teal-200 text-teal-900'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-[11px]">
                                        {facilityTopology.facility_name} Bed Capacity
                                    </span>
                                    <Badge className={`text-[10px] border-none font-bold ${
                                        isBedLimitReached ? 'bg-rose-600 text-white' : 'bg-teal-600 text-white'
                                    }`}>
                                        {facilityTopology.available_beds} / {facilityTopology.total_beds} Beds Available
                                    </Badge>
                                </div>
                                <p className="text-[10px] leading-snug">
                                    {facilityTopology.total_beds === 0
                                        ? 'Cannot register patient anymore: No wards, rooms, or beds have been configured in the system for this facility by the System Administrator.'
                                        : isBedLimitReached
                                            ? `Cannot register patient anymore: Facility bed capacity limit (${facilityTopology.total_beds} beds) has been reached.`
                                            : `${facilityTopology.total_wards} Ward(s), ${facilityTopology.total_rooms} Room(s), and ${facilityTopology.available_beds} open Bed(s) available for patient onboarding.`}
                                </p>
                            </div>
                        )}

                        {/* Existing Patient Lookup Box */}
                        <div className="p-2.5 bg-slate-50/90 border border-slate-200 rounded-lg space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Search className="w-3 h-3 text-teal-600" />
                                    Existing Patient ID Lookup
                                </label>
                                {loadedPatientId && (
                                    <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                                        Editing Patient #{loadedPatientId}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={existingPatientId}
                                    onChange={e => setExistingPatientId(e.target.value.replace(/[^0-9]/g, ''))}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLookupExistingPatient(); } }}
                                    placeholder="Enter Patient ID (e.g. 5) to load patient details..."
                                    className="h-8 text-xs bg-white flex-1"
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleLookupExistingPatient}
                                    disabled={isSearchingExisting || !existingPatientId.trim()}
                                    className="h-8 text-xs px-3 bg-slate-800 hover:bg-slate-900 text-white font-medium cursor-pointer"
                                >
                                    {isSearchingExisting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Search className="w-3.5 h-3.5 mr-1" />}
                                    Load
                                </Button>
                                {loadedPatientId && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={handleClearExistingPatient}
                                        className="h-8 text-xs px-2 text-slate-600 hover:text-red-600 border-slate-200 hover:bg-red-50 cursor-pointer"
                                        title="Clear and register a new patient"
                                    >
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        New
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                    First Name <span className="text-red-500">*</span>
                                </label>
                                <Input 
                                    value={form.first_name} 
                                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value.replace(/[^a-zA-Z\s'-]/g, '') }))} 
                                    className="h-8 text-xs bg-slate-50/50" 
                                    placeholder="Juan"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                    Last Name <span className="text-red-500">*</span>
                                </label>
                                <Input 
                                    value={form.last_name} 
                                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value.replace(/[^a-zA-Z\s'-]/g, '') }))} 
                                    className="h-8 text-xs bg-slate-50/50" 
                                    placeholder="Dela Cruz"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                    Age <span className="text-red-500">*</span>
                                </label>
                                <Input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} className="h-8 text-xs bg-slate-50/50" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Gender</label>
                                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                    className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 cursor-pointer">
                                    <option>Male</option><option>Female</option><option>Other</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                Diagnosis / Reason for Monitoring <span className="text-red-500">*</span>
                            </label>
                            <Input value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} className="h-8 text-xs bg-slate-50/50" placeholder="e.g. Hypertension" />
                        </div>

                        {isSystemAdmin && (
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Care Setting</label>
                                    <select
                                        value={form.patient_type}
                                        onChange={e => setForm(f => ({
                                            ...f,
                                            patient_type: e.target.value,
                                            facility_name: e.target.value === 'at_home' ? '' : f.facility_name
                                        }))}
                                        className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 cursor-pointer"
                                    >
                                        <option value="facility">Facility</option>
                                        <option value="at_home">At Home</option>
                                    </select>
                                </div>
                                {form.patient_type === 'facility' && (
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Facility Name <span className="text-red-500">*</span></label>
                                        <Input
                                            value={form.facility_name}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setForm(f => ({ ...f, facility_name: val, ward: '', room: '', bed: '' }));
                                                fetchFacilityTopology(val);
                                            }}
                                            placeholder="e.g. Alaga General Hospital"
                                            className="h-8 text-xs bg-slate-50/50"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="border-t border-slate-100 pt-2.5 mt-2.5">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Location Assignment (Registered Facility Topology)
                            </span>
                            <div className="space-y-2">
                                {/* WARD NAME WITH SUGGESTIONS */}
                                <div className="relative">
                                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                        Ward Name {isFacilityMode ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
                                    </label>
                                    <Input
                                        value={form.ward}
                                        onChange={e => {
                                            setForm(f => ({ ...f, ward: e.target.value, room: '', bed: '' }));
                                            setShowWardSuggestions(true);
                                        }}
                                        onFocus={() => setShowWardSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowWardSuggestions(false), 200)}
                                        className="h-8 text-xs bg-slate-50/50"
                                        placeholder="Select registered Ward..."
                                    />
                                    {isFacilityMode && showWardSuggestions && (
                                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                                            <div className="px-2.5 py-1 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                                Registered Facility Wards ({wardSuggestionsList.length})
                                            </div>
                                            {wardSuggestionsList.length > 0 ? (
                                                wardSuggestionsList.map((w, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onMouseDown={e => {
                                                            e.preventDefault();
                                                            setForm(f => ({ ...f, ward: w.name, room: '', bed: '' }));
                                                            setShowWardSuggestions(false);
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-teal-50 text-slate-700 flex items-center justify-between"
                                                    >
                                                        <span className="font-semibold">{w.name}</span>
                                                        <span className="text-[10px] text-slate-400">{w.rooms?.length || 0} room(s)</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-3 py-2 text-xs text-slate-400 italic">
                                                    No matching wards configured in Facility Profile Details.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {/* ROOM NAME WITH CASCADING SUGGESTIONS */}
                                    <div className="relative">
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                            Room Name <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            value={form.room}
                                            onChange={e => {
                                                setForm(f => ({ ...f, room: e.target.value, bed: '' }));
                                                setShowRoomSuggestions(true);
                                            }}
                                            onFocus={() => setShowRoomSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowRoomSuggestions(false), 200)}
                                            disabled={isFacilityMode && !form.ward.trim()}
                                            className="h-8 text-xs bg-slate-50/50"
                                            placeholder={isFacilityMode && !form.ward.trim() ? "Select Ward first..." : "Select registered Room..."}
                                        />
                                        {isFacilityMode && showRoomSuggestions && (
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                                                <div className="px-2.5 py-1 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                                    Rooms in {matchedTopologyWard?.name || form.ward || 'Ward'}
                                                </div>
                                                {roomSuggestionsList.length > 0 ? (
                                                    roomSuggestionsList.map((r, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onMouseDown={e => {
                                                                e.preventDefault();
                                                                setForm(f => ({ ...f, room: r.name, bed: '' }));
                                                                setShowRoomSuggestions(false);
                                                            }}
                                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-teal-50 text-slate-700 flex items-center justify-between"
                                                        >
                                                            <span className="font-semibold">{r.name}</span>
                                                            <span className="text-[10px] text-slate-400">{r.beds?.length || 0} bed(s)</span>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-3 py-2 text-xs text-slate-400 italic">
                                                        No matching rooms registered under this ward.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* BED NAME WITH CASCADING SUGGESTIONS */}
                                    <div className="relative">
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                            Bed Name {isFacilityMode ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
                                        </label>
                                        <Input
                                            value={form.bed}
                                            onChange={e => {
                                                setForm(f => ({ ...f, bed: e.target.value }));
                                                setShowBedSuggestions(true);
                                            }}
                                            onFocus={() => setShowBedSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowBedSuggestions(false), 200)}
                                            disabled={isFacilityMode && (!form.ward.trim() || !form.room.trim())}
                                            className="h-8 text-xs bg-slate-50/50"
                                            placeholder={isFacilityMode && !form.room.trim() ? "Select Room first..." : "Select registered Bed..."}
                                        />
                                        {isFacilityMode && showBedSuggestions && (
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                                                <div className="px-2.5 py-1 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                                    Beds in {matchedTopologyRoom?.name || form.room || 'Room'}
                                                </div>
                                                {bedSuggestionsList.length > 0 ? (
                                                    bedSuggestionsList.map((b, idx) => {
                                                        const isOccupiedByOther = b.patientId !== null && Number(b.patientId) !== Number(loadedPatientId || 0);
                                                        return (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                disabled={isOccupiedByOther}
                                                                onMouseDown={e => {
                                                                    e.preventDefault();
                                                                    if (!isOccupiedByOther) {
                                                                        setForm(f => ({ ...f, bed: b.name }));
                                                                        setShowBedSuggestions(false);
                                                                    }
                                                                }}
                                                                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                                                                    isOccupiedByOther
                                                                        ? 'text-slate-400 bg-slate-50 cursor-not-allowed'
                                                                        : 'hover:bg-teal-50 text-slate-700'
                                                                }`}
                                                            >
                                                                <span className="font-semibold">{b.name}</span>
                                                                <span className={`text-[10px] font-semibold ${isOccupiedByOther ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                                    {isOccupiedByOther ? 'Occupied' : 'Available'}
                                                                </span>
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="px-3 py-2 text-xs text-slate-400 italic">
                                                        No matching beds registered under this room.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* [DPA] Visible consent checkbox */}
                        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <input type="checkbox" id="consent" checked={consentConfirmed} onChange={e => setConsentConfirmed(e.target.checked)}
                                className="mt-0.5 accent-teal-600 cursor-pointer" />
                            <label htmlFor="consent" className="text-[10px] text-blue-800 cursor-pointer select-none leading-relaxed">
                                I confirm that the patient or their legal guardian has provided informed consent for health data collection and processing, as required by the Data Privacy Act of 2012 (RA 10173), Section 13.
                            </label>
                        </div>
                        {lastCreatedId && !loadedPatientId && (
                            <div className="text-[10px] bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-emerald-700">
                                Patient registered successfully. Patient ID: <strong>{lastCreatedId}</strong>. Use this ID below to pair a device.
                            </div>
                        )}
                        <Button
                            onClick={handleRegister}
                            disabled={submitting || isBedLimitReached}
                            className="w-full h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                        >
                            {submitting
                                ? 'Saving...'
                                : isBedLimitReached
                                    ? 'Cannot Register Patient (Bed Limit Reached)'
                                    : loadedPatientId
                                        ? 'Update Patient Profile & Bed'
                                        : 'Register Patient'}
                        </Button>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    {/* Device Pairing */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="py-4">
                            <CardTitle className="text-slate-800 text-sm flex items-center gap-2"><Cpu className="w-4 h-4 text-teal-600" /> Pair Device/s To Patient</CardTitle>
                            <CardDescription className="text-[10px] text-slate-500">Device serial number must be pre-approved in whitelist.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* Mode Selection Checkbox */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">Device Registration Option</label>
                                <div className="grid grid-cols-1 gap-1.5">
                                    <label 
                                        className={`flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all ${
                                            pairMode === 'new' 
                                                ? 'bg-teal-50 border-teal-500 text-teal-900 font-medium' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={pairMode === 'new'} 
                                            onChange={() => {
                                                setPairMode('new');
                                                setDiaperSN('');
                                                setVitalSN('');
                                            }}
                                            className="accent-teal-600 cursor-pointer" 
                                        />
                                        <PlusCircle className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                        <span>Register a new device to patient</span>
                                    </label>

                                    <label 
                                        className={`flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs transition-all ${
                                            pairMode === 'existing' 
                                                ? 'bg-teal-50 border-teal-500 text-teal-900 font-medium' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={pairMode === 'existing'} 
                                            onChange={() => {
                                                setPairMode('existing');
                                                setDiaperSN('');
                                                setVitalSN('');
                                                fetchAvailableDevices();
                                            }}
                                            className="accent-teal-600 cursor-pointer" 
                                        />
                                        <Database className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                        <span>Register an existing device to a patient</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Patient ID</label>
                                <Input value={pairPatientId} onChange={e => setPairPatientId(e.target.value)} placeholder="e.g. 5" type="number" className="h-8 text-xs bg-slate-50/50" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Device Selection</label>
                                <select 
                                    value={pairingType} 
                                    onChange={e => setPairingType(e.target.value)}
                                    className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 cursor-pointer"
                                >
                                    <option value="both">Partnered Devices (Smart Diaper Moisture Sensor & Vital Signs Sensor)</option>
                                    <option value="diaper">Smart Diaper Moisture Sensor only</option>
                                    <option value="vital">Vital Signs Sensor only</option>
                                </select>
                            </div>
                            
                            {(pairingType === 'both' || pairingType === 'diaper') && (
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[10px] font-semibold text-slate-600">Smart Diaper Moisture Sensor Serial Number</label>
                                        {pairMode === 'existing' && availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('SD-')).length > 0 && (
                                            <span className="text-[9px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-medium">
                                                {availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('SD-')).length} Available
                                            </span>
                                        )}
                                    </div>
                                    {pairMode === 'existing' && availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('SD-')).length > 0 ? (
                                        <div className="space-y-1">
                                            <select
                                                value={diaperSN}
                                                onChange={e => setDiaperSN(e.target.value)}
                                                className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 font-mono cursor-pointer"
                                            >
                                                <option value="">-- Select Available Smart Diaper Moisture Sensor --</option>
                                                {availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('SD-')).map(d => (
                                                    <option key={d.serial_number} value={d.serial_number}>
                                                        {d.serial_number} - AVAILABLE
                                                    </option>
                                                ))}
                                            </select>
                                            <Input value={diaperSN} onChange={e => setDiaperSN(e.target.value)} placeholder="Or type serial number (e.g. SD-2026-0001)" className="h-7 text-xs font-mono bg-slate-50/50" />
                                        </div>
                                    ) : (
                                        <Input value={diaperSN} onChange={e => setDiaperSN(e.target.value)} placeholder="e.g. SD-2026-0001" className="h-8 text-xs font-mono bg-slate-50/50" />
                                    )}
                                </div>
                            )}

                            {(pairingType === 'both' || pairingType === 'vital') && (
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[10px] font-semibold text-slate-600">Vital Signs Sensor Serial Number</label>
                                        {pairMode === 'existing' && availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('VS-')).length > 0 && (
                                            <span className="text-[9px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-medium">
                                                {availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('VS-')).length} Available
                                            </span>
                                        )}
                                    </div>
                                    {pairMode === 'existing' && availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('VS-')).length > 0 ? (
                                        <div className="space-y-1">
                                            <select
                                                value={vitalSN}
                                                onChange={e => setVitalSN(e.target.value)}
                                                className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 font-mono cursor-pointer"
                                            >
                                                <option value="">-- Select Available Vital Signs Sensor --</option>
                                                {availableDevices.filter(d => d.serial_number.toUpperCase().startsWith('VS-')).map(d => (
                                                    <option key={d.serial_number} value={d.serial_number}>
                                                        {d.serial_number} - AVAILABLE
                                                    </option>
                                                ))}
                                            </select>
                                            <Input value={vitalSN} onChange={e => setVitalSN(e.target.value)} placeholder="Or type serial number (e.g. VS-2026-0001)" className="h-7 text-xs font-mono bg-slate-50/50" />
                                        </div>
                                    ) : (
                                        <Input value={vitalSN} onChange={e => setVitalSN(e.target.value)} placeholder="e.g. VS-2026-0001" className="h-8 text-xs font-mono bg-slate-50/50" />
                                    )}
                                </div>
                            )}

                            <Button onClick={handlePairDevice} className="w-full h-8 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold cursor-pointer">
                                {pairMode === 'new' ? 'Register & Pair New Device' : 'Pair Existing Device'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <BaselineGuideModal 
                isOpen={isBaselineGuideOpen} 
                onClose={() => setIsBaselineGuideOpen(false)} 
                onApplyPreset={handleApplyPreset} 
            />
        </div>
    );
}
