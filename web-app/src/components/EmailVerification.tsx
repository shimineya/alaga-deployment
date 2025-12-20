import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Activity, Mail, Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export const EmailVerification: React.FC = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeLeft, setLockTimeLeft] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeExpired, setCodeExpired] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Mock verification code (in real app, this would be generated server-side)
  const [correctCode] = useState('123456');
  const [codeExpiryTime, setCodeExpiryTime] = useState(Date.now() + 10 * 60 * 1000); // 10 minutes

  useEffect(() => {
    // Check if user came from signup
    const signupData = sessionStorage.getItem('signupData');
    if (!signupData) {
      navigate('/signup');
      return;
    }

    // Auto-focus first input
    inputRefs.current[0]?.focus();
  }, [navigate]);

  // Resend timer
  useEffect(() => {
    if (timeLeft > 0 && !canResend) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      setCanResend(true);
    }
  }, [timeLeft, canResend]);

  // Lock timer
  useEffect(() => {
    if (isLocked && lockTimeLeft > 0) {
      const timer = setTimeout(() => setLockTimeLeft(lockTimeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockTimeLeft === 0 && isLocked) {
      setIsLocked(false);
      setAttempts(0);
      toast.success('Account unlocked. You may try again.');
    }
  }, [isLocked, lockTimeLeft]);

  // Check code expiry
  useEffect(() => {
    const checkExpiry = setInterval(() => {
      if (Date.now() > codeExpiryTime) {
        setCodeExpired(true);
        toast.error('Your verification code has expired. Please request a new one.');
      }
    }, 1000);

    return () => clearInterval(checkExpiry);
  }, [codeExpiryTime]);

  const handleInputChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits are entered
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      setTimeout(() => verifyCode(newCode.join('')), 300);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current input
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
    const pastedData = e.clipboardData.getData('text').trim();
    
    // Only process if it's 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      
      // Auto-verify
      setTimeout(() => verifyCode(pastedData), 300);
    }
  };

  const verifyCode = (enteredCode: string) => {
    if (isLocked) {
      toast.error(`Too many attempts. Please wait ${Math.floor(lockTimeLeft / 60)}:${(lockTimeLeft % 60).toString().padStart(2, '0')}`);
      return;
    }

    if (codeExpired) {
      toast.error('This code has expired. Please request a new one.');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      return;
    }

    setIsVerifying(true);

    // Simulate API call
    setTimeout(() => {
      if (enteredCode === correctCode) {
        // Success - green animation
        toast.success('Email verified successfully!');
        
        // Get signup data and complete registration
        const signupData = sessionStorage.getItem('signupData');
        if (signupData) {
          const userData = JSON.parse(signupData);
          // In real app, send to backend here
          console.log('Registering user:', userData);
          
          // Clear session storage
          sessionStorage.removeItem('signupData');
          
          // Redirect to login
          setTimeout(() => {
            navigate('/login');
          }, 1500);
        }
      } else {
        // Incorrect code - red animation with shake
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= 5) {
          setIsLocked(true);
          setLockTimeLeft(30 * 60); // 30 minutes
          toast.error('Too many failed attempts. Account locked for 30 minutes.');
        } else {
          toast.error(`Invalid code. ${5 - newAttempts} attempts remaining.`);
        }

        // Shake animation
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
      setIsVerifying(false);
    }, 800);
  };

  const handleResendCode = () => {
    if (!canResend || codeExpired) {
      // Generate new code
      setCodeExpired(false);
      setCodeExpiryTime(Date.now() + 10 * 60 * 1000);
      setTimeLeft(60);
      setCanResend(false);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      toast.success('A new verification code has been sent to your email');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCodeStatus = () => {
    const enteredCode = code.join('');
    if (enteredCode.length === 6) {
      if (isVerifying) return 'verifying';
      if (enteredCode === correctCode) return 'success';
      return 'error';
    }
    return 'default';
  };

  const status = getCodeStatus();

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F0FAF9' }}>
      <Card className="w-full max-w-md border-0" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ 
                backgroundColor: '#7DD3C0',
                boxShadow: '0 0 30px rgba(125, 211, 192, 0.4)'
              }}
            >
              <Mail className="w-9 h-9 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl mb-2" style={{ color: '#2C3E50' }}>
            Verify Your Email
          </CardTitle>
          <CardDescription className="text-base">
            We've sent a 6-digit code to your email address
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Warning Messages */}
          {isLocked && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm text-red-800">
                    Too many failed attempts. Please try again in {formatTime(lockTimeLeft)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {codeExpired && (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800">
                    This code has expired. Please request a new one.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Code Input Boxes */}
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={isLocked || isVerifying}
                  className={`
                    w-12 h-14 text-center text-2xl rounded-lg border-2 transition-all
                    focus:outline-none focus:ring-2
                    ${status === 'success' 
                      ? 'border-green-500 bg-green-50 text-green-700' 
                      : status === 'error'
                      ? 'border-red-500 bg-red-50 text-red-700 animate-shake'
                      : 'border-gray-300 focus:border-[#7DD3C0] focus:ring-[#7DD3C0]/20'
                    }
                    ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    color: status === 'default' ? '#2C3E50' : undefined
                  }}
                />
              ))}
            </div>

            {/* Status Message */}
            {status === 'verifying' && (
              <p className="text-center text-sm" style={{ color: '#7DD3C0' }}>
                Verifying code...
              </p>
            )}
            {status === 'success' && (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Shield className="w-4 h-4" />
                <p className="text-sm">Code verified successfully!</p>
              </div>
            )}
          </div>

          {/* Security Info */}
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#E8F6F3' }}>
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 mt-0.5" style={{ color: '#7DD3C0' }} />
              <div className="flex-1">
                <p className="text-sm mb-2" style={{ color: '#2C3E50' }}>
                  <strong>Security Notice:</strong>
                </p>
                <ul className="text-xs space-y-1" style={{ color: '#7F8C8D' }}>
                  <li>• Code expires in 10 minutes</li>
                  <li>• Maximum 5 attempts allowed</li>
                  <li>• Account locks for 30 minutes after 5 failed attempts</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Resend Code */}
          <div className="text-center">
            <p className="text-sm mb-2" style={{ color: '#7F8C8D' }}>
              Didn't receive the code?
            </p>
            {canResend || codeExpired ? (
              <Button
                onClick={handleResendCode}
                variant="outline"
                size="sm"
                style={{ color: '#7DD3C0', borderColor: '#7DD3C0' }}
              >
                Resend Code
              </Button>
            ) : (
              <Button
                disabled
                variant="outline"
                size="sm"
                className="opacity-50 cursor-not-allowed"
              >
                Resend in {formatTime(timeLeft)}
              </Button>
            )}
          </div>

          {/* Back to Login */}
          <div className="text-center pt-4 border-t">
            <button
              onClick={() => {
                sessionStorage.removeItem('signupData');
                navigate('/login');
              }}
              className="text-sm underline"
              style={{ color: '#7DD3C0' }}
            >
              Back to Login
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Add shake animation */}
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