import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, ArrowDown, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../lib/config';

export interface LegalForm {
  id: string;
  title: string;
  category: string;
  role_scope: string;
  summary: string;
  content: string;
}

interface ConsentAgreementModalProps {
  isOpen: boolean;
  userId?: number;
  userRole?: string;
  authToken?: string | null;
  onAccepted: () => void;
  isReadOnly?: boolean; // When viewing from Settings
  onClose?: () => void;  // For read-only settings view
}

const DEFAULT_FALLBACK_FORMS: LegalForm[] = [
  {
    id: 'terms_and_conditions',
    title: 'Platform Terms and Conditions',
    category: 'Legal & Terms of Service',
    role_scope: 'all',
    summary: 'Governs acceptable use of the ALAGA healthcare monitoring portal, account responsibilities, system uptime, and auxiliary hardware disclaimers.',
    content: `1. ACCEPTANCE OF TERMS\nBy accessing or using the ALAGA Healthcare Monitoring System (Web and Mobile Applications, firmware-enabled IoT clips, and cloud services), you acknowledge and agree to be bound by these Platform Terms and Conditions. If you do not agree with any provision herein, you must refrain from accessing or utilizing the platform.\n\n2. AUXILIARY HARDWARE DISCLAIMER\nALAGA HARDWARE DEVICES ARE AUXILIARY MONITORING AIDS AND ARE NOT CERTIFIED AS LIFE-SUPPORT SYSTEMS. The system is designed to augment, not substitute, hands-on clinical observation, parental attentiveness, and professional medical supervision.\n\n3. ACCOUNT CREDENTIALS & SECURITY OBLIGATIONS\nUsers are solely responsible for preserving the confidentiality of their credentials and session tokens.\n\n4. CONNECTIVITY LIMITATIONS\nTelemetry streaming relies on Wi-Fi, battery capacity, cellular internet connectivity, and cloud backend availability. ALAGA implements automatic store-and-forward buffers during network drops.`
  },
  {
    id: 'privacy_policy',
    title: 'Platform Privacy Policy (RA 10173)',
    category: 'Data Governance & Privacy',
    role_scope: 'all',
    summary: 'Details lawful processing of Personal Health Information (PHI) under Philippine Republic Act 10173 (Data Privacy Act of 2012).',
    content: `1. STATUTORY COMPLIANCE\nIn accordance with Republic Act No. 10173 (Philippine Data Privacy Act of 2012), ALAGA adheres to transparency, legitimate purpose, and proportionality in collecting and processing Personal Health Information.\n\n2. INFORMATION COLLECTED\nDemographics, real-time vital telemetry (heart rate, SpO2, body temperature), diaper moisture percentages, sensor attachment status, and device battery/signal telemetry.\n\n3. ENCRYPTION & DATA STORAGE\nAll telemetry transmitted between IoT sensors, mobile devices, and backend endpoints is encrypted in transit using TLS 1.3. Database records are encrypted at rest with AES-256 standards.\n\n4. ACCESS CONTROL\nAccess to patient telemetry is strictly scoped to enrolled parents or assigned clinical staff.`
  },
  {
    id: 'telemetry_authorization',
    title: 'Informed Health Data Consent & Telemetry Authorization',
    category: 'Clinical Telemetry Consent',
    role_scope: 'all',
    summary: 'Explicit authorization for continuous optical biometric streaming and smart diaper moisture sampling.',
    content: `1. PURPOSE OF CONTINUOUS MONITORING\nContinuous telemetry collection enables immediate identification of acute physiological changes, fever onset, hypoxia episodes, and wet diaper saturation.\n\n2. NATURE OF WEARABLE SENSORS\nYou authorize placement and operation of MAX30102 Optical PPG clips and conductive diaper moisture probes.\n\n3. POTENTIAL RISKS & SKIN INTEGRITY\nSensor components utilize medical-grade hypoallergenic casings. Caregivers agree to routinely inspect skin during diaper changes.`
  },
  {
    id: 'ai_decision_support_disclaimer',
    title: 'AI Decision-Support & Clinical Telemetry Disclaimer',
    category: 'AI & Algorithm Disclaimer',
    role_scope: 'all',
    summary: 'Auxiliary decision-support safeguard declaring algorithms serve non-diagnostic functions only.',
    content: `1. NON-DIAGNOSTIC NATURE OF ALGORITHMIC OUTPUTS\nALL AI INSIGHTS, PREDICTIVE TRENDS, RISK INDICATORS, AND AUTOMATED RECOMMENDATIONS ARE CLASSIFIED AS NON-DIAGNOSTIC CLINICAL DECISION-SUPPORT AIDS.\n\n2. PRESERVATION OF CLINICAL AUTONOMY\nLicensed healthcare providers, caregivers, and legal guardians retain complete clinical authority and responsibility for patient care.`
  },
  {
    id: 'emergency_escalation_protocol',
    title: 'Emergency Care & Escalation Protocol Acknowledgment',
    category: 'Emergency Protocols',
    role_scope: 'all',
    summary: 'Operational instructions and escalation protocols when emergency vital signs are triggered.',
    content: `1. CRITICAL VITAL ACTION THRESHOLDS\nWhen an alarm status switches to "CRITICAL", immediately perform physical assessment of the patient and verify sensor seating before escalating according to facility clinical protocol.\n\n2. NETWORK DISRUPTIONS IN EMERGENCIES\nIn life-threatening emergencies, never delay contacting emergency medical responders while troubleshooting connectivity.`
  }
];

export const ConsentAgreementModal: React.FC<ConsentAgreementModalProps> = ({
  isOpen,
  userId,
  userRole = 'all',
  authToken,
  onAccepted,
  isReadOnly = false,
  onClose,
}) => {
  const [forms, setForms] = useState<LegalForm[]>(DEFAULT_FALLBACK_FORMS);
  const [activeFormIndex, setActiveFormIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState<Record<string, boolean>>({});
  const [acceptedCheckboxes, setAcceptedCheckboxes] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchForms = async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        const roleQuery = userRole ? `?role=${encodeURIComponent(userRole)}` : '';
        const res = await fetch(`${API_URL}/api/compliance/forms${roleQuery}`, { headers });
        const data = await res.json();
        if (data.success && Array.isArray(data.forms) && data.forms.length > 0) {
          setForms(data.forms);
          // If in read-only mode, mark all as scrolled
          if (isReadOnly) {
            const allScrolled: Record<string, boolean> = {};
            data.forms.forEach((f: LegalForm) => { allScrolled[f.id] = true; });
            setHasScrolledToBottom(allScrolled);
          }
        }
      } catch (err) {
        console.warn('Compliance API forms fetch failed, utilizing embedded fallback forms:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, [isOpen, userRole, authToken, isReadOnly]);

  const activeForm = forms[activeFormIndex];

  // Scroll detection to enforce reading the document to the very bottom
  const handleScroll = () => {
    if (!contentRef.current || !activeForm) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    if (scrollHeight - scrollTop <= clientHeight + 25) {
      if (!hasScrolledToBottom[activeForm.id]) {
        setHasScrolledToBottom(prev => ({ ...prev, [activeForm.id]: true }));
      }
    }
  };

  // Reset scroll and re-check if document fits in container without scrolling
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
      const { scrollHeight, clientHeight } = contentRef.current;
      if (scrollHeight <= clientHeight + 10 && activeForm) {
        setHasScrolledToBottom(prev => ({ ...prev, [activeForm.id]: true }));
      }
    }
  }, [activeFormIndex, activeForm]);

  if (!isOpen) return null;

  const currentScrolled = activeForm ? !!hasScrolledToBottom[activeForm.id] : false;
  const allFormsScrolled = forms.length > 0 && forms.every(f => !!hasScrolledToBottom[f.id]);
  const allCheckboxesChecked = forms.length > 0 && forms.every(f => !!acceptedCheckboxes[f.id]);
  const canSubmit = allFormsScrolled && allCheckboxesChecked;

  const handleAcceptAll = async () => {
    if (isReadOnly) {
      onClose?.();
      return;
    }
    if (!canSubmit) {
      toast.warning('Please review all documents to the bottom and confirm agreements.');
      return;
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const bodyPayload = {
        user_id: userId,
        version: 'v1.0',
        forms_accepted: forms.map(f => f.id),
      };

      const res = await fetch(`${API_URL}/api/compliance/accept`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Compliance agreements accepted and recorded in clinical audit log.');
        onAccepted();
      } else {
        toast.error(data.message || 'Failed to record consent agreements.');
      }
    } catch {
      toast.error('Network error while recording compliance agreements.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">ALAGA Governance &amp; Clinical Consents</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-500/30 text-teal-200 px-2 py-0.5 rounded-full border border-teal-400/30">
                  Version 1.0 &bull; RA 10173
                </span>
              </div>
              <p className="text-xs text-teal-100/80 mt-0.5">
                {isReadOnly 
                  ? 'Active legal policies, data protection notices, and clinical telemetry authorizations' 
                  : 'Review and read each document to the end to acknowledge terms before continuing'}
              </p>
            </div>
          </div>
          {isReadOnly && onClose && (
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 transition-colors"
            >
              Close
            </button>
          )}
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Loading clinical consent documentation...</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
            
            {/* Sidebar with Tabs */}
            <div className="w-full md:w-72 bg-slate-50 border-r border-slate-200 p-3 overflow-y-auto flex flex-row md:flex-col gap-1.5 shrink-0">
              <div className="hidden md:block px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Required Agreements ({forms.length})
              </div>
              {forms.map((f, idx) => {
                const isCurrent = idx === activeFormIndex;
                const isScrolled = !!hasScrolledToBottom[f.id];
                const isChecked = !!acceptedCheckboxes[f.id];

                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFormIndex(idx)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-2.5 border text-xs ${
                      isCurrent
                        ? 'bg-white border-teal-500 text-teal-950 font-semibold shadow-xs'
                        : 'bg-transparent border-transparent hover:bg-slate-200/60 text-slate-700'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isChecked ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isScrolled ? (
                        <div className="w-4 h-4 rounded-full border-2 border-teal-500 flex items-center justify-center text-[9px] font-bold text-teal-700">✓</div>
                      ) : (
                        <FileText className={`w-4 h-4 ${isCurrent ? 'text-teal-600' : 'text-slate-400'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{f.title}</div>
                      <div className="text-[10px] text-slate-400 truncate">{f.category}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Main Document Viewer */}
            {activeForm && (
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
                
                {/* Document Subheader */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{activeForm.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{activeForm.summary}</p>
                  </div>
                  <div className="shrink-0">
                    {currentScrolled ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Fully Reviewed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                        <ArrowDown className="w-3.5 h-3.5" /> Read to the End
                      </span>
                    )}
                  </div>
                </div>

                {/* Document Scrollable Text */}
                <div
                  ref={contentRef}
                  onScroll={handleScroll}
                  className="flex-1 p-5 overflow-y-auto text-xs text-slate-700 leading-relaxed font-sans space-y-4 max-h-[380px] bg-slate-50/30"
                >
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs whitespace-pre-wrap font-sans">
                    {activeForm.content}
                  </div>
                </div>

                {/* Per-form Acceptance Checkbox */}
                {!isReadOnly && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`chk-${activeForm.id}`}
                      disabled={!currentScrolled}
                      checked={!!acceptedCheckboxes[activeForm.id]}
                      onChange={(e) => {
                        setAcceptedCheckboxes(prev => ({
                          ...prev,
                          [activeForm.id]: e.target.checked
                        }));
                      }}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    />
                    <label
                      htmlFor={`chk-${activeForm.id}`}
                      className={`text-xs select-none ${
                        currentScrolled
                          ? 'text-slate-800 font-semibold cursor-pointer'
                          : 'text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {currentScrolled
                        ? `I have reviewed and agree to the ${activeForm.title}`
                        : `Please read to the end of this document before confirming agreement`}
                    </label>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="bg-slate-100/90 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-teal-600" />
            <span>Cryptographically sealed under RA 10173 &bull; Recorded in HIPAA Audit Trail</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isReadOnly && activeFormIndex < forms.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveFormIndex(prev => prev + 1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Next Document &rarr;
              </button>
            )}

            {!isReadOnly ? (
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={handleAcceptAll}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Recording Consent...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Accept All Consents &amp; Continue
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
              >
                Close Policies
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
