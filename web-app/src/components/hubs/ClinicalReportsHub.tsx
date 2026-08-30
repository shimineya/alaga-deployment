import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Patient, VitalSign, Alert } from '@/types';
import { ClinicalReportsShell } from '../caregiver-reports/ClinicalReportsShell';
import { Loader2, Lock, ActivitySquare, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generateAlertsFromDoctorsOrders } from '@/lib/alert-generator';

export default function ClinicalReportsHub() {
    const { token, user, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';
    const isSysAdminUser = isSysAdmin || ['system_admin', 'sysadmin', 'admin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    const isMedStaff = role === 'medical_staff' || role === 'medstaff';

    const isAllowed = isSysAdminUser || isFacilityAdmin || isMedStaff;

    const [patients, setPatients] = useState<Patient[]>([]);
    const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPatients = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const API_BASE = import.meta.env.VITE_API_URL || '';
            const endpoint = isFacilityAdmin 
                ? `${API_BASE}/api/facility-admin/patients`
                : `${API_BASE}/api/caregiver/patients`;

            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                const mapped: Patient[] = data.data.map((p: any) => {
                    // In System Admin view, ensure patient name is anonymized for privacy governance
                    const displayName = isSysAdminUser
                        ? (p.anonymous_identifier || `Subject #${p.patient_id} (De-identified)`)
                        : (p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || `Patient #${p.patient_id}`);

                    return {
                        id: p.patient_id?.toString() || '',
                        name: displayName,
                        age: p.birthdate
                            ? new Date().getFullYear() - new Date(p.birthdate).getFullYear()
                            : (p.age ? parseInt(p.age, 10) : 0),
                        gender: p.gender || p.baseline_data?.gender || 'Unknown',
                        roomNumber: isFacilityAdmin ? (p.room || p.baseline_data?.room || 'Facility') : 'Home',
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
                        emergencyContact: { name: 'Protected', phone: 'Protected', relation: 'Contact' },
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
                    Clinical Reports containing Protected Health Information (PHI) are strictly restricted to <strong>Facility Administrators</strong>, <strong>Medical Staff</strong>, and <strong>System Administrators</strong>.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
            {/* Hub Header */}
            <div className="mb-4 flex-shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <ActivitySquare className="w-6 h-6 text-teal-600" />
                        Clinical Reports & Analytics Hub
                        {isSysAdminUser && (
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-900 text-teal-300 font-bold">
                                Anonymized Governance Mode
                            </span>
                        )}
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Comprehensive patient clinical monitoring: Daily health summaries, ML anomaly logs, moisture & hygiene trends, weekly vital analytics, and PDF physician exports.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchPatients}
                    className="border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold h-9"
                >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Records
                </Button>
            </div>

            {/* Content Body */}
            {isLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                        <p className="text-sm font-medium">Loading clinical patient telemetry records...</p>
                    </div>
                </div>
            ) : patients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[350px] bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <ActivitySquare className="w-12 h-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800">No Patient Records Available</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                        There are currently no active patients enrolled in your facility or department. Once patients are enrolled, their clinical telemetry summaries will appear here.
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden">
                    <ClinicalReportsShell
                        patients={patients}
                        vitalSigns={vitalSigns}
                        alerts={alerts}
                    />
                </div>
            )}
        </div>
    );
}
