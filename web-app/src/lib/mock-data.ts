import { User, Patient, VitalSign, Alert, Event } from '../types';

export const mockUsers: User[] = [
  {
    id: '1',
    email: 'caregiver@alaga.com',
    role: 'caregiver',
    name: 'Maria Santos',
  },
  {
    id: '2',
    email: 'medstaff@alaga.com',
    role: 'medical_staff',
    name: 'Dr. Jose Reyes',
  },
];

export const mockPatients: Patient[] = [
  {
    id: 'p0',
    name: 'Patient A',
    age: 45,
    medicalConditions: ['Hypertension'],
    baselineVitals: {
      heartRate: 72,
      temperature: 36.9,
      spo2: 97,
    },
    caregiverId: '1',
    deviceId: 'ESP32-000',
    deviceBattery: 78,
    deviceConnected: true,
    lastUpdated: new Date(),
  },
  {
    id: 'p1',
    name: 'Baby Miguel',
    age: 1,
    medicalConditions: ['Nocturnal Enuresis'],
    baselineVitals: {
      heartRate: 120,
      temperature: 37.0,
      spo2: 98,
    },
    caregiverId: '1',
    deviceId: 'ESP32-001',
    deviceBattery: 85,
    deviceConnected: true,
    lastUpdated: new Date(),
  },
  {
    id: 'p2',
    name: 'Lola Carmen',
    age: 78,
    medicalConditions: ['Diabetes', 'Hypertension', 'Incontinence'],
    baselineVitals: {
      heartRate: 75,
      temperature: 36.8,
      spo2: 96,
    },
    caregiverId: '1',
    deviceId: 'ESP32-002',
    deviceBattery: 92,
    deviceConnected: true,
    lastUpdated: new Date(),
  },
  {
    id: 'p3',
    name: 'Lolo Pedro',
    age: 82,
    medicalConditions: ['Chronic Obstructive Pulmonary Disease'],
    baselineVitals: {
      heartRate: 68,
      temperature: 36.7,
      spo2: 94,
    },
    caregiverId: '2',
    deviceId: 'ESP32-003',
    deviceBattery: 15,
    deviceConnected: false,
    lastUpdated: new Date(Date.now() - 300000),
  },
  {
    id: 'p4',
    name: 'Mrs. Elena Cruz',
    age: 65,
    medicalConditions: ['Post-Stroke', 'Bedsore Prevention'],
    baselineVitals: {
      heartRate: 78,
      temperature: 36.9,
      spo2: 95,
    },
    caregiverId: '1',
    deviceId: 'ESP32-004',
    deviceBattery: 88,
    deviceConnected: true,
    lastUpdated: new Date(),
  },
  {
    id: 'p5',
    name: 'Baby Sofia',
    age: 0.5,
    medicalConditions: ['Premature Birth Monitoring'],
    baselineVitals: {
      heartRate: 135,
      temperature: 37.1,
      spo2: 97,
    },
    caregiverId: '1',
    deviceId: 'ESP32-005',
    deviceBattery: 95,
    deviceConnected: true,
    lastUpdated: new Date(),
  },
  {
    id: 'p6',
    name: 'Mr. Roberto Tan',
    age: 70,
    medicalConditions: ['Congestive Heart Failure', 'Diabetes'],
    baselineVitals: {
      heartRate: 82,
      temperature: 36.6,
      spo2: 93,
    },
    caregiverId: '2',
    deviceId: 'ESP32-006',
    deviceBattery: 72,
    deviceConnected: true,
    lastUpdated: new Date(),
  },
  {
    id: 'p7',
    name: 'Baby Lucas',
    age: 2,
    medicalConditions: ['Nocturnal Enuresis', 'Sleep Apnea Monitoring'],
    baselineVitals: {
      heartRate: 110,
      temperature: 36.8,
      spo2: 96,
    },
    caregiverId: '1',
    deviceId: 'ESP32-007',
    deviceBattery: 81,
    deviceConnected: true,
    lastUpdated: new Date(),
  },
  {
    id: 'p8',
    name: 'Mrs. Gloria Ramos',
    age: 75,
    medicalConditions: ['Alzheimer\'s Disease', 'Incontinence'],
    baselineVitals: {
      heartRate: 70,
      temperature: 36.7,
      spo2: 95,
    },
    caregiverId: '2',
    deviceId: 'ESP32-008',
    deviceBattery: 68,
    deviceConnected: true,
    lastUpdated: new Date(),
  },
];

// Generate mock vital signs for the last 24 hours
export const generateMockVitalSigns = (patientId: string, baseline: Patient['baselineVitals']): VitalSign[] => {
  const vitals: VitalSign[] = [];
  const now = Date.now();
  
  for (let i = 0; i < 288; i++) { // Every 5 minutes for 24 hours
    const timestamp = new Date(now - i * 5 * 60 * 1000);
    vitals.push({
      id: `v${patientId}-${i}`,
      patientId,
      timestamp,
      heartRate: baseline.heartRate + Math.random() * 10 - 5,
      temperature: baseline.temperature + Math.random() * 0.4 - 0.2,
      spo2: baseline.spo2 + Math.random() * 2 - 1,
      moistureLevel: Math.random() * 20,
    });
  }
  
  return vitals.reverse();
};

export const mockAlerts: Alert[] = [
  {
    id: 'a1',
    patientId: 'p1',
    type: 'bedwetting',
    severity: 'warning',
    title: 'Bed-wetting Detected',
    message: 'Moisture sensors detected a bed-wetting event for Baby Miguel.',
    timestamp: new Date(Date.now() - 600000),
    acknowledged: false,
  },
  {
    id: 'a2',
    patientId: 'p2',
    type: 'vital_signs',
    severity: 'critical',
    title: 'Abnormal Heart Rate',
    message: 'Heart rate of 105 bpm exceeds normal threshold for Lola Carmen.',
    timestamp: new Date(Date.now() - 900000),
    acknowledged: false,
  },
  {
    id: 'a3',
    patientId: 'p3',
    type: 'device',
    severity: 'critical',
    title: 'Low Battery',
    message: 'Device battery is at 15% for Lolo Pedro. Please charge soon.',
    timestamp: new Date(Date.now() - 1200000),
    acknowledged: false,
  },
  {
    id: 'a4',
    patientId: 'p3',
    type: 'device',
    severity: 'critical',
    title: 'Device Disconnected',
    message: 'Lost connection to monitoring device for Lolo Pedro.',
    timestamp: new Date(Date.now() - 300000),
    acknowledged: false,
  },
  {
    id: 'a5',
    patientId: 'p1',
    type: 'anomaly',
    severity: 'warning',
    title: 'Abnormal Pattern Detected',
    message: 'One-Class SVM detected an unusual bed-wetting pattern (Confidence: 87%).',
    timestamp: new Date(Date.now() - 7200000),
    acknowledged: true,
    acknowledgedBy: '1',
    acknowledgedAt: new Date(Date.now() - 7100000),
  },
];

export const mockEvents: Event[] = [
  {
    id: 'e1',
    patientId: 'p1',
    type: 'bedwetting',
    timestamp: new Date(Date.now() - 600000),
    data: { moistureLevel: 85, duration: 120 },
  },
  {
    id: 'e2',
    patientId: 'p1',
    type: 'bedwetting',
    timestamp: new Date(Date.now() - 14400000),
    data: { moistureLevel: 78, duration: 95 },
  },
  {
    id: 'e3',
    patientId: 'p2',
    type: 'vital_change',
    timestamp: new Date(Date.now() - 900000),
    data: { heartRate: 105, temperature: 37.2 },
  },
  {
    id: 'e4',
    patientId: 'p1',
    type: 'anomaly',
    timestamp: new Date(Date.now() - 7200000),
    data: { type: 'frequent_bedwetting', pattern: 'unusual_timing' },
    confidence: 0.87,
  },
];