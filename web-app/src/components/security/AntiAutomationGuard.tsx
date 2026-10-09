import React, { useEffect, useState } from 'react';
import { detectUIAutomation, installSyntheticEventBlocker, AutomationDetectionResult } from '../../lib/antiAutomation';
import { ShieldAlert, RefreshCw, Lock, AlertTriangle, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface AntiAutomationGuardProps {
  children: React.ReactNode;
}

export const AntiAutomationGuard: React.FC<AntiAutomationGuardProps> = ({ children }) => {
  const [detection, setDetection] = useState<AutomationDetectionResult>({
    isAutomated: false,
    reason: null,
  });

  const runDetection = () => {
    const result = detectUIAutomation();
    setDetection(result);
    return result;
  };

  useEffect(() => {
    // 1. Initial check
    runDetection();

    // 2. Continuous background verification (detects runtime driver injection/evaluation)
    const interval = setInterval(() => {
      runDetection();
    }, 1500);

    // 3. Install capture-phase blocker for synthetic/untrusted DOM events
    const uninstallBlocker = installSyntheticEventBlocker((eventType, targetTag) => {
      toast.error('UI Automation Prohibited', {
        description: `Synthetic <${targetTag}> [${eventType}] event blocked. Automated DOM scripts are disabled on Alaga.`,
        duration: 4000,
      });
    });

    return () => {
      clearInterval(interval);
      uninstallBlocker();
    };
  }, []);

  if (detection.isAutomated) {
    return (
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-6 select-none font-sans text-white">
        <div className="max-w-lg w-full bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl overflow-hidden p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-inner shadow-rose-500/20">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 mb-3">
            <Lock className="w-3.5 h-3.5" /> Security Enforced
          </span>

          <h1 className="text-2xl font-bold text-slate-100 tracking-tight mb-2">
            UI Automation Detected & Blocked
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            An automated browser controller, script driver, or headless environment has been detected. In accordance with 
            <span className="text-slate-200 font-medium"> HIPAA § 164.312</span> and 
            <span className="text-slate-200 font-medium"> OWASP A07</span>, automated programmatic interaction with Alaga patient vital signs, medical records, and monitoring devices is strictly blocked.
          </p>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-left mb-6 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Detection Diagnostic</span>
            </div>
            <p className="text-xs font-mono text-slate-300 break-words leading-relaxed">
              {detection.reason || 'WebDriver automation runtime detected.'}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => runDetection()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm transition-all shadow-lg shadow-rose-600/25 active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              Re-scan Environment
            </button>
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <EyeOff className="w-3.5 h-3.5" />
              <span>Please launch Alaga in an unmodified human browser session</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AntiAutomationGuard;
