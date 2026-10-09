import { useState, useEffect, useCallback } from 'react';
import { Patient } from '../types';
import { toast } from 'sonner';
import { extractBirthdateString } from '../lib/dateUtils';

export const usePatients = (token: string | null) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPatients = useCallback(async (silent = false) => {
        if (!token) return;
        try {
            if (!silent) setLoading(true);
            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/patients`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                const mappedPatients: Patient[] = data.data.map((p: any) => {
                    const bdayStr = extractBirthdateString(p.birthdate);
                    const birthYear = p.birthdate ? new Date(bdayStr).getFullYear() : 0;
                    const telem = p.latest_telemetry || {};
                    const hr = Number(telem.heart_rate) || 0;
                    const temp = Number(telem.temperature) || 0;
                    const sp = Number(telem.spo2) || 0;
                    const moist = Number(telem.moisture ?? telem.moisture_value) || 0;

                    return {
                        id: p.patient_id?.toString(),
                        name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
                        first_name: p.first_name,
                        last_name: p.last_name,
                        age: birthYear > 0 ? new Date().getFullYear() - birthYear : 0,
                        birthdate: p.birthdate ? bdayStr : undefined,
                        roomNumber: p.room_number || p.baseline_data?.room || 'Home',
                        condition: p.baseline_data?.condition || 'Stable',
                        status: p.status || 'Stable',
                        medicalConditions: p.baseline_data?.medicalConditions || p.medical_history || [],
                        illness: p.baseline_data?.illness || p.illness || 'N/A',
                        emergencyContact: p.baseline_data?.emergencyContact || p.emergencyContact || null,
                        baselineVitals: {
                            heartRate: hr,
                            spo2: sp,
                            temperature: temp,
                            moistureLevel: moist
                        },
                        deviceConnected: !!p.is_online,
                        is_online: !!p.is_online,
                        isOnline: !!p.is_online,
                        is_vitals_online: !!p.is_vitals_online,
                        is_moisture_online: !!p.is_moisture_online,
                        assignedCaregiverName: p.assigned_caregiver_name,
                        vital_device_sn: p.vital_device_sn,
                        diaper_device_sn: p.diaper_device_sn,
                        paired_devices: p.paired_devices || [],
                        latest_telemetry: telem,
                        heart_rate: hr,
                        temperature: temp,
                        spo2: sp,
                        moisture: moist,
                        moisture_value: moist,
                        doctorsOrders: [],
                        deleted: false,
                        archived: false
                    } as any;
                });
                setPatients(mappedPatients);
            }
        } catch (err: any) {
            console.error("Fetch Error:", err);
            setError(err.message);
            if (!silent) toast.error("Failed to load patients");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchPatients(false);

        // Real-Time Telemetry & Device Sync Listener
        const handleSync = (e: any) => {
            const detail = e?.detail;
            if (!detail) return;

            if (detail.type === 'device_status_update') {
                const targetPatientId = String(detail.patient_id || detail.patientId || '');
                const isOnline = detail.status === 'ACTIVE';
                const sn = String(detail.serial_number || '');
                const isVS = sn.startsWith('VS-');
                const isSD = sn.startsWith('SD-');

                setPatients(prev => prev.map(p => {
                    if (!targetPatientId || String(p.id) === targetPatientId) {
                        const paired = ((p as any).paired_devices || []).map((dev: any) => {
                            if (dev.serial_number === sn) {
                                return {
                                    ...dev,
                                    status: detail.status || dev.status,
                                    is_online: isOnline,
                                    battery_level: detail.battery_level !== undefined ? detail.battery_level : dev.battery_level,
                                    signal_strength: detail.signal_strength || dev.signal_strength
                                };
                            }
                            return dev;
                        });
                        return {
                            ...p,
                            deviceConnected: isOnline,
                            is_online: isOnline,
                            isOnline: isOnline,
                            is_vitals_online: isVS ? isOnline : (p as any).is_vitals_online,
                            is_moisture_online: isSD ? isOnline : (p as any).is_moisture_online,
                            paired_devices: paired
                        } as any;
                    }
                    return p;
                }));
            } else if (detail.type === 'patient_telemetry_update') {
                const targetPatientId = String(detail.patient_id || detail.patientId || '');
                if (targetPatientId) {
                    const sn = String(detail.serial_number || '');
                    const isVS = sn.startsWith('VS-') || detail.device_type === 'vitals';
                    const isSD = sn.startsWith('SD-') || detail.device_type === 'moisture';

                    const rawHr = detail.heart_rate !== undefined ? detail.heart_rate : detail.latest_telemetry?.heart_rate;
                    const rawTemp = detail.temperature !== undefined ? detail.temperature : detail.latest_telemetry?.temperature;
                    const rawSp = detail.spo2 !== undefined ? detail.spo2 : detail.latest_telemetry?.spo2;
                    const rawMoist = detail.moisture !== undefined ? detail.moisture : detail.latest_telemetry?.moisture;

                    setPatients(prev => prev.map(p => {
                        if (String(p.id) === targetPatientId) {
                            const existingTelem = (p as any).latest_telemetry || {};
                            const finalHr = rawHr !== undefined && rawHr !== null && (Number(rawHr) > 0 || !isSD) ? Number(rawHr) : existingTelem.heart_rate;
                            const finalTemp = rawTemp !== undefined && rawTemp !== null && (Number(rawTemp) > 0 || !isSD) ? Number(rawTemp) : existingTelem.temperature;
                            const finalSp = rawSp !== undefined && rawSp !== null && (Number(rawSp) > 0 || !isSD) ? Number(rawSp) : existingTelem.spo2;
                            const finalMoist = rawMoist !== undefined && rawMoist !== null ? Number(rawMoist) : existingTelem.moisture;

                            return {
                                ...p,
                                deviceConnected: true,
                                is_online: true,
                                isOnline: true,
                                is_vitals_online: isVS ? true : (p as any).is_vitals_online,
                                is_moisture_online: isSD ? true : (p as any).is_moisture_online,
                                heart_rate: finalHr,
                                temperature: finalTemp,
                                spo2: finalSp,
                                moisture: finalMoist,
                                moisture_value: finalMoist,
                                baselineVitals: {
                                    heartRate: finalHr || 0,
                                    temperature: finalTemp || 0,
                                    spo2: finalSp || 0,
                                    moistureLevel: finalMoist || 0
                                },
                                latest_telemetry: {
                                    ...existingTelem,
                                    heart_rate: finalHr,
                                    temperature: finalTemp,
                                    spo2: finalSp,
                                    moisture: finalMoist,
                                    recorded_at: detail.recorded_at || new Date().toISOString()
                                }
                            } as any;
                        }
                        return p;
                    }));
                }
            }
        };

        window.addEventListener('alaga_alert_update', handleSync);
        const poll = setInterval(() => fetchPatients(true), 10000);

        return () => {
            window.removeEventListener('alaga_alert_update', handleSync);
            clearInterval(poll);
        };
    }, [fetchPatients]);

    return { patients, loading, error, refreshPatients: () => fetchPatients(false) };
};