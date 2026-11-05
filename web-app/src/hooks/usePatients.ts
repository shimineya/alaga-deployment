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

            if (detail.type === 'device_status_update' || detail.type === 'patient_telemetry_update') {
                const targetPatientId = String(detail.patient_id || detail.patientId || '');
                const action = detail.action;
                const isPermanentUnpair = action === 'unpair_permanent' || detail.assigned_patient_id === null;
                const isStandby = action === 'unpair_change' || detail.status === 'STANDBY';
                const isOnline = !isPermanentUnpair && !isStandby && (detail.status === 'ACTIVE' || detail.device_status === 'ACTIVE');
                const sn = String(detail.serial_number || detail.serialNumber || '');
                const isVS = sn.startsWith('VS-') || detail.device_type === 'vitals' || String(detail.device_name || '').toLowerCase().includes('vital');
                const isSD = sn.startsWith('SD-') || detail.device_type === 'moisture' || String(detail.device_name || '').toLowerCase().includes('diaper');

                const rawHr = detail.heart_rate !== undefined ? detail.heart_rate : detail.latest_telemetry?.heart_rate;
                const rawTemp = detail.temperature !== undefined ? detail.temperature : detail.latest_telemetry?.temperature;
                const rawSp = detail.spo2 !== undefined ? detail.spo2 : detail.latest_telemetry?.spo2;
                const rawMoist = detail.moisture !== undefined ? detail.moisture : (detail.latest_telemetry?.moisture ?? detail.latest_telemetry?.moisture_value);
                const isFinger = detail.finger_detected !== undefined ? !!detail.finger_detected : (detail.latest_telemetry?.finger_detected !== undefined ? !!detail.latest_telemetry?.finger_detected : undefined);

                setPatients(prev => prev.map(p => {
                    const pPaired = (p as any).paired_devices || [];
                    const hasSn = sn && (
                        pPaired.some((d: any) => d.serial_number === sn) ||
                        (p as any).vital_device_sn === sn ||
                        (p as any).diaper_device_sn === sn ||
                        (p as any).deviceId === sn
                    );

                    if ((targetPatientId && String(p.id) === targetPatientId) || hasSn) {
                        const existingTelem = (p as any).latest_telemetry || {};
                        let paired = [...pPaired];

                        if (isPermanentUnpair && sn) {
                            paired = paired.filter((dev: any) => dev.serial_number !== sn);
                        } else if (sn) {
                            const exists = paired.some((dev: any) => dev.serial_number === sn);
                            if (exists) {
                                paired = paired.map((dev: any) => {
                                    if (dev.serial_number === sn) {
                                        return {
                                            ...dev,
                                            status: isStandby ? 'STANDBY' : (detail.status || dev.status),
                                            is_online: isOnline,
                                            battery_level: detail.battery_level !== undefined ? detail.battery_level : dev.battery_level,
                                            signal_strength: detail.signal_strength || dev.signal_strength
                                        };
                                    }
                                    return dev;
                                });
                            } else if ((action === 'pair' || action === 'assign' || isOnline) && String(p.id) === targetPatientId) {
                                paired.push({
                                    serial_number: sn,
                                    device_name: detail.device_name || (isSD ? 'Smart Diaper Moisture Sensor' : 'Vital Signs Sensor'),
                                    status: detail.status || 'ACTIVE',
                                    is_online: isOnline,
                                    battery_level: detail.battery_level ?? 100,
                                    signal_strength: detail.signal_strength || 'Good'
                                });
                            }
                        }

                        const nextVitalSn = isPermanentUnpair && (p as any).vital_device_sn === sn
                            ? null
                            : ((action === 'pair' || action === 'assign') && isVS && String(p.id) === targetPatientId ? sn : (p as any).vital_device_sn);
                        const nextDiaperSn = isPermanentUnpair && (p as any).diaper_device_sn === sn
                            ? null
                            : ((action === 'pair' || action === 'assign') && isSD && String(p.id) === targetPatientId ? sn : (p as any).diaper_device_sn);

                        const isVOnline = (isPermanentUnpair || isStandby) && isVS
                            ? paired.some((d: any) => (d.status === 'ACTIVE' && d.is_online !== false) && (String(d.serial_number).startsWith('VS-') || String(d.device_name).toLowerCase().includes('vital')))
                            : (isVS 
                                ? isOnline 
                                : (detail.is_vitals_active !== undefined 
                                    ? !!detail.is_vitals_active 
                                    : paired.some((d: any) => (d.status === 'ACTIVE' || d.is_online) && (String(d.serial_number).startsWith('VS-') || String(d.device_name).toLowerCase().includes('vital')))));

                        const isMOnline = (isPermanentUnpair || isStandby) && isSD
                            ? paired.some((d: any) => (d.status === 'ACTIVE' && d.is_online !== false) && (String(d.serial_number).startsWith('SD-') || String(d.device_name).toLowerCase().includes('diaper') || String(d.device_name).toLowerCase().includes('moisture')))
                            : (isSD 
                                ? isOnline 
                                : (detail.is_moisture_active !== undefined 
                                    ? !!detail.is_moisture_active 
                                    : paired.some((d: any) => (d.status === 'ACTIVE' || d.is_online) && (String(d.serial_number).startsWith('SD-') || String(d.device_name).toLowerCase().includes('diaper') || String(d.device_name).toLowerCase().includes('moisture')))));

                        const finalHr = isVOnline ? (rawHr !== undefined && rawHr !== null ? Number(rawHr) : existingTelem.heart_rate) : 0;
                        const finalTemp = isVOnline ? (rawTemp !== undefined && rawTemp !== null ? Number(rawTemp) : existingTelem.temperature) : 0;
                        const finalSp = isVOnline ? (rawSp !== undefined && rawSp !== null ? Number(rawSp) : existingTelem.spo2) : 0;
                        const finalMoist = isMOnline ? (rawMoist !== undefined && rawMoist !== null ? Number(rawMoist) : existingTelem.moisture) : 0;

                        return {
                            ...p,
                            deviceId: nextVitalSn || nextDiaperSn || 'UNASSIGNED',
                            vital_device_sn: nextVitalSn,
                            diaper_device_sn: nextDiaperSn,
                            deviceConnected: isVOnline || isMOnline,
                            is_online: isVOnline || isMOnline,
                            isOnline: isVOnline || isMOnline,
                            is_vitals_online: isVOnline,
                            is_moisture_online: isMOnline,
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
                                finger_detected: isVOnline && isFinger !== undefined ? isFinger : false,
                                recorded_at: detail.recorded_at || detail.timestamp || new Date().toISOString()
                            },
                            paired_devices: paired,
                            devices: paired
                        } as any;
                    }
                    return p;
                }));

                if (action === 'unpair_permanent' || action === 'unpair_change' || action === 'pair' || action === 'assign') {
                    fetchPatients(true);
                }
            }
        };

        const handleManualRefresh = () => fetchPatients(true);
        window.addEventListener('alaga_alert_update', handleSync);
        window.addEventListener('alaga_manual_refresh', handleManualRefresh);
        const poll = setInterval(() => fetchPatients(true), 10000);

        return () => {
            window.removeEventListener('alaga_alert_update', handleSync);
            window.removeEventListener('alaga_manual_refresh', handleManualRefresh);
            clearInterval(poll);
        };
    }, [fetchPatients]);

    return { patients, loading, error, refreshPatients: () => fetchPatients(false) };
};