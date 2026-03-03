import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Bell, Save } from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface Thresholds {
    spo2_min: string; heart_rate_min: string; heart_rate_max: string;
    moisture_sensitivity: string;
}

export default function AlertConfiguration() {
    const [thresholds, setThresholds] = useState<Thresholds>({
        spo2_min: '95', heart_rate_min: '60', heart_rate_max: '100', moisture_sensitivity: '70'
    });
    const [saving, setSaving] = useState(false);

    const fetchThresholds = async () => {
        try {
            const res = await fetch(`${API}/alerts/thresholds`, { headers: getAuth() });
            const data = await res.json();
            if (data.success && Object.keys(data.data).length > 0) {
                setThresholds(prev => ({ ...prev, ...data.data }));
            }
        } catch { /* Use defaults if fetch fails */ }
    };

    useEffect(() => { fetchThresholds(); }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/alerts/thresholds`, {
                method: 'PUT', headers: getAuth(),
                body: JSON.stringify(thresholds)
            });
            const data = await res.json();
            if (data.success) toast.success('Alert thresholds updated.');
            else toast.error(data.message);
        } catch { toast.error('Failed to save thresholds.'); }
        finally { setSaving(false); }
    };

    const fields = [
        {
            key: 'spo2_min', label: 'Minimum SpO2 (%)',
            tooltip: 'An alarm is triggered when blood oxygen saturation falls below this percentage. Clinical default is 95%.',
            min: 80, max: 99, unit: '%'
        },
        {
            key: 'heart_rate_min', label: 'Minimum Heart Rate (BPM)',
            tooltip: 'An alarm is triggered when heart rate falls below this value. Normal resting range is 60-100 BPM.',
            min: 30, max: 80, unit: 'BPM'
        },
        {
            key: 'heart_rate_max', label: 'Maximum Heart Rate (BPM)',
            tooltip: 'An alarm is triggered when heart rate exceeds this value.',
            min: 100, max: 220, unit: 'BPM'
        },
        {
            key: 'moisture_sensitivity', label: 'Diaper Moisture Sensitivity (%)',
            tooltip: 'The moisture level (0-100%) at which the diaper sensor triggers a change alert. Higher value = alert only when fully wet.',
            min: 10, max: 100, unit: '%'
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">Alert Configuration</h2>
                <p className="text-slate-500 text-sm mt-1">Set clinical alarm thresholds for all patients in your facility. These override global system defaults.</p>
            </div>

            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                        <Bell className="w-4 h-4 text-teal-600" /> Vital Sign &amp; Sensor Thresholds
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-xs">
                        Changes saved here apply to all active sensors in your facility. Individual patient overrides are configured via the SVM Baseline tool.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {fields.map(f => (
                            <div key={f.key}>
                                <label className="block text-sm font-medium text-slate-700 mb-0.5">{f.label}</label>
                                <p className="text-xs text-slate-500 mb-2">{f.tooltip}</p>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={f.min} max={f.max}
                                        value={thresholds[f.key as keyof Thresholds]}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThresholds(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        className="h-9 text-sm w-28"
                                    />
                                    <span className="text-xs text-slate-500">{f.unit}</span>
                                    <span className="text-xs text-slate-400">(Valid: {f.min}–{f.max})</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                        <Button onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Saving...' : 'Save Thresholds'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
