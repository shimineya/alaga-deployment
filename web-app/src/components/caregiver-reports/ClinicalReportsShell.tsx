import React, { useState, useMemo } from 'react';
import { Patient, VitalSign, Alert } from '../../types';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
    Search,
    User,
    Wifi,
    WifiOff,
    FileBarChart,
    ActivitySquare,
    Droplets,
    LineChart,
    Download,
    Heart,
    Thermometer,
    Activity,
} from 'lucide-react';

import { DailyHealthSummary } from './DailyHealthSummary';
import { AnomalyLog } from './AnomalyLog';
import { MoistureHygieneTracker } from './MoistureHygieneTracker';
import { WeeklyTrendAnalysis } from './WeeklyTrendAnalysis';
import { ExportableHealthReport } from './ExportableHealthReport';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ClinicalReportsShellProps {
    patients: Patient[];
    vitalSigns: VitalSign[];
    alerts: Alert[];
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
function getStatusBadge(patient: Patient, alerts: Alert[]) {
    const hasCritical = alerts.some(
        (a) => a.patientId === patient.id && a.severity === 'critical' && !a.acknowledged
    );
    const hasWarning = alerts.some(
        (a) => a.patientId === patient.id && a.severity === 'warning' && !a.acknowledged
    );
    if (hasCritical)
        return { label: 'Critical', className: 'bg-red-100 text-red-700 border-red-200' };
    if (hasWarning)
        return { label: 'Warning', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    if (!patient.deviceConnected)
        return { label: 'Offline', className: 'bg-slate-100 text-slate-500' };
    return { label: 'Stable', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
}

// ---------------------------------------------------------------------------
// Patient List Panel
// ---------------------------------------------------------------------------
interface PatientPanelItemProps {
    patient: Patient;
    alerts: Alert[];
    vitalSigns: VitalSign[];
    isSelected: boolean;
    onClick: () => void;
}

const PatientPanelItem: React.FC<PatientPanelItemProps> = ({
    patient,
    alerts,
    vitalSigns,
    isSelected,
    onClick,
}) => {
    const status = getStatusBadge(patient, alerts);
    const latestVital = useMemo(() => {
        const pvitals = vitalSigns.filter((v) => v.patientId === patient.id);
        return pvitals.length > 0 ? pvitals[pvitals.length - 1] : null;
    }, [vitalSigns, patient.id]);

    return (
        <button
            type="button"
            id={`patient-report-item-${patient.id}`}
            onClick={onClick}
            className={`
                w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-teal-400
                ${isSelected
                    ? 'bg-teal-50 border-teal-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
            `}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-teal-800' : 'text-slate-800'}`}>
                        {patient.name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                        Room {patient.roomNumber || 'N/A'} &middot; ID: {patient.id}
                    </p>
                </div>
                <Badge
                    variant="outline"
                    className={`text-[10px] h-5 flex-shrink-0 border ${status.className}`}
                >
                    {status.label}
                </Badge>
            </div>

            {/* Mini vitals row — shows at a glance without needing to open the report */}
            <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                    <Heart className="w-2.5 h-2.5 text-rose-400 flex-shrink-0" />
                    {latestVital ? Math.round(latestVital.heartRate) : '--'}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                    <Thermometer className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                    {latestVital ? `${latestVital.temperature.toFixed(1)}°` : '--'}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                    <Activity className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />
                    {latestVital ? `${Math.round(latestVital.spo2)}%` : '--'}
                </span>
                <span className="ml-auto">
                    {patient.deviceConnected
                        ? <Wifi className="w-2.5 h-2.5 text-emerald-500" />
                        : <WifiOff className="w-2.5 h-2.5 text-slate-300" />
                    }
                </span>
            </div>
        </button>
    );
};

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------
const REPORT_TABS = [
    {
        value: 'daily-summary',
        label: 'Daily Summary',
        icon: FileBarChart,
        tooltip: 'At-a-glance vitals average from the last 24 hours.',
        accentColor: 'amber',
    },
    {
        value: 'anomaly-log',
        label: 'Anomaly Log',
        icon: ActivitySquare,
        tooltip: 'AI-detected deviations from this patient\'s baseline vitals.',
        accentColor: 'red',
    },
    {
        value: 'moisture-tracker',
        label: 'Moisture Tracker',
        icon: Droplets,
        tooltip: 'Diaper status timeline and hygiene intervention history.',
        accentColor: 'teal',
    },
    {
        value: 'weekly-trends',
        label: 'Weekly Trends',
        icon: LineChart,
        tooltip: '7-day aggregated averages for long-term health monitoring.',
        accentColor: 'blue',
    },
    {
        value: 'export',
        label: 'Export (PDF)',
        icon: Download,
        tooltip: 'Download an official health summary formatted for doctor review.',
        accentColor: 'slate',
    },
] as const;

type ReportTabValue = typeof REPORT_TABS[number]['value'];

// ---------------------------------------------------------------------------
// Empty State (no patient selected)
// ---------------------------------------------------------------------------
const NoPatientSelected: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-6">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <User className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No patient selected</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
            Select a patient from the list on the left to view their {label}.
        </p>
    </div>
);

// ---------------------------------------------------------------------------
// Main Shell Component
// ---------------------------------------------------------------------------
export const ClinicalReportsShell: React.FC<ClinicalReportsShellProps> = ({
    patients,
    vitalSigns,
    alerts,
}) => {
    const [activePatientId, setActivePatientId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<ReportTabValue>('daily-summary');
    const [searchQuery, setSearchQuery] = useState('');

    // [OWASP A01 / DPA] Filter only active (non-archived, non-deleted) patients.
    // The caregiver only ever sees their own assigned patients because the backend
    // already enforces that via patient_access table queries.
    const activePatients = useMemo(
        () => patients.filter((p) => !p.deleted && !p.archived),
        [patients]
    );

    const filteredPatients = useMemo(
        () =>
            activePatients.filter(
                (p) =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        [activePatients, searchQuery]
    );

    const selectedPatient = useMemo(
        () => activePatients.find((p) => p.id === activePatientId) ?? null,
        [activePatients, activePatientId]
    );

    const currentTabConfig = REPORT_TABS.find((t) => t.value === activeTab)!;

    // Dummy passthrough: report components still accept onSelectPatient prop
    // but since selection is managed here, we just keep it as a no-op.
    const noop = () => {};

    return (
        <div
            className="flex h-full gap-0 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm"
            style={{ minHeight: '600px' }}
        >
            {/* ============================== LEFT PANEL — Patient List ============================== */}
            <aside className="w-[260px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-slate-50/60">
                {/* Header */}
                <div className="px-3 py-3 border-b border-slate-200 bg-white">
                    <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                        Patients
                    </h2>
                    {/* Search bar */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                            id="clinical-reports-patient-search"
                            placeholder="Search name or room..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs border-slate-200 bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                        {filteredPatients.length} of {activePatients.length} patient{activePatients.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* Scrollable patient list */}
                <ScrollArea className="flex-1 px-2 py-2">
                    {filteredPatients.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-8 px-2">
                            {searchQuery
                                ? 'No patients match your search.'
                                : 'No patients assigned yet.'}
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {filteredPatients.map((patient) => (
                                <PatientPanelItem
                                    key={patient.id}
                                    patient={patient}
                                    alerts={alerts}
                                    vitalSigns={vitalSigns}
                                    isSelected={activePatientId === patient.id}
                                    onClick={() => setActivePatientId(patient.id)}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </aside>

            {/* ============================== RIGHT PANEL — Report View ============================== */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Report header — shows selected patient identity */}
                <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-4 flex-shrink-0">
                    <div className="min-w-0">
                        {selectedPatient ? (
                            <>
                                <h2 className="text-sm font-bold text-slate-800 truncate">
                                    {selectedPatient.name}
                                </h2>
                                <p className="text-[10px] text-slate-400">
                                    Room {selectedPatient.roomNumber || 'N/A'} &middot; ID: {selectedPatient.id}
                                    {selectedPatient.assignedCaregiverName
                                        ? ` · Caregiver: ${selectedPatient.assignedCaregiverName}`
                                        : ''}
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-slate-400 italic">Select a patient to begin</p>
                        )}
                    </div>
                    {selectedPatient && (
                        <Badge
                            variant="outline"
                            className={`text-[10px] flex-shrink-0 border ${getStatusBadge(selectedPatient, alerts).className}`}
                        >
                            {getStatusBadge(selectedPatient, alerts).label}
                        </Badge>
                    )}
                </div>

                {/* Report tabs */}
                <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as ReportTabValue)}
                    className="flex flex-col flex-1 min-h-0"
                >
                    <div className="border-b border-slate-200 px-4 bg-white flex-shrink-0">
                        <TooltipProvider delayDuration={300}>
                            <TabsList className="bg-transparent h-11 p-0 flex gap-1 justify-start overflow-x-auto scrollbar-none">
                                {REPORT_TABS.map(({ value, label, icon: Icon, tooltip }) => (
                                    <Tooltip key={value}>
                                        <TooltipTrigger asChild>
                                            <TabsTrigger
                                                value={value}
                                                id={`report-tab-${value}`}
                                                className="
                                                    data-[state=active]:bg-transparent
                                                    data-[state=active]:shadow-none
                                                    data-[state=active]:border-b-2
                                                    data-[state=active]:border-teal-500
                                                    rounded-none h-11 px-3 text-xs font-semibold
                                                    text-slate-500 data-[state=active]:text-teal-700
                                                    flex items-center gap-1.5 transition-all
                                                    hover:text-slate-700 whitespace-nowrap
                                                "
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {label}
                                            </TabsTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side="bottom"
                                            className="bg-slate-800 text-white border-none shadow-xl max-w-[200px]"
                                        >
                                            <p className="text-xs">{tooltip}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </TabsList>
                        </TooltipProvider>
                    </div>

                    {/* Tab content area — scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-5">
                            {/* Each report sub-component receives the selected patient ID.
                                The onSelectPatient prop is a no-op here because selection
                                is managed at the shell level (left panel). The embedded
                                ReportPatientPicker inside each component is hidden via CSS
                                using the [data-picker-hidden] pattern below — the pickers
                                still render but are not displayed.
                                NOTE: A future refactor should remove the pickers from each
                                sub-component entirely (Technical Debt marker). */}
                            <style>{`[data-report-picker] { display: none !important; }`}</style>

                            <TabsContent value="daily-summary" className="mt-0 data-[state=inactive]:hidden">
                                {selectedPatient ? (
                                    <DailyHealthSummary
                                        patients={activePatients}
                                        vitalSigns={vitalSigns}
                                        selectedPatientId={activePatientId}
                                        onSelectPatient={noop}
                                    />
                                ) : (
                                    <NoPatientSelected label="Daily Health Summary" />
                                )}
                            </TabsContent>

                            <TabsContent value="anomaly-log" className="mt-0 data-[state=inactive]:hidden">
                                {selectedPatient ? (
                                    <AnomalyLog
                                        patients={activePatients}
                                        alerts={alerts}
                                        selectedPatientId={activePatientId}
                                        onSelectPatient={noop}
                                    />
                                ) : (
                                    <NoPatientSelected label="Anomaly Log" />
                                )}
                            </TabsContent>

                            <TabsContent value="moisture-tracker" className="mt-0 data-[state=inactive]:hidden">
                                {selectedPatient ? (
                                    <MoistureHygieneTracker
                                        patients={activePatients}
                                        vitalSigns={vitalSigns}
                                        selectedPatientId={activePatientId}
                                        onSelectPatient={noop}
                                    />
                                ) : (
                                    <NoPatientSelected label="Moisture Tracker" />
                                )}
                            </TabsContent>

                            <TabsContent value="weekly-trends" className="mt-0 data-[state=inactive]:hidden">
                                {selectedPatient ? (
                                    <WeeklyTrendAnalysis
                                        patients={activePatients}
                                        vitalSigns={vitalSigns}
                                        selectedPatientId={activePatientId}
                                        onSelectPatient={noop}
                                    />
                                ) : (
                                    <NoPatientSelected label="Weekly Trends" />
                                )}
                            </TabsContent>

                            <TabsContent value="export" className="mt-0 data-[state=inactive]:hidden">
                                {selectedPatient ? (
                                    <ExportableHealthReport
                                        patients={activePatients}
                                        vitalSigns={vitalSigns}
                                        alerts={alerts}
                                        selectedPatientId={activePatientId}
                                        onSelectPatient={noop}
                                    />
                                ) : (
                                    <NoPatientSelected label="Data Export" />
                                )}
                            </TabsContent>
                        </div>
                    </div>
                </Tabs>
            </div>
        </div>
    );
};
