import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/auth-context';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
    Sparkles,
    Heart,
    Activity,
    Droplets,
    Bell,
    Sliders,
    Calendar,
    Cpu,
    Shield,
    FileText,
    Users,
    Building2,
    Server,
    Stethoscope,
    BookOpen,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    X,
    Compass,
    Volume2,
    AlertTriangle,
    RefreshCw,
    Check
} from 'lucide-react';

export type TutorialRole = 'caregiver' | 'medical_staff' | 'facility_admin' | 'system_admin';

interface TutorialStep {
    stepNumber: number;
    title: string;
    subtitle: string;
    badge: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    interactiveType: 'vitals-preview' | 'diaper-preview' | 'chime-preview' | 'baseline-preview' | 'ward-preview' | 'battery-preview' | 'neon-preview' | 'final-step';
    keyPoints: string[];
    roleTip: string;
}

export const InteractiveOnboardingTutorial: React.FC = () => {
    const { user, isSysAdmin } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    // Interactive widget preview states
    const [simulatedVitalsState, setSimulatedVitalsState] = useState<'normal' | 'elevated'>('normal');
    const [simulatedWetness, setSimulatedWetness] = useState<number>(14);
    const [simulatedAlertAcknowledged, setSimulatedAlertAcknowledged] = useState(false);
    const [simulatedBaselineTrained, setSimulatedBaselineTrained] = useState(false);
    const [simulatedBatteryLevel, setSimulatedBatteryLevel] = useState<number>(85);

    // Determine normalized role
    const rawRole = (user?.role || '').toLowerCase();
    const roleCategory: TutorialRole = useMemo(() => {
        if (isSysAdmin || rawRole === 'system_admin' || rawRole === 'admin' || rawRole === 'sysadmin') return 'system_admin';
        if (rawRole === 'facility_admin') return 'facility_admin';
        if (rawRole === 'medical_staff' || rawRole === 'medstaff') return 'medical_staff';
        return 'caregiver'; // Default to caregiver/family
    }, [rawRole, isSysAdmin]);

    const storageKey = user?.id ? `alaga_tutorial_seen_${user.id}` : null;

    // Check if new account needs tutorial on mount
    useEffect(() => {
        if (!storageKey) return;
        const alreadySeen = localStorage.getItem(storageKey);
        if (!alreadySeen) {
            // Delay slightly so dashboard finishes rendering smoothly
            const timer = setTimeout(() => {
                setIsOpen(true);
                setCurrentStepIndex(0);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [storageKey]);

    // Listen for manual trigger from UserManualButton
    useEffect(() => {
        const handleStartTutorial = () => {
            setCurrentStepIndex(0);
            setIsOpen(true);
        };
        window.addEventListener('alaga:start-tutorial', handleStartTutorial);
        return () => window.removeEventListener('alaga:start-tutorial', handleStartTutorial);
    }, []);

    // Dismiss & Skip (never show automatically again)
    const handleSkip = () => {
        if (storageKey) {
            localStorage.setItem(storageKey, 'skipped');
        }
        setIsOpen(false);
    };

    // Finish Tutorial (never show automatically again)
    const handleFinish = () => {
        if (storageKey) {
            localStorage.setItem(storageKey, 'completed');
        }
        setIsOpen(false);
    };

    // Role-specific step definitions
    const steps: TutorialStep[] = useMemo(() => {
        if (roleCategory === 'system_admin') {
            return [
                {
                    stepNumber: 1,
                    title: 'Welcome to System Administration',
                    subtitle: 'Global Infrastructure & Root Governance',
                    badge: 'SysAdmin Control',
                    description: 'You have root authority over the ALAGA healthcare network, database clusters, hardware provisioning, and system-wide security.',
                    icon: Server,
                    interactiveType: 'neon-preview',
                    keyPoints: [
                        'Serverless Lakebase Postgres (Neon) health & real-time connection pooling',
                        'Global sensor telemetry ingestion rates & WebSocket stream health',
                        'Hardware MAC whitelisting & Over-the-Air (OTA) firmware deployments'
                    ],
                    roleTip: 'All system configuration changes and administrator logins are immutably logged for forensic audit compliance.'
                },
                {
                    stepNumber: 2,
                    title: 'Serverless Database & Connection Pool',
                    subtitle: 'Postgres Autoscaling & Latency Optimization',
                    badge: 'Neon Lakebase',
                    description: 'Monitor direct vs. pooled database connection metrics. The platform automatically scales to zero during low-traffic hours to optimize costs.',
                    icon: Activity,
                    interactiveType: 'neon-preview',
                    keyPoints: [
                        'Zero connection exhaustion with pgbouncer pooling on port 5432 / 6543',
                        'Sub-25ms query response times on real-time biometric ingestion',
                        'Instant branching for safe staging tests and schema migrations'
                    ],
                    roleTip: 'Review the System Reports Hub anytime for automated database performance benchmarks.'
                },
                {
                    stepNumber: 3,
                    title: 'Hardware Provisioning & Sensor Whitelist',
                    subtitle: 'Cryptographic ESP32 Device Registration',
                    badge: 'OTA & Fleet',
                    description: 'Prevent rogue hardware from streaming into patient records by managing the hardware device whitelist and pushing firmware updates.',
                    icon: Cpu,
                    interactiveType: 'battery-preview',
                    keyPoints: [
                        'Verify device MAC addresses before sensor assignment to beds',
                        'Push compiled .bin firmware over-the-air to all active ward clips',
                        'Monitor hardware battery degradation curves and RSSI signal quality'
                    ],
                    roleTip: 'Sensors with RSSI weaker than -85 dBm will automatically alert maintenance engineers to reposition ward access points.'
                },
                {
                    stepNumber: 4,
                    title: 'SIEM Security & Access Control',
                    subtitle: 'Zero-Trust Role-Based Access Audit',
                    badge: 'DPA / HIPAA SIEM',
                    description: 'Inspect cryptographically hashed audit trails, track login anomalies, and govern privilege escalation between facility tiers.',
                    icon: Shield,
                    interactiveType: 'chime-preview',
                    keyPoints: [
                        'Real-time alerts on brute-force attempts and session hijack anomalies',
                        'Strict role segregation: SysAdmin, Facility Admin, Medical Staff, Caregiver',
                        'Immutable forensic ledger with digital signing on clinical record modifications'
                    ],
                    roleTip: 'Export complete tamper-proof audit reports in PDF or CSV formats directly from the Security Hub.'
                },
                {
                    stepNumber: 5,
                    title: "You're Fully Equipped!",
                    subtitle: 'Master System Documentation & Support',
                    badge: 'Onboarding Complete',
                    description: 'Your platform command center is live. You can test features, manage ward fleets, or re-run this interactive tour anytime from the User Manual.',
                    icon: BookOpen,
                    interactiveType: 'final-step',
                    keyPoints: [
                        'Access the comprehensive User Manual anytime via the book icon in the top bar',
                        'Replay this interactive walkthrough at any time from within the manual',
                        'Live monitoring feeds and system diagnostics are actively streaming'
                    ],
                    roleTip: 'Thank you for keeping ALAGA secure, scalable, and resilient for patients and caregivers.'
                }
            ];
        }

        if (roleCategory === 'facility_admin') {
            return [
                {
                    stepNumber: 1,
                    title: 'Welcome to Facility Administration',
                    subtitle: 'Ward Coordination & Fleet Oversight',
                    badge: 'Facility Command',
                    description: 'Lead your hospital or clinic ward operations. Coordinate caregiver shift schedules, monitor hardware fleet readiness, and ensure quality of care.',
                    icon: Building2,
                    interactiveType: 'ward-preview',
                    keyPoints: [
                        'Bird’s-eye view of all occupied beds, patient vitals, and alert states',
                        'Staff delegation matrix: Assign nurses and caregivers to specific wards',
                        'Facility-wide compliance reporting and device inventory tracking'
                    ],
                    roleTip: 'Ward dashboards refresh automatically every 5 seconds without needing manual browser reloads.'
                },
                {
                    stepNumber: 2,
                    title: 'Sensor Fleet & Battery Readiness',
                    subtitle: 'Preventing Clinical Device Downtime',
                    badge: 'Hardware Management',
                    description: 'Never let a patient go unmonitored due to depleted batteries. The Device Management Hub highlights clips requiring recharge.',
                    icon: Cpu,
                    interactiveType: 'battery-preview',
                    keyPoints: [
                        'Automatic warning flags when sensor battery drops below 20%',
                        'Sensor-to-bed pairing verification to prevent telemetry mix-ups',
                        'Real-time WiFi signal heat-map for each room in your facility'
                    ],
                    roleTip: 'Sensors reach 80% charge in just 35 minutes using the magnetic charging cradle.'
                },
                {
                    stepNumber: 3,
                    title: 'Staff Delegation & Shift Roster',
                    subtitle: 'Caregiver Assignments & Handover Sync',
                    badge: 'Staff Management',
                    description: 'Ensure every newborn and patient has designated primary and relief medical attendants. Reassign beds seamlessly during shift changes.',
                    icon: Users,
                    interactiveType: 'ward-preview',
                    keyPoints: [
                        'Assign single or multiple beds to attending nurses and staff',
                        'Instant notifications when an assigned staff member acknowledges an alert',
                        'Audit adherence logs for feeding schedules and medication administration'
                    ],
                    roleTip: 'Unassigned beds trigger a persistent reminder until claimed by on-duty medical staff.'
                },
                {
                    stepNumber: 4,
                    title: 'Institutional Reports & Audit Logs',
                    subtitle: 'Data Privacy Act (DPA) & Clinical Reports',
                    badge: 'Clinical Compliance',
                    description: 'Generate comprehensive ward summaries, moisture exposure trends, and incident logs with a single click.',
                    icon: FileText,
                    interactiveType: 'final-step',
                    keyPoints: [
                        'Weekly wetness duration regression charts to verify skin-care quality',
                        'Full export options (PDF, Excel CSV) for hospital accreditation',
                        'Cryptographically logged clinical notes for physician review'
                    ],
                    roleTip: 'Reports can be scheduled for automatic daily delivery to attending pediatric chiefs.'
                },
                {
                    stepNumber: 5,
                    title: "Ready to Coordinate Your Ward!",
                    subtitle: 'User Manual & Tour Access',
                    badge: 'Onboarding Complete',
                    description: 'You are ready to oversee your facility. You can train new staff members or replay this interactive tutorial anytime via the User Manual.',
                    icon: BookOpen,
                    interactiveType: 'final-step',
                    keyPoints: [
                        'Click the User Manual button in the header for staff troubleshooting guides',
                        'Replay this interactive tutorial anytime from the top of the manual',
                        'Contact system administrators if you need additional hardware clips provisioned'
                    ],
                    roleTip: 'Empower your caregivers with peaceful, intelligent monitoring today.'
                }
            ];
        }

        if (roleCategory === 'medical_staff') {
            return [
                {
                    stepNumber: 1,
                    title: 'Welcome to Clinical Care Command',
                    subtitle: 'High-Acuity Vitals & Pediatric Monitoring',
                    badge: 'Medical Staff',
                    description: 'Engineered for doctors, nurses, and clinical specialists to deliver rapid, attentive care while eliminating unnecessary alarm fatigue.',
                    icon: Stethoscope,
                    interactiveType: 'ward-preview',
                    keyPoints: [
                        'Multi-patient ward overview with live telemetry cards for each bed',
                        'Real-time optical pulse-oximetry (SpO₂) and calibrated skin temperature',
                        'Instant acoustic & visual chimes with role-based alert escalation'
                    ],
                    roleTip: 'Urgent alerts are prioritized at the top of your screen regardless of which tab you are currently viewing.'
                },
                {
                    stepNumber: 2,
                    title: 'Live Vitals & Adaptive Visual Cues',
                    subtitle: 'Color-Coded Statuses at a Glance',
                    badge: 'Vital Signs Monitor',
                    description: 'Vitals cards adjust dynamically based on patient health status. Try toggling the simulated vitals below to see the visual changes.',
                    icon: Activity,
                    interactiveType: 'vitals-preview',
                    keyPoints: [
                        'Heart Rate (BPM): Resting normal range for infants is typically 100 - 150 BPM',
                        'SpO₂ (%): Optical oxygen saturation alerts when falling below 90%',
                        'Skin Temp (°C): Infrared thermopile sensor catches sudden febrile spikes'
                    ],
                    roleTip: 'Brief spikes during vigorous crying are automatically distinguished from persistent hypoxia by the AI engine.'
                },
                {
                    stepNumber: 3,
                    title: 'One-Class SVM AI & Baseline Calibration',
                    subtitle: 'Personalized Machine Learning Without False Alarms',
                    badge: 'AI Calibration',
                    description: 'ALAGA observes your patient for 24 hours to learn their baseline. When health significantly changes (e.g. post-fever recovery), start a fresh calibration.',
                    icon: Sliders,
                    interactiveType: 'baseline-preview',
                    keyPoints: [
                        'Rejects motion and feeding artifacts to eliminate up to 85% of false alarms',
                        'Hard safety net overrides ALWAYS alert if vitals breach manual thresholds',
                        'One-click "Reset Baseline" initiates a new 24-hour learning phase'
                    ],
                    roleTip: 'Never reset the baseline during an active febrile spike, as that would teach the model that fever is normal.'
                },
                {
                    stepNumber: 4,
                    title: 'Clinical Alert Handling Protocol',
                    subtitle: 'Acknowledge, Flag Normal & Care Adherence',
                    badge: 'Bedside Protocol',
                    description: 'Handle patient alerts directly from your station or mobile device. Try interacting with the simulated alert buttons below.',
                    icon: Bell,
                    interactiveType: 'chime-preview',
                    keyPoints: [
                        'Acknowledge: Confirms clinician attendance and records response latency',
                        'Flag Normal: Feeds non-emergency crying/feeding context to the AI model',
                        'Mute 5m: Temporarily suppresses acoustic chimes during diaper changes'
                    ],
                    roleTip: 'All alert responses are permanently timestamped in the patient’s clinical record.'
                },
                {
                    stepNumber: 5,
                    title: 'You Are Ready for Clinical Duty!',
                    subtitle: 'Quick Access to Protocols & Manual',
                    badge: 'Onboarding Complete',
                    description: 'Your clinical dashboard is primed. You can consult dosage guidelines, device calibration tips, or replay this tutorial anytime via the User Manual.',
                    icon: BookOpen,
                    interactiveType: 'final-step',
                    keyPoints: [
                        'Access the User Manual in the top header for clinical operating procedures',
                        'Re-run this interactive tour anytime with a single click in the manual',
                        'Patient records and live monitoring streams are active'
                    ],
                    roleTip: 'Delivering clinical excellence with heart and precision.'
                }
            ];
        }

        // Caregiver / Family (Default)
        return [
            {
                stepNumber: 1,
                title: 'Welcome to ALAGA Family Care',
                subtitle: 'Peaceful, Smart Monitoring for Your Little One',
                badge: 'Caregiver Guide',
                description: 'We created ALAGA so you can watch over your baby with confidence, prevent diaper rashes before they start, and enjoy restful, peaceful days and nights.',
                icon: Heart,
                interactiveType: 'vitals-preview',
                keyPoints: [
                    'Live streaming of your baby’s heart rate, oxygen levels, and temperature',
                    'Smart diaper moisture detection that alerts you when a change is needed',
                    'Gentle audio chimes that notify you without startling your baby'
                ],
                roleTip: 'Your dashboard works seamlessly on desktop computers, tablets, and mobile phones.'
            },
            {
                stepNumber: 2,
                title: 'Understanding Live Vital Signs',
                subtitle: 'Heart Rate, Oxygen & Temperature at a Glance',
                badge: 'Vital Signs',
                description: 'The vitals card shows real-time biometrics. Normal readings glow in soothing pastel teal, while any unusual reading gently changes to alert you.',
                icon: Activity,
                interactiveType: 'vitals-preview',
                keyPoints: [
                    'Heart Rate (BPM): Normal resting rate for infants is usually 100 - 150 BPM',
                    'SpO₂ Oxygen (%): Normal oxygen levels stay safely between 95% and 100%',
                    'Skin Temp (°C): Continuous temperature monitoring helps catch fevers early'
                ],
                roleTip: 'If baby is crying actively or kicking, heart rate will temporarily rise. Give baby a moment to settle down before checking.'
            },
            {
                stepNumber: 3,
                title: 'Smart Diaper Moisture Sensor',
                subtitle: 'Prevent Rashes with Early Moisture Detection',
                badge: 'Diaper Sensor',
                description: 'The featherlight sensor clip fastens safely to the outside fold of your baby’s diaper. It measures moisture in real-time so you know exactly when to change.',
                icon: Droplets,
                interactiveType: 'diaper-preview',
                keyPoints: [
                    'Dry (0% - 25%): Diaper is clean and dry; baby is comfortable',
                    'Damp (26% - 60%): Mild moisture; prepare for upcoming diaper change',
                    'Wet (61% - 100%): Diaper change recommended now to prevent dermatitis'
                ],
                roleTip: 'Wipe the sensor clip clean with a 70% alcohol wipe between diaper changes. Never submerge it in water.'
            },
            {
                stepNumber: 4,
                title: 'Gentle Chimes & Alert Responses',
                subtitle: 'Peaceful Audio Notifications Built for Home',
                badge: 'Soothing Chimes',
                description: 'Instead of jarring hospital beeps, ALAGA plays gentle polyphonic chimes. Try the interactive buttons below to see how easy it is to handle an alert.',
                icon: Bell,
                interactiveType: 'chime-preview',
                keyPoints: [
                    'Acknowledge: Tap when you go to baby to silence the chime and log care',
                    'Flag Normal: Tap if baby was just crying or nursing, teaching the AI',
                    'Mute 5m: Gives you 5 quiet minutes to change the diaper or comfort baby'
                ],
                roleTip: 'You can choose between "Gentle Chime" and "High Urgency" in Settings > Alert Preferences.'
            },
            {
                stepNumber: 5,
                title: "You're All Set to Care for Your Baby!",
                subtitle: 'User Manual & Daily Care Calendar',
                badge: 'Ready to Care',
                description: 'You are ready to begin! Keep track of feeding times and medications in the Care Calendar. If you ever need a refresher, the User Manual is always here.',
                icon: BookOpen,
                interactiveType: 'final-step',
                keyPoints: [
                    'Click the User Manual book icon in the header whenever you have a question',
                    'You can restart this interactive tour anytime directly from the manual',
                    'Your baby’s monitoring is active and protecting comfort around the clock'
                ],
                roleTip: 'Wishing you and your baby peaceful days and soothing nights.'
            }
        ];
    }, [roleCategory]);

    const currentStep = steps[currentStepIndex] || steps[0];
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === steps.length - 1;

    // Render interactive mini-widget according to current step
    const renderInteractiveWidget = () => {
        switch (currentStep.interactiveType) {
            case 'vitals-preview':
                return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-teal-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-teal-900 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-teal-700" />
                                Interactive Vitals Simulator
                            </span>
                            <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-lg border border-teal-200 text-[11px] font-bold">
                                <button
                                    type="button"
                                    onClick={() => setSimulatedVitalsState('normal')}
                                    className={`px-2.5 py-1 rounded-md transition-all ${simulatedVitalsState === 'normal' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-teal-800'}`}
                                >
                                    Normal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSimulatedVitalsState('elevated')}
                                    className={`px-2.5 py-1 rounded-md transition-all ${simulatedVitalsState === 'elevated' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-amber-800'}`}
                                >
                                    Elevated
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className={`p-2.5 rounded-xl border transition-all ${simulatedVitalsState === 'normal' ? 'bg-white border-teal-200' : 'bg-amber-50 border-amber-300'}`}>
                                <Heart className={`w-4 h-4 mx-auto mb-1 ${simulatedVitalsState === 'normal' ? 'text-rose-500' : 'text-amber-600 animate-pulse'}`} />
                                <div className="text-[10px] font-bold text-slate-500 uppercase">Heart Rate</div>
                                <div className={`text-sm font-black ${simulatedVitalsState === 'normal' ? 'text-teal-950' : 'text-amber-900'}`}>
                                    {simulatedVitalsState === 'normal' ? '118 BPM' : '162 BPM'}
                                </div>
                            </div>
                            <div className={`p-2.5 rounded-xl border transition-all ${simulatedVitalsState === 'normal' ? 'bg-white border-teal-200' : 'bg-amber-50 border-amber-300'}`}>
                                <Activity className={`w-4 h-4 mx-auto mb-1 ${simulatedVitalsState === 'normal' ? 'text-teal-600' : 'text-amber-600'}`} />
                                <div className="text-[10px] font-bold text-slate-500 uppercase">SpO₂ Oxygen</div>
                                <div className={`text-sm font-black ${simulatedVitalsState === 'normal' ? 'text-teal-950' : 'text-amber-900'}`}>
                                    {simulatedVitalsState === 'normal' ? '99%' : '91%'}
                                </div>
                            </div>
                            <div className={`p-2.5 rounded-xl border transition-all ${simulatedVitalsState === 'normal' ? 'bg-white border-teal-200' : 'bg-rose-50 border-rose-300'}`}>
                                <Sparkles className={`w-4 h-4 mx-auto mb-1 ${simulatedVitalsState === 'normal' ? 'text-emerald-500' : 'text-rose-600'}`} />
                                <div className="text-[10px] font-bold text-slate-500 uppercase">Skin Temp</div>
                                <div className={`text-sm font-black ${simulatedVitalsState === 'normal' ? 'text-teal-950' : 'text-rose-900'}`}>
                                    {simulatedVitalsState === 'normal' ? '36.8°C' : '38.4°C'}
                                </div>
                            </div>
                        </div>
                        <p className="text-[11px] text-teal-900/80 italic text-center">
                            Tip: Tap "Elevated" above to see how badges instantly shift color to highlight anomalies.
                        </p>
                    </div>
                );

            case 'diaper-preview':
                return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50 to-teal-50 border-2 border-sky-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-sky-950 flex items-center gap-1.5">
                                <Droplets className="w-3.5 h-3.5 text-sky-600" />
                                Interactive Moisture Gauge
                            </span>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${simulatedWetness > 60 ? 'bg-rose-100 text-rose-800' : simulatedWetness > 25 ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'}`}>
                                {simulatedWetness > 60 ? 'Wet - Change Now' : simulatedWetness > 25 ? 'Damp' : 'Comfortably Dry'}
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-slate-700">
                                <span>Sensor Level: {simulatedWetness}%</span>
                                <span className="text-slate-500 text-[11px]">Threshold: 60%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={simulatedWetness}
                                onChange={(e) => setSimulatedWetness(Number(e.target.value))}
                                className="w-full accent-teal-600 cursor-pointer"
                            />
                        </div>

                        <div className="flex items-center justify-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setSimulatedWetness(14)}
                                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-2xs"
                            >
                                Set Dry (14%)
                            </button>
                            <button
                                type="button"
                                onClick={() => setSimulatedWetness(85)}
                                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold text-rose-700 shadow-2xs"
                            >
                                Simulate Wet (85%)
                            </button>
                        </div>
                    </div>
                );

            case 'chime-preview':
                return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-teal-50 border-2 border-amber-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                                <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                                Interactive Alert Acknowledgment
                            </span>
                            <Badge className={simulatedAlertAcknowledged ? "bg-teal-600 text-white font-bold" : "bg-amber-500 text-white font-bold animate-pulse"}>
                                {simulatedAlertAcknowledged ? "Acknowledged" : "Active Gentle Chime"}
                            </Badge>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">
                            {simulatedAlertAcknowledged
                                ? "✓ Alert successfully acknowledged. Chime silenced, caregiver response timestamp recorded in clinical logs."
                                : "Simulation: SpO₂ dipped to 92% or Diaper reached 85%. Test the caregiver response buttons below:"}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSimulatedAlertAcknowledged(!simulatedAlertAcknowledged)}
                                className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm alaga-btn-tactile"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {simulatedAlertAcknowledged ? "Reset Simulation" : "Acknowledge (Tend)"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSimulatedAlertAcknowledged(true)}
                                className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs shadow-2xs alaga-btn-tactile"
                            >
                                Flag Normal
                            </button>
                            <button
                                type="button"
                                onClick={() => setSimulatedAlertAcknowledged(true)}
                                className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs shadow-2xs alaga-btn-tactile"
                            >
                                Mute 5m
                            </button>
                        </div>
                    </div>
                );

            case 'baseline-preview':
                return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-teal-50 border-2 border-purple-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-purple-950 flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5 text-purple-600" />
                                One-Class SVM Baseline State
                            </span>
                            <Badge className={simulatedBaselineTrained ? "bg-teal-600 text-white font-bold" : "bg-purple-600 text-white font-bold"}>
                                {simulatedBaselineTrained ? "Calibrated & Active" : "24h Learning Phase"}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                            {simulatedBaselineTrained
                                ? "Personalized baseline established. Transient motion and feeding artifacts are actively filtered."
                                : "Observing patient resting vitals to compute individual hyper-sphere boundaries. Hard safety net overrides remain fully armed."}
                        </p>
                        <button
                            type="button"
                            onClick={() => setSimulatedBaselineTrained(!simulatedBaselineTrained)}
                            className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm alaga-btn-tactile"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{simulatedBaselineTrained ? "Trigger Recalibration" : "Simulate 24h Baseline Completion"}</span>
                        </button>
                    </div>
                );

            case 'ward-preview':
                return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 to-slate-100 border-2 border-teal-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-teal-950 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-teal-700" />
                                Ward Telemetry Simulator
                            </span>
                            <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                4 Beds Online
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-white border border-teal-200 shadow-2xs">
                                <div className="font-black text-slate-900">Bed 4A: Baby Maya</div>
                                <div className="text-[11px] text-teal-700 font-bold mt-0.5">HR 124 &bull; SpO₂ 98%</div>
                                <div className="text-[10px] text-slate-500">Diaper: Dry (12%)</div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white border border-teal-200 shadow-2xs">
                                <div className="font-black text-slate-900">Bed 4B: Baby Elijah</div>
                                <div className="text-[11px] text-teal-700 font-bold mt-0.5">HR 118 &bull; SpO₂ 99%</div>
                                <div className="text-[10px] text-slate-500">Diaper: Dry (14%)</div>
                            </div>
                        </div>
                    </div>
                );

            case 'battery-preview':
                return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-teal-50 border-2 border-amber-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-amber-700" />
                                Hardware Battery & RSSI Monitor
                            </span>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${simulatedBatteryLevel < 20 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {simulatedBatteryLevel}% {simulatedBatteryLevel < 20 ? '(Recharge Needed)' : '(Good)'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-200 h-3 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${simulatedBatteryLevel < 20 ? 'bg-rose-500' : 'bg-teal-500'}`}
                                    style={{ width: `${simulatedBatteryLevel}%` }}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setSimulatedBatteryLevel(simulatedBatteryLevel > 50 ? 15 : 90)}
                                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold rounded-lg shadow-2xs"
                            >
                                {simulatedBatteryLevel > 50 ? "Simulate <20%" : "Recharge (90%)"}
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-600">
                            Automatic low-battery warnings trigger before sensors fall below 20%, ensuring uninterrupted monitoring.
                        </p>
                    </div>
                );

            case 'neon-preview':
                return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-teal-950 text-white border-2 border-teal-500/40 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-teal-300 flex items-center gap-1.5">
                                <Server className="w-3.5 h-3.5 text-teal-400" />
                                Neon Postgres Infrastructure Health
                            </span>
                            <Badge className="bg-emerald-500 text-slate-950 font-black text-[10px]">
                                POOL READY &bull; 14ms
                            </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="p-2 rounded-xl bg-white/10 border border-white/10">
                                <div className="text-[10px] text-teal-200 font-bold uppercase">Pool Connections</div>
                                <div className="font-black text-white text-sm mt-0.5">18 / 100</div>
                            </div>
                            <div className="p-2 rounded-xl bg-white/10 border border-white/10">
                                <div className="text-[10px] text-teal-200 font-bold uppercase">Branch State</div>
                                <div className="font-black text-white text-sm mt-0.5">Primary Main</div>
                            </div>
                            <div className="p-2 rounded-xl bg-white/10 border border-white/10">
                                <div className="text-[10px] text-teal-200 font-bold uppercase">Autoscaling</div>
                                <div className="font-black text-white text-sm mt-0.5">0.25 - 2 CU</div>
                            </div>
                        </div>
                    </div>
                );

            case 'final-step':
            default:
                return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 via-emerald-50 to-sky-50 border-2 border-teal-300 space-y-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-md">
                            <Check className="w-7 h-7 stroke-[3]" />
                        </div>
                        <h4 className="text-sm font-black text-slate-900">
                            You're Ready to Experience ALAGA
                        </h4>
                        <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                            All features for your role are unlocked. Remember: click the <strong>User Manual</strong> icon in the header whenever you need guidance or wish to replay this interactive walkthrough.
                        </p>
                    </div>
                );
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
            <DialogContent className="max-w-2xl w-[95vw] p-0 gap-0 overflow-hidden bg-white rounded-3xl border-0 shadow-2xl">
                {/* Header with gradient & role badge */}
                <div className="p-6 bg-gradient-to-r from-teal-900 via-teal-800 to-teal-950 text-white relative overflow-hidden">
                    {/* Ambient Glows */}
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-teal-400/20 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -left-10 -top-10 w-40 h-40 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-teal-200 shadow-sm">
                                <currentStep.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider px-2 py-0.5">
                                        {currentStep.badge}
                                    </Badge>
                                    <span className="text-[11px] font-bold text-teal-200/90">
                                        Step {currentStep.stepNumber} of {steps.length}
                                    </span>
                                </div>
                                <DialogTitle className="text-lg sm:text-xl font-black text-white mt-1">
                                    {currentStep.title}
                                </DialogTitle>
                                <DialogDescription className="text-xs sm:text-sm text-teal-200/90 font-medium">
                                    {currentStep.subtitle}
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Skip Button (top right) */}
                        <button
                            type="button"
                            onClick={handleSkip}
                            className="text-xs text-teal-200/80 hover:text-white hover:bg-white/10 px-2.5 py-1.5 rounded-lg font-bold transition-all border border-white/10 flex items-center gap-1 shrink-0"
                            title="Skip onboarding tutorial"
                        >
                            <span>Skip</span>
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Step progress pills */}
                    <div className="flex items-center gap-1.5 mt-5">
                        {steps.map((step, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setCurrentStepIndex(idx)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                    idx === currentStepIndex
                                        ? 'w-8 bg-amber-400'
                                        : idx < currentStepIndex
                                        ? 'w-4 bg-teal-400'
                                        : 'w-2 bg-white/20'
                                }`}
                                aria-label={`Go to step ${idx + 1}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-5 max-h-[68vh] overflow-y-auto bg-slate-50/50">
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                        {currentStep.description}
                    </p>

                    {/* Interactive Widget Area */}
                    {renderInteractiveWidget()}

                    {/* Key Highlights */}
                    <div className="space-y-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                            Key Capabilities & Protocols
                        </h4>
                        <div className="space-y-2">
                            {currentStep.keyPoints.map((point, idx) => (
                                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                                    <span className="leading-snug">{point}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Role Tip Callout */}
                    <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-950 flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                        <p className="text-[11px] sm:text-xs text-teal-900 leading-relaxed">
                            <strong className="font-black text-teal-950">Clinical Note: </strong>
                            {currentStep.roleTip}
                        </p>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleSkip}
                        className="text-xs font-bold text-slate-400 hover:text-slate-700 px-3 py-2 rounded-lg transition-colors"
                    >
                        Skip Tour
                    </button>

                    <div className="flex items-center gap-2">
                        {!isFirstStep && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
                                className="h-9 px-3.5 border-slate-300 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Back</span>
                            </Button>
                        )}

                        {isLastStep ? (
                            <Button
                                size="sm"
                                onClick={handleFinish}
                                className="h-9 px-5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 alaga-btn-tactile"
                            >
                                <span>Finish & Explore Dashboard</span>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={() => setCurrentStepIndex(prev => Math.min(steps.length - 1, prev + 1))}
                                className="h-9 px-5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 alaga-btn-tactile"
                            >
                                <span>Continue</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default InteractiveOnboardingTutorial;
