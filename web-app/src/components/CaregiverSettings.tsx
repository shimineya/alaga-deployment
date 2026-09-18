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
  Volume2,
  BellRing,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const CaregiverSettings: React.FC = () => {
  const { t } = useCaregiverLanguage();

  const [isOtaChecking, setIsOtaChecking] = useState(false);

  const handleCheckOtaUpdates = async () => {
    setIsOtaChecking(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/caregiver/firmware/check`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setIsOtaChecking(false);

      if (data.success && data.update) {
        const update = data.update;
        const confirmUpdate = window.confirm(
          `${t(
            'New firmware update found: version',
            'May bagong firmware update: version'
          )} ${update.version} (${update.name}).\n\n${t(
            'Features:',
            'Mga Feature:'
          )} ${update.features}\n\n${t(
            'Would you like to update your connected devices?',
            'Gusto mo bang i-update ang iyong mga nakakonektang device?'
          )}`
        );

        if (confirmUpdate) {
          toast.loading(t('Initiating OTA update on your connected devices...', 'Sinisimulan ang OTA update sa iyong mga device...'));
          const updateRes = await fetch(`${API_BASE}/api/caregiver/firmware/update`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
            }
          });
          const updateData = await updateRes.json();
          if (updateData.success) {
            toast.dismiss();
            alert(
              t(
                `OTA Update successful! Updated ${updateData.updatedCount || 0} device(s) to version ${update.version}.`,
                `Matagumpay ang OTA Update! Na-update ang ${updateData.updatedCount || 0} device(s) sa bersyong ${update.version}.`
              )
            );
          } else {
            toast.dismiss();
            alert(updateData.message || t('Failed to run OTA update.', 'Hindi ma-run ang OTA update.'));
          }
        }
      } else {
        alert(t('No firmware updates found in database. All your devices are up to date.', 'Walang nahanap na firmware update sa database. Ang iyong mga device ay up to date.'));
      }
    } catch (err) {
      setIsOtaChecking(false);
      console.error(err);
      alert(t('Error searching for firmware updates.', 'Error sa paghahanap ng firmware update.'));
    }
  };

  // Alert preferences
  const [alertTone, setAlertTone] = useState<'gentle' | 'high'>('gentle');
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // Threshold safety nets (manual overrides)
  const [spo2Min, setSpo2Min] = useState(90);
  const [heartRateMin, setHeartRateMin] = useState(50);
  const [heartRateMax, setHeartRateMax] = useState(120);
  const [tempMin, setTempMin] = useState(36.0);
  const [tempMax, setTempMax] = useState(37.5);

  const token = localStorage.getItem('token');

  // Load saved preferences from localStorage / API
  useEffect(() => {
    const loadPreferences = async () => {
      // 1. Render localStorage immediately
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

      // 2. Fetch from DB for authority sync
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/api/user/profile/preferences`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.preferences) {
          const p = data.preferences;
          if (p.alertTone) setAlertTone(p.alertTone);
          if (typeof p.vibrationEnabled === 'boolean') setVibrationEnabled(p.vibrationEnabled);
          if (p.spo2Min != null) setSpo2Min(p.spo2Min);
          if (p.heartRateMin != null) setHeartRateMin(p.heartRateMin);
          if (p.heartRateMax != null) setHeartRateMax(p.heartRateMax);
          if (p.tempMin != null) setTempMin(p.tempMin);
          if (p.tempMax != null) setTempMax(p.tempMax);
          
          localStorage.setItem('alaga_caregiver_prefs', JSON.stringify(p));
        }
      } catch (err) {
        console.error("Failed to sync preferences with database:", err);
      }
    };

    loadPreferences();
  }, [token]);

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

    if (!token) return;
    const delayDebounceId = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/api/user/profile/preferences`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            preferences: {
              alertTone,
              vibrationEnabled,
              spo2Min,
              heartRateMin,
              heartRateMax,
              tempMin,
              tempMax,
            }
          })
        });
      } catch (err) {
        console.error("Failed to write preferences to database:", err);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceId);
  }, [alertTone, vibrationEnabled, spo2Min, heartRateMin, heartRateMax, tempMin, tempMax, token]);

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
      <Card className="shadow-sm border-slate-200/80 overflow-hidden rounded-xl">
        <CardHeader className="py-3 px-4 bg-slate-50/70 border-b border-slate-100">
          <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-4 h-4 text-teal-600" />
            {t('Alert Preferences', 'Mga Kagustuhan sa Alert')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-slate-700">{t('Volume & tone', 'Lakas at tono')}</Label>
              <span className="text-[11px] font-medium text-slate-500">
                {alertTone === 'gentle'
                  ? t('Selected: Gentle Chime', 'Napili: Malumanay na tunog')
                  : t('Selected: High Urgency', 'Napili: Mataas na urgency')}
              </span>
            </div>

            <RadioGroup
              value={alertTone}
              onValueChange={(v) => setAlertTone(v as 'gentle' | 'high')}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {/* Option 1: Gentle Chime */}
              <label
                htmlFor="tone-gentle"
                className={`relative flex items-start gap-3.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 select-none ${
                  alertTone === 'gentle'
                    ? 'border-teal-600 bg-teal-50/80 shadow-xs ring-2 ring-teal-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="pt-0.5">
                  <RadioGroupItem
                    value="gentle"
                    id="tone-gentle"
                    className={`size-5 border-2 transition-colors ${
                      alertTone === 'gentle'
                        ? 'border-teal-600 text-teal-600 bg-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Volume2 className={`w-4 h-4 shrink-0 ${alertTone === 'gentle' ? 'text-teal-700' : 'text-slate-500'}`} />
                    <span className={`text-xs font-bold ${alertTone === 'gentle' ? 'text-teal-950' : 'text-slate-800'}`}>
                      {t('Gentle Chime (home)', 'Malumanay na tunog (bahay)')}
                    </span>
                    {alertTone === 'gentle' && (
                      <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-600 text-white">
                        <Check className="w-2.5 h-2.5" />
                        {t('Active', 'Aktibo')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {t('Soft, pleasant chime suitable for calm home environments.', 'Malumanay at mahinahong tunog na angkop sa tahimik na bahay.')}
                  </p>
                </div>
              </label>

              {/* Option 2: High Urgency */}
              <label
                htmlFor="tone-high"
                className={`relative flex items-start gap-3.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 select-none ${
                  alertTone === 'high'
                    ? 'border-amber-600 bg-amber-50/80 shadow-xs ring-2 ring-amber-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="pt-0.5">
                  <RadioGroupItem
                    value="high"
                    id="tone-high"
                    className={`size-5 border-2 transition-colors ${
                      alertTone === 'high'
                        ? 'border-amber-600 text-amber-600 bg-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <BellRing className={`w-4 h-4 shrink-0 ${alertTone === 'high' ? 'text-amber-700' : 'text-slate-500'}`} />
                    <span className={`text-xs font-bold ${alertTone === 'high' ? 'text-amber-950' : 'text-slate-800'}`}>
                      {t('High Urgency (noisy)', 'Mataas na urgency (maingay)')}
                    </span>
                    {alertTone === 'high' && (
                      <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-600 text-white">
                        <Check className="w-2.5 h-2.5" />
                        {t('Active', 'Aktibo')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {t('Louder, prominent alarm for busy facilities or noisy settings.', 'Mas malakas at kapansin-pansing tunog para sa maingay o abalang lugar.')}
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Vibration Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border shadow-2xs transition-colors ${
                vibrationEnabled ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-slate-200 text-slate-400'
              }`}>
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-800 cursor-pointer" htmlFor="vibration-toggle">
                  {t('Notification vibration (wearable/phone)', 'Vibration sa notipikasyon (wearable/phone)')}
                </Label>
                <p className="text-[11px] text-slate-500">
                  {vibrationEnabled
                    ? t('Vibration is enabled for incoming alerts', 'Naka-on ang vibration para sa mga alert')
                    : t('Vibration is disabled', 'Naka-off ang vibration')}
                </p>
              </div>
            </div>
            <Switch id="vibration-toggle" checked={vibrationEnabled} onCheckedChange={setVibrationEnabled} className="data-[state=checked]:bg-teal-600" />
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

      {/* 4. Firmware OTA Update */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            {t('Firmware Update (OTA)', 'Firmware Update (OTA)')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <p className="text-[11px] text-slate-500">
            {t('Search the database for new OTA firmware upgrades for your assigned patient devices.', 'Maghanap sa database ng mga bagong firmware upgrade para sa mga device ng iyong pasyente.')}
          </p>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white text-xs" onClick={handleCheckOtaUpdates} disabled={isOtaChecking}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isOtaChecking ? 'animate-spin' : ''}`} />
            {isOtaChecking ? t('Checking...', 'Naghahanap...') : t('Check for Updates', 'Maghanap ng Update')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
