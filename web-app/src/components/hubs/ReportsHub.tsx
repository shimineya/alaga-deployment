import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Patient, VitalSign, Alert } from '@/types';
import { BreakGlassWrapper } from '../security/BreakGlassWrapper';
import { ClinicalReportsShell } from '../caregiver-reports/ClinicalReportsShell';
import SystemAdminReportsHub from '../sysadmin/SystemAdminReportsHub';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { generateAlertsFromDoctorsOrders } from '@/lib/alert-generator';

export default function ReportsHub() {
    const { token, user, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';
    const isSysAdminUser = isSysAdmin || ['system_admin', 'sysadmin', 'admin'].includes(role);

    // If active user is System Administrator, render the dedicated System Admin Reports & Observability Hub
    if (isSysAdminUser) {
        return <SystemAdminReportsHub />;
    }

    const isAllowedClinicalReportsRole = role === 'facility_admin' || role === 'medical_staff';
    if (!isAllowedClinicalReportsRole) {
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

    // [DPA / HIPAA] All data fetched here is Protected Health Information (PHI).
    // Access to this hub is gated by the BreakGlassWrapper below,
    // which enforces an additional consent/justification step for SysAdmin
    // and validates the token's role claim for caregivers.
    const [patients, setPatients] = useState<Patient[]>([]);
    const [vitalSigns] = useState<VitalSign[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // [OWASP A01] The backend /api/caregiver/patients endpoint already enforces
    // row-level access: caregivers only receive patients they are assigned to.
    const fetchPatients = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || ''}/api/caregiver/patients`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                const mapped: Patient[] = data.data.map((p: any) => ({
                    id: p.patient_id?.toString() || '',
                    name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
                    age: p.birthdate
                        ? new Date().getFullYear() - new Date(p.birthdate).getFullYear()
                        : 0,
                    gender: p.gender || 'Unknown',
                    roomNumber: 'Home',
                    condition: p.baseline_data?.condition || 'Stable',
                    status: 'Stable',
                    medicalConditions: p.medical_history || [],
                    allergies: p.allergies || [],
                    medications: p.medications || [],
                    doctorsOrders: [],
                    baselineVitals: { heartRate: 0, spo2: 0, temperature: 0, moistureLevel: 0 },
                    deviceConnected: !!p.device_serial_number,
                    assignedCaregiverName: p.assigned_caregiver_name,
                    emergencyContact: { name: 'N/A', phone: 'N/A', relation: 'N/A' },
                    deleted: false,
                    archived: false,
                }));
                setPatients(mapped);

                // Derive alerts from doctor's orders (same logic as CaregiverDashboardNew)
                const derivedAlerts: Alert[] = [];
                mapped.forEach((patient) => {
                    const orderAlerts = generateAlertsFromDoctorsOrders(patient);
                    derivedAlerts.push(...orderAlerts);
                });
                setAlerts(derivedAlerts);
            }
        } catch (err) {
            // [OWASP A10] Do not expose internal error details in the UI.
            console.error('ReportsHub: failed to fetch patients', err);
            toast.error('Could not load patient data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
            {/* Page header */}
            <div className="mb-5 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                    Clinical Reports (PHI)
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Select a patient from the list to generate health summaries, anomaly logs,
                    and exportable reports for attending physicians.
                    {/*
                        Tooltip suggestion for the page subtitle:
                        "All reports on this page contain Protected Health Information (PHI)
                        and are subject to the Data Privacy Act of 2012. Do not share without
                        patient or guardian consent."
                    */}
                </p>
            </div>

            {/* [HIPAA / DPA] BreakGlassWrapper enforces an additional access justification
                step for SysAdmin users accessing this PHI-containing hub. */}
            <BreakGlassWrapper targetHub="Clinical Reports">
                {isLoading ? (
                    <div className="flex items-center justify-center h-[400px]">
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                            <Loader2 className="w-7 h-7 animate-spin text-teal-500" />
                            <p className="text-sm">Loading patient records...</p>
                        </div>
                    </div>
                ) : (
                    /*  The ClinicalReportsShell owns the two-panel layout:
                        - Left  : searchable, scrollable patient list with mini-vitals
                        - Right : tabbed report panel (Daily Summary, Anomaly Log, etc.)
                        Patient selection lives in the shell so it persists across all report tabs.
                    */
                    <div className="flex-1 overflow-hidden">
                        <ClinicalReportsShell
                            patients={patients}
                            vitalSigns={vitalSigns}
                            alerts={alerts}
                        />
                    </div>
                )}
            </BreakGlassWrapper>
        </div>
    );
}
