import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Calendar, 
  Plus, 
  X, 
  AlertCircle, 
  Pill, 
  Activity, 
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export interface VitalSignThreshold {
  heartRateHigh: number;
  heartRateLow: number;
  spo2Floor: number;
  temperatureCeiling: number;
  aiSensitivity: 'low' | 'medium' | 'high';
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions: string;
  prn?: boolean;
  prnCondition?: string;
  refillThreshold?: string;
  times: string[]; // e.g., ['08:00', '14:00', '20:00']
}

export interface ActivityOrder {
  turningSchedule?: string;
  turningFrequency?: string; // e.g., "Every 2 hours"
  turningPattern?: string; // e.g., "Left-Back-Right"
  ambulationGoals?: string;
  dietaryOrders?: string;
  fluidIntakeGoal?: string;
}

export interface MonitoringOrder {
  checkupFrequency?: string;
  labSchedule?: string;
  observationFocus?: string;
}

export interface CalendarEvent {
  id: string;
  type: 'medication' | 'turning' | 'hygiene' | 'checkup' | 'lab' | 'refill';
  title: string;
  description?: string;
  dateTime: Date;
  recurring?: 'daily' | 'weekly' | 'every2hours' | 'every4hours';
  color: string;
}

export interface DoctorsOrdersData {
  vitalSignThresholds: VitalSignThreshold;
  medications: Medication[];
  activityOrders: ActivityOrder;
  monitoringOrders: MonitoringOrder;
  calendarEvents: CalendarEvent[];
}

interface DoctorsOrdersProps {
  patientName: string;
  onSave: (data: DoctorsOrdersData) => void;
  initialData?: DoctorsOrdersData;
}

export const DoctorsOrders: React.FC<DoctorsOrdersProps> = ({ 
  patientName, 
  onSave,
  initialData 
}) => {
  const [activeSection, setActiveSection] = useState<string | null>('vitals');
  const [showCalendar, setShowCalendar] = useState(false);

  // Vital Sign Thresholds
  const [vitalThresholds, setVitalThresholds] = useState<VitalSignThreshold>(
    initialData?.vitalSignThresholds || {
      heartRateHigh: 100,
      heartRateLow: 60,
      spo2Floor: 92,
      temperatureCeiling: 38.5,
      aiSensitivity: 'medium',
    }
  );

  // Medications
  const [medications, setMedications] = useState<Medication[]>(
    initialData?.medications || []
  );
  const [newMed, setNewMed] = useState<Partial<Medication>>({
    name: '',
    dosage: '',
    frequency: '',
    instructions: '',
    times: [],
  });
  const [isAddingMed, setIsAddingMed] = useState(false);

  // Activity Orders
  const [activityOrders, setActivityOrders] = useState<ActivityOrder>(
    initialData?.activityOrders || {}
  );

  // Monitoring Orders
  const [monitoringOrders, setMonitoringOrders] = useState<MonitoringOrder>(
    initialData?.monitoringOrders || {}
  );

  // Calendar Events
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(
    initialData?.calendarEvents || []
  );
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    type: 'medication',
    title: '',
    dateTime: new Date(),
    color: '#EF4444',
  });

  const handleAddMedication = () => {
    if (!newMed.name || !newMed.dosage || !newMed.frequency) {
      toast.error('Please fill in all required medication fields');
      return;
    }

    const medication: Medication = {
      id: `med-${Date.now()}`,
      name: newMed.name!,
      dosage: newMed.dosage!,
      frequency: newMed.frequency!,
      instructions: newMed.instructions || '',
      prn: newMed.prn || false,
      prnCondition: newMed.prnCondition,
      refillThreshold: newMed.refillThreshold,
      times: newMed.times || [],
    };

    setMedications([...medications, medication]);
    
    // Auto-generate calendar events for medication times
    if (medication.times.length > 0) {
      medication.times.forEach((time) => {
        const event: CalendarEvent = {
          id: `event-${Date.now()}-${time}`,
          type: 'medication',
          title: `${medication.name} - ${medication.dosage}`,
          description: medication.instructions,
          dateTime: new Date(`2025-01-01T${time}:00`),
          recurring: 'daily',
          color: '#EF4444',
        };
        setCalendarEvents(prev => [...prev, event]);
      });
    }

    setNewMed({ name: '', dosage: '', frequency: '', instructions: '', times: [] });
    setIsAddingMed(false);
    toast.success('Medication added successfully');
  };

  const handleRemoveMedication = (id: string) => {
    setMedications(medications.filter(m => m.id !== id));
    // Remove associated calendar events
    setCalendarEvents(calendarEvents.filter(e => !e.title.includes(medications.find(m => m.id === id)?.name || '')));
    toast.success('Medication removed');
  };

  const handleAddCalendarEvent = () => {
    if (!newEvent.title || !newEvent.dateTime) {
      toast.error('Please fill in event details');
      return;
    }

    const event: CalendarEvent = {
      id: `event-${Date.now()}`,
      type: newEvent.type!,
      title: newEvent.title!,
      description: newEvent.description,
      dateTime: newEvent.dateTime!,
      recurring: newEvent.recurring,
      color: newEvent.color!,
    };

    setCalendarEvents([...calendarEvents, event]);
    setNewEvent({ type: 'medication', title: '', dateTime: new Date(), color: '#EF4444' });
    toast.success('Calendar event added');
  };

  const handleSave = () => {
    const data: DoctorsOrdersData = {
      vitalSignThresholds: vitalThresholds,
      medications,
      activityOrders,
      monitoringOrders,
      calendarEvents,
    };

    onSave(data);
    toast.success('Doctor\'s orders saved successfully!');
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const getSensitivityColor = (level: string) => {
    switch (level) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#10B981';
      default:
        return '#7DD3C0';
    }
  };

  const getEventTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'medication':
        return '#EF4444';
      case 'turning':
      case 'hygiene':
        return '#3B82F6';
      case 'checkup':
      case 'lab':
      case 'refill':
        return '#10B981';
      default:
        return '#7DD3C0';
    }
  };

  // Check for calendar conflicts
  const checkConflicts = (newEventTime: Date) => {
    return calendarEvents.filter(event => {
      const timeDiff = Math.abs(event.dateTime.getTime() - newEventTime.getTime());
      return timeDiff < 3600000; // Within 1 hour
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Doctor's Orders - {patientName}</CardTitle>
              <CardDescription>
                Configure treatment protocols, medication schedules, and monitoring requirements
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowCalendar(!showCalendar)}
              variant="outline"
              style={{ borderColor: '#7DD3C0', color: '#7DD3C0' }}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {showCalendar ? 'Hide' : 'Show'} Calendar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Section 1: Vital Sign Thresholds */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('vitals')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5" style={{ color: '#7DD3C0' }} />
                <div className="text-left">
                  <h3 className="font-medium" style={{ color: '#2C3E50' }}>
                    1. Vital Sign Thresholds (AI Configuration)
                  </h3>
                  <p className="text-sm text-gray-500">
                    Set patient-specific trigger points for alerts
                  </p>
                </div>
              </div>
              {activeSection === 'vitals' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {activeSection === 'vitals' && (
              <div className="p-4 border-t space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Heart Rate - High Limit (Tachycardia)</Label>
                    <Input
                      type="number"
                      value={vitalThresholds.heartRateHigh}
                      onChange={(e) => setVitalThresholds({ ...vitalThresholds, heartRateHigh: Number(e.target.value) })}
                      placeholder="e.g., 100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Alert if above this value (bpm)</p>
                  </div>

                  <div>
                    <Label>Heart Rate - Low Limit (Bradycardia)</Label>
                    <Input
                      type="number"
                      value={vitalThresholds.heartRateLow}
                      onChange={(e) => setVitalThresholds({ ...vitalThresholds, heartRateLow: Number(e.target.value) })}
                      placeholder="e.g., 60"
                    />
                    <p className="text-xs text-gray-500 mt-1">Alert if below this value (bpm)</p>
                  </div>

                  <div>
                    <Label>SpO₂ Floor (Oxygen)</Label>
                    <Input
                      type="number"
                      value={vitalThresholds.spo2Floor}
                      onChange={(e) => setVitalThresholds({ ...vitalThresholds, spo2Floor: Number(e.target.value) })}
                      placeholder="e.g., 92"
                    />
                    <p className="text-xs text-gray-500 mt-1">Emergency alert if below (%)</p>
                  </div>

                  <div>
                    <Label>Temperature Ceiling (Fever)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={vitalThresholds.temperatureCeiling}
                      onChange={(e) => setVitalThresholds({ ...vitalThresholds, temperatureCeiling: Number(e.target.value) })}
                      placeholder="e.g., 38.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">Alert if above (°C)</p>
                  </div>
                </div>

                <div>
                  <Label>AI Sensitivity (OC-SVM Algorithm)</Label>
                  <div className="flex gap-2 mt-2">
                    {(['low', 'medium', 'high'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setVitalThresholds({ ...vitalThresholds, aiSensitivity: level })}
                        className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                          vitalThresholds.aiSensitivity === level ? 'border-opacity-100' : 'border-opacity-30'
                        }`}
                        style={{
                          borderColor: getSensitivityColor(level),
                          backgroundColor: vitalThresholds.aiSensitivity === level ? `${getSensitivityColor(level)}20` : 'transparent',
                        }}
                      >
                        <span className="capitalize font-medium">{level}</span>
                        <p className="text-xs mt-1">
                          {level === 'high' && 'Critical patients'}
                          {level === 'medium' && 'Standard monitoring'}
                          {level === 'low' && 'Stable patients'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Medication & Treatment Orders */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('medications')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Pill className="w-5 h-5" style={{ color: '#7DD3C0' }} />
                <div className="text-left">
                  <h3 className="font-medium" style={{ color: '#2C3E50' }}>
                    2. Medication & Treatment Orders
                  </h3>
                  <p className="text-sm text-gray-500">
                    Prescription list and administration schedule
                  </p>
                </div>
              </div>
              {activeSection === 'medications' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {activeSection === 'medications' && (
              <div className="p-4 border-t space-y-4">
                {/* Existing Medications */}
                {medications.length > 0 && (
                  <div className="space-y-2">
                    {medications.map((med) => (
                      <div
                        key={med.id}
                        className="p-3 rounded-lg border flex items-start justify-between"
                        style={{ backgroundColor: '#F0FAF9' }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium" style={{ color: '#2C3E50' }}>{med.name}</h4>
                            {med.prn && (
                              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                PRN
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{med.dosage} - {med.frequency}</p>
                          {med.instructions && (
                            <p className="text-xs text-gray-500 mt-1">{med.instructions}</p>
                          )}
                          {med.times.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {med.times.map((time, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-1 rounded"
                                  style={{ backgroundColor: '#E8F6F3', color: '#0a4a47' }}
                                >
                                  {time}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveMedication(med.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Medication */}
                {!isAddingMed ? (
                  <Button
                    onClick={() => setIsAddingMed(true)}
                    variant="outline"
                    style={{ borderColor: '#7DD3C0', color: '#7DD3C0' }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Medication
                  </Button>
                ) : (
                  <div className="p-4 rounded-lg border space-y-3" style={{ backgroundColor: '#F0FAF9' }}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium" style={{ color: '#2C3E50' }}>New Medication</h4>
                      <button onClick={() => setIsAddingMed(false)}>
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Medicine Name *</Label>
                        <Input
                          value={newMed.name}
                          onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                          placeholder="e.g., Paracetamol"
                        />
                      </div>

                      <div>
                        <Label>Dosage *</Label>
                        <Input
                          value={newMed.dosage}
                          onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                          placeholder="e.g., 500mg"
                        />
                      </div>

                      <div>
                        <Label>Frequency *</Label>
                        <Input
                          value={newMed.frequency}
                          onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                          placeholder="e.g., 3x a day"
                        />
                      </div>

                      <div>
                        <Label>Times (comma-separated)</Label>
                        <Input
                          value={newMed.times?.join(', ')}
                          onChange={(e) => setNewMed({ ...newMed, times: e.target.value.split(',').map(t => t.trim()) })}
                          placeholder="e.g., 08:00, 14:00, 20:00"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Administration Instructions</Label>
                      <Input
                        value={newMed.instructions}
                        onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                        placeholder="e.g., Take after meals"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newMed.prn || false}
                        onChange={(e) => setNewMed({ ...newMed, prn: e.target.checked })}
                        id="prn-checkbox"
                      />
                      <Label htmlFor="prn-checkbox">PRN (As Needed)</Label>
                    </div>

                    {newMed.prn && (
                      <div>
                        <Label>PRN Condition</Label>
                        <Input
                          value={newMed.prnCondition}
                          onChange={(e) => setNewMed({ ...newMed, prnCondition: e.target.value })}
                          placeholder="e.g., Give if temperature exceeds 38.5°C"
                        />
                      </div>
                    )}

                    <div>
                      <Label>Refill Threshold</Label>
                      <Input
                        value={newMed.refillThreshold}
                        onChange={(e) => setNewMed({ ...newMed, refillThreshold: e.target.value })}
                        placeholder="e.g., Notify when 7 days supply remains"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleAddMedication}
                        style={{ backgroundColor: '#7DD3C0', color: 'white' }}
                      >
                        Add Medication
                      </Button>
                      <Button
                        onClick={() => setIsAddingMed(false)}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Activity & Positioning Orders */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('activity')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5" style={{ color: '#7DD3C0' }} />
                <div className="text-left">
                  <h3 className="font-medium" style={{ color: '#2C3E50' }}>
                    3. Activity & Positioning Orders
                  </h3>
                  <p className="text-sm text-gray-500">
                    Turning schedule, ambulation goals, and dietary requirements
                  </p>
                </div>
              </div>
              {activeSection === 'activity' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {activeSection === 'activity' && (
              <div className="p-4 border-t space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Turning Frequency</Label>
                    <Input
                      value={activityOrders.turningFrequency || ''}
                      onChange={(e) => setActivityOrders({ ...activityOrders, turningFrequency: e.target.value })}
                      placeholder="e.g., Every 2 hours"
                    />
                  </div>

                  <div>
                    <Label>Turning Pattern</Label>
                    <Input
                      value={activityOrders.turningPattern || ''}
                      onChange={(e) => setActivityOrders({ ...activityOrders, turningPattern: e.target.value })}
                      placeholder="e.g., Left-Back-Right rotation"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Ambulation Goals</Label>
                    <Input
                      value={activityOrders.ambulationGoals || ''}
                      onChange={(e) => setActivityOrders({ ...activityOrders, ambulationGoals: e.target.value })}
                      placeholder="e.g., Assist patient to sit in chair for 15 minutes twice daily"
                    />
                  </div>

                  <div>
                    <Label>Dietary Orders</Label>
                    <Input
                      value={activityOrders.dietaryOrders || ''}
                      onChange={(e) => setActivityOrders({ ...activityOrders, dietaryOrders: e.target.value })}
                      placeholder="e.g., Low Salt, Soft Food"
                    />
                  </div>

                  <div>
                    <Label>Daily Fluid Intake Goal</Label>
                    <Input
                      value={activityOrders.fluidIntakeGoal || ''}
                      onChange={(e) => setActivityOrders({ ...activityOrders, fluidIntakeGoal: e.target.value })}
                      placeholder="e.g., 1500ml per day"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Monitoring & Laboratory Orders */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('monitoring')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5" style={{ color: '#7DD3C0' }} />
                <div className="text-left">
                  <h3 className="font-medium" style={{ color: '#2C3E50' }}>
                    4. Monitoring & Laboratory Orders
                  </h3>
                  <p className="text-sm text-gray-500">
                    Check-up frequency and observation requirements
                  </p>
                </div>
              </div>
              {activeSection === 'monitoring' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {activeSection === 'monitoring' && (
              <div className="p-4 border-t space-y-4">
                <div>
                  <Label>Check-up Frequency</Label>
                  <Input
                    value={monitoringOrders.checkupFrequency || ''}
                    onChange={(e) => setMonitoringOrders({ ...monitoringOrders, checkupFrequency: e.target.value })}
                    placeholder="e.g., Physical assessment once a week, Teleconsult every Monday"
                  />
                </div>

                <div>
                  <Label>Laboratory Schedule</Label>
                  <Input
                    value={monitoringOrders.labSchedule || ''}
                    onChange={(e) => setMonitoringOrders({ ...monitoringOrders, labSchedule: e.target.value })}
                    placeholder="e.g., Blood work every month, X-ray quarterly"
                  />
                </div>

                <div>
                  <Label>Observation Focus</Label>
                  <textarea
                    value={monitoringOrders.observationFocus || ''}
                    onChange={(e) => setMonitoringOrders({ ...monitoringOrders, observationFocus: e.target.value })}
                    placeholder="e.g., Monitor for swelling in lower limbs, watch for signs of infection"
                    rows={3}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                    style={{ borderColor: '#D1D5DB' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              style={{ backgroundColor: '#7DD3C0', color: 'white' }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Save Doctor's Orders
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      {showCalendar && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Medical Calendar & Scheduling
            </CardTitle>
            <CardDescription>
              Automated schedules for medications, turning, procedures, and appointments
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Color Legend */}
            <div className="flex flex-wrap gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F0FAF9' }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} />
                <span className="text-sm">Critical (Medication/Vitals)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
                <span className="text-sm">Routine (Hygiene/Turning)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }} />
                <span className="text-sm">Checkups/Lab Tests</span>
              </div>
            </div>

            {/* Calendar Events List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {calendarEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No scheduled events yet</p>
                  <p className="text-sm">Add medications or procedures to generate calendar events</p>
                </div>
              ) : (
                calendarEvents
                  .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
                  .map((event) => (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg border-l-4 flex items-start justify-between"
                      style={{ 
                        borderLeftColor: event.color,
                        backgroundColor: '#F9FAFB'
                      }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4" style={{ color: event.color }} />
                          <span className="font-medium" style={{ color: '#2C3E50' }}>
                            {event.dateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {event.recurring && (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#E8F6F3', color: '#0a4a47' }}>
                              {event.recurring}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-sm" style={{ color: '#2C3E50' }}>{event.title}</p>
                        {event.description && (
                          <p className="text-xs text-gray-500 mt-1">{event.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setCalendarEvents(calendarEvents.filter(e => e.id !== event.id))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Add Manual Event */}
            <div className="p-4 rounded-lg border" style={{ backgroundColor: '#F0FAF9' }}>
              <h4 className="font-medium mb-3" style={{ color: '#2C3E50' }}>Add Manual Event</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Event Type</Label>
                  <select
                    value={newEvent.type}
                    onChange={(e) => {
                      const type = e.target.value as CalendarEvent['type'];
                      setNewEvent({ ...newEvent, type, color: getEventTypeColor(type) });
                    }}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="medication">Medication Check</option>
                    <option value="turning">Turning/Positioning</option>
                    <option value="hygiene">Hygiene/Bathing</option>
                    <option value="checkup">Doctor Checkup</option>
                    <option value="lab">Lab Test</option>
                    <option value="refill">Medication Refill</option>
                  </select>
                </div>

                <div>
                  <Label>Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={newEvent.dateTime?.toISOString().slice(0, 16)}
                    onChange={(e) => setNewEvent({ ...newEvent, dateTime: new Date(e.target.value) })}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Event Title</Label>
                  <Input
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="e.g., Blood pressure check"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Recurring</Label>
                  <select
                    value={newEvent.recurring || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, recurring: e.target.value as CalendarEvent['recurring'] })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">One-time only</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="every2hours">Every 2 Hours</option>
                    <option value="every4hours">Every 4 Hours</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <Button
                    onClick={handleAddCalendarEvent}
                    style={{ backgroundColor: '#7DD3C0', color: 'white' }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Event
                  </Button>
                </div>
              </div>

              {/* Conflict Detection */}
              {newEvent.dateTime && checkConflicts(newEvent.dateTime).length > 0 && (
                <div className="mt-3 p-2 rounded bg-yellow-50 border border-yellow-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-800 font-medium">Schedule Conflict Detected!</p>
                      <p className="text-xs text-yellow-700">
                        {checkConflicts(newEvent.dateTime).length} event(s) scheduled within 1 hour
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
