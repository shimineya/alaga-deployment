import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Patient, VitalSign, Alert } from '@/types';
import { ClinicalReportsShell } from '../caregiver-reports/ClinicalReportsShell';
import { HealthReportsCenter } from '../caregiver-reports/HealthReportsCenter';
import { Loader2, Lock, ActivitySquare, RefreshCw, FileText, BarChart3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generateAlertsFromDoctorsOrders } from '@/lib/alert-generator';

export default function ClinicalReportsHub() {
    const { token, user } = useAuth();
    const role = user?.role?.toLowerCase() || '';
    // ONLY anonymize if strictly System Administrator accessing governance mode
    const isSysAdminUser = role === 'system_admin' || role === 'sysadmin';
    const isFacilityAdmin = role === 'facility_admin';
    const isMedStaff = role === 'medical_staff' || role === 'medstaff';
    const isCaregiver = role === 'caregiver';
    const isParentOrGuardian = role === 'parent' || role === 'guardian';

    const isAllowed = isSysAdminUser || isFacilityAdmin || isMedStaff || role === 'admin' || isCaregiver || isParentOrGuardian;
    const isCaregiverOrFamily = isCaregiver || isParentOrGuardian;

    const [patients, setPatients] = useState<Patient[]>([]);
    const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPatients = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const API_BASE = import.meta.env.VITE_API_URL || '';
            const endpoint = `${API_BASE}/api/caregiver/patients`;

            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                const mapped: Patient[] = data.data.map((p: any) => {
                    // For Medical Staff, Facility Admin, Caregivers: full real patient identity and contact details
                    // Strictly for pure System Admin: anonymized subject code for privacy governance
                    const displayName = isSysAdminUser
                        ? (p.anonymous_identifier || `Subject #${p.patient_id} (De-identified)`)
                        : (p.name || p.patient_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || `Patient #${p.patient_id}`);

                    const emergencyContact = isSysAdminUser
                        ? { name: 'Protected', phone: 'Protected', relation: 'Contact' }
                        : (p.emergency_contact || p.emergencyContact || {
                            name: p.baseline_data?.emergency_contact_name || 'N/A',
                            phone: p.baseline_data?.emergency_contact_phone || 'N/A',
                            relation: p.baseline_data?.emergency_contact_relation || 'Contact'
                        });

                    return {
                        id: p.patient_id?.toString() || '',
                        name: displayName,
                        age: p.birthdate
                            ? new Date().getFullYear() - new Date(p.birthdate).getFullYear()
                            : (p.age ? parseInt(p.age, 10) : 0),
                        gender: p.gender || p.baseline_data?.gender || 'Unknown',
                        roomNumber: isSysAdminUser
                            ? (p.room ? `Inpatient Telemetry (Room ${p.room})` : 'De-identified Inpatient Telemetry')
                            : (isFacilityAdmin ? (p.room ? `Inpatient Telemetry (Room ${p.room})` : (p.baseline_data?.room || 'Facility')) : (p.room ? `Room ${p.room}` : 'Home')),
                        condition: p.condition || p.baseline_data?.condition || 'Stable',
                        status: 'Stable',
                        medicalConditions: p.medical_history || p.medicalConditions || [],
                        allergies: p.allergies || [],
                        medications: p.medications || [],
                        doctorsOrders: p.doctors_orders || p.doctorsOrders || [],
                        baselineVitals: {
                            heartRate: p.baseline_data?.heartRate || p.baseline_data?.heart_rate || 75,
                            spo2: p.baseline_data?.spo2 || 98,
                            temperature: p.baseline_data?.temperature || 36.8,
                            moistureLevel: p.baseline_data?.moistureLevel || p.baseline_data?.moisture || 0
                        },
                        deviceConnected: !!(p.device_serial_number || p.vital_device_sn || p.diaper_device_sn),
                        assignedCaregiverName: p.assigned_caregiver_name || 'N/A',
                        emergencyContact,
                        deleted: false,
                        archived: false,
                    };
                });
                setPatients(mapped);

                // Derive alerts from doctor's orders & vitals
                const derivedAlerts: Alert[] = [];
                mapped.forEach((patient) => {
                    const orderAlerts = generateAlertsFromDoctorsOrders(patient);
                    derivedAlerts.push(...orderAlerts);
                });
                setAlerts(derivedAlerts);
            }
        } catch (err) {
            console.error('ClinicalReportsHub: failed to fetch patient clinical records', err);
            toast.error('Could not load patient clinical records. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [token, isFacilityAdmin, isSysAdminUser]);

    useEffect(() => {
        if (isAllowed) {
            fetchPatients();
        }
    }, [fetchPatients, isAllowed]);

    if (!isAllowed) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-xl border border-slate-200">
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
                    <Lock className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Access Restricted (PHI)</h2>
                <p className="text-sm text-slate-500 max-w-md mt-2">
                    Clinical Reports containing Protected Health Information (PHI) are strictly restricted to <strong>Facility Administrators</strong>, <strong>Medical Staff</strong>, <strong>Caregivers</strong>, and <strong>Parents/Guardians</strong>.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col space-y-4">
            {/* Hub Header */}
            <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <ActivitySquare className="w-6 h-6 text-teal-600" />
                        {isCaregiverOrFamily ? 'Health Reports Center' : 'Clinical Reports & Analytics Hub'}
                        {isSysAdminUser && (
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-900 text-teal-300 font-bold">
                                Anonymized Governance Mode
                            </span>
                        )}
                        {isFacilityAdmin && (
                            <span className="text-[10px] uppercase font-sans font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                Facility Administrator
                            </span>
                        )}
                        {isMedStaff && (
                            <span className="text-[10px] uppercase font-sans font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Medical Staff
                            </span>
                        )}
                        {isCaregiverOrFamily && (
                            <span className="text-[10px] uppercase font-sans font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                                {isParentOrGuardian ? 'Parent & Guardian View' : 'Caregiver View'}
                            </span>
                        )}
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        {isCaregiverOrFamily
                            ? 'Generate mobile-aligned health summaries, view past telemetry reports, and export multi-format records (PDF, CSV, TXT, HTML).'
                            : 'In-depth clinical patient monitoring: Daily health summaries, ML anomaly logs, moisture & hygiene trends, weekly vital analytics, and physician exports.'}
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchPatients}
                        className="border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold h-9"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Records
                    </Button>
                </div>
            </div>

            {/* Content Body: Role-specific rendering */}
            {isLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                        <p className="text-sm font-medium">Loading clinical patient monitoring records...</p>
                    </div>
                </div>
            ) : patients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[350px] bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <ActivitySquare className="w-12 h-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800">No Patient Records Available</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                        There are currently no active patients enrolled in your roster. Once patients are enrolled or assigned, their clinical monitoring summaries will appear here.
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden">
                    {isCaregiverOrFamily ? (
                        /* Parent/Guardian and Caregivers exclusively see the Mobile-Aligned HealthReportsCenter */
                        <HealthReportsCenter
                            patients={patients}
                            vitalSigns={vitalSigns}
                            alerts={alerts}
                            onRefreshPatients={fetchPatients}
                        />
                    ) : (
                        /* Medical Staff, Facility Admin, and System Admin see ClinicalReportsShell (Clinical Analytics & Trends) */
                        <ClinicalReportsShell
                            patients={patients}
                            vitalSigns={vitalSigns}
                            alerts={alerts}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

