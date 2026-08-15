import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Mail, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// [OWASP A07] Masks the email address for display so the user can confirm
// it is correct without fully exposing it on screen.
// Example: "coronado.carlgab@gmail.com" -> "co***@gmail.com"
const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split('@');
  if (!domain || localPart.length <= 2) return email;
  return `${localPart.slice(0, 2)}***@${domain}`;
};

const API_BASE = import.meta.env.VITE_API_URL || '';

export const EmailVerification: React.FC = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [shakeActive, setShakeActive] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // [OWASP A07] Pending verification context stored by SignUp.tsx after successful registration.
  const [pendingData, setPendingData] = useState<{ user_id: number; email: string } | null>(null);

  useEffect(() => {
    // [OWASP A07] Guard: if there is no pending verification context, the user
    // did not come from SignUp — redirect them back to start the flow correctly.
    const raw = sessionStorage.getItem('pendingOtpVerification');
    if (!raw) {
      navigate('/registration');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed.user_id || !parsed.email) throw new Error('Incomplete');
      setPendingData(parsed);
    } catch {
      sessionStorage.removeItem('pendingOtpVerification');
      navigate('/registration');
      return;
    }

    // Auto-focus first OTP box on mount
    inputRefs.current[0]?.focus();
  }, [navigate]);

  // Resend cooldown countdown
  useEffect(() => {
    if (canResend) return;
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendTimer(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer, canResend]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const triggerShake = () => {
    setShakeActive(true);
    setTimeout(() => setShakeActive(false), 600);
  };

  const handleInputChange = (index: number, value: string) => {
    // [OWASP A05] Allow only numeric digits in each OTP box.
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-advance focus to the next box
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are filled
    if (newCode.every(d => d !== '') && newCode.join('').length === 6) {
      setTimeout(() => submitCode(newCode.join('')), 300);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else {
        const newCode = [...code];
        newCode[index] = '';
        setCode(newCode);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split('');
      setCode(digits);
      inputRefs.current[5]?.focus();
      setTimeout(() => submitCode(pasted), 300);
    }
  };

  const submitCode = async (enteredCode: string) => {
    if (!pendingData) return;
    if (isVerifying) return;

    setIsVerifying(true);
    try {
      // [OWASP A05] Parameterized request body — no string concatenation.
      const response = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: pendingData.user_id,
          email: pendingData.email,
          otp: enteredCode,
          purpose: 'REGISTER_VERIFY',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Verification succeeded — clean up and send user to login
        sessionStorage.removeItem('pendingOtpVerification');
        toast.success('Email verified successfully! You can now log in.');
        setTimeout(() => navigate('/login'), 1200);
      } else {
        // [OWASP A10] Show only the server's message — no stack trace
        triggerShake();
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();

        if (response.status === 429) {
          toast.error('Too many incorrect attempts. Please request a new code.');
        } else {
          toast.error(data.message || 'Invalid code. Please try again.');
        }
      }
    } catch {
      // [OWASP A10] Generic network error — no internal detail exposed to the user
      toast.error('Network error. Please check your connection and try again.');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend || !pendingData || isResending) return;

    setIsResending(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: pendingData.user_id,
          email: pendingData.email,
          purpose: 'REGISTER_VERIFY',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('A new verification code has been sent to your email.');
        setCode(['', '', '', '', '', '']);
        setResendTimer(60);
        setCanResend(false);
        inputRefs.current[0]?.focus();
      } else if (response.status === 429) {
        // Backend enforces a 60-second cooldown between resend requests
        toast.error('Please wait at least 60 seconds before requesting another code.');
      } else {
        toast.error(data.message || 'Could not resend code. Please try again.');
      }
    } catch {
      toast.error('Network error. Could not resend code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('pendingOtpVerification');
    navigate('/login');
  };

  const codeString = code.join('');
  const isComplete = codeString.length === 6;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F0FAF9' }}>
      <Card className="w-full max-w-md border-0" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: '#7DD3C0',
                boxShadow: '0 0 30px rgba(125, 211, 192, 0.4)',
              }}
            >
              <Mail className="w-9 h-9 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl mb-2" style={{ color: '#2C3E50' }}>
            Verify Your Email
          </CardTitle>
          <CardDescription className="text-base">
            We sent a 6-digit code to
          </CardDescription>
          {pendingData && (
            <p className="text-sm font-semibold mt-1" style={{ color: '#7DD3C0' }}>
              {maskEmail(pendingData.email)}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* OTP Input Boxes */}
          <div className="space-y-3">
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={el => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleInputChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={isVerifying}
                  className={`
                    w-12 h-14 text-center text-2xl font-semibold rounded-lg border-2
                    transition-all focus:outline-none focus:ring-2
                    ${shakeActive ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 focus:border-[#7DD3C0] focus:ring-[#7DD3C0]/20'}
                    ${isVerifying ? 'opacity-60 cursor-not-allowed' : ''}
                    ${shakeActive ? 'animate-shake' : ''}
                  `}
                  style={{ color: '#2C3E50' }}
                />
              ))}
            </div>

            {/* Inline status */}
            {isVerifying && (
              <div className="flex items-center justify-center gap-2" style={{ color: '#7DD3C0' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <p className="text-sm">Verifying code...</p>
              </div>
            )}
          </div>

          {/* Security notice box */}
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#E8F6F3' }}>
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#7DD3C0' }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#2C3E50' }}>
                  Security Notice
                </p>
                <ul className="text-xs space-y-0.5" style={{ color: '#7F8C8D' }}>
                  <li>• Code expires in 10 minutes</li>
                  <li>• Maximum 5 attempts per code</li>
                  <li>• Do not share this code with anyone</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Resend section */}
          <div className="text-center">
            <p className="text-sm mb-2" style={{ color: '#7F8C8D' }}>
              Did not receive the code?
            </p>
            {canResend ? (
              <Button
                onClick={handleResendCode}
                disabled={isResending}
                variant="outline"
                size="sm"
                style={{ color: '#7DD3C0', borderColor: '#7DD3C0' }}
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  'Resend Code'
                )}
              </Button>
            ) : (
              <Button
                disabled
                variant="outline"
                size="sm"
                className="opacity-50 cursor-not-allowed"
              >
                Resend in {formatTime(resendTimer)}
              </Button>
            )}
          </div>

          {/* Warning if code has not arrived */}
          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-800">
                Check your spam folder if the email does not arrive within a minute.
                The sender will be listed as the Alaga system account.
              </p>
            </div>
          </div>

          {/* Cancel / back */}
          <div className="text-center pt-2 border-t">
            <button
              onClick={handleCancel}
              className="text-sm underline"
              style={{ color: '#7DD3C0' }}
            >
              Cancel and Return to Login
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  );
};