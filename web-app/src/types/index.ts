export type UserRole = 'caregiver' | 'medical_staff';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  medicalConditions: string[];
  baselineVitals: {
    heartRate: number;
    temperature: number;
    spo2: number;
  };
  caregiverId: string;
  deviceId: string;
  deviceBattery: number;
  deviceConnected: boolean;
  lastUpdated: Date;
  doctorsOrders?: DoctorsOrdersData;
}

export interface DoctorsOrdersData {
  vitalSignThresholds: {
    heartRateHigh: number;
    heartRateLow: number;
    spo2Floor: number;
    temperatureCeiling: number;
    aiSensitivity: 'low' | 'medium' | 'high';
  };
  medications: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    instructions: string;
    prn?: boolean;
    prnCondition?: string;
    refillThreshold?: string;
    times: string[];
  }>;
  activityOrders: {
    turningSchedule?: string;
    turningFrequency?: string;
    turningPattern?: string;
    ambulationGoals?: string;
    dietaryOrders?: string;
    fluidIntakeGoal?: string;
  };
  monitoringOrders: {
    checkupFrequency?: string;
    labSchedule?: string;
    observationFocus?: string;
  };
  calendarEvents: Array<{
    id: string;
    type: 'medication' | 'turning' | 'hygiene' | 'checkup' | 'lab' | 'refill';
    title: string;
    description?: string;
    dateTime: Date;
    recurring?: 'daily' | 'weekly' | 'every2hours' | 'every4hours';
    color: string;
  }>;
}

export interface VitalSign {
  id: string;
  patientId: string;
  timestamp: Date;
  heartRate: number;
  temperature: number;
  spo2: number;
  moistureLevel: number;
}

export interface Alert {
  id: string;
  patientId: string;
  type: 'bedwetting' | 'vital_signs' | 'device' | 'anomaly';
  severity: 'normal' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface Event {
  id: string;
  patientId: string;
  type: 'bedwetting' | 'vital_change' | 'anomaly';
  timestamp: Date;
  data: Record<string, any>;
  confidence?: number;
}

export interface ThresholdConfig {
  patientId: string;
  heartRateMin: number;
  heartRateMax: number;
  temperatureMin: number;
  temperatureMax: number;
  spo2Min: number;
  moistureThreshold: number;
}