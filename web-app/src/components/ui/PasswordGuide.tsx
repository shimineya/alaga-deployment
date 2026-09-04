import React, { useMemo } from 'react';
import { Check } from 'lucide-react';

export interface PasswordCriteriaResult {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

export const checkPasswordCriteria = (pwd: string, minLength = 8): PasswordCriteriaResult => {
  const safePwd = pwd || '';
  const result = {
    minLength: safePwd.length >= minLength,
    hasUpper: /[A-Z]/.test(safePwd),
    hasLower: /[a-z]/.test(safePwd),
    hasNumber: /[0-9]/.test(safePwd),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-=+~`[\]\\;/]/.test(safePwd),
  };
  return {
    ...result,
    isValid: result.minLength && result.hasUpper && result.hasLower && result.hasNumber && result.hasSpecial,
  };
};

interface PasswordGuideProps {
  password: string;
  minLength?: number;
  className?: string;
  compact?: boolean;
}

export const PasswordGuide: React.FC<PasswordGuideProps> = ({
  password,
  minLength = 8,
  className = '',
  compact = false
}) => {
  const criteria = useMemo(() => checkPasswordCriteria(password, minLength), [password, minLength]);

  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5 text-[11px] ${className}`}>
      <div className="flex items-center justify-between text-slate-700 font-semibold text-[11px]">
        <span>Password Requirements</span>
        {criteria.isValid ? (
          <span className="text-emerald-600 flex items-center gap-1 font-bold text-[10px]">
            <Check className="w-3 h-3 text-emerald-600" /> Meets Criteria
          </span>
        ) : (
          <span className="text-slate-400 font-normal text-[10px]">
            {password.length === 0 ? 'Requirements' : 'Incomplete'}
          </span>
        )}
      </div>

      <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-2'} gap-x-2 gap-y-1 text-slate-600 text-[10px]`}>
        <div className={`flex items-center gap-1.5 transition-colors ${criteria.minLength ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
          {criteria.minLength ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-0.5 mr-1 shrink-0" />}
          {minLength}+ characters
        </div>
        <div className={`flex items-center gap-1.5 transition-colors ${criteria.hasUpper ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
          {criteria.hasUpper ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-0.5 mr-1 shrink-0" />}
          1 uppercase letter (A-Z)
        </div>
        <div className={`flex items-center gap-1.5 transition-colors ${criteria.hasLower ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
          {criteria.hasLower ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-0.5 mr-1 shrink-0" />}
          1 lowercase letter (a-z)
        </div>
        <div className={`flex items-center gap-1.5 transition-colors ${criteria.hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
          {criteria.hasNumber ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-0.5 mr-1 shrink-0" />}
          1 numeric digit (0-9)
        </div>
        <div className={`flex items-center gap-1.5 transition-colors ${compact ? '' : 'col-span-2'} ${criteria.hasSpecial ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
          {criteria.hasSpecial ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-0.5 mr-1 shrink-0" />}
          1 special symbol (!@#$%^&*)
        </div>
      </div>
    </div>
  );
};
