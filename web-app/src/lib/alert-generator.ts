import type { Alert, Patient, DoctorsOrdersData } from '../types';

export function generateAlertsFromDoctorsOrders(patient: Patient): Alert[] {
  if (!patient.doctorsOrders) return [];

  const alerts: Alert[] = [];
  const now = new Date();
  const orders = patient.doctorsOrders;

  // 1. Generate medication alerts from calendar events
  orders.calendarEvents
    .filter(event => event.type === 'medication' && event.recurring)
    .forEach(event => {
      const eventTime = new Date(event.dateTime);
      const hours = eventTime.getHours();
      const minutes = eventTime.getMinutes();
      
      // Create alert for today's schedule
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);

      // If scheduled time is within next 30 minutes, create alert
      const timeDiff = scheduledTime.getTime() - now.getTime();
      if (timeDiff > 0 && timeDiff <= 30 * 60 * 1000) {
        alerts.push({
          id: `alert-med-${patient.id}-${Date.now()}-${event.id}`,
          patientId: patient.id,
          type: 'vital_signs', // Categorize as vital_signs for medication reminders
          severity: 'warning',
          title: 'Medication Due Soon',
          message: `${event.title} scheduled at ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
          timestamp: scheduledTime,
          acknowledged: false
        });
      }
    });

  // 2. Generate turning/positioning alerts
  if (orders.activityOrders?.turningFrequency) {
    const frequency = orders.activityOrders.turningFrequency.toLowerCase();
    let hoursInterval = 2; // default

    if (frequency.includes('2')) hoursInterval = 2;
    else if (frequency.includes('3')) hoursInterval = 3;
    else if (frequency.includes('4')) hoursInterval = 4;
    else if (frequency.includes('1')) hoursInterval = 1;

    // Check if turning is due (using modulo of current hour)
    const currentHour = now.getHours();
    if (currentHour % hoursInterval === 0 && now.getMinutes() < 30) {
      alerts.push({
        id: `alert-turning-${patient.id}-${Date.now()}`,
        patientId: patient.id,
        type: 'vital_signs',
        severity: 'normal',
        title: 'Patient Repositioning Due',
        message: `Time to reposition patient. Pattern: ${orders.activityOrders.turningPattern || 'Standard'}`,
        timestamp: now,
        acknowledged: false
      });
    }
  }

  // 3. Generate hygiene/bathing alerts from calendar
  orders.calendarEvents
    .filter(event => event.type === 'hygiene')
    .forEach(event => {
      const eventDate = new Date(event.dateTime);
      const today = new Date();
      
      // If event is scheduled for today
      if (
        eventDate.getDate() === today.getDate() &&
        eventDate.getMonth() === today.getMonth() &&
        eventDate.getFullYear() === today.getFullYear()
      ) {
        const timeDiff = eventDate.getTime() - now.getTime();
        if (timeDiff > 0 && timeDiff <= 60 * 60 * 1000) { // Within 1 hour
          alerts.push({
            id: `alert-hygiene-${patient.id}-${Date.now()}-${event.id}`,
            patientId: patient.id,
            type: 'vital_signs',
            severity: 'normal',
            title: 'Hygiene Care Scheduled',
            message: event.title + (event.description ? ` - ${event.description}` : ''),
            timestamp: eventDate,
            acknowledged: false
          });
        }
      }
    });

  // 4. Generate checkup/lab alerts
  orders.calendarEvents
    .filter(event => event.type === 'checkup' || event.type === 'lab')
    .forEach(event => {
      const eventDate = new Date(event.dateTime);
      const timeDiff = eventDate.getTime() - now.getTime();
      
      // Alert 24 hours before
      if (timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000) {
        alerts.push({
          id: `alert-${event.type}-${patient.id}-${Date.now()}-${event.id}`,
          patientId: patient.id,
          type: 'vital_signs',
          severity: 'warning',
          title: `Upcoming ${event.type === 'checkup' ? 'Check-up' : 'Lab Test'}`,
          message: `${event.title} scheduled for ${eventDate.toLocaleString()}`,
          timestamp: now,
          acknowledged: false
        });
      }
    });

  // 5. Generate refill alerts
  orders.medications.forEach(med => {
    if (med.refillThreshold && med.refillThreshold.toLowerCase().includes('3 days')) {
      // Simulated: trigger refill alert (in real app, this would check inventory)
      if (Math.random() < 0.1) { // 10% chance to trigger for demo
        alerts.push({
          id: `alert-refill-${patient.id}-${Date.now()}-${med.id}`,
          patientId: patient.id,
          type: 'device',
          severity: 'warning',
          title: 'Medication Refill Needed',
          message: `${med.name} supply is running low. ${med.refillThreshold}`,
          timestamp: now,
          acknowledged: false
        });
      }
    }
  });

  return alerts;
}

// Function to check if vital signs exceed doctor's orders thresholds
export function checkVitalSignThresholds(
  patient: Patient,
  currentVitals: { heartRate: number; temperature: number; spo2: number }
): Alert | null {
  if (!patient.doctorsOrders?.vitalSignThresholds) return null;

  const thresholds = patient.doctorsOrders.vitalSignThresholds;
  const now = new Date();

  // Check heart rate high
  if (currentVitals.heartRate > thresholds.heartRateHigh) {
    return {
      id: `alert-hr-high-${patient.id}-${Date.now()}`,
      patientId: patient.id,
      type: 'vital_signs',
      severity: 'critical',
      title: 'Tachycardia Alert',
      message: `Heart rate ${currentVitals.heartRate} bpm exceeds threshold of ${thresholds.heartRateHigh} bpm`,
      timestamp: now,
      acknowledged: false
    };
  }

  // Check heart rate low
  if (currentVitals.heartRate < thresholds.heartRateLow) {
    return {
      id: `alert-hr-low-${patient.id}-${Date.now()}`,
      patientId: patient.id,
      type: 'vital_signs',
      severity: 'critical',
      title: 'Bradycardia Alert',
      message: `Heart rate ${currentVitals.heartRate} bpm below threshold of ${thresholds.heartRateLow} bpm`,
      timestamp: now,
      acknowledged: false
    };
  }

  // Check SpO2
  if (currentVitals.spo2 < thresholds.spo2Floor) {
    return {
      id: `alert-spo2-${patient.id}-${Date.now()}`,
      patientId: patient.id,
      type: 'vital_signs',
      severity: 'critical',
      title: 'EMERGENCY: Low Oxygen Level',
      message: `SpO₂ ${currentVitals.spo2}% below critical threshold of ${thresholds.spo2Floor}%`,
      timestamp: now,
      acknowledged: false
    };
  }

  // Check temperature
  if (currentVitals.temperature > thresholds.temperatureCeiling) {
    return {
      id: `alert-temp-${patient.id}-${Date.now()}`,
      patientId: patient.id,
      type: 'vital_signs',
      severity: 'warning',
      title: 'Fever Detected',
      message: `Temperature ${currentVitals.temperature.toFixed(1)}°C exceeds threshold of ${thresholds.temperatureCeiling}°C`,
      timestamp: now,
      acknowledged: false
    };
  }

  return null;
}
