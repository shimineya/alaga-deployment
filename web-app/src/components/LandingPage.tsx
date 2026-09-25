import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import {
    Activity,
    Heart,
    Thermometer,
    Droplets,
    Shield,
    Wifi,
    Cpu,
    CheckCircle2,
    Calendar,
    ArrowRight,
    Sparkles,
    Lock,
    Users,
    ChevronRight,
    ChevronLeft,
    Eye,
    Layers,
    Sliders,
    Bell,
    Check,
    X,
    PhoneCall,
    FileText,
    TrendingUp,
    Building2,
    Server
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from './ui/dialog';

interface SolutionItem {
    id: string;
    title: string;
    category: string;
    badge: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    borderColor: string;
    bgTint: string;
    specs: string[];
    clinicalBenefit: string;
}

const SOLUTIONS: SolutionItem[] = [
    {
        id: 'smart-diaper',
        title: 'Smart Diaper Moisture Sensor',
        category: 'IoT Hardware',
        badge: 'Medical Wearable',
        description: 'Gold-plated conductive sensing pads that detect incontinence within 2 seconds, stopping Moisture-Associated Skin Damage (MASD) before it starts.',
        icon: Droplets,
        color: 'text-teal-600',
        borderColor: 'border-teal-200',
        bgTint: 'bg-teal-50/80',
        specs: ['Conductive gold-plated sensing strip', '18-24 hour magnetic rechargeable battery', 'IPX4 splash-resistant casing', 'BLE + 2.4GHz WiFi telemetry'],
        clinicalBenefit: 'Drastically reduces dermatitis and diaper rash through immediate caregiver notification.'
    },
    {
        id: 'vitals-monitor',
        title: 'Continuous Vital Signs Monitor',
        category: 'Optical Biometrics',
        badge: 'Pulse-Oximetry',
        description: 'Non-invasive optical pulse-oximeter measuring SpO₂ oxygen saturation, pulse rate, and calibrated body skin temperature continuously.',
        icon: Heart,
        color: 'text-rose-600',
        borderColor: 'border-rose-200',
        bgTint: 'bg-rose-50/80',
        specs: ['Dual-wavelength photoplethysmography (PPG)', 'High-precision infrared thermopile probe', 'Sub-second optical heart rate resolution', 'Hypoxia emergency buzzer'],
        clinicalBenefit: 'Catches silent hypoxia and sudden febrile spikes without disturbing the patient.'
    },
    {
        id: 'svm-engine',
        title: 'One-Class SVM AI Engine',
        category: 'Machine Learning',
        badge: 'AI Anomaly Detection',
        description: 'An unsupervised machine learning model that learns your patient’s unique resting baseline over 24 hours, rejecting movement and feeding artifacts.',
        icon: Sliders,
        color: 'text-sky-600',
        borderColor: 'border-sky-200',
        bgTint: 'bg-sky-50/80',
        specs: ['24-hour personalized baseline training', '3-axis accelerometer artifact rejection', 'Hard threshold safety net overrides', 'One-click recalibration after illness'],
        clinicalBenefit: 'Eliminates up to 85% of false alarms, protecting caregivers from alarm fatigue.'
    },
    {
        id: 'care-calendar',
        title: 'Care Calendar & Doctors’ Orders',
        category: 'Care Coordination',
        badge: 'Clinical Workflow',
        description: 'Synchronized care schedule for medications, feeding, and diaper checks directly linked to doctor prescriptions and task adherence logs.',
        icon: Calendar,
        color: 'text-purple-600',
        borderColor: 'border-purple-200',
        bgTint: 'bg-purple-50/80',
        specs: ['Automated chime reminders for medication', 'Prescription dosage & instructions sync', 'Caregiver shift adherence checkmarks', 'Multi-patient daily timeline view'],
        clinicalBenefit: 'Ensures zero missed medication doses and transparent handoffs between caregiver shifts.'
    },
    {
        id: 'ward-matrix',
        title: 'Ward Diagnostic & Fleet Matrix',
        category: 'Facility Management',
        badge: 'Hardware Telemetry',
        description: 'Real-time battery level, WiFi signal RSSI, and over-the-air (OTA) firmware deployment across hundreds of patient sensors simultaneously.',
        icon: Cpu,
        color: 'text-amber-600',
        borderColor: 'border-amber-200',
        bgTint: 'bg-amber-50/80',
        specs: ['Centralized low-battery (<20%) warning grid', 'WiFi RSSI signal quality heat-matrix', 'ESP32 Over-the-Air (OTA) firmware flashing', 'Automatic sensor-to-bed pairing'],
        clinicalBenefit: 'Prevents downtime by notifying ward engineers before batteries deplete.'
    },
    {
        id: 'forensic-reports',
        title: 'HIPAA & DPA Clinical Reports Hub',
        category: 'Compliance & Analytics',
        badge: 'DPA Protected',
        description: 'Cryptographically logged access trails, automated 24-hour vitals summary PDFs, and weekly moisture exposure regression charts.',
        icon: FileText,
        color: 'text-emerald-600',
        borderColor: 'border-emerald-200',
        bgTint: 'bg-emerald-50/80',
        specs: ['One-click PDF/CSV health report export', 'Moisture exposure duration analysis (mins)', 'Immutable forensic audit ledger', 'De-identified cohort statistical analytics'],
        clinicalBenefit: 'Provides doctors and families with clear, verifiable evidence of patient health trajectory.'
    },
];

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();

    // Quick View Modal State
    const [selectedSolution, setSelectedSolution] = useState<SolutionItem | null>(null);

    // Interactive Demo State
    const [demoAlertAcknowledged, setDemoAlertAcknowledged] = useState(false);
    const [demoHeartRate, setDemoHeartRate] = useState(74);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900">
            {/* ================================================================ */}
            {/* 1. STICKY NAVBAR (Inspired by fursight.shop)                      */}
            {/* ================================================================ */}
            <header className="sticky top-0 z-50 bg-[#061126]/95 backdrop-blur-md border-b border-teal-500/20 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
                    {/* Brand Logo */}
                    <Link to="/" className="flex items-center gap-3 group text-decoration-none">
                        <img 
                            src="/alaga-robot-logo.png" 
                            alt="Alaga Logo" 
                            className="w-10 h-10 object-contain group-hover:scale-110 transition-transform shrink-0" 
                        />
                        <div className="flex flex-col">
                            <span className="text-xl font-black tracking-tight text-white italic group-hover:text-teal-300 transition-colors">
                                ALAGA
                            </span>
                            <span className="text-[9px] font-black tracking-widest uppercase text-amber-400 -mt-1">
                                Smart Healthcare
                            </span>
                        </div>
                    </Link>

                    {/* Nav Links (Desktop) */}
                    <nav className="hidden lg:flex items-center gap-1.5 text-xs font-semibold">
                        <a href="#hero" className="px-3.5 py-2 rounded-full text-white/80 hover:text-amber-400 hover:bg-white/5 transition-all">
                            Overview
                        </a>
                        <a href="#solutions" className="px-3.5 py-2 rounded-full text-white/80 hover:text-amber-400 hover:bg-white/5 transition-all">
                            Featured Hardware
                        </a>
                        <a href="#benefits" className="px-3.5 py-2 rounded-full text-white/80 hover:text-amber-400 hover:bg-white/5 transition-all">
                            Why ALAGA
                        </a>
                        <a href="#how-it-works" className="px-3.5 py-2 rounded-full text-white/80 hover:text-amber-400 hover:bg-white/5 transition-all">
                            How It Works
                        </a>
                    </nav>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2.5">
                        {isAuthenticated ? (
                            <Button
                                onClick={() => navigate('/dashboard')}
                                className="h-10 px-5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-md text-xs tracking-tight flex items-center gap-1.5 alaga-btn-tactile"
                            >
                                <span>Go to Dashboard</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className="h-10 px-4 sm:px-5 bg-white hover:bg-teal-50 text-teal-950 font-black rounded-xl text-xs tracking-wide transition-all shadow-sm border border-white flex items-center justify-center alaga-btn-tactile"
                                >
                                    Log In
                                </button>
                                <Button
                                    onClick={() => navigate('/signup')}
                                    className="h-10 px-4 sm:px-5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-md text-xs tracking-tight flex items-center gap-1.5 alaga-btn-tactile"
                                >
                                    <span>Get Started</span>
                                    <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* ================================================================ */}
            {/* 2. HERO SECTION (Inspired by fursight-home-hero)                 */}
            {/* ================================================================ */}
            <section id="hero" className="relative alaga-ambient-bg pt-10 pb-16 sm:py-20 overflow-hidden border-b border-teal-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                        {/* Copy Column */}
                        <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-100/90 border border-teal-300/80 text-teal-900 text-xs font-black shadow-xs">
                                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                                <span>AI-Powered IoT Health & Diaper Moisture Intelligence</span>
                            </div>

                            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
                                Everything Your Patient{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600">
                                    Needs
                                </span>
                                , Monitored with Heart.
                            </h1>

                            <p className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                                Real-time diaper wetness detection, continuous pulse-oximetry vitals, and intelligent machine learning safety nets. Built to protect patient comfort, prevent dermatitis, and eliminate caregiver alarm fatigue.
                            </p>

                            {/* CTAs */}
                            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
                                <Button
                                    onClick={() => navigate('/signup')}
                                    className="w-full sm:w-auto h-12 px-7 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl shadow-md hover:shadow-lg text-sm flex items-center justify-center gap-2 alaga-btn-tactile"
                                >
                                    <span>Create Account</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                                <Button
                                    onClick={() => navigate('/login')}
                                    className="w-full sm:w-auto h-12 px-6 bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-900 font-bold rounded-xl text-sm alaga-btn-tactile shadow-sm"
                                >
                                    <span>Sign In to Portal</span>
                                </Button>
                            </div>

                            {/* Trust Stats Bar */}
                            <div className="pt-4 grid grid-cols-3 gap-3 border-t border-teal-200/80 max-w-lg mx-auto lg:mx-0">
                                <div className="text-left">
                                    <p className="text-xl sm:text-2xl font-black text-teal-900">&lt; 2s</p>
                                    <p className="text-[11px] text-slate-500 font-bold">Wetness Latency</p>
                                </div>
                                <div className="text-left border-l border-slate-200 pl-3">
                                    <p className="text-xl sm:text-2xl font-black text-emerald-800">24/7</p>
                                    <p className="text-[11px] text-slate-500 font-bold">AI Safety Nets</p>
                                </div>
                                <div className="text-left border-l border-slate-200 pl-3">
                                    <p className="text-xl sm:text-2xl font-black text-slate-900">100%</p>
                                    <p className="text-[11px] text-slate-500 font-bold">DPA Compliant</p>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Visual Showcase Column */}
                        <div className="lg:col-span-5">
                            <div className="relative">
                                {/* Ambient decorative backdrop */}
                                <div className="absolute -inset-2 bg-gradient-to-r from-teal-400/20 to-emerald-400/20 rounded-3xl blur-xl" />

                                <div className="relative bg-white/95 backdrop-blur-md rounded-3xl border border-teal-200 shadow-2xl p-5 sm:p-6 space-y-4">
                                    {/* Simulated Live Patient Card Header */}
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-10 h-10 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center font-black text-teal-800 text-sm">
                                                E
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                                                    Baby Elijah
                                                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">Bed 4B</span>
                                                </h4>
                                                <p className="text-[11px] text-slate-500 font-medium">Assigned: Primary Caregiver</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 alaga-streaming-radar" />
                                            <span className="text-[10px] font-black uppercase text-teal-800">Streaming</span>
                                        </div>
                                    </div>

                                    {/* 2x2 Mini Vitals Showcase */}
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Heart Rate</span>
                                                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/30 animate-pulse" />
                                            </div>
                                            <p className="text-xl font-black text-slate-900 tracking-tight">
                                                {demoHeartRate} <span className="text-xs font-medium text-slate-400">bpm</span>
                                            </p>
                                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                                                Normal
                                            </span>
                                        </div>

                                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">SpO₂ Oxygen</span>
                                                <Activity className="w-3.5 h-3.5 text-sky-500" />
                                            </div>
                                            <p className="text-xl font-black text-slate-900 tracking-tight">
                                                99 <span className="text-xs font-medium text-slate-400">%</span>
                                            </p>
                                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                                                Optimal
                                            </span>
                                        </div>

                                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Body Temp</span>
                                                <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                                            </div>
                                            <p className="text-xl font-black text-slate-900 tracking-tight">
                                                36.8 <span className="text-xs font-medium text-slate-400">°C</span>
                                            </p>
                                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                                                Stable
                                            </span>
                                        </div>

                                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Diaper Wetness</span>
                                                <Droplets className="w-3.5 h-3.5 text-teal-600 fill-teal-500/20" />
                                            </div>
                                            <p className="text-xl font-black text-slate-900 tracking-tight">
                                                12 <span className="text-xs font-medium text-slate-400">%</span>
                                            </p>
                                            <span className="text-[9px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 inline-block mt-0.5">
                                                Dry & Clean
                                            </span>
                                        </div>
                                    </div>

                                    {/* Live Interactive Notification Card */}
                                    <div className="p-3 rounded-xl bg-teal-50/80 border border-teal-200 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="p-2 rounded-lg bg-teal-600 text-white shrink-0">
                                                <Bell className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-teal-950 truncate">
                                                    {demoAlertAcknowledged ? 'Alert Acknowledged' : 'Gentle Chime: Feeding Schedule'}
                                                </p>
                                                <p className="text-[10px] text-teal-800 truncate">
                                                    {demoAlertAcknowledged ? 'Caregiver marked task complete.' : 'Scheduled doctor feeding due in 10 minutes.'}
                                                </p>
                                            </div>
                                        </div>

                                        {!demoAlertAcknowledged ? (
                                            <Button
                                                size="sm"
                                                onClick={() => setDemoAlertAcknowledged(true)}
                                                className="h-7 px-2.5 text-[11px] bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg shrink-0 alaga-btn-tactile flex items-center gap-1"
                                            >
                                                <Check className="w-3 h-3" />
                                                <span>Acknowledge</span>
                                            </Button>
                                        ) : (
                                            <button
                                                onClick={() => setDemoAlertAcknowledged(false)}
                                                className="text-[10px] font-bold text-teal-700 underline shrink-0 hover:text-teal-900"
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                        <span className="flex items-center gap-1">
                                            <Wifi className="w-3 h-3 text-emerald-600" /> Sensor Online (WiFi RSSI: -48 dBm)
                                        </span>
                                        <span>Battery: 94%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* 3. FEATURED PRODUCTS / HARDWARE (Inspired by fursight.shop)       */}
            {/* ================================================================ */}
            <section id="solutions" className="py-16 sm:py-20 bg-white border-b border-slate-200/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    {/* Section Header */}
                    <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase tracking-wider mb-3">
                            <Layers className="w-3.5 h-3.5" />
                            <span>Featured Healthcare Solutions</span>
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                            Medical-Grade IoT Sensors & Intelligent Software
                        </h2>
                        <p className="text-sm sm:text-base text-slate-600 mt-2">
                            Engineered for effortless patient wearability, continuous telemetry streaming, and proactive clinical intervention.
                        </p>
                    </div>

                    {/* Solutions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {SOLUTIONS.map((item) => {
                            const IconComp = item.icon;
                            return (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-teal-300 hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group alaga-card-interactive"
                                >
                                    {/* Card Header & Icon */}
                                    <div className="p-6 pb-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`w-12 h-12 rounded-xl ${item.bgTint} ${item.color} border ${item.borderColor} flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform`}>
                                                <IconComp className="w-6 h-6" />
                                            </div>
                                            <Badge variant="outline" className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${item.bgTint} ${item.color} ${item.borderColor}`}>
                                                {item.badge}
                                            </Badge>
                                        </div>

                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                            {item.category}
                                        </span>
                                        <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-teal-700 transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                                            {item.description}
                                        </p>
                                    </div>

                                    {/* Specs preview list */}
                                    <div className="px-6 py-3 bg-slate-50/70 border-t border-b border-slate-100 space-y-1.5 flex-1">
                                        {item.specs.slice(0, 3).map((spec, sIdx) => (
                                            <div key={sIdx} className="flex items-center gap-2 text-[11px] text-slate-600">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                                <span className="truncate">{spec}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Card Footer Actions (Quick View modal like fursight) */}
                                    <div className="p-4 px-6 flex items-center justify-between gap-3 bg-white">
                                        <button
                                            onClick={() => setSelectedSolution(item)}
                                            className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 transition-colors"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Quick View</span>
                                        </button>

                                        <Button
                                            size="sm"
                                            onClick={() => navigate('/signup')}
                                            className="h-8 px-3.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg shadow-xs alaga-btn-tactile flex items-center gap-1"
                                        >
                                            <span>Access Portal</span>
                                            <ChevronRight className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* 4. "WHY ALAGA" BENEFITS (Inspired by fursight-home-benefits)      */}
            {/* ================================================================ */}
            <section id="benefits" className="py-16 sm:py-20 alaga-ambient-bg border-b border-teal-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 border border-teal-300 text-teal-900 text-xs font-bold uppercase tracking-wider mb-3">
                            <Shield className="w-3.5 h-3.5" />
                            <span>Clinical Excellence</span>
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                            Built for Easier, Less Overwhelming Care
                        </h2>
                        <p className="text-sm sm:text-base text-slate-600 mt-2">
                            Healthcare monitoring can get chaotic. ALAGA introduces intelligent filtering and calm design to restore clarity.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm hover:shadow-lg transition-all space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                                <Shield className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900">AI Artifact Rejection</h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Our One-Class SVM machine learning model separates active infant crying, movement, and feeding from real clinical hypoxia or hyperthermia.
                            </p>
                            <div className="text-[11px] font-semibold text-teal-700 bg-teal-50/80 p-2.5 rounded-lg border border-teal-200/80">
                                Reduces nuisance alarm fatigue by over 80%.
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm hover:shadow-lg transition-all space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                                <Users className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900">Role-Tailored Workspaces</h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Parents receive simple comfort alerts, medical staff see 24-hour vital trends, and facility admins manage ward bed assignments seamlessly.
                            </p>
                            <div className="text-[11px] font-semibold text-sky-700 bg-sky-50/80 p-2.5 rounded-lg border border-sky-200/80">
                                Granular permissions compliant with HIPAA and DPA.
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm hover:shadow-lg transition-all space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                                <Bell className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900">Gentle vs Urgent Chimes</h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Customize your auditory environment. Choose tranquil, low-stress gentle chimes for quiet home nurseries or high-urgency alarms for hospital wards.
                            </p>
                            <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200/80">
                                Fast Acknowledge, Flag Normal, and Mute actions.
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* 5. HOW IT WORKS (3-Step Rapid Onboarding Walkthrough)            */}
            {/* ================================================================ */}
            <section id="how-it-works" className="py-16 sm:py-20 bg-white border-b border-slate-200/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                            Start Monitoring in 3 Simple Steps
                        </h2>
                        <p className="text-sm sm:text-base text-slate-600 mt-2">
                            Pair hardware devices, invite caregivers, and monitor live telemetry in minutes.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 relative space-y-3 text-center sm:text-left">
                            <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-black text-base flex items-center justify-center mx-auto sm:mx-0 shadow-sm">
                                1
                            </div>
                            <h4 className="text-base font-bold text-slate-900">Attach Sensor Clip</h4>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Fasten the Smart Diaper clip securely to the outer front fold or place the soft pulse-oximetry wristband.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 relative space-y-3 text-center sm:text-left">
                            <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-black text-base flex items-center justify-center mx-auto sm:mx-0 shadow-sm">
                                2
                            </div>
                            <h4 className="text-base font-bold text-slate-900">Connect to WiFi</h4>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Turn on the device. It automatically pairs to your hospital ward or home WiFi and establishes real-time WebSockets.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 relative space-y-3 text-center sm:text-left">
                            <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-black text-base flex items-center justify-center mx-auto sm:mx-0 shadow-sm">
                                3
                            </div>
                            <h4 className="text-base font-bold text-slate-900">Stream & Protect</h4>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Monitor live vitals from any browser or phone. Receive proactive alerts and check the built-in user manual anytime.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* 6. CALL TO ACTION (Inspired by fursight-home-cta)                 */}
            {/* ================================================================ */}
            <section className="py-16 sm:py-20 bg-slate-50">
                <div className="max-w-5xl mx-auto px-4 sm:px-6">
                    <div className="bg-gradient-to-r from-teal-950 via-teal-800 to-teal-950 text-white rounded-3xl p-8 sm:p-14 shadow-2xl relative overflow-hidden text-center space-y-6">
                        {/* Decorative circle glow */}
                        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -left-20 -top-20 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative z-10 space-y-3">
                            <Badge className="bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider px-3 py-1">
                                Ready for Deployment
                            </Badge>
                            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                                Ready to experience intelligent, peaceful care?
                            </h2>
                            <p className="text-sm sm:text-base text-teal-100/90 max-w-xl mx-auto leading-relaxed">
                                Create an account or sign in to your dashboard to monitor live vitals, schedule patient care tasks, and configure threshold safety nets.
                            </p>
                        </div>

                        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => navigate('/signup')}
                                className="w-full sm:w-auto h-12 px-8 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-sm shadow-lg flex items-center justify-center gap-2 alaga-btn-tactile transition-all"
                            >
                                <span>Get Started for Free</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="w-full sm:w-auto h-12 px-8 bg-white hover:bg-teal-50 text-teal-950 font-black rounded-xl text-sm shadow-lg border-2 border-white flex items-center justify-center gap-2 alaga-btn-tactile transition-all"
                            >
                                <span>Sign In to Account</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================ */}
            {/* 7. FOOTER                                                        */}
            {/* ================================================================ */}
            <footer className="bg-[#061126] text-white border-t border-slate-800 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <img 
                                src="/alaga-robot-logo.png" 
                                alt="Alaga Logo" 
                                className="w-9 h-9 object-contain drop-shadow-[0_2px_8px_rgba(20,184,166,0.3)] shrink-0" 
                            />
                            <div>
                                <span className="text-xl font-black italic tracking-tight text-white">ALAGA</span>
                                <span className="text-[10px] font-black text-amber-400 uppercase ml-2">Healthcare System</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
                            <Link to="/login" className="hover:text-white transition-colors">Caregiver Login</Link>
                            <Link to="/signup" className="hover:text-white transition-colors">Registration</Link>
                            <a href="#solutions" className="hover:text-white transition-colors">Hardware Solutions</a>
                            <a href="#benefits" className="hover:text-white transition-colors">Clinical Benefits</a>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                        <p>&copy; {new Date().getFullYear()} ALAGA Smart Healthcare Platform. All rights reserved.</p>
                        <p className="text-[11px] text-slate-500 max-w-md text-center sm:text-right">
                            Notice: ALAGA is an assistive patient monitoring device platform. In life-threatening clinical emergencies, always consult attending hospital medical staff immediately.
                        </p>
                    </div>
                </div>
            </footer>

            {/* ================================================================ */}
            {/* QUICK VIEW MODAL (Just like fursight.shop quick-view-modal)       */}
            {/* ================================================================ */}
            {selectedSolution && (
                <Dialog open={!!selectedSolution} onOpenChange={() => setSelectedSolution(null)}>
                    <DialogContent className="max-w-xl w-[95vw] rounded-2xl bg-white p-0 gap-0 overflow-hidden border-slate-200 shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-5 bg-gradient-to-r from-teal-800 to-teal-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                                    <selectedSolution.icon className="w-5 h-5 text-teal-200" />
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-black text-white">
                                        {selectedSolution.title}
                                    </DialogTitle>
                                    <DialogDescription className="text-teal-200 text-xs font-semibold">
                                        {selectedSolution.category} &bull; {selectedSolution.badge}
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4 bg-slate-50/60 max-h-[70vh] overflow-y-auto">
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Overview & Purpose
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200">
                                    {selectedSolution.description}
                                </p>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Technical Specifications
                                </h4>
                                <div className="space-y-2">
                                    {selectedSolution.specs.map((spec, idx) => (
                                        <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700">
                                            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                                            <span>{spec}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-950">
                                <h5 className="text-xs font-bold text-teal-900 mb-1 flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-teal-600" />
                                    Clinical & Practical Benefit
                                </h5>
                                <p className="text-xs text-teal-900/90 leading-relaxed">
                                    {selectedSolution.clinicalBenefit}
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSolution(null)}
                                className="font-semibold text-xs border-slate-300"
                            >
                                Close
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setSelectedSolution(null);
                                    navigate('/signup');
                                }}
                                className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg alaga-btn-tactile flex items-center gap-1.5"
                            >
                                <span>Get Started with ALAGA</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};
