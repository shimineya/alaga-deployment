import React, { useState } from 'react';
import { Calendar, Clock, AlertTriangle, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface CalendarEvent {
  id: string;
  type: 'medication' | 'turning' | 'hygiene' | 'checkup' | 'lab' | 'refill';
  title: string;
  description?: string;
  dateTime: Date;
  recurring?: 'daily' | 'weekly' | 'every2hours' | 'every4hours';
  color: string;
}

interface MedicalCalendarProps {
  events: CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onRemoveEvent: (id: string) => void;
}

const eventTypeColors = {
  medication: '#E74C3C',
  checkup: '#2ECC71',
  lab: '#2ECC71',
  turning: '#3498DB',
  hygiene: '#3498DB',
  refill: '#F39C12'
};

const eventTypeLabels = {
  medication: '🔴 Medication',
  checkup: '🟢 Check-up',
  lab: '🟢 Lab Test',
  turning: '🔵 Turning/Positioning',
  hygiene: '🔵 Hygiene',
  refill: '🟠 Refill Reminder'
};

export const MedicalCalendar: React.FC<MedicalCalendarProps> = ({ events, onAddEvent, onRemoveEvent }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    type: 'medication' as const,
    title: '',
    description: '',
    dateTime: '',
    time: '',
    recurring: '' as '' | 'daily' | 'weekly' | 'every2hours' | 'every4hours'
  });

  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.dateTime || !newEvent.time) return;

    const dateTimeString = `${newEvent.dateTime}T${newEvent.time}`;
    const eventData = {
      type: newEvent.type,
      title: newEvent.title,
      description: newEvent.description,
      dateTime: new Date(dateTimeString),
      recurring: newEvent.recurring || undefined,
      color: eventTypeColors[newEvent.type]
    };

    onAddEvent(eventData);
    setNewEvent({
      type: 'medication',
      title: '',
      description: '',
      dateTime: '',
      time: '',
      recurring: ''
    });
    setShowAddForm(false);
  };

  // Detect conflicts (events within same hour)
  const detectConflicts = () => {
    const conflicts: string[] = [];
    const sortedEvents = [...events].sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const current = sortedEvents[i];
      const next = sortedEvents[i + 1];
      const timeDiff = Math.abs(next.dateTime.getTime() - current.dateTime.getTime());
      
      // If events are within 1 hour
      if (timeDiff < 60 * 60 * 1000) {
        const conflictKey = `${current.id}-${next.id}`;
        if (!conflicts.includes(conflictKey)) {
          conflicts.push(conflictKey);
        }
      }
    }

    return conflicts;
  };

  const conflicts = detectConflicts();

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = event.dateTime.toISOString().split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  return (
    <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: '#7DD3C0' }} />
            <CardTitle style={{ color: '#2C3E50' }}>Medical Calendar</CardTitle>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            size="sm"
            style={{ backgroundColor: '#7DD3C0', color: 'white' }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Event
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conflict Warning */}
        {conflicts.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#FFF3CD', border: '1px solid #F39C12' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#F39C12' }} />
            <div>
              <p className="text-sm" style={{ color: '#856404' }}>
                <strong>Schedule Conflict Detected!</strong> Some events are scheduled within the same hour. Please review and adjust timing.
              </p>
            </div>
          </div>
        )}

        {/* Add Event Form */}
        {showAddForm && (
          <div className="p-4 rounded-lg space-y-3" style={{ backgroundColor: '#E8F6F3', border: '2px solid #7DD3C0' }}>
            <div className="flex items-center justify-between">
              <h4 className="font-medium" style={{ color: '#2C3E50' }}>Add Calendar Event</h4>
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Event Type</Label>
                <Select value={newEvent.type} onValueChange={(value: any) => setNewEvent({ ...newEvent, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medication">{eventTypeLabels.medication}</SelectItem>
                    <SelectItem value="turning">{eventTypeLabels.turning}</SelectItem>
                    <SelectItem value="hygiene">{eventTypeLabels.hygiene}</SelectItem>
                    <SelectItem value="checkup">{eventTypeLabels.checkup}</SelectItem>
                    <SelectItem value="lab">{eventTypeLabels.lab}</SelectItem>
                    <SelectItem value="refill">{eventTypeLabels.refill}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Recurring</Label>
                <Select value={newEvent.recurring} onValueChange={(value: any) => setNewEvent({ ...newEvent, recurring: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="One-time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="every2hours">Every 2 Hours</SelectItem>
                    <SelectItem value="every4hours">Every 4 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>Title</Label>
                <Input
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="e.g., Paracetamol 500mg"
                />
              </div>

              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newEvent.dateTime}
                  onChange={(e) => setNewEvent({ ...newEvent, dateTime: e.target.value })}
                />
              </div>

              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <Label>Description (Optional)</Label>
                <Input
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Additional instructions..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button onClick={handleAddEvent} style={{ backgroundColor: '#7DD3C0', color: 'white' }}>
                Add Event
              </Button>
            </div>
          </div>
        )}

        {/* Calendar View */}
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-xs" style={{ color: '#7F8C8D' }}>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#E74C3C' }}></div>
              <span>Critical/Medication</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3498DB' }}></div>
              <span>Routine Care</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2ECC71' }}></div>
              <span>Clinical</span>
            </div>
          </div>

          {Object.keys(groupedEvents).length === 0 ? (
            <div className="text-center py-8" style={{ color: '#95A5A6' }}>
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No scheduled events yet</p>
              <p className="text-sm">Click "Add Event" to start scheduling</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {Object.entries(groupedEvents)
                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                .map(([date, dayEvents]) => (
                  <div key={date} className="space-y-2">
                    <div className="text-sm" style={{ color: '#2C3E50' }}>
                      <strong>{new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                    </div>
                    <div className="space-y-2">
                      {dayEvents
                        .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
                        .map((event) => (
                          <div
                            key={event.id}
                            className="flex items-start gap-3 p-3 rounded-lg"
                            style={{
                              backgroundColor: `${event.color}15`,
                              borderLeft: `4px solid ${event.color}`
                            }}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-4 h-4" style={{ color: event.color }} />
                                <span className="text-sm" style={{ color: '#2C3E50' }}>
                                  {event.dateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {event.recurring && (
                                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: event.color, color: 'white' }}>
                                    {event.recurring}
                                  </span>
                                )}
                              </div>
                              <div style={{ color: '#2C3E50' }}>
                                <div className="text-sm">{event.title}</div>
                                {event.description && (
                                  <div className="text-xs mt-1" style={{ color: '#7F8C8D' }}>{event.description}</div>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemoveEvent(event.id)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="w-4 h-4" style={{ color: '#E74C3C' }} />
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
