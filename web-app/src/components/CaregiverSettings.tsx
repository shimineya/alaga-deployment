import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { useCaregiverLanguage } from '../lib/caregiver-language-context';
import {
  Bell,
  Smartphone,
  Shield,
  RefreshCw,
  Languages,
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const CaregiverSettings: React.FC = () => {
  const { language, setLanguage, t } = useCaregiverLanguage();

  // Alert preferences
  const [alertTone, setAlertTone] = useState<'gentle' | 'high'>('gentle');
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // Threshold safety nets (manual overrides)
  const [spo2Min, setSpo2Min] = useState(90);
  const [heartRateMin, setHeartRateMin] = useState(50);
  const [heartRateMax, setHeartRateMax] = useState(120);
  const [tempMin, setTempMin] = useState(36.0);
  const [tempMax, setTempMax] = useState(37.5);

  // Load saved preferences from localStorage / API
  useEffect(() => {
    try {
      const prefs = localStorage.getItem('alaga_caregiver_prefs');
      if (prefs) {
        const p = JSON.parse(prefs);
        if (p.alertTone) setAlertTone(p.alertTone);
        if (typeof p.vibrationEnabled === 'boolean') setVibrationEnabled(p.vibrationEnabled);
        if (p.spo2Min != null) setSpo2Min(p.spo2Min);
        if (p.heartRateMin != null) setHeartRateMin(p.heartRateMin);
        if (p.heartRateMax != null) setHeartRateMax(p.heartRateMax);
        if (p.tempMin != null) setTempMin(p.tempMin);
        if (p.tempMax != null) setTempMax(p.tempMax);
      }
    } catch {}
  }, []);

  const savePrefs = () => {
    try {
      localStorage.setItem(
        'alaga_caregiver_prefs',
        JSON.stringify({
          alertTone,
          vibrationEnabled,
          spo2Min,
          heartRateMin,
          heartRateMax,
          tempMin,
          tempMax,
        })
      );
    } catch {}
  };

  useEffect(() => {
    savePrefs();
  }, [alertTone, vibrationEnabled, spo2Min, heartRateMin, heartRateMax, tempMin, tempMax]);

  const handleResetBaseline = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/caregiver/baseline/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success(t('Baseline reset started. New 24-hour learning phase active.', 'Sinimulan ang reset ng baseline. Aktibo na ang bagong 24-oras na learning phase.'));
      } else {
        toast.info(t('Baseline reset requested. Backend may not be connected.', 'Hiniling ang reset ng baseline. Maaaring hindi nakakonekta ang backend.'));
      }
    } catch {
      toast.info(t('Baseline reset requested. New 24-hour learning phase will start when devices sync.', 'Hiniling ang reset ng baseline. Mag-uumpisa ang bagong 24-oras na learning phase kapag naka-sync na ang mga device.'));
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">{t('Settings', 'Mga Setting')}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{t('Alert, device, and safety preferences.', 'Mga kagustuhan sa alert, device, at kaligtasan.')}</p>
      </div>

      {/* 1. Alert Preferences: Volume & Tone */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-teal-600" />
            {t('Alert Preferences', 'Mga Kagustuhan sa Alert')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <div>
            <Label className="text-[11px] text-slate-600">{t('Volume & tone', 'Lakas at tono')}</Label>
            <RadioGroup value={alertTone} onValueChange={(v) => setAlertTone(v as 'gentle' | 'high')} className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="gentle" className="size-3.5" />
                <span className="text-xs text-slate-700">{t('Gentle Chime (home)', 'Malumanay na tunog (bahay)')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="high" className="size-3.5" />
                <span className="text-xs text-slate-700">{t('High Urgency (noisy)', 'Mataas na urgency (maingay)')}</span>
              </label>
            </RadioGroup>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <Label className="text-[11px] text-slate-600">{t('Notification vibration (wearable/phone)', 'Vibration sa notipikasyon (wearable/phone)')}</Label>
            </div>
            <Switch checked={vibrationEnabled} onCheckedChange={setVibrationEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* 2. Baseline Calibration (AI Training) */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
            {t('Baseline calibration (AI training)', 'Baseline calibration (AI training)')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-[11px] text-slate-500 mb-2">
            {t('Use when the patient\'s health state changes significantly (e.g. after fever). Starts a new 24-hour learning phase for the OC-SVM algorithm.', 'Gamitin kapag malaki ang pagbabago sa kalusugan ng pasyente (hal. pagkatapos ng lagnat). Mag-uumpisa ng bagong 24-oras na learning phase para sa OC-SVM.')}
          </p>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleResetBaseline}>
            <RefreshCw className="w-3 h-3 mr-1.5" />
            {t('Reset baseline', 'I-reset ang baseline')}
          </Button>
        </CardContent>
      </Card>

      {/* 3. Threshold safety nets */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-rose-600" />
            {t('Threshold safety nets', 'Safety nets sa threshold')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-[11px] text-slate-500 mb-3">
            {t('Always alert if vital goes beyond these limits (manual override).', 'Laging mag-alert kung lumampas ang vital sa mga limiteng ito (manual override).')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px] text-slate-500">SpO₂ min (%)</Label>
              <Input type="number" min={70} max={100} value={spo2Min} onChange={(e) => setSpo2Min(Number(e.target.value) || 90)} className="h-7 text-xs mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">HR min (bpm)</Label>
              <Input type="number" min={30} max={100} value={heartRateMin} onChange={(e) => setHeartRateMin(Number(e.target.value) || 50)} className="h-7 text-xs mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">HR max (bpm)</Label>
              <Input type="number" min={80} max={200} value={heartRateMax} onChange={(e) => setHeartRateMax(Number(e.target.value) || 120)} className="h-7 text-xs mt-0.5" />
            </div>
            <div className="col-span-2 sm:col-span-2 flex gap-2">
              <div className="flex-1">
                <Label className="text-[10px] text-slate-500">Temp min (°C)</Label>
                <Input type="number" step={0.1} min={35} max={38} value={tempMin} onChange={(e) => setTempMin(Number(e.target.value) || 36)} className="h-7 text-xs mt-0.5" />
              </div>
              <div className="flex-1">
                <Label className="text-[10px] text-slate-500">Temp max (°C)</Label>
                <Input type="number" step={0.1} min={36} max={40} value={tempMax} onChange={(e) => setTempMax(Number(e.target.value) || 37.5)} className="h-7 text-xs mt-0.5" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Language & accessibility */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <Languages className="w-3.5 h-3.5 text-indigo-600" />
            {t('Language & accessibility', 'Wika at accessibility')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-slate-600">{t('Interface language', 'Wika ng interface')}</Label>
            <div className="flex rounded-md border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${language === 'en' ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('fil')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${language === 'fil' ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                Filipino
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
