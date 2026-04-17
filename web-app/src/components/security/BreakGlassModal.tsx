import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface BreakGlassModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  targetHub: string;
}

export const BreakGlassModal: React.FC<BreakGlassModalProps> = ({ onSuccess, onCancel, targetHub }) => {
  const [justificationCode, setJustificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token, updateToken } = useAuth();

  const handleAcknowledge = async () => {
    // [TECHNICAL DEBT/PROTOTYPING] Default to a bypass code if none is provided to allow easy testing.
    // In a production environment, integration with an ITSM tool (like Jira/ServiceNow) would validate this code.
    const codeToSend = justificationCode.trim() || 'DEV-BYPASS-00000';

    if (codeToSend.length < 5) {
      toast.error('A valid justification code (min 5 characters) is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/break-glass`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ justification_code: codeToSend, target_hub: targetHub })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message);
        // Inline token update to avoid forcing a full page reload and losing context
        if (data.token) {
           updateToken(data.token);
        }
        onSuccess();
      } else {
        toast.error(data.message || 'Authorization failed.');
      }
    } catch (err) {
      toast.error('Network error. Could not establish Break-Glass session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4">
          <div className="bg-red-100 p-2 rounded-full shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-red-900 tracking-tight">Break-Glass Notice</h2>
            <p className="text-sm text-red-700 mt-1 leading-snug">
              You are about to access Protected Health Information (PHI). This action bypasses standard role-based access controls.
            </p>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              [OWASP A09 / HIPAA] Strict Audit Active. Your IP Address, internal ID, and timestamp will be permanently logged.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800 flex items-center justify-between">
              Justification / Ticket Code
              <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">Required</span>
            </label>
            <input
              type="text"
              value={justificationCode}
              onChange={(e) => setJustificationCode(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:opacity-50"
              placeholder="[DEV] Leave blank to bypass"
              autoFocus
            />
            <p className="text-[10px] text-slate-500 leading-tight">
              Provide an ITSM ticket number or emergency rationale required for compliance review.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel Access
          </button>
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-md text-sm font-semibold bg-red-600 text-white hover:bg-red-500 shadow-sm transition-colors focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? 'Verifying...' : 'Acknowledge & Access'}
          </button>
        </div>
      </div>
    </div>
  );
};
