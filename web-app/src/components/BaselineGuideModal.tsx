import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Heart, Thermometer, Droplets, Activity, Check, BookOpen, ShieldCheck } from 'lucide-react';

export interface BaselinePreset {
    heartRate: number;
    temperature: number;
    spo2: number;
    moistureThreshold: number;
}

interface BaselineGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyPreset?: (preset: BaselinePreset) => void;
}

export const PRESETS: { id: string; label: string; ageGroup: string; color: string; desc: string; values: BaselinePreset }[] = [
    {
        id: 'adult',
        label: 'Adult Standard',
        ageGroup: 'Ages 18 - 65',
        color: 'teal',
        desc: 'Standard healthy adult eucardic baseline with normal thermoregulation.',
        values: { heartRate: 75, temperature: 36.8, spo2: 98, moistureThreshold: 30 }
    },
    {
        id: 'pediatric',
        label: 'Pediatric / Infant',
        ageGroup: 'Ages 0 - 17',
        color: 'sky',
        desc: 'Higher normal resting cardiac frequency with strict moisture monitoring.',
        values: { heartRate: 110, temperature: 36.9, spo2: 98, moistureThreshold: 30 }
    },
    {
        id: 'geriatric',
        label: 'Geriatric / Elderly',
        ageGroup: 'Ages 65+',
        color: 'indigo',
        desc: 'Lower resting metabolic rate and gentle skin protection baseline.',
        values: { heartRate: 70, temperature: 36.4, spo2: 96, moistureThreshold: 25 }
    }
];

export const BaselineGuideModal: React.FC<BaselineGuideModalProps> = ({ isOpen, onClose, onApplyPreset }) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-xl rounded-2xl">
                <DialogHeader className="px-6 py-4 bg-gradient-to-r from-teal-50 via-slate-50 to-blue-50 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-teal-600 text-white rounded-lg shadow-sm">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                Clinical Baseline Reference Guide
                                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                                    Standard Guide
                                </span>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Standard physiological baseline reference ranges across patient demographic cohorts.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                    {/* Clinical Standard Ranges Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl border border-rose-100 bg-rose-50/50">
                            <div className="flex items-center gap-1.5 text-rose-700 mb-1">
                                <Heart className="w-4 h-4" />
                                <span className="text-xs font-bold">Heart Rate</span>
                            </div>
                            <div className="text-lg font-black text-rose-950">60 - 100</div>
                            <div className="text-[10px] text-rose-600 font-medium">BPM (Resting eucardia)</div>
                        </div>

                        <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/50">
                            <div className="flex items-center gap-1.5 text-amber-700 mb-1">
                                <Thermometer className="w-4 h-4" />
                                <span className="text-xs font-bold">Temperature</span>
                            </div>
                            <div className="text-lg font-black text-amber-950">36.5 - 37.5</div>
                            <div className="text-[10px] text-amber-600 font-medium">°C (Normothermia)</div>
                        </div>

                        <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/50">
                            <div className="flex items-center gap-1.5 text-blue-700 mb-1">
                                <Activity className="w-4 h-4" />
                                <span className="text-xs font-bold">SpO₂ Oxygen</span>
                            </div>
                            <div className="text-lg font-black text-blue-950">95 - 100%</div>
                            <div className="text-[10px] text-blue-600 font-medium">Optimal arterial sat.</div>
                        </div>

                        <div className="p-3 rounded-xl border border-cyan-100 bg-cyan-50/50">
                            <div className="flex items-center gap-1.5 text-cyan-700 mb-1">
                                <Droplets className="w-4 h-4" />
                                <span className="text-xs font-bold">Moisture Limit</span>
                            </div>
                            <div className="text-lg font-black text-cyan-950">&lt; 30%</div>
                            <div className="text-[10px] text-cyan-600 font-medium">Dry diaper baseline</div>
                        </div>
                    </div>

                    {/* Presets by Cohort */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-teal-600" />
                                Standard Cohort Baselines & Quick Presets
                            </h4>
                            <span className="text-[11px] text-slate-400">Click a preset to auto-fill form</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {PRESETS.map((preset) => (
                                <div 
                                    key={preset.id}
                                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-teal-400 hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-xs font-bold text-slate-800">{preset.label}</h5>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                                                {preset.ageGroup}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                            {preset.desc}
                                        </p>
                                        <div className="mt-3 space-y-1 text-[11px] bg-white p-2 rounded-lg border border-slate-100 font-medium text-slate-700">
                                            <div className="flex justify-between"><span>HR Baseline:</span> <span className="font-bold">{preset.values.heartRate} bpm</span></div>
                                            <div className="flex justify-between"><span>Temp Baseline:</span> <span className="font-bold">{preset.values.temperature} °C</span></div>
                                            <div className="flex justify-between"><span>SpO₂ Baseline:</span> <span className="font-bold">{preset.values.spo2} %</span></div>
                                            <div className="flex justify-between"><span>Moisture Limit:</span> <span className="font-bold">{preset.values.moistureThreshold} %</span></div>
                                        </div>
                                    </div>

                                    {onApplyPreset && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="mt-3 w-full h-7 text-xs border-teal-500 text-teal-700 hover:bg-teal-50 font-semibold"
                                            onClick={() => {
                                                onApplyPreset(preset.values);
                                                onClose();
                                            }}
                                        >
                                            <Check className="w-3 h-3 mr-1" />
                                            Apply {preset.label.split(' ')[0]} Preset
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Clinical Guidance Footnote */}
                    <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 text-[11px] text-slate-600 leading-relaxed space-y-1">
                        <p className="font-bold text-slate-700">Clinical Application Note:</p>
                        <p>
                            • Personalized baselines establish the center-point for ALAGA's OC-SVM AI anomaly detection.
                        </p>
                        <p>
                            • If a patient has known chronic conditions (e.g., chronic bradycardia, low resting SpO₂ due to COPD), set their customized baseline values here to minimize false-positive notifications.
                        </p>
                    </div>
                </div>

                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <Button
                        type="button"
                        onClick={onClose}
                        className="h-8 px-4 text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900"
                    >
                        Close Guide
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
