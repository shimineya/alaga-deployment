import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Calendar as CalendarIcon, Clock, Bell, Plus, X, Edit, Trash2, Repeat } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { toast } from 'sonner';

interface ScheduleItem {
    schedule_id: number;
    patient_name: string;
    event_type: string;
    custom_event_name?: string;
    is_recurring: boolean;
    recurrence_interval?: string;
    scheduled_at: string;
    status: 'Pending' | 'Completed' | 'Missed';
}

interface Patient {
    patient_id: number;
    full_name: string;
    condition?: string;
}

export const CareCalendarWidget: React.FC = () => {
    const { token } = useAuth();
    const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);

    const [patientName, setPatientName] = useState('');
    const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
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

    const [activeAlarm, setActiveAlarm] = useState<ScheduleItem | null>(null);
    const audioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

    const todayStr = new Date().toISOString().split('T')[0];

    const fetchSchedules = React.useCallback(async () => {
        try {
            const res = await axios.get('/api/schedules', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSchedules(res.data.data || []);
        } catch (error) {
            console.error("Failed to fetch schedules", error);
        }
    }, [token]);

    const fetchPatients = React.useCallback(async () => {
        try {
            const res = await axios.get('/api/caregiver/patients', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataList = res.data.data || [];
            const mapped = dataList.map((p: any) => ({
                patient_id: p.patient_id,
                full_name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                condition: p.condition || p.primary_diagnosis || p.diagnosis || ''
            }));
            setPatients(mapped);
        } catch (error) {
            console.error("Failed to fetch patients", error);
        }
    }, [token]);

    useEffect(() => {
        fetchSchedules();
        fetchPatients();

        const fetchInterval = setInterval(() => {
            fetchSchedules();
        }, 5000); // Poll schedules every 5 seconds for real-time updates

        return () => clearInterval(fetchInterval);
    }, [fetchSchedules, fetchPatients]);

    useEffect(() => {
        let actx: AudioContext | null = null;
        try {
            actx = new (window.AudioContext || (window as any).webkitAudioContext)();
            setAudioContext(actx);
        } catch (e) {
            console.log("AudioContext not supported");
        }
        return () => {
            if (actx) actx.close();
        };
    }, []);

    useEffect(() => {
        const pollInterval = setInterval(() => {
            checkDueSchedules();
        }, 1000); // Check due schedules every 1 second for instant alerts

        return () => {
            clearInterval(pollInterval);
            stopAlarmSound();
        };
    }, [schedules, activeAlarm]);

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
                if (now >= eventTime && !activeAlarm) {
                    setActiveAlarm(item);
                    startAlarmSound();
                }
            }
        });
    };

    const handleCreateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        const fullDateTime = `${scheduledDate}T${scheduledTime}:00`;
        try {
            await axios.post('/api/schedules', {
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
            setCustomEvent('');
            setIsRecurring(false);
            setScheduledDate('');
            setScheduledTime('');
        } catch (error) {
            console.error("Failed to create schedule", error);
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
        const targetId = editingSchedule.schedule_id;
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

    const handleDeleteSchedule = async (scheduleItem: ScheduleItem) => {
        const targetId = scheduleItem.schedule_id;
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

    const handleAcknowledgeAlarm = async () => {
        if (!activeAlarm) return;
        try {
            await axios.put(`/api/schedules/${activeAlarm.schedule_id}/acknowledge`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            stopAlarmSound();
            setActiveAlarm(null);
            fetchSchedules();
        } catch (error) {
            console.error("Failed to acknowledge schedule item", error);
        }
    };

    const getDetailsConfig = () => {
        switch (eventType) {
            case 'Medication Intake':
                return {
                    label: 'Specification of Care Task (Medicine and Dosage)',
                    placeholder: 'e.g., Aspirin 100mg - 1 tablet after meals'
                };
            case 'Doctor Visit':
                return {
                    label: 'Specification of Care Task (Doctor and Visit Details)',
                    placeholder: 'e.g., Dr. Smith - General checkup and suture removal'
                };
            case 'Lab Work / Vital Check':
                return {
                    label: 'Specification of Care Task (Lab Work or Vitals Check)',
                    placeholder: 'e.g., Fasting Blood Sugar and SpO2 monitoring'
                };
            case 'Patient Repositioning':
                return {
                    label: 'Specification of Care Task (Positioning Instructions)',
                    placeholder: 'e.g., Turn to left lateral position with pillows'
                };
            case 'Other Care Task':
            default:
                return {
                    label: 'Specification of Care Task (Custom Task Description)',
                    placeholder: 'e.g., Physical Therapy Exercise or Wound Dressing'
                };
        }
    };

    const currentDetailsConfig = getDetailsConfig();

    const filteredPatients = patients.filter(p => 
        p.full_name.toLowerCase().includes(patientName.toLowerCase())
    );

    return (
        <>
            <button
                onClick={() => setIsCalendarModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition shadow-sm"
            >
                <CalendarIcon className="h-3.5 w-3.5 text-teal-600" />
                Care Calendar
            </button>

            {isCalendarModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
                                    <CalendarIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Care Calendar & Reminders</h3>
                                    <p className="text-xs text-slate-500">Track medicine intake, doctor visits, and routines</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
                                >
                                    <Plus className="h-4 w-4" /> Add Schedule
                                </button>
                                <button onClick={() => setIsCalendarModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {schedules.map(item => (
                                <Card key={item.schedule_id} className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden bg-slate-50/50">
                                    <CardContent className="p-5 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="font-semibold bg-white">
                                                {item.event_type}
                                            </Badge>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${item.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {item.status}
                                                </span>
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
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-base">{item.patient_name}</h4>
                                            {item.custom_event_name && (
                                                <div className="mt-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Specification of Care Task</span>
                                                    <p className="text-xs font-medium text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                                                        {item.custom_event_name}
                                                    </p>
                                                </div>
                                            )}
                                            <div className="mt-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Recurrence Status</span>
                                                <p className="text-xs text-slate-500">
                                                    {item.is_recurring ? `Recurring (${item.recurrence_interval})` : 'One-time Event'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Scheduled Date & Time</span>
                                            <div className="text-xs font-semibold text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                                                <Clock className="h-3.5 w-3.5 text-teal-500" />
                                                {new Date(item.scheduled_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
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
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900">Schedule Care Task</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSchedule} className="space-y-4">
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Patient Name</label>
                                <input 
                                    type="text"
                                    value={patientName}
                                    onChange={(e) => {
                                        setPatientName(e.target.value);
                                        setShowPatientSuggestions(true);
                                    }}
                                    onFocus={() => setShowPatientSuggestions(true)}
                                    placeholder="Type patient name..."
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                                />
                                {showPatientSuggestions && filteredPatients.length > 0 && (
                                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                                        {filteredPatients.map(p => (
                                            <div
                                                key={p.patient_id}
                                                onClick={() => {
                                                    setPatientName(p.full_name);
                                                    setShowPatientSuggestions(false);
                                                }}
                                                className="px-3.5 py-2 hover:bg-teal-50 text-sm cursor-pointer border-b border-slate-50 last:border-b-0 flex justify-between items-center"
                                            >
                                                <span className="font-medium text-slate-800">{p.full_name}</span>
                                                {p.condition && <span className="text-xs text-slate-400">{p.condition}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Type of Care Task</label>
                                <select 
                                    value={eventType} 
                                    onChange={(e) => setEventType(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                                >
                                    <option value="Medication Intake">Medication Intake</option>
                                    <option value="Patient Repositioning">Patient Repositioning / Turning</option>
                                    <option value="Doctor Visit">Doctor Visit</option>
                                    <option value="Lab Work / Vital Check">Lab Work / Vital Check</option>
                                    <option value="Other Care Task">Other Care Task</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{currentDetailsConfig.label}</label>
                                <textarea 
                                    value={customEvent}
                                    onChange={(e) => setCustomEvent(e.target.value)}
                                    placeholder={currentDetailsConfig.placeholder}
                                    required
                                    rows={3}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input 
                                    type="checkbox" 
                                    id="recurring-widget"
                                    checked={isRecurring}
                                    onChange={(e) => setIsRecurring(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                />
                                <label htmlFor="recurring-widget" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recurring Event</label>
                            </div>

                            {isRecurring && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recurrence Frequency</label>
                                    <select 
                                        value={recurrenceInterval}
                                        onChange={(e) => setRecurrenceInterval(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                                    >
                                        <option value="Hourly (Every 2 Hours)">Hourly (Every 2 Hours)</option>
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        min={todayStr}
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Time</label>
                                    <input 
                                        type="time" 
                                        value={scheduledTime}
                                        onChange={(e) => setScheduledTime(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3">
                                <button 
                                    type="button" 
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow-sm"
                                >
                                    Save Schedule
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {activeAlarm && (
                <div className="fixed inset-0 bg-red-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-pulse">
                    <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 border-4 border-red-500">
                        <div className="h-20 w-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <Bell className="h-10 w-10 animate-bounce" />
                        </div>
                        <div className="space-y-2">
                            <span className="bg-red-500 text-white text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                                Scheduled Task Due Now!
                            </span>
                            <h2 className="text-2xl font-black text-slate-900">{activeAlarm.patient_name}</h2>
                            <p className="text-lg font-bold text-red-600">
                                {activeAlarm.event_type}
                            </p>
                            {activeAlarm.custom_event_name && (
                                <p className="text-sm font-semibold text-slate-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                                    {activeAlarm.custom_event_name}
                                </p>
                            )}
                            <p className="text-xs text-slate-500">
                                Scheduled Time: {new Date(activeAlarm.scheduled_at).toLocaleTimeString()}
                            </p>
                        </div>
                        <div className="pt-2">
                            <button
                                onClick={handleAcknowledgeAlarm}
                                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg transition text-base tracking-wide uppercase"
                            >
                                Acknowledge & Stop Alarm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CareCalendarWidget;