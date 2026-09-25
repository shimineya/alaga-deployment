// Audio & Vibration Alert Engine for ALAGA
// Supports 'gentle' (soft home chime) and 'high' (loud high-urgency alarm)

export interface AlertPreferences {
  alertTone: 'gentle' | 'high';
  vibrationEnabled: boolean;
}

const STORAGE_KEY = 'alaga_caregiver_prefs';

let sharedAudioCtx: AudioContext | null = null;
let hasUserInteracted = false;

if (typeof window !== 'undefined') {
  const markInteraction = () => {
    hasUserInteracted = true;
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    window.removeEventListener('click', markInteraction);
    window.removeEventListener('touchstart', markInteraction);
    window.removeEventListener('keydown', markInteraction);
  };
  window.addEventListener('click', markInteraction, { passive: true, capture: true });
  window.addEventListener('touchstart', markInteraction, { passive: true, capture: true });
  window.addEventListener('keydown', markInteraction, { passive: true, capture: true });
}

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended' && hasUserInteracted) {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function unlockAudioContext(): void {
  hasUserInteracted = true;
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function getAlertPreferences(): AlertPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        alertTone: parsed.alertTone === 'high' ? 'high' : 'gentle',
        vibrationEnabled: parsed.vibrationEnabled !== false,
      };
    }
  } catch {}
  return { alertTone: 'gentle', vibrationEnabled: true };
}

/**
 * Plays the alert sound based on the user's saved or specified tone preference and triggers vibration.
 */
export function playAlertTone(
  level: 'critical' | 'warning' = 'critical',
  overrideTone?: 'gentle' | 'high'
): void {
  // If the browser hasn't registered a user gesture yet, avoid triggering autoplay & vibration intervention warnings
  const userGestureActive = typeof navigator !== 'undefined' && (navigator as any).userActivation
    ? Boolean((navigator as any).userActivation.hasBeenActive)
    : hasUserInteracted;

  if (!userGestureActive) return;

  const prefs = getAlertPreferences();
  const tone = overrideTone || prefs.alertTone;
  const vibrate = prefs.vibrationEnabled;

  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  try {
    const now = ctx.currentTime;

    if (tone === 'gentle') {
      // Gentle Chime: Warm, soft harmonic sine tones (C5=523.25Hz, E5=659.25Hz, G5=783.99Hz)
      const freqs = level === 'critical' ? [523.25, 659.25, 783.99] : [523.25, 659.25];
      const volume = level === 'critical' ? 0.45 : 0.30;

      freqs.forEach((freq, idx) => {
        const start = now + idx * 0.16;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.50);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.55);
      });

      if (vibrate && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          if (userGestureActive) {
            navigator.vibrate([100, 60, 100]);
          }
        } catch (_) {}
      }
    } else {
      // High Urgency: Piercing, loud insistent pulse for noisy environments (880Hz, 1046.5Hz, 1318.5Hz)
      const freqs = level === 'critical' ? [880, 1046.5, 880, 1046.5] : [880, 1046.5];
      const volume = level === 'critical' ? 0.85 : 0.65;

      freqs.forEach((freq, idx) => {
        const start = now + idx * 0.11;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.16);
      });

      if (vibrate && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          if (userGestureActive) {
            navigator.vibrate([250, 80, 250, 80, 250]);
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[ALAGA Alert Engine] Sound playback notice:', err);
  }
}

/**
 * Plays a quick 1-second sample tone specifically for testing/previewing in Settings.
 */
export function playAlertToneSample(tone: 'gentle' | 'high'): void {
  playAlertTone('critical', tone);
}
