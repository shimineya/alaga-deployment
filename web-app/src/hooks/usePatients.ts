import { useState, useEffect, useCallback } from 'react';
import { Patient } from '../types';
import { toast } from 'sonner';

export const usePatients = (token: string | null) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPatients = useCallback(async () => {
        if (!token) return;
        try {
            setLoading(true);
            const response = await fetch('http://localhost:3000/api/caregiver/patients', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                const mappedPatients: Patient[] = data.data.map((p: any) => ({
                    id: p.patient_id?.toString(),
                    name: p.name || `${p.first_name} ${p.last_name}`,
                    age: p.birthdate ? new Date().getFullYear() - new Date(p.birthdate).getFullYear() : 0,
                    roomNumber: p.room_number || 'Home',
                    condition: p.baseline_data?.condition || 'Stable',
                    status: 'Stable', // Default until sensors update
                    medicalConditions: p.medical_history || [],
                    // Default Vitals (0 or -- indicates no data yet)
                    baselineVitals: { heartRate: 0, spo2: 0, temperature: 0, moistureLevel: 0 },
                    deviceConnected: !!p.device_serial_number,
                    assignedCaregiverName: p.assigned_caregiver_name,
                    doctorsOrders: [],
                    deleted: false,
                    archived: false
                }));
                setPatients(mappedPatients);
            }
        } catch (err: any) {
            console.error("Fetch Error:", err);
            setError(err.message);
            toast.error("Failed to load patients");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    return { patients, loading, error, refreshPatients: fetchPatients };
};