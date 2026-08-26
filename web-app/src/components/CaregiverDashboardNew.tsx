import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../lib/auth-context';
import { Patient, Alert, VitalSign, DoctorsOrdersData } from '../types';
import { generateAlertsFromDoctorsOrders, checkVitalSignThresholds } from '../lib/alert-generator';
import { DashboardSidebar } from './DashboardSidebar';
import { NotificationPanel } from './NotificationPanel';
import { PatientProfile } from './PatientProfile';
import { AddNewPatient } from './AddNewPatient';
import { PatientList } from './PatientList';
import { AddNewDevice } from './AddNewDevice';
import { AssignmentTracker } from './AssignmentTracker';
import { CaregiverUserManagement } from './CaregiverUserManagement';
import { MyDevices } from './MyDevices';
import { FirmwareOTA } from './FirmwareOTA';
import { DailyHealthSummary } from './caregiver-reports/DailyHealthSummary';
import { AnomalyLog } from './caregiver-reports/AnomalyLog';
import { MoistureHygieneTracker } from './caregiver-reports/MoistureHygieneTracker';
import { WeeklyTrendAnalysis } from './caregiver-reports/WeeklyTrendAnalysis';
import { ExportableHealthReport } from './caregiver-reports/ExportableHealthReport';
import { CaregiverSettings } from './CaregiverSettings';
import { CaregiverProfile } from './CaregiverProfile';
import { CaregiverLanguageProvider } from '../lib/caregiver-language-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
    Users, Activity, Bell, Heart, Thermometer, Droplets, Wifi,
    AlertTriangle, Check, User, LogOut, Search, TrendingUp, AlertCircle, ChevronLeft, ChevronRight,
    HelpCircle,
    Link2Off, Calendar as CalendarIcon, X, Plus, Repeat, Trash2, Edit
} from 'lucide-react';
import { toast } from 'sonner';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import axios from 'axios';




interface CaregiverDashboardProps {
    initialTab?: string;
    hideNavigation?: boolean;
}




interface ScheduleItem {
    id?: number;
    schedule_id?: number;
    patient_name: string;
    event_type: string;
    custom_event_name?: string;
    is_recurring: boolean;
    recurrence_interval?: string;
    scheduled_at: string;
    status: 'Pending' | 'Completed' | 'Missed';
}




export const CaregiverDashboardNew: React.FC<CaregiverDashboardProps> = ({
    initialTab = 'dashboard',
    hideNavigation = false
}) => {
    const { user, logout, token } = useAuth();




    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [viewMode, setViewMode] = useState<'dashboard' | 'profile'>('dashboard');
    const [profileInitialTab, setProfileInitialTab] = useState<string>('overview');
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
    const [activeNavItem, setActiveNavItem] = useState(initialTab);




    useEffect(() => {
        setActiveNavItem(initialTab);
    }, [initialTab]);

    React.useEffect(() => {
        if (selectedPatient) {
            const updated = patients.find(p => p.id === selectedPatient.id);
            if (updated) {
                setSelectedPatient(updated);
            }
        }
    }, [patients, selectedPatient]);
    const [detailView, setDetailView] = useState<'list' | 'detail'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const patientSearchRef = useRef<HTMLDivElement>(null);
    const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
 
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (patientSearchRef.current && !patientSearchRef.current.contains(event.target as Node)) {
                setShowPatientSuggestions(false);
            }
        };
        document.onmousedown = handleClickOutside as any;
        return () => { document.onmousedown = null; };
    }, []);
 
    const [reportPatientId, setReportPatientId] = useState('');
    const itemsPerPage = 8;




    const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
   
    const [patientName, setPatientName] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [patientSuggestions, setPatientSuggestions] = useState<Patient[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestionsRef = useRef<HTMLDivElement>(null);
   
    const [eventType, setEventType] = useState('Medication Intake');
    const [customEvent, setCustomEvent] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceInterval, setRecurrenceInterval] = useState('Daily');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
    const [editPatientName, setEditPatientName] = useState('');
    const [editEventType, setEditEventType] = useState('Medication Intake');
    const [editCustomEvent, setEditCustomEvent] = useState('');
    const [editIsRecurring, setEditIsRecurring] = useState(false);
    const [editRecurrenceInterval, setEditRecurrenceInterval] = useState('Daily');
    const [editScheduledDate, setEditScheduledDate] = useState('');
    const [editScheduledTime, setEditScheduledTime] = useState('');
    const [editStatus, setEditStatus] = useState<'Pending' | 'Completed' | 'Missed'>('Pending');




    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);




    const [activeAlarm, setActiveAlarm] = useState<ScheduleItem | null>(null);
    const audioIntervalRef = useRef<any>(null);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const todayStr = new Date().toISOString().split('T')[0];




    const metrics = useMemo(() => {
        const activePatients = patients.filter(p => !((p as any).deleted) && !((p as any).archived));
        const criticalCount = activePatients.filter(p =>
            alerts.some(a => a.patientId === p.id && a.severity === 'critical' && !a.acknowledged)
        ).length;
        const unassignedCount = activePatients.filter(p => !p.deviceConnected).length;
        const stableCount = activePatients.length - criticalCount - unassignedCount;




        return {
            critical: criticalCount,
            stable: Math.max(0, stableCount),
            unassigned: unassignedCount,
            total: activePatients.length
        };
    }, [patients, alerts]);




    const trendData = [
        { time: '08:00', critical: 1, stable: 10 },
        { time: '12:00', critical: 0, stable: 11 },
        { time: '16:00', critical: metrics.critical, stable: metrics.stable },
    ];
    const distributionData = [
        { name: 'Stable', value: metrics.stable, color: '#10B981' },
        { name: 'Critical', value: metrics.critical, color: '#EF4444' },
        { name: 'Unassigned', value: metrics.unassigned, color: '#94A3B8' },
    ];




    const fetchPatients = React.useCallback(async () => {
        if (!token) return;
        try {
            const apiBase = (import.meta as any).env?.VITE_API_URL || '';
            const response = await fetch(`${apiBase}/api/caregiver/patients`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();




            if (data.success && Array.isArray(data.data)) {
                const mappedPatients: Patient[] = data.data.map((p: any) => {
                    const vitalSn = p.vital_device_sn || null;
                    const diaperSn = p.diaper_device_sn || null;
                    const activeDevicesList = [vitalSn, diaperSn].filter(Boolean);

                    return {
                        id: p.patient_id?.toString() || Math.random().toString(),
                        name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
                        age: p.birthdate ? new Date().getFullYear() - new Date(p.birthdate).getFullYear() : 0,
                        gender: p.baseline_data?.gender || 'Unknown',
                        roomNumber: p.baseline_data?.room || 'Home',
                        condition: p.baseline_data?.condition || p.baseline_data?.diagnosis || 'Stable',
                        status: 'Stable',
                        medicalConditions: p.baseline_data?.medicalConditions || p.medical_history || [],
                        illness: p.baseline_data?.illness || p.baseline_data?.diagnosis || p.illness || 'N/A',
                        emergencyContact: p.baseline_data?.emergencyContact || p.emergencyContact || null,
                        allergies: p.allergies || [],
                        medications: p.medications || [],
                        doctorsOrders: [],
                        baselineVitals: { heartRate: 0, spo2: 0, temperature: 0, moistureLevel: 0 },
                        deviceConnected: activeDevicesList.length > 0,
                        assignedCaregiverName: p.assigned_caregiver_name,
                        deleted: false,
                        archived: false,
                        baseline_data: p.baseline_data || null,
                        active_devices: activeDevicesList,
                        latest_telemetry: p.latest_telemetry || null
                    } as any;
                });
                setPatients(mappedPatients);
            }
        } catch (err) {
            console.error("Failed to fetch patients:", err);
            toast.error("Could not load patient data");
        }
    }, [token]);




    const fetchSchedules = React.useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get('/api/schedules', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSchedules(res.data.data || res.data || []);
        } catch (error) {
            console.error("Failed to fetch schedules", error);
        }
    }, [token]);




    const startAlarmSound = () => {
        if (audioIntervalRef.current) return;
        const playBeep = () => {
            if (!audioContext) return;
            try {
                const osc = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                osc.connect(gainNode);
                gainNode.connect(audioContext.destination);
                osc.frequency.setValueAtTime(880, audioContext.currentTime);
                osc.type = 'sine';
                gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);
                osc.start();
                osc.stop(audioContext.currentTime + 0.8);
            } catch (err) {
                console.log("Audio play error", err);
            }
        };
        playBeep();
        audioIntervalRef.current = setInterval(playBeep, 1500);
    };




    const stopAlarmSound = () => {
        if (audioIntervalRef.current) {
            clearInterval(audioIntervalRef.current);
            audioIntervalRef.current = null;
        }
    };




    const checkDueSchedules = () => {
        const now = new Date().getTime();
        schedules.forEach(item => {
            if (item.status === 'Pending') {
                const eventTime = new Date(item.scheduled_at).getTime();
                const scheduleId = item.schedule_id ?? item.id;
                if (!isNaN(eventTime) && now >= eventTime && (!activeAlarm || (activeAlarm.schedule_id ?? activeAlarm.id) !== scheduleId)) {
                    setActiveAlarm(item);
                    startAlarmSound();
                }
            }
        });
    };




    const handlePatientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPatientName(value);
        setSelectedPatientId(null);




        if (value.trim().length > 0) {
            const filtered = patients.filter(p =>
                p.name.toLowerCase().includes(value.toLowerCase())
            );
            setPatientSuggestions(filtered);
            setShowSuggestions(true);
        } else {
            setPatientSuggestions([]);
            setShowSuggestions(false);
        }
    };




    const handleSelectPatientSuggestion = (patient: Patient) => {
        setPatientName(patient.name);
        setSelectedPatientId(patient.id);
        setShowSuggestions(false);
        setPatientSuggestions([]);
    };




    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };




        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);




    useEffect(() => {
        fetchPatients();
        fetchSchedules();

        const fetchInterval = setInterval(() => {
            fetchSchedules();
        }, 5000); // Poll schedules every 5 seconds for real-time updates

        return () => clearInterval(fetchInterval);
    }, [fetchPatients, fetchSchedules]);

    useEffect(() => {
        let actx: AudioContext | null = null;
        try {
            actx = new (window.AudioContext || (window as any).webkitAudioContext)();
            setAudioContext(actx);
        } catch (e) {
            console.log("AudioContext not supported");
        }
        return () => {
            if (actx) {
                actx.close();
            }
        };
    }, []);

    useEffect(() => {
        const pollInterval = setInterval(() => {
            checkDueSchedules();
        }, 1000);

        return () => {
            clearInterval(pollInterval);
            stopAlarmSound();
        };
    }, [schedules, activeAlarm]);




    useEffect(() => {
        if (patients.length === 0) return;
        const interval = setInterval(() => {
            const newAlerts: Alert[] = [];
            patients.forEach(patient => {
                const doctorOrderAlerts = generateAlertsFromDoctorsOrders(patient);
                newAlerts.push(...doctorOrderAlerts);
            });
            if (newAlerts.length > 0) {
                setAlerts(prev => {
                    const existingIds = new Set(prev.map(a => a.id));
                    return [...prev, ...newAlerts.filter(a => !existingIds.has(a.id))];
                });
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [patients]);




    useEffect(() => {
        if (selectedPatient) {
            const updatedPatient = patients.find(p => p.id === selectedPatient.id);
            if (updatedPatient) {
                setSelectedPatient(updatedPatient);
            }
        }
    }, [patients]);




    const handleCreateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();




        if (!selectedPatientId) {
            toast.error("Please select a patient from the suggestions");
            return;
        }




        const fullDateTime = `${scheduledDate}T${scheduledTime}:00`;
        try {
            await axios.post('/api/schedules', {
                patient_id: selectedPatientId,
                patient_name: patientName,
                event_type: eventType,
                custom_event_name: customEvent,
                is_recurring: isRecurring,
                recurrence_interval: isRecurring ? recurrenceInterval : null,
                scheduled_at: fullDateTime,
                status: 'Pending'
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setIsCreateModalOpen(false);
            fetchSchedules();
            setPatientName('');
            setSelectedPatientId(null);
            setCustomEvent('');
            setIsRecurring(false);
            setRecurrenceInterval('Daily');
            setScheduledDate('');
            setScheduledTime('');
            toast.success("Schedule created successfully");
        } catch (error) {
            console.error("Failed to create schedule", error);
            toast.error("Failed to create schedule");
        }
    };




    const handleAcknowledgeAlarm = async () => {
        if (!activeAlarm) return;
        const alarmId = activeAlarm.schedule_id ?? activeAlarm.id;
        try {
            if (alarmId) {
                await axios.put(`/api/schedules/${alarmId}/acknowledge`, {}, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
            stopAlarmSound();
            setActiveAlarm(null);
            fetchSchedules();
            toast.success("Schedule acknowledged successfully");
        } catch (error) {
            console.error("Failed to acknowledge schedule item", error);
            toast.error("Failed to acknowledge schedule");
        }
    };




    const handleDeleteSchedule = async (scheduleItem: ScheduleItem) => {
        const targetId = scheduleItem.schedule_id ?? scheduleItem.id;
        if (!targetId) {
            toast.error("Invalid schedule identifier");
            return;
        }
        if (!window.confirm("Are you sure you want to delete this care schedule?")) {
            return;
        }
        try {
            await axios.delete(`/api/schedules/${targetId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchSchedules();
            toast.success("Schedule removed successfully");
        } catch (error: any) {
            console.error("Failed to delete schedule", error);
            const errorMsg = error.response?.data?.message || error.message || "Failed to remove schedule";
            toast.error(errorMsg);
        }
    };

    const handleStartEditSchedule = (item: ScheduleItem) => {
        setEditingSchedule(item);
        setEditPatientName(item.patient_name);
        setEditEventType(item.event_type);
        setEditCustomEvent(item.custom_event_name || '');
        setEditIsRecurring(item.is_recurring);
        setEditRecurrenceInterval(item.recurrence_interval || 'Daily');
        setEditStatus(item.status);

        if (item.scheduled_at) {
            const dateObj = new Date(item.scheduled_at);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            setEditScheduledDate(`${year}-${month}-${day}`);
            setEditScheduledTime(`${hours}:${minutes}`);
        } else {
            setEditScheduledDate('');
            setEditScheduledTime('');
        }
        setIsEditModalOpen(true);
    };

    const handleUpdateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSchedule) return;
        const targetId = editingSchedule.schedule_id ?? editingSchedule.id;
        if (!targetId) {
            toast.error("Invalid schedule identifier");
            return;
        }

        const fullDateTime = `${editScheduledDate}T${editScheduledTime}:00`;
        try {
            await axios.put(`/api/schedules/${targetId}`, {
                patient_name: editPatientName,
                event_type: editEventType,
                custom_event_name: editCustomEvent,
                is_recurring: editIsRecurring,
                recurrence_interval: editIsRecurring ? editRecurrenceInterval : null,
                scheduled_at: fullDateTime,
                status: editStatus
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setIsEditModalOpen(false);
            setEditingSchedule(null);
            fetchSchedules();
            toast.success("Schedule updated successfully");
        } catch (error) {
            console.error("Failed to update schedule", error);
            toast.error("Failed to update schedule");
        }
    };




    const getDetailsPlaceholder = () => {
        switch (eventType) {
            case 'Medication Intake': return 'e.g., Aspirin 100mg - 1 tablet after meals';
            case 'Patient Repositioning': return 'e.g., Turn to left lateral position with pillows';
            case 'Doctor Visit': return 'e.g., Dr. Smith - General checkup and suture removal';
            case 'Lab Work': return 'e.g., Fasting Blood Sugar and SpO2 monitoring';
            case 'Other Care Task': return 'e.g., Assist with light stretching and mobility exercise';
            default: return 'e.g., Physical Therapy Exercise';
        }
    };




    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];




    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) { calendarDays.push(null); }
    for (let day = 1; day <= daysInMonth; day++) {
        const formattedMonth = String(month + 1).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');
        calendarDays.push(`${year}-${formattedMonth}-${formattedDay}`);
    }




    const isScheduleMatchForDate = (item: ScheduleItem, targetDateStr: string) => {
        const baseDateStr = item.scheduled_at.split('T')[0];
        if (baseDateStr === targetDateStr) return true;
        if (!item.is_recurring) return false;




        const baseDate = new Date(baseDateStr);
        const targetDate = new Date(targetDateStr);
        if (targetDate < baseDate) return false;




        const diffTime = targetDate.getTime() - baseDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));




        if (item.recurrence_interval === 'Daily') {
            return diffDays >= 0;
        } else if (item.recurrence_interval === 'Weekly') {
            return diffDays >= 0 && diffDays % 7 === 0;
        } else if (item.recurrence_interval === 'Monthly') {
            return targetDate.getDate() === baseDate.getDate() && targetDate >= baseDate;
        }
        return false;
    };




    const filteredSchedules = schedules.filter(item => isScheduleMatchForDate(item, selectedDate));




    const handleAcknowledgeAlert = (alertId: string) => {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
        toast.success('Alert acknowledged');
    };




    const handleMarkAllRead = () => {
        setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
    };




    const patientNamesMap = useMemo(() => {
        return patients.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>);
    }, [patients]);




    const filteredPatients = useMemo(() =>
        patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [patients, searchQuery]
    );
    const totalPages = Math.max(1, Math.ceil(filteredPatients.length / itemsPerPage));




    const renderDashboard = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Critical', value: metrics.critical, color: 'text-red-600', icon: AlertCircle, bg: 'bg-red-50' },
                    { label: 'Stable', value: metrics.stable, color: 'text-emerald-600', icon: Activity, bg: 'bg-emerald-50' },
                    { label: 'Unassigned', value: metrics.unassigned, color: 'text-slate-600', icon: Link2Off, bg: 'bg-slate-100' },
                    { label: 'Total', value: metrics.total, color: 'text-blue-600', icon: Users, bg: 'bg-blue-50' },
                ].map((stat, i) => (
                    <Card key={i} className="shadow-sm border-slate-100">
                        <CardContent className="p-3 flex justify-between items-center">
                            <div>
                                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                                <h3 className={`text-xl font-bold ${stat.color}`}>{stat.value}</h3>
                            </div>
                            <div className={`p-2 rounded-full ${stat.bg}`}>
                                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>




            <Card className="shadow-sm border-slate-100 bg-gradient-to-r from-teal-50/50 to-white">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-teal-100 text-teal-700">
                            <CalendarIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-800">Care Calendar & Reminders</h4>
                            <p className="text-xs text-slate-500">Manage daily schedules, medication intake, and care tasks.</p>
                        </div>
                    </div>
                    <Button onClick={() => setIsCalendarModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm">
                        Open Calendar
                    </Button>
                </CardContent>
            </Card>




            <div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-teal-600" />
                        Patients
                        <span className="text-xs font-normal text-slate-400">
                            ({filteredPatients.length} total)
                        </span>
                    </h3>

                    {/* Patient Search with Autosuggestion */}
                    <div className="relative w-full md:w-64" ref={patientSearchRef}>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search patients..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowPatientSuggestions(true);
                                    setCurrentPage(1);
                                }}
                                onFocus={() => setShowPatientSuggestions(true)}
                                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => { setSearchQuery(''); setShowPatientSuggestions(false); }}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Autosuggestions Dropdown */}
                        {showPatientSuggestions && searchQuery && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-50">
                                {patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                                    <div className="p-3 text-xs text-slate-400 italic">No matches found</div>
                                ) : (
                                    patients
                                        .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map(patient => (
                                            <button
                                                key={patient.id}
                                                onClick={() => {
                                                    setSearchQuery(patient.name);
                                                    setShowPatientSuggestions(false);
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 text-slate-700 hover:text-teal-900 transition-colors font-medium flex items-center justify-between"
                                            >
                                                <span>{patient.name}</span>
                                                <span className="text-[10px] text-slate-400 font-normal">Room {(patient as any).roomNumber || 'Home'}</span>
                                            </button>
                                        ))
                                )}
                            </div>
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0 border-slate-200"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>
                            <span className="text-xs text-slate-500 font-medium min-w-[60px] text-center">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0 border-slate-200"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    )}
                </div>




                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {filteredPatients
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map(patient => {
                            const latestVital = vitalSigns.find(v => v.patientId === patient.id);
                            const activeAlerts = alerts.filter(a => a.patientId === patient.id && !a.acknowledged);
                            const isCritical = activeAlerts.some(a => a.severity === 'critical');
                            const isUnassigned = !patient.deviceConnected;




                            return (
                                <Card
                                    key={patient.id}
                                    className={`border shadow-sm hover:shadow-md transition-all cursor-pointer group ${isCritical ? 'border-red-200 bg-red-50/50' : 'border-slate-100'}`}
                                    onClick={() => { setSelectedPatient(patient); setViewMode('profile'); }}
                                >
                                    <CardHeader className="p-3 pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-sm font-bold text-slate-800 group-hover:text-teal-600 transition-colors">{patient.name}</CardTitle>
                                                <CardDescription className="text-[11px] text-slate-500">Room {(patient as any).roomNumber || 'Home'}</CardDescription>
                                                {patient.assignedCaregiverName && (
                                                    <div className="flex items-center gap-1 mt-1 text-[10px] text-teal-600 font-medium">
                                                        <Users className="w-3 h-3" />
                                                        {patient.assignedCaregiverName}
                                                    </div>
                                                )}
                                            </div>
                                            <Badge variant="outline" className={`text-[10px] h-5 ${isCritical ? 'text-red-600 border-red-200 bg-red-50' :
                                                isUnassigned ? 'text-slate-600 border-slate-200 bg-slate-50' :
                                                    'text-emerald-600 border-emerald-200 bg-emerald-50'
                                                }`}>
                                                {isCritical ? 'Critical' : isUnassigned ? 'Unassigned' : 'Stable'}
                                            </Badge>
                                        </div>
                                    </CardHeader>




                                    <CardContent className="p-3 pt-0 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                                                <div className="flex justify-center items-center gap-1 mb-0.5">
                                                    <Heart className="w-3 h-3 text-rose-500" />
                                                    <span className="text-[9px] text-slate-400 font-medium">PULSE</span>
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {latestVital ? Math.round(latestVital.heartRate) : '--'}
                                                </span>
                                            </div>




                                            <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                                                <div className="flex justify-center items-center gap-1 mb-0.5">
                                                    <Thermometer className="w-3 h-3 text-amber-500" />
                                                    <span className="text-[9px] text-slate-400 font-medium">TEMP</span>
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {latestVital ? latestVital.temperature.toFixed(1) : '--'}
                                                </span>
                                            </div>
                                        </div>




                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                                                <div className="flex justify-center items-center gap-1 mb-0.5">
                                                    <Activity className="w-3 h-3 text-blue-500" />
                                                    <span className="text-[9px] text-slate-400 font-medium">SPO2</span>
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {latestVital ? Math.round(latestVital.spo2) : '--'}
                                                </span>
                                            </div>




                                            <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                                                <div className="flex justify-center items-center gap-1 mb-0.5">
                                                    <Droplets className="w-3 h-3 text-teal-500" />
                                                    <span className="text-[9px] text-slate-400 font-medium">WETNESS</span>
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {latestVital ? `${Math.round(latestVital.moistureLevel)}%` : '--'}
                                                </span>
                                            </div>
                                        </div>




                                        {activeAlerts.length > 0 && (
                                            <Button size="sm" variant="destructive" className="w-full h-6 text-[10px] bg-red-500 hover:bg-red-600 text-white"
                                                onClick={(e) => { e.stopPropagation(); handleAcknowledgeAlert(activeAlerts[0].id); }}
                                            >
                                                <Check className="w-3 h-3 mr-1" /> Acknowledge
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                </div>
            </div>




            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Card className="lg:col-span-2 shadow-sm border-slate-100">
                    <CardHeader className="py-2 px-4 border-b border-slate-50">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-slate-400" /> Status Overview (24h)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '4px', border: 'none', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} />
                                <Area type="monotone" dataKey="critical" stroke="#EF4444" fill="url(#colorCritical)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>




                <Card className="shadow-sm border-slate-100">
                    <CardHeader className="py-2 px-4 border-b border-slate-50">
                        <CardTitle className="text-sm">Status Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 h-[160px] flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={distributionData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={2} dataKey="value">
                                    {distributionData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                </Pie>
                                <Tooltip />
                                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                                    <tspan x="50%" dy="0" fontSize="16" fontWeight="bold" fill="#334155">{metrics.total}</tspan>
                                </text>
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );




    const renderContent = () => {
        if (viewMode === 'profile' && selectedPatient) {
            return (
                <PatientProfile
                    patient={selectedPatient}
                    onBack={() => { setViewMode('dashboard'); setSelectedPatient(null); setProfileInitialTab('overview'); }}
                    caregiverName={selectedPatient.assignedCaregiverName}
                    initialTab={profileInitialTab}
                    onRefresh={fetchPatients}
                />
            );
        }
        switch (activeNavItem) {
            case 'dashboard': return renderDashboard();
            case 'add-patient': return <AddNewPatient onSuccess={() => { toast.success("Added"); setActiveNavItem('dashboard'); fetchPatients(); }} onCancel={() => setActiveNavItem('dashboard')} />;
            case 'patient-list': return <PatientList patients={patients} vitalSigns={vitalSigns} onSelectPatient={(p) => { setSelectedPatient(p); setViewMode('profile'); }} onRefresh={fetchPatients} />;
            case 'add-device': return <AddNewDevice onDeviceAdded={() => { setActiveNavItem('dashboard'); fetchPatients(); }} onCancel={() => setActiveNavItem('dashboard')} />;
            case 'my-devices': return <MyDevices />;
            case 'firmware-update': return <FirmwareOTA />;
            case 'assignment-tracker': return <AssignmentTracker onRefresh={fetchPatients} />;
            case 'user-management': return <CaregiverUserManagement patients={patients} user={user} />;
            case 'reports-daily-summary':
                return (
                    <DailyHealthSummary
                        patients={patients}
                        vitalSigns={vitalSigns}
                        selectedPatientId={reportPatientId}
                        onSelectPatient={setReportPatientId}
                    />
                );
            case 'reports-anomaly-log':
                return (
                    <AnomalyLog
                        patients={patients}
                        alerts={alerts}
                        selectedPatientId={reportPatientId}
                        onSelectPatient={setReportPatientId}
                    />
                );
            case 'reports-moisture-hygiene':
                return (
                    <MoistureHygieneTracker
                        patients={patients}
                        vitalSigns={vitalSigns}
                        selectedPatientId={reportPatientId}
                        onSelectPatient={setReportPatientId}
                    />
                );
            case 'reports-weekly-trends':
                return (
                    <WeeklyTrendAnalysis
                        patients={patients}
                        vitalSigns={vitalSigns}
                        selectedPatientId={reportPatientId}
                        onSelectPatient={setReportPatientId}
                    />
                );
            case 'reports-export':
                return (
                    <ExportableHealthReport
                        patients={patients}
                        vitalSigns={vitalSigns}
                        alerts={alerts}
                        selectedPatientId={reportPatientId}
                        onSelectPatient={setReportPatientId}
                    />
                );
            case 'settings':
                return <CaregiverSettings />;
            case 'profile':
                return <CaregiverProfile patients={patients} />;
            default: return renderDashboard();
        }
    };




    return (
        <CaregiverLanguageProvider>
            <div className="flex h-screen bg-slate-50/50">
                {!hideNavigation && (
                    <DashboardSidebar
                        activeItem={activeNavItem}
                        onItemClick={(item) => { setActiveNavItem(item); setDetailView('list'); }}
                        userRole="caregiver"
                    />
                )}




                <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                    {!hideNavigation && (
                        <header className="bg-white border-b border-slate-200 flex-shrink-0 px-6 py-2 shadow-sm z-20 h-14 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-teal-900 tracking-tight">Dashboard</h2>
                                <p className="text-[10px] text-slate-500 font-medium">Welcome back, {(user as any)?.name || 'Caregiver'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <NotificationPanel alerts={alerts} onAcknowledge={handleAcknowledgeAlert} onMarkAllRead={handleMarkAllRead} patientNames={patientNamesMap} />
                                <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs">
                                    {(user as any)?.name?.[0] || 'C'}
                                </div>
                                <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 text-slate-400 hover:text-red-500">
                                    <LogOut className="w-4 h-4" />
                                </Button>
                            </div>
                        </header>
                    )}




                    <main className={`flex-1 overflow-y-auto p-4 scroll-smooth ${hideNavigation ? 'h-full' : ''}`}>
                        <div className="w-full min-h-full pb-20">
                            {renderContent()}
                        </div>
                    </main>
                </div>
            </div>




            {isCalendarModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                            <h3 className="text-xl font-bold text-slate-900">Care Calendar & Reminders</h3>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setIsCreateModalOpen(true)} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-teal-700 transition">
                                    <Plus className="h-4 w-4" /> Add Schedule
                                </button>
                                <button onClick={() => setIsCalendarModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                            </div>
                        </div>




                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-7 bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-slate-900 text-base">{monthNames[month]} {year}</h4>
                                    <div className="flex gap-1">
                                        <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
                                        <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-400 py-1">
                                    <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                                </div>
                                <div className="grid grid-cols-7 gap-1.5">
                                    {calendarDays.map((dateStr, index) => {
                                        if (!dateStr) return <div key={`empty-${index}`} />;
                                        const dayNum = parseInt(dateStr.split('-')[2], 10);
                                        const isSelected = dateStr === selectedDate;
                                        return (
                                            <button key={dateStr} onClick={() => setSelectedDate(dateStr)} className={`h-11 rounded-xl flex flex-col items-center justify-center font-semibold text-xs border ${isSelected ? 'bg-teal-600 text-white border-teal-600' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                <span>{dayNum}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>




                            <div className="lg:col-span-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4 flex flex-col">
                                <h4 className="font-bold text-slate-900 text-sm border-b pb-3">Timetable for {selectedDate}</h4>
                                <div className="space-y-3 overflow-y-auto max-h-[340px] flex-1">
                                    {filteredSchedules.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-6">No scheduled events for this date.</p>
                                    ) : (
                                        filteredSchedules.map((item, index) => (
                                            <Card key={item.schedule_id ?? item.id ?? index} className="border border-slate-200 shadow-sm rounded-xl bg-white">
                                                <CardContent className="p-4 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline">{item.event_type}</Badge>
                                                            <span className="text-xs font-semibold text-slate-500">
                                                                {new Date(item.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {item.is_recurring && (
                                                                <Badge variant="secondary" className="text-[10px] bg-teal-50 text-teal-700 border-teal-200 flex items-center gap-1">
                                                                    <Repeat className="w-3 h-3" /> {item.recurrence_interval}
                                                                </Badge>
                                                            )}
                                                             <button
                                                                 onClick={() => handleStartEditSchedule(item)}
                                                                 className="text-slate-400 hover:text-teal-600 p-1 transition"
                                                                 title="Edit Schedule"
                                                             >
                                                                 <Edit className="w-4 h-4" />
                                                             </button>
                                                             <button
                                                                 onClick={() => handleDeleteSchedule(item)}
                                                                 className="text-slate-400 hover:text-red-500 p-1 transition"
                                                                 title="Remove Schedule"
                                                             >
                                                                 <Trash2 className="w-4 h-4" />
                                                             </button>
                                                         </div>
                                                    </div>
                                                    <h5 className="font-bold text-slate-900 text-sm">{item.patient_name}</h5>
                                                    {item.custom_event_name && <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg">{item.custom_event_name}</p>}
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}




            {isEditModalOpen && editingSchedule && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900">Edit Care Task</h3>
                            <button onClick={() => { setIsEditModalOpen(false); setEditingSchedule(null); }} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                        </div>
                        <form onSubmit={handleUpdateSchedule} className="space-y-4">
                            <div className="space-y-1.5 relative">
                                <label className="text-xs font-semibold text-slate-700">Patient Name *</label>
                                <input
                                    type="text"
                                    value={editPatientName}
                                    onChange={(e) => setEditPatientName(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Event Type *</label>
                                <select
                                    value={editEventType}
                                    onChange={(e) => setEditEventType(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500"
                                >
                                    <option value="Medication Intake">Medication Intake</option>
                                    <option value="Doctor Visit">Doctor Visit</option>
                                    <option value="Hygiene Care">Hygiene Care</option>
                                    <option value="Routine Check">Routine Check</option>
                                    <option value="Meal Intake">Meal Intake</option>
                                    <option value="Physical Therapy">Physical Therapy</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Specification of Care Task (Optional)</label>
                                <input
                                    type="text"
                                    value={editCustomEvent}
                                    onChange={(e) => setEditCustomEvent(e.target.value)}
                                    placeholder="e.g., Medicine details or instructions"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Date *</label>
                                    <input
                                        type="date"
                                        value={editScheduledDate}
                                        onChange={(e) => setEditScheduledDate(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Time *</label>
                                    <input
                                        type="time"
                                        value={editScheduledTime}
                                        onChange={(e) => setEditScheduledTime(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Status *</label>
                                <select
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value as any)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500"
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Missed">Missed</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="editIsRecurring"
                                    checked={editIsRecurring}
                                    onChange={(e) => setEditIsRecurring(e.target.checked)}
                                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                />
                                <label htmlFor="editIsRecurring" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">Recurring Event</label>
                            </div>

                            {editIsRecurring && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Recurrence Interval</label>
                                    <select
                                        value={editRecurrenceInterval}
                                        onChange={(e) => setEditRecurrenceInterval(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500"
                                    >
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                    </select>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => { setIsEditModalOpen(false); setEditingSchedule(null); }}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900">Schedule Care Task</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                        </div>
                        <form onSubmit={handleCreateSchedule} className="space-y-4">
                            <div className="space-y-1.5 relative" ref={suggestionsRef}>
                                <label className="text-xs font-semibold text-slate-700">Patient Name *</label>
                                <input
                                    type="text"
                                    value={patientName}
                                    onChange={handlePatientNameChange}
                                    onFocus={() => patientName.length > 0 && setShowSuggestions(true)}
                                    placeholder="e.g., Juan Dela Cruz"
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500"
                                />
                               
                                {showSuggestions && patientSuggestions.length > 0 && (
                                    <div className="absolute top-[68px] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                                        {patientSuggestions.map(patient => (
                                            <button
                                                key={patient.id}
                                                type="button"
                                                onClick={() => handleSelectPatientSuggestion(patient)}
                                                className="w-full text-left px-4 py-3 hover:bg-teal-50 border-b border-slate-100 last:border-b-0 transition"
                                            >
                                                <p className="text-sm font-semibold text-slate-900">{patient.name}</p>
                                                <p className="text-xs text-slate-500">Age: {patient.age} • {patient.gender}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}




                                {showSuggestions && patientName.length > 0 && patientSuggestions.length === 0 && (
                                    <div className="absolute top-[68px] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 p-3">
                                        <p className="text-xs text-slate-500 text-center">No matching patients found</p>
                                    </div>
                                )}




                                {selectedPatientId && (
                                    <p className="text-xs text-teal-600 font-medium mt-1">✓ Patient selected</p>
                                )}
                            </div>




                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Care Task Type *</label>
                                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-teal-500">
                                    <option value="Medication Intake">Medication Intake</option>
                                    <option value="Patient Repositioning">Patient Repositioning</option>
                                    <option value="Doctor Visit">Doctor Visit</option>
                                    <option value="Lab Work">Lab Work</option>
                                    <option value="Other Care Task">Other Care Task</option>
                                </select>
                            </div>




                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Task Details / Description *</label>
                                <input type="text" value={customEvent} onChange={(e) => setCustomEvent(e.target.value)} placeholder={getDetailsPlaceholder()} required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500" />
                            </div>




                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Date *</label>
                                    <input type="date" min={todayStr} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Time *</label>
                                    <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500" />
                                </div>
                            </div>


                            <div className="space-y-3 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Repeat className="w-4 h-4 text-teal-600" />
                                        <label className="text-xs font-semibold text-slate-700">Recurring Schedule</label>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={isRecurring}
                                        onChange={(e) => setIsRecurring(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                    />
                                </div>


                                {isRecurring && (
                                    <div className="space-y-1.5 pl-6 animate-fadeIn">
                                        <label className="text-xs font-semibold text-slate-700">Recurrence Interval *</label>
                                        <select
                                            value={recurrenceInterval}
                                            onChange={(e) => setRecurrenceInterval(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-teal-500"
                                        >
                                            <option value="Daily">Daily</option>
                                            <option value="Weekly">Weekly</option>
                                            <option value="Monthly">Monthly</option>
                                        </select>
                                    </div>
                                )}
                            </div>




                            <div className="flex justify-end gap-3 pt-3">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200">Cancel</button>
                                <button type="submit" disabled={!selectedPatientId} className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed">Save Schedule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}




            {activeAlarm && (
                <div className="fixed inset-0 bg-red-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-pulse">
                    <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 border-4 border-red-500">
                        <div className="h-20 w-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                            <Bell className="h-10 w-10 animate-bounce" />
                        </div>
                        <div>
                            <span className="bg-red-500 text-white text-xs font-extrabold px-3 py-1 rounded-full">Task Due!</span>
                            <h2 className="text-2xl font-black text-slate-900 mt-2">{activeAlarm.patient_name}</h2>
                            <p className="text-lg font-bold text-red-600 mt-1">{activeAlarm.event_type}</p>
                            {activeAlarm.custom_event_name && (
                                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl mt-3 border border-slate-200">
                                    {activeAlarm.custom_event_name}
                                </p>
                            )}
                            <p className="text-xs text-slate-400 mt-2">
                                Scheduled For: {new Date(activeAlarm.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <button onClick={handleAcknowledgeAlarm} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg uppercase tracking-wider text-sm">
                            Acknowledge & Stop Alarm
                        </button>
                    </div>
                </div>
            )}
        </CaregiverLanguageProvider>
    );
};