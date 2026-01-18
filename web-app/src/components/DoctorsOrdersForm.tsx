import React, { useState } from "react";
import {
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Plus,
  X,
  Clock,
  AlertCircle,
  Pill,
  Utensils,
  ClipboardList,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { MedicalCalendar } from "./MedicalCalendar";
import type { DoctorsOrdersData } from "../types";

interface DoctorsOrdersFormProps {
  initialData?: DoctorsOrdersData;
  onChange: (data: DoctorsOrdersData) => void;
}

export const DoctorsOrdersForm: React.FC<
  DoctorsOrdersFormProps
> = ({ initialData, onChange }) => {
  const [formData, setFormData] = useState<DoctorsOrdersData>(
    initialData || {
      vitalSignThresholds: {
        heartRateHigh: 120,
        heartRateLow: 60,
        spo2Floor: 92,
        temperatureCeiling: 38.5,
        aiSensitivity: "medium",
      },
      medications: [],
      activityOrders: {
        turningSchedule: "",
        turningFrequency: "",
        turningPattern: "",
        ambulationGoals: "",
        dietaryOrders: "",
        fluidIntakeGoal: "",
      },
      monitoringOrders: {
        checkupFrequency: "",
        labSchedule: "",
        observationFocus: "",
      },
      calendarEvents: [],
    },
  );

  const [newMedication, setNewMedication] = useState({
    name: "",
    dosage: "",
    frequency: "",
    instructions: "",
    prn: false,
    prnCondition: "",
    refillThreshold: "",
    times: [] as string[],
  });

  const [newMedicationTime, setNewMedicationTime] =
    useState("");

  const updateFormData = (
    updates: Partial<DoctorsOrdersData>,
  ) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);
    onChange(newData);
  };

  const addMedication = () => {
    if (
      !newMedication.name ||
      !newMedication.dosage ||
      !newMedication.frequency
    )
      return;

    const medication = {
      id: `med-${Date.now()}`,
      ...newMedication,
    };

    updateFormData({
      medications: [...formData.medications, medication],
    });

    // Reset form
    setNewMedication({
      name: "",
      dosage: "",
      frequency: "",
      instructions: "",
      prn: false,
      prnCondition: "",
      refillThreshold: "",
      times: [],
    });
  };

  const removeMedication = (id: string) => {
    updateFormData({
      medications: formData.medications.filter(
        (m) => m.id !== id,
      ),
    });
  };

  const addMedicationTime = () => {
    if (!newMedicationTime) return;
    setNewMedication({
      ...newMedication,
      times: [...newMedication.times, newMedicationTime],
    });
    setNewMedicationTime("");
  };

  const removeMedicationTime = (index: number) => {
    setNewMedication({
      ...newMedication,
      times: newMedication.times.filter((_, i) => i !== index),
    });
  };

  const addCalendarEvent = (
    event: Omit<DoctorsOrdersData["calendarEvents"][0], "id">,
  ) => {
    const newEvent = {
      id: `event-${Date.now()}`,
      ...event,
    };
    updateFormData({
      calendarEvents: [...formData.calendarEvents, newEvent],
    });
  };

  const removeCalendarEvent = (id: string) => {
    updateFormData({
      calendarEvents: formData.calendarEvents.filter(
        (e) => e.id !== id,
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Vital Sign Thresholds */}
      <Card
        className="border-0"
        style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)" }}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity
              className="w-5 h-5"
              style={{ color: "#E74C3C" }}
            />
            <CardTitle style={{ color: "#2C3E50" }}>
              1. Vital Sign Thresholds (AI Configuration)
            </CardTitle>
          </div>
          <CardDescription>
            Set specific trigger points for automated alerts and
            AI anomaly detection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <Heart
                  className="w-4 h-4"
                  style={{ color: "#E74C3C" }}
                />
                Heart Rate - High Limit (Tachycardia)
              </Label>
              <Input
                type="number"
                value={
                  formData.vitalSignThresholds.heartRateHigh
                }
                onChange={(e) =>
                  updateFormData({
                    vitalSignThresholds: {
                      ...formData.vitalSignThresholds,
                      heartRateHigh: Number(e.target.value),
                    },
                  })
                }
                placeholder="e.g., 120"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "#7F8C8D" }}
              >
                Alert if heart rate exceeds this value
              </p>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Heart
                  className="w-4 h-4"
                  style={{ color: "#3498DB" }}
                />
                Heart Rate - Low Limit (Bradycardia)
              </Label>
              <Input
                type="number"
                value={
                  formData.vitalSignThresholds.heartRateLow
                }
                onChange={(e) =>
                  updateFormData({
                    vitalSignThresholds: {
                      ...formData.vitalSignThresholds,
                      heartRateLow: Number(e.target.value),
                    },
                  })
                }
                placeholder="e.g., 60"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "#7F8C8D" }}
              >
                Alert if heart rate falls below this value
              </p>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Activity
                  className="w-4 h-4"
                  style={{ color: "#3498DB" }}
                />
                SpO₂ Floor (Oxygen Level)
              </Label>
              <Input
                type="number"
                value={formData.vitalSignThresholds.spo2Floor}
                onChange={(e) =>
                  updateFormData({
                    vitalSignThresholds: {
                      ...formData.vitalSignThresholds,
                      spo2Floor: Number(e.target.value),
                    },
                  })
                }
                placeholder="e.g., 92"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "#7F8C8D" }}
              >
                Emergency alarm if SpO₂ drops below this %
              </p>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Thermometer
                  className="w-4 h-4"
                  style={{ color: "#F39C12" }}
                />
                Temperature Ceiling (Fever Threshold)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={
                  formData.vitalSignThresholds
                    .temperatureCeiling
                }
                onChange={(e) =>
                  updateFormData({
                    vitalSignThresholds: {
                      ...formData.vitalSignThresholds,
                      temperatureCeiling: Number(
                        e.target.value,
                      ),
                    },
                  })
                }
                placeholder="e.g., 38.5"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "#7F8C8D" }}
              >
                Alert when temperature exceeds this °C
              </p>
            </div>
          </div>

          <div>
            <Label>
              AI Sensitivity (OC-SVM Anomaly Detection)
            </Label>
            <div className="flex items-center gap-4 mt-2">
              <Slider
                value={[
                  formData.vitalSignThresholds.aiSensitivity ===
                  "low"
                    ? 1
                    : formData.vitalSignThresholds
                          .aiSensitivity === "medium"
                      ? 2
                      : 3,
                ]}
                onValueChange={(values) => {
                  const sensitivity =
                    values[0] === 1
                      ? "low"
                      : values[0] === 2
                        ? "medium"
                        : "high";
                  updateFormData({
                    vitalSignThresholds: {
                      ...formData.vitalSignThresholds,
                      aiSensitivity: sensitivity,
                    },
                  });
                }}
                max={3}
                min={1}
                step={1}
                className="flex-1"
              />
              <span
                className="text-sm px-3 py-1 rounded-full"
                style={{
                  backgroundColor:
                    formData.vitalSignThresholds
                      .aiSensitivity === "high"
                      ? "#E74C3C"
                      : formData.vitalSignThresholds
                            .aiSensitivity === "medium"
                        ? "#F39C12"
                        : "#2ECC71",
                  color: "white",
                }}
              >
                {formData.vitalSignThresholds.aiSensitivity.toUpperCase()}
              </span>
            </div>
            <div
              className="flex justify-between text-xs mt-2"
              style={{ color: "#7F8C8D" }}
            >
              <span>Low (Stable patients)</span>
              <span>Medium (Standard)</span>
              <span>High (Critical patients)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Medication & Treatment Orders */}
      <Card
        className="border-0"
        style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)" }}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <Pill
              className="w-5 h-5"
              style={{ color: "#9B59B6" }}
            />
            <CardTitle style={{ color: "#2C3E50" }}>
              2. Medication & Treatment Orders
            </CardTitle>
          </div>
          <CardDescription>
            Prescription details that will generate caregiver
            medication alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Medications */}
          {formData.medications.length > 0 && (
            <div className="space-y-2">
              {formData.medications.map((med) => (
                <div
                  key={med.id}
                  className="flex items-start gap-3 p-3 rounded-lg"
                  style={{
                    backgroundColor: "#F8F9FA",
                    border: "1px solid #E9ECEF",
                  }}
                >
                  <Pill
                    className="w-4 h-4 mt-1"
                    style={{ color: "#9B59B6" }}
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div
                          className="text-sm"
                          style={{ color: "#2C3E50" }}
                        >
                          <strong>{med.name}</strong> -{" "}
                          {med.dosage}
                        </div>
                        <div
                          className="text-xs mt-1"
                          style={{ color: "#7F8C8D" }}
                        >
                          Frequency: {med.frequency}
                        </div>
                        {med.times.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {med.times.map((time, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-0.5 rounded"
                                style={{
                                  backgroundColor: "#E8F6F3",
                                  color: "#2C3E50",
                                }}
                              >
                                {time}
                              </span>
                            ))}
                          </div>
                        )}
                        {med.instructions && (
                          <div
                            className="text-xs mt-1"
                            style={{ color: "#7F8C8D" }}
                          >
                            Instructions: {med.instructions}
                          </div>
                        )}
                        {med.prn && (
                          <div
                            className="text-xs mt-1 px-2 py-1 rounded inline-block"
                            style={{
                              backgroundColor: "#FFF3CD",
                              color: "#856404",
                            }}
                          >
                            PRN: {med.prnCondition}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMedication(med.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X
                          className="w-4 h-4"
                          style={{ color: "#E74C3C" }}
                        />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Medication */}
          <div
            className="p-4 rounded-lg space-y-3"
            style={{
              backgroundColor: "#F0F3FF",
              border: "2px dashed #9B59B6",
            }}
          >
            <h4
              className="text-sm"
              style={{ color: "#2C3E50" }}
            >
              Add New Medication
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Medication Name</Label>
                <Input
                  value={newMedication.name}
                  onChange={(e) =>
                    setNewMedication({
                      ...newMedication,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g., Paracetamol"
                />
              </div>

              <div>
                <Label>Dosage</Label>
                <Input
                  value={newMedication.dosage}
                  onChange={(e) =>
                    setNewMedication({
                      ...newMedication,
                      dosage: e.target.value,
                    })
                  }
                  placeholder="e.g., 500mg"
                />
              </div>

              <div>
                <Label>Frequency</Label>
                <Input
                  value={newMedication.frequency}
                  onChange={(e) =>
                    setNewMedication({
                      ...newMedication,
                      frequency: e.target.value,
                    })
                  }
                  placeholder="e.g., 3x a day"
                />
              </div>

              <div>
                <Label>Administration Times</Label>
                <div className="flex gap-1">
                  <Input
                    type="time"
                    value={newMedicationTime}
                    onChange={(e) =>
                      setNewMedicationTime(e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={addMedicationTime}
                    style={{
                      backgroundColor: "#7DD3C0",
                      color: "white",
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {newMedication.times.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {newMedication.times.map((time, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 rounded flex items-center gap-1"
                        style={{
                          backgroundColor: "#E8F6F3",
                          color: "#2C3E50",
                        }}
                      >
                        {time}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() =>
                            removeMedicationTime(idx)
                          }
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <Label>Administration Instructions</Label>
                <Input
                  value={newMedication.instructions}
                  onChange={(e) =>
                    setNewMedication({
                      ...newMedication,
                      instructions: e.target.value,
                    })
                  }
                  placeholder="e.g., Take after meals, Do not crush"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={newMedication.prn}
                    onCheckedChange={(checked) =>
                      setNewMedication({
                        ...newMedication,
                        prn: checked as boolean,
                      })
                    }
                  />
                  <Label>PRN (As Needed)</Label>
                </div>
                {newMedication.prn && (
                  <Input
                    value={newMedication.prnCondition}
                    onChange={(e) =>
                      setNewMedication({
                        ...newMedication,
                        prnCondition: e.target.value,
                      })
                    }
                    placeholder="e.g., Give if temperature exceeds 38.5°C"
                  />
                )}
              </div>

              <div className="col-span-2">
                <Label>Refill Threshold</Label>
                <Input
                  value={newMedication.refillThreshold}
                  onChange={(e) =>
                    setNewMedication({
                      ...newMedication,
                      refillThreshold: e.target.value,
                    })
                  }
                  placeholder="e.g., Notify when 3 days supply remaining"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={addMedication}
                style={{
                  backgroundColor: "#9B59B6",
                  color: "white",
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Medication
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Activity & Positioning Orders */}
      <Card
        className="border-0"
        style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)" }}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <Utensils
              className="w-5 h-5"
              style={{ color: "#16A085" }}
            />
            <CardTitle style={{ color: "#2C3E50" }}>
              3. Activity & Positioning Orders
            </CardTitle>
          </div>
          <CardDescription>
            Care instructions for bedridden patients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Turning Schedule</Label>
              <Input
                value={
                  formData.activityOrders.turningSchedule || ""
                }
                onChange={(e) =>
                  updateFormData({
                    activityOrders: {
                      ...formData.activityOrders,
                      turningSchedule: e.target.value,
                    },
                  })
                }
                placeholder="e.g., Every 2 hours"
              />
            </div>

            <div>
              <Label>Turning Pattern</Label>
              <Input
                value={
                  formData.activityOrders.turningPattern || ""
                }
                onChange={(e) =>
                  updateFormData({
                    activityOrders: {
                      ...formData.activityOrders,
                      turningPattern: e.target.value,
                    },
                  })
                }
                placeholder="e.g., Left-Back-Right rotation"
              />
            </div>

            <div className="col-span-2">
              <Label>Ambulation Goals</Label>
              <Textarea
                value={
                  formData.activityOrders.ambulationGoals || ""
                }
                onChange={(e) =>
                  updateFormData({
                    activityOrders: {
                      ...formData.activityOrders,
                      ambulationGoals: e.target.value,
                    },
                  })
                }
                placeholder="e.g., Assist patient to sit in chair for 15 minutes twice daily"
                rows={2}
              />
            </div>

            <div>
              <Label>Dietary Orders</Label>
              <Input
                value={
                  formData.activityOrders.dietaryOrders || ""
                }
                onChange={(e) =>
                  updateFormData({
                    activityOrders: {
                      ...formData.activityOrders,
                      dietaryOrders: e.target.value,
                    },
                  })
                }
                placeholder="e.g., Low Salt, Soft Food"
              />
            </div>

            <div>
              <Label>Daily Fluid Intake Goal</Label>
              <Input
                value={
                  formData.activityOrders.fluidIntakeGoal || ""
                }
                onChange={(e) =>
                  updateFormData({
                    activityOrders: {
                      ...formData.activityOrders,
                      fluidIntakeGoal: e.target.value,
                    },
                  })
                }
                placeholder="e.g., 2 liters per day"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Monitoring & Laboratory Orders */}
      <Card
        className="border-0"
        style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)" }}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList
              className="w-5 h-5"
              style={{ color: "#3498DB" }}
            />
            <CardTitle style={{ color: "#2C3E50" }}>
              4. Monitoring & Laboratory Orders
            </CardTitle>
          </div>
          <CardDescription>
            Clinical monitoring and testing requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label>Check-up Frequency</Label>
              <Input
                value={
                  formData.monitoringOrders.checkupFrequency ||
                  ""
                }
                onChange={(e) =>
                  updateFormData({
                    monitoringOrders: {
                      ...formData.monitoringOrders,
                      checkupFrequency: e.target.value,
                    },
                  })
                }
                placeholder="e.g., Physical assessment once a week, Teleconsult every Monday"
              />
            </div>

            <div>
              <Label>Laboratory Schedule</Label>
              <Input
                value={
                  formData.monitoringOrders.labSchedule || ""
                }
                onChange={(e) =>
                  updateFormData({
                    monitoringOrders: {
                      ...formData.monitoringOrders,
                      labSchedule: e.target.value,
                    },
                  })
                }
                placeholder="e.g., Blood work every 2 weeks, Urinalysis monthly"
              />
            </div>

            <div>
              <Label>Observation Focus</Label>
              <Textarea
                value={
                  formData.monitoringOrders.observationFocus ||
                  ""
                }
                onChange={(e) =>
                  updateFormData({
                    monitoringOrders: {
                      ...formData.monitoringOrders,
                      observationFocus: e.target.value,
                    },
                  })
                }
                placeholder="e.g., Monitor for swelling in lower limbs, Watch for respiratory distress"
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Medical Calendar */}
      <MedicalCalendar
        events={formData.calendarEvents}
        onAddEvent={addCalendarEvent}
        onRemoveEvent={removeCalendarEvent}
      />
    </div>
  );
};