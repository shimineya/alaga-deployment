import React, { useState, useMemo } from 'react';
import { useAuth } from '../lib/auth-context';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
    BookOpen,
    Search,
    Heart,
    Thermometer,
    Droplets,
    Activity,
    Bell,
    Volume2,
    Sliders,
    Calendar,
    Wifi,
    Battery,
    Shield,
    FileText,
    Users,
    Cpu,
    CheckCircle2,
    AlertTriangle,
    Info,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Stethoscope,
    Building2,
    Server,
    ExternalLink
} from 'lucide-react';

type RoleCategory = 'caregiver' | 'medical_staff' | 'facility_admin' | 'system_admin';

interface ManualTopic {
    id: string;
    title: string;
    category: 'quickstart' | 'vitals' | 'alerts' | 'calibration' | 'devices' | 'clinical' | 'admin' | 'faq';
    icon: React.ComponentType<{ className?: string }>;
    summary: string;
    steps?: string[];
    tips?: string[];
    warning?: string;
}

export const UserManualButton: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { user, isSysAdmin } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'quickstart' | 'core' | 'alerts' | 'faq'>('all');
    const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

    // Determine default role perspective
    const rawRole = (user?.role || '').toLowerCase();
    const userRoleCategory: RoleCategory = useMemo(() => {
        if (isSysAdmin || rawRole === 'system_admin' || rawRole === 'admin' || rawRole === 'sysadmin') return 'system_admin';
        if (rawRole === 'facility_admin') return 'facility_admin';
        if (rawRole === 'medical_staff' || rawRole === 'medstaff') return 'medical_staff';
        return 'caregiver'; // Default to caregiver/parent
    }, [rawRole, isSysAdmin]);

    const [selectedRoleView, setSelectedRoleView] = useState<RoleCategory>(userRoleCategory);

    // Keep selected role view synced when user changes
    React.useEffect(() => {
        setSelectedRoleView(userRoleCategory);
    }, [userRoleCategory]);

    // Role-specific manual content
    const manualContent = useMemo(() => {
        const guides: Record<RoleCategory, {
            roleLabel: string;
            roleBadgeColor: string;
            roleDesc: string;
            quickStartSteps: { title: string; desc: string }[];
            topics: ManualTopic[];
        }> = {
            caregiver: {
                roleLabel: 'Caregiver & Parent Guide',
                roleBadgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
                roleDesc: 'Essential guide for monitoring your patient, understanding real-time health vitals, responding to alerts, and setting up comfort preferences.',
                quickStartSteps: [
                    { title: '1. Check Live Vitals', desc: 'Look at the 4 vital sign cards at the top (Heart Rate, Oxygen SpO₂, Skin Temperature, Diaper Wetness). Green means everything is normal.' },
                    { title: '2. Verify Sensor Status', desc: 'Ensure the sensor badge says "Streaming" or "Connected" with a healthy battery level (> 20%).' },
                    { title: '3. Respond to Alerts', desc: 'When an alert sounds, tap the notification to read the cause. Tap "Acknowledge" after you attend to the patient.' },
                    { title: '4. Schedule Care Tasks', desc: 'Use the Care Calendar to set reminders for feeding, diaper checks, and doctor-prescribed medications.' },
                ],
                topics: [
                    {
                        id: 'cg-vitals',
                        title: 'Understanding Vitals & Normal Ranges',
                        category: 'vitals',
                        icon: Heart,
                        summary: 'How to read the patient vital signs monitoring cards and understand what the colors mean.',
                        steps: [
                            'Heart Rate (HR): Normal resting range is 60 - 100 bpm. Green indicates normal, amber indicates mild elevation (e.g. crying or moving), and red indicates tachycardia (>130 bpm) or bradycardia (<50 bpm).',
                            'Oxygen Saturation (SpO₂): Normal range is 95% - 100%. If SpO₂ drops below 92%, an immediate warning will trigger. A reading below 90% is a critical medical event.',
                            'Skin Temperature: Healthy range is 36.5°C - 37.5°C. Fever warnings sound above 38.0°C; hypothermia warnings sound below 35.5°C.',
                            'Diaper Wetness: Monitored via conductive sensor strips. Dry (0-30%), Damp (31-69%), Wet (70%+). Prolonged wetness will notify you to change the diaper to prevent diaper dermatitis.'
                        ],
                        tips: [
                            'Vitals update in real-time over WebSocket every 2 to 5 seconds.',
                            'If the patient is moving around or crying vigorously, heart rate will temporarily elevate. Allow the patient to settle before suspecting an emergency.'
                        ],
                        warning: 'If Oxygen (SpO₂) drops below 90% or Heart Rate stays above 160 bpm while resting, attend to the patient immediately and notify attending medical staff.'
                    },
                    {
                        id: 'cg-alerts',
                        title: 'How to Handle Alerts (Acknowledge, Flag Normal, Mute)',
                        category: 'alerts',
                        icon: Bell,
                        summary: 'What to do when an alert chimes and how each button works.',
                        steps: [
                            'Acknowledge: Tap this when you have arrived at the bedside and are tending to the patient. It silences the alert and records that care was provided.',
                            'Flag Normal: Use this button if the alert was triggered by an expected non-emergency event (such as vigorous crying, warm bath, or active feeding). This teaches the AI algorithm not to over-react to false alarms in the future.',
                            'Mute: Temporarily silences the audio chime for 5 minutes while you change the diaper or adjust the sensor placement.'
                        ],
                        tips: [
                            'You can choose between "Gentle Chime" (softer sound for peaceful home care) or "High Urgency" (louder beep for noisy environments) in Settings > Alert Preferences.',
                            'All unacknowledged alerts will remain pinned to the top of your screen until addressed.'
                        ]
                    },
                    {
                        id: 'cg-calibration',
                        title: 'AI Baseline Calibration & Safety Nets',
                        category: 'calibration',
                        icon: Sliders,
                        summary: 'How the AI learns your patient’s personal baseline and when to recalibrate.',
                        steps: [
                            'What is Baseline Calibration? The system uses an One-Class SVM (OC-SVM) algorithm that observes your patient for 24 hours to learn their personal resting vitals.',
                            'When to click "Reset baseline": Tap this in Settings > Preferences whenever the patient has recovered from a fever, experienced a major growth spurt, or changed medication.',
                            'Threshold Safety Nets: Even while the AI is learning or recalibrating, hard safety limits (e.g. SpO₂ < 90% or HR > 150 bpm) will ALWAYS trigger an emergency alert.'
                        ],
                        tips: [
                            'Do not reset the baseline during an active fever, as this would teach the AI that high fever is normal.'
                        ]
                    },
                    {
                        id: 'cg-devices',
                        title: 'Smart Diaper & Sensor Troubleshooting',
                        category: 'devices',
                        icon: Cpu,
                        summary: 'Pairing, battery charging, and sensor connection guides.',
                        steps: [
                            'Checking Connection: Look for the WiFi signal icon. If it shows "Streaming", live monitoring is active. If it says "Waiting for device", the sensor is either asleep or out of range.',
                            'Battery Level: Recharge the sensor using the magnetic USB cable when battery drops below 20%. A full charge lasts 18-24 hours.',
                            'Attaching the Diaper Clip: Fasten the clip securely to the outer front fold of the diaper. Ensure the conductive sensing pads touch the absorbent core without pressing uncomfortably into the patient’s skin.'
                        ],
                        warning: 'Never submerge the main sensor module in water. Wipe clean with a 70% isopropyl alcohol wipe and let dry.'
                    },
                    {
                        id: 'cg-calendar',
                        title: 'Care Calendar & Medication Tasks',
                        category: 'quickstart',
                        icon: Calendar,
                        summary: 'Managing daily routines, feedings, medicine reminders, and doctor orders.',
                        steps: [
                            'Adding a Task: Open the Care Calendar, click "+ Add Care Task", specify the time, task type (Medication, Diaper Check, Feeding), and patient name.',
                            'Doctor Prescriptions: When medical staff write a doctor’s order, it automatically appears on your schedule with clinical instructions.',
                            'Completing Tasks: Click the checkmark beside the task once completed to record adherence.'
                        ]
                    },
                    {
                        id: 'cg-faq',
                        title: 'Frequently Asked Questions (FAQ)',
                        category: 'faq',
                        icon: Info,
                        summary: 'Common caregiver questions and quick solutions.',
                        steps: [
                            'Q: Why is the SpO₂ reading showing 0% or dashes?\nA: The optical pulse oximeter clip may have shifted or is not making full contact with warm skin. Reposition the sensor gently.',
                            'Q: Can I share access with another family member?\nA: Contact your Facility Administrator to link a secondary caregiver account to your patient.',
                            'Q: Does the app work without internet?\nA: Real-time monitoring requires connection to the local ward WiFi network or cloud server. If offline, the sensor device will beep locally for critical emergencies.'
                        ]
                    }
                ]
            },
            medical_staff: {
                roleLabel: 'Medical Staff & Clinical Guide',
                roleBadgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
                roleDesc: 'Clinical protocols for vital signs monitoring review, anomaly classification, issuing doctor’s orders, and exporting PHI health reports.',
                quickStartSteps: [
                    { title: '1. Review Ward Monitoring', desc: 'View live vital signs monitoring streams across assigned patients. Check for amber/red threshold alerts.' },
                    { title: '2. Triage Anomaly Log', desc: 'Inspect OC-SVM deviation events to differentiate motion artifacts from physiological distress.' },
                    { title: '3. Issue Doctor’s Orders', desc: 'Write medication schedules and clinical care directives that sync directly to caregiver rosters.' },
                    { title: '4. Export Clinical Summaries', desc: 'Generate PDF/CSV weekly trend reports and moisture exposure metrics for medical rounds.' },
                ],
                topics: [
                    {
                        id: 'med-triage',
                        title: 'Clinical Alert Triage & Response Protocol',
                        category: 'alerts',
                        icon: Bell,
                        summary: 'Hospital-grade triage steps for hypoxia, tachycardia, and moisture-associated skin damage (MASD).',
                        steps: [
                            'Critical Hypoxia (SpO₂ < 90%): Verify sensor perfusion index. If confirmed, initiate oxygen therapy per protocol and alert the attending physician.',
                            'Severe Tachycardia / Bradycardia: Check whether reading correlates with patient activity or pyrexia. Inspect ECG/vital waveform trends.',
                            'Clinical Acknowledgment: Click "Acknowledge" and append clinical observation notes. This audit trail is saved in the HIPAA-compliant forensic ledger.'
                        ],
                        warning: 'Always corroborate sensor alarms with physical patient bedside assessment before administering critical medication.'
                    },
                    {
                        id: 'med-orders',
                        title: 'Issuing Doctor’s Orders & Care Directives',
                        category: 'clinical',
                        icon: FileText,
                        summary: 'How to prescribe care tasks and medication regimens to assigned caregivers.',
                        steps: [
                            'Navigate to the Patient Profile > Doctor’s Orders tab.',
                            'Click "+ New Clinical Order". Specify medication name, dosage, frequency (e.g. Q8H, PRN), and administration instructions.',
                            'Set auto-alert threshold overrides if the patient has a known baseline condition (e.g. target SpO₂ 88-92% for chronic respiratory conditions).',
                            'Save the order. The caregiver’s dashboard will immediately display scheduled reminders and alarms.'
                        ]
                    },
                    {
                        id: 'med-reports',
                        title: 'Clinical Reports & EHR Exporting',
                        category: 'clinical',
                        icon: Stethoscope,
                        summary: 'Generating daily summaries, weekly trend analysis, and moisture hygiene trackers.',
                        steps: [
                            'Daily Health Summary: Shows 24-hour mean, min, and max values for SpO₂, HR, and Temperature.',
                            'Moisture Hygiene Tracker: Displays prolonged diaper wetness exposure time (in minutes) to prevent skin breakdown.',
                            'Weekly Trend Analysis: Multi-day regression charts showing recovery trajectories or deteriorating patterns.',
                            'Exporting: Click "Export PDF" or "Export CSV" to archive records or transfer to your hospital EHR system.'
                        ]
                    },
                    {
                        id: 'med-faq',
                        title: 'Clinical FAQ & Gotchas',
                        category: 'faq',
                        icon: Info,
                        summary: 'Clinical questions regarding OC-SVM machine learning and artifact filtration.',
                        steps: [
                            'Q: How does ALAGA handle motion artifacts?\nA: The firmware incorporates 3-axis accelerometer cross-referencing. Sudden spikes accompanied by intense movement are labeled as motion artifacts in the Anomaly Log.',
                            'Q: Can I set patient-specific alarm thresholds?\nA: Yes, through the Threshold Safety Nets in Patient Settings or Doctor’s Orders.'
                        ]
                    }
                ]
            },
            facility_admin: {
                roleLabel: 'Facility Administrator Guide',
                roleBadgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                roleDesc: 'Ward operational workflows: patient admission, caregiver-to-patient pairing, sensor device inventory, and staff rosters.',
                quickStartSteps: [
                    { title: '1. Patient Admission', desc: 'Admit new patients into rooms and beds with diagnosis and emergency contacts.' },
                    { title: '2. Pair Caregivers', desc: 'Assign primary and secondary caregivers to each admitted patient.' },
                    { title: '3. Assign Hardware Sensors', desc: 'Link Smart Diaper clips and Vital Sign monitors to patient IDs.' },
                    { title: '4. Monitor Ward Health', desc: 'Oversee device battery levels, WiFi signal RSSI, and ward alarm activity.' },
                ],
                topics: [
                    {
                        id: 'fa-admission',
                        title: 'Patient Admission & Bed Allocation',
                        category: 'admin',
                        icon: Users,
                        summary: 'Registering patients and setting up their ward records.',
                        steps: [
                            'Go to Patient Records Hub > Admission / Onboarding.',
                            'Enter patient legal name, date of birth, ward/room number, and clinical notes.',
                            'Assign primary attending physician and registered caregiver accounts.'
                        ]
                    },
                    {
                        id: 'fa-devices',
                        title: 'Sensor Device Inventory & Whitelisting',
                        category: 'devices',
                        icon: Cpu,
                        summary: 'Adding ESP32 hardware, MAC whitelisting, and assigning devices to beds.',
                        steps: [
                            'Go to Device Management Hub > Add New Device.',
                            'Enter the device MAC address and assign a hardware label (e.g., "Smart Diaper Bed 4B").',
                            'Pair the device to the admitted patient. The live monitoring stream will route automatically.',
                            'View Ward Diagnostics to identify sensors with low battery (<20%) or weak WiFi signal (RSSI < -75 dBm).'
                        ]
                    },
                    {
                        id: 'fa-staff',
                        title: 'Department Staff & Shift Management',
                        category: 'admin',
                        icon: Building2,
                        summary: 'Managing nurse and caregiver credentials, permissions, and shift schedules.',
                        steps: [
                            'Manage staff accounts under Staff Management Hub.',
                            'Verify caregiver assignments to ensure every admitted patient has an active caregiver on duty.'
                        ]
                    }
                ]
            },
            system_admin: {
                roleLabel: 'System Administrator & DevOps Guide',
                roleBadgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
                roleDesc: 'Platform system monitoring, SIEM security threats, forensic audit trails, RBAC module toggles, and ESP32 OTA firmware deployments.',
                quickStartSteps: [
                    { title: '1. System Health Monitoring', desc: 'Verify API latency, WebSocket connection pools, and Neon Postgres database health.' },
                    { title: '2. SIEM & Security', desc: 'Monitor the brute-force threat feed and review forensic audit logs for PHI compliance.' },
                    { title: '3. RBAC Permissions', desc: 'Use the User Permissions Manager to toggle module access per role or user.' },
                    { title: '4. Firmware OTA', desc: 'Upload and stage ESP32 firmware binaries for over-the-air deployment.' },
                ],
                topics: [
                    {
                        id: 'sa-siem',
                        title: 'Security Operations (SIEM) & Audit Logging',
                        category: 'admin',
                        icon: Shield,
                        summary: 'Forensic audit trails, brute-force IP rate-limiting, and DPA compliance.',
                        steps: [
                            'SIEM Feed: Real-time threat feed flags suspicious IP ranges and repeated failed authentication attempts.',
                            'Audit Logs: Every PHI read, export, alert acknowledgment, and sensor parameter change is cryptographically logged with user ID and timestamp.',
                            'Data Privacy: Configure retention windows under Settings Hub > Privacy & Compliance.'
                        ]
                    },
                    {
                        id: 'sa-rbac',
                        title: 'Role-Based Access Control (RBAC) Management',
                        category: 'admin',
                        icon: Sliders,
                        summary: 'Fine-grained module access toggles and role permission overrides.',
                        steps: [
                            'Access Security & Access Hub > User Permissions Manager.',
                            'Search for any user account to view their active module access permissions.',
                            'Toggle individual modules (e.g. OTA, Diagnostics, SIEM, Patient Records) to grant or revoke features on demand.'
                        ]
                    },
                    {
                        id: 'sa-ota',
                        title: 'ESP32 Firmware Repository & OTA Updates',
                        category: 'devices',
                        icon: Cpu,
                        summary: 'Pushing wireless firmware updates to Vital Signs and Smart Diaper sensors.',
                        steps: [
                            'Navigate to Device Management Hub > Firmware OTA Updates.',
                            'Upload a compiled `.bin` firmware file. Specify semantic version number and device target (WetnessSensor or VitalSignsSensor).',
                            'Select target device MAC addresses or initiate ward-wide staging.',
                            'Monitor OTA progress bars to verify successful flashing and automatic device reboot.'
                        ]
                    }
                ]
            }
        };

        return guides[selectedRoleView];
    }, [selectedRoleView]);

    // Filter topics based on search query and active tab
    const filteredTopics = useMemo(() => {
        return manualContent.topics.filter(topic => {
            const matchesTab =
                activeTab === 'all' ||
                (activeTab === 'quickstart' && topic.category === 'quickstart') ||
                (activeTab === 'core' && (topic.category === 'vitals' || topic.category === 'clinical' || topic.category === 'admin')) ||
                (activeTab === 'alerts' && (topic.category === 'alerts' || topic.category === 'calibration')) ||
                (activeTab === 'faq' && (topic.category === 'faq' || topic.category === 'devices'));

            if (!matchesTab) return false;

            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase();
            const inTitle = topic.title.toLowerCase().includes(q);
            const inSummary = topic.summary.toLowerCase().includes(q);
            const inSteps = topic.steps?.some(s => s.toLowerCase().includes(q)) ?? false;
            const inTips = topic.tips?.some(t => t.toLowerCase().includes(q)) ?? false;

            return inTitle || inSummary || inSteps || inTips;
        });
    }, [manualContent, activeTab, searchQuery]);

    const canSwitchRoles = isSysAdmin || rawRole === 'facility_admin' || rawRole === 'system_admin' || rawRole === 'admin';

    return (
        <>
            {/* Trigger Button beside Notification Button */}
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(true)}
                title="System User Manual & Guide"
                aria-label="Open User Manual"
                className={`relative flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border-teal-200/90 bg-teal-50/70 hover:bg-teal-100/90 text-teal-900 font-semibold shadow-sm hover:shadow transition-all duration-200 ${className}`}
            >
                <BookOpen className="w-4 h-4 text-teal-700 shrink-0" />
                <span className="hidden sm:inline text-xs font-bold text-teal-800 tracking-tight">Manual</span>
                <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse sm:hidden" />
            </Button>

            {/* Modal User Guide Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-slate-200 shadow-2xl bg-white">
                    {/* Header */}
                    <div className="p-4 sm:p-6 bg-gradient-to-r from-teal-800 via-teal-700 to-teal-900 text-white shrink-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                                    <BookOpen className="w-6 h-6 text-teal-200" />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                                        ALAGA User Guide & Manual
                                    </DialogTitle>
                                    <DialogDescription className="text-teal-100/90 text-xs sm:text-sm font-medium mt-0.5">
                                        Tailored instructions for your specific role & permissions.
                                    </DialogDescription>
                                </div>
                            </div>

                            {/* Active Role Badge & Switcher */}
                            <div className="flex items-center gap-2">
                                {canSwitchRoles ? (
                                    <div className="flex items-center bg-teal-950/40 p-1 rounded-lg border border-teal-500/30 text-xs">
                                        <span className="text-teal-200 text-[11px] font-semibold px-2">View Role:</span>
                                        <select
                                            value={selectedRoleView}
                                            onChange={(e) => setSelectedRoleView(e.target.value as RoleCategory)}
                                            className="bg-white text-teal-950 text-xs font-bold rounded-md px-2 py-1 outline-none cursor-pointer"
                                        >
                                            <option value="caregiver">Caregiver / Parent</option>
                                            <option value="medical_staff">Medical Staff / Doctor</option>
                                            <option value="facility_admin">Facility Admin</option>
                                            <option value="system_admin">System Admin</option>
                                        </select>
                                    </div>
                                ) : (
                                    <Badge variant="outline" className={`px-3 py-1 font-bold text-xs uppercase tracking-wider ${manualContent.roleBadgeColor}`}>
                                        {manualContent.roleLabel}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="mt-4 relative">
                            <Search className="w-4 h-4 text-teal-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <Input
                                type="text"
                                placeholder="Search guides (e.g. 'heart rate', 'diaper wetness', 'acknowledge alert', 'baseline')..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder:text-teal-200/70 border-white/20 focus:border-teal-300 rounded-xl text-xs sm:text-sm transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-200 hover:text-white text-xs font-bold"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1.5 px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto shrink-0 scrollbar-none text-xs">
                        {[
                            { id: 'all', label: 'All Topics' },
                            { id: 'quickstart', label: 'Quick Start' },
                            { id: 'core', label: 'Core Vitals & Features' },
                            { id: 'alerts', label: 'Alerts & Safety' },
                            { id: 'faq', label: 'Troubleshooting & FAQ' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 ${
                                    activeTab === tab.id
                                        ? 'bg-teal-600 text-white shadow-sm'
                                        : 'bg-white hover:bg-slate-200/70 text-slate-700 border border-slate-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Body - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60">
                        {/* Role Description Banner */}
                        <div className="bg-teal-50/80 border border-teal-200 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm text-teal-900 flex items-start gap-3 shadow-xs">
                            <Sparkles className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-teal-950">{manualContent.roleLabel} Overview</h4>
                                <p className="text-teal-800 text-xs mt-0.5 leading-relaxed">{manualContent.roleDesc}</p>
                            </div>
                        </div>

                        {/* Quick Start Card (Shown on 'all' or 'quickstart' tab when not searching) */}
                        {(activeTab === 'all' || activeTab === 'quickstart') && !searchQuery && (
                            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm">
                                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="w-5 h-5 text-teal-600" />
                                    Quick Start Checklist
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {manualContent.quickStartSteps.map((step, idx) => (
                                        <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                                            <p className="font-bold text-xs sm:text-sm text-teal-950 mb-1">{step.title}</p>
                                            <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">{step.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Topics List */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
                                {filteredTopics.length} Guide Topic{filteredTopics.length === 1 ? '' : 's'} Found
                            </h3>

                            {filteredTopics.length === 0 ? (
                                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                                    <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <p className="font-bold text-sm text-slate-700">No manual topics match "{searchQuery}"</p>
                                    <p className="text-xs text-slate-500 mt-1">Try searching for keywords like "vitals", "spo2", "battery", or "alerts".</p>
                                </div>
                            ) : (
                                filteredTopics.map((topic) => {
                                    const IconComponent = topic.icon;
                                    const isExpanded = expandedTopicId === topic.id;

                                    return (
                                        <div
                                            key={topic.id}
                                            className={`bg-white border rounded-xl transition-all duration-200 overflow-hidden ${
                                                isExpanded ? 'border-teal-400 shadow-md ring-1 ring-teal-200' : 'border-slate-200 shadow-xs hover:border-slate-300'
                                            }`}
                                        >
                                            <button
                                                onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                                                className="w-full text-left p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`p-2 rounded-lg shrink-0 ${isExpanded ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-800'}`}>
                                                        <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-black text-xs sm:text-sm text-slate-900 tracking-tight truncate">
                                                            {topic.title}
                                                        </h4>
                                                        <p className="text-[11px] sm:text-xs text-slate-600 truncate mt-0.5">
                                                            {topic.summary}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="shrink-0 flex items-center gap-2">
                                                    <span className="text-[10px] uppercase font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 hidden sm:inline">
                                                        {topic.category}
                                                    </span>
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4 text-teal-700" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                                    )}
                                                </div>
                                            </button>

                                            {/* Expanded Topic Details */}
                                            {isExpanded && (
                                                <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/40 space-y-3.5 text-xs sm:text-sm">
                                                    {/* Steps */}
                                                    {topic.steps && topic.steps.length > 0 && (
                                                        <div>
                                                            <h5 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                                                                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                                                Instructions & Guidelines
                                                            </h5>
                                                            <div className="space-y-2">
                                                                {topic.steps.map((step, sIdx) => (
                                                                    <div key={sIdx} className="flex items-start gap-2.5 text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/80 leading-relaxed">
                                                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                                                                            {sIdx + 1}
                                                                        </span>
                                                                        <span className="text-xs sm:text-sm whitespace-pre-line">{step}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Tips */}
                                                    {topic.tips && topic.tips.length > 0 && (
                                                        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sky-950">
                                                            <p className="font-bold text-xs text-sky-900 flex items-center gap-1.5 mb-1">
                                                                <Info className="w-4 h-4 text-sky-600" />
                                                                Pro-Tips & Best Practices
                                                            </p>
                                                            <ul className="list-disc list-inside space-y-1 text-xs text-sky-900/90 pl-1">
                                                                {topic.tips.map((tip, tIdx) => (
                                                                    <li key={tIdx} className="leading-relaxed">{tip}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Warning */}
                                                    {topic.warning && (
                                                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-950 flex items-start gap-2">
                                                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="font-bold text-xs text-rose-900">Safety Caution</p>
                                                                <p className="text-xs text-rose-800/90 leading-relaxed mt-0.5">{topic.warning}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                        <p className="text-[11px] text-slate-500 hidden sm:block">
                            ALAGA Smart Healthcare System &bull; Version 2.4 Active Monitoring
                        </p>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsOpen(false)}
                                className="w-full sm:w-auto font-bold border-slate-300 hover:bg-slate-100"
                            >
                                Close Manual
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
