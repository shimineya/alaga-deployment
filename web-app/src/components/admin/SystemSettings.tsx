import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
    Save,
    FileText,
    Activity,
    Database,
    AlertTriangle,
    Download,
    Megaphone,
    Trash2,
    Mail,
    Send
} from "lucide-react";

export default function SystemSettings() {
    const [loading, setLoading] = useState(false);

    // --- States ---

    // 1. Configs
    const [thresholds, setThresholds] = useState({ temp_min: 36.0, temp_max: 37.5, svm_sensitivity: 0.85 });
    const [maintenanceMode, setMaintenanceMode] = useState(false);

    // 2. Legal CMS
    const [privacyPolicy, setPrivacyPolicy] = useState({
        content: `ALAGA HEALTH CARE MONITORING SYSTEM - DATA PRIVACY & LEGAL BASELINES

1. DATA PROCESSING PRINCIPLES (RA 10173 § 11)
Patient vital signs telemetry (SpO2, heart rate, temperature) and caregiver access trails are processed strictly for clinical monitoring and emergency response. All telemetry is encrypted in transit and at rest.

2. GDPR COMPLIANT DATA RETENTION
Under GDPR Article 17, soft-deleted patient records are retained in an archival state for exactly 1 year to prevent accidental loss, after which they are permanently purged.

3. DPA PROPORTIONALITY LIMITS
Emergency "break-glass" access overrides must be justified. User audits store only access events to mitigate secondary risk vectors.`,
        version: "v1.2"
    });

    // 3. Broadcasts
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [newAnnouncement, setNewAnnouncement] = useState({ title: "", message: "" });

    // 4. Security Overrides (New)
    const [securityOverrides, setSecurityOverrides] = useState({
        session_timeout: 15,
        max_login_attempts: 5,
        password_expiry: 90,
        mfa_enforced: false
    });

    // 4. Email Config (New)
    const [smtp, setSmtp] = useState({ host: "smtp.gmail.com", port: 587, user: "", pass: "" });
    const [testEmail, setTestEmail] = useState("");

    // --- Initial Data Fetching ---
    const fetchAnnouncements = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/announcements`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setAnnouncements(data.data);
        } catch (err) {
            console.error("Failed to fetch announcements");
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { 'Authorization': `Bearer ${token}` };

                // 1. Fetch Configs (System + SMTP)
                const confRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/system-config`, { headers });
                const confData = await confRes.json();
                if (confData.success) {
                    if (confData.data.temp_thresholds) {
                        setThresholds({
                            temp_min: confData.data.temp_thresholds.min,
                            temp_max: confData.data.temp_thresholds.max,
                            svm_sensitivity: confData.data.svm_sensitivity?.value || 0.85
                        });
                    }
                    if (confData.data.maintenance_mode) {
                        setMaintenanceMode(confData.data.maintenance_mode.enabled || false);
                    }
                    if (confData.data.security_overrides) {
                        setSecurityOverrides({
                            session_timeout: confData.data.security_overrides.session_timeout || 15,
                            max_login_attempts: confData.data.security_overrides.max_login_attempts || 5,
                            password_expiry: confData.data.security_overrides.password_expiry || 90,
                            mfa_enforced: !!confData.data.security_overrides.mfa_enforced
                        });
                    }
                }

                // 2. Fetch Saved SMTP Settings
                const smtpRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/notifications/config`, { headers });
                const smtpData = await smtpRes.json();
                if (smtpData.success && smtpData.data.host) {
                    setSmtp(smtpData.data);
                }

                // 3. Fetch Legal
                const legalRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/legal-docs`, { headers });
                const legalData = await legalRes.json();
                if (legalData.success && legalData.data.length > 0) {
                    const policy = legalData.data.find((d: any) => d.doc_type === 'PRIVACY_POLICY');
                    if (policy) setPrivacyPolicy({ content: policy.content, version: policy.version });
                }

                // 4. Fetch Announcements
                await fetchAnnouncements();

            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, []);

    // --- Handlers ---

    // 1. Save Thresholds
    const saveThresholds = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await Promise.all([
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/system-config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ config_key: 'temp_thresholds', config_value: { min: thresholds.temp_min, max: thresholds.temp_max } })
                }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/system-config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ config_key: 'svm_sensitivity', config_value: { value: thresholds.svm_sensitivity } })
                })
            ]);
            toast.success("System Thresholds Updated");
        } catch (err) {
            toast.error("Failed to update config");
        } finally {
            setLoading(false);
        }
    };

    // 2. Save Security Overrides
    const saveSecurityOverrides = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/system-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ config_key: 'security_overrides', config_value: securityOverrides })
            });
            toast.success("Security Overrides Updated");
        } catch (err) {
            toast.error("Failed to update security overrides");
        } finally {
            setLoading(false);
        }
    };

    // 3. Save Privacy Policy
    const savePrivacyPolicy = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/legal-docs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    doc_type: 'PRIVACY_POLICY',
                    title: 'Data Privacy Policy',
                    content: privacyPolicy.content,
                    version: privacyPolicy.version
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Data Privacy Policy Published");
            } else {
                toast.error(data.message || "Failed to publish policy");
            }
        } catch {
            toast.error("Failed to publish policy");
        } finally {
            setLoading(false);
        }
    };

    // 2. Toggle Maintenance
    const toggleMaintenance = async (enabled: boolean) => {
        if (enabled && !confirm("Warning: This will block ALL non-admin users from accessing the system. Proceed?")) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/maintenance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ enabled })
            });
            setMaintenanceMode(enabled);
            toast.success(enabled ? "System is now UNDER MAINTENANCE" : "System is LIVE");
        } catch (err) {
            toast.error("Failed to toggle mode");
        }
    };

    // 3. Download Backup
    const downloadBackup = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/backup`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Alaga_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast.success("Database Backup Downloaded");
        } catch (err) {
            toast.error("Backup Failed");
        }
    };

    // 4. Post Announcement
    const postAnnouncement = async () => {
        if (!newAnnouncement.title || !newAnnouncement.message) {
            toast.error("Please fill in both title and message");
            return;
        }
        try {
            const token = localStorage.getItem('token');
            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/announcements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newAnnouncement)
            });
            toast.success("Broadcast Sent");
            setNewAnnouncement({ title: "", message: "" });
            fetchAnnouncements();
        } catch (err) {
            toast.error("Failed to post announcement");
        }
    };

    // 5. Delete Announcement
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const deleteAnnouncement = async (id: number) => {
    if (!confirm("Delete this announcement?")) return;
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/api/admin/announcements/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.success("Deleted");
        fetchAnnouncements();
    } catch (err) {
        toast.error("Failed to delete");
    }
};

    // 6. Test Email (New)
    const handleTestEmail = async () => {
        if (!smtp.user || !smtp.pass || !testEmail) return toast.error("Missing SMTP details or Test Recipient");

        const toastId = toast.loading("Connecting to SMTP Server...");
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/notifications/test-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ...smtp, to: testEmail })
            });
            const data = await res.json();
            toast.dismiss(toastId);

            if (data.success) {
                toast.success("Email Sent Successfully!");
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            toast.dismiss(toastId);
            toast.error("Connection Failed");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">System Configuration</h2>
                <p className="text-muted-foreground">Manage global variables, legal texts, and recovery tools.</p>
            </div>

            <Tabs defaultValue="thresholds" className="w-full">
                {/* CHANGED: grid-cols-5 to accommodate Email tab */}
                {/* FIX: Use flex-wrap instead of grid to prevent overlapping */}
                <TabsList className="flex flex-wrap w-full h-auto gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-2 rounded-lg justify-start">
                    <TabsTrigger
                        value="thresholds"
                        className="flex-1 min-w-[140px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700"
                    >
                        <Activity className="w-4 h-4 mr-2" /> Thresholds
                    </TabsTrigger>

                    <TabsTrigger
                        value="legal"
                        className="flex-1 min-w-[140px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700"
                    >
                        <FileText className="w-4 h-4 mr-2" /> Legal
                    </TabsTrigger>

                    <TabsTrigger
                        value="maintenance"
                        className="flex-1 min-w-[140px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-amber-700"
                    >
                        <Database className="w-4 h-4 mr-2" /> Recovery
                    </TabsTrigger>

                    <TabsTrigger
                        value="broadcast"
                        className="flex-1 min-w-[140px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700"
                    >
                        <Megaphone className="w-4 h-4 mr-2" /> Broadcast
                    </TabsTrigger>
                </TabsList>

                {/* --- TAB 1: THRESHOLDS --- */}
                <TabsContent value="thresholds" className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Vital Sign Parameters</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Min Temp (°C)</Label><Input type="number" value={thresholds.temp_min} onChange={(e) => setThresholds({ ...thresholds, temp_min: parseFloat(e.target.value) })} /></div>
                                <div className="space-y-2"><Label>Max Temp (°C)</Label><Input type="number" value={thresholds.temp_max} onChange={(e) => setThresholds({ ...thresholds, temp_max: parseFloat(e.target.value) })} /></div>
                            </div>
                            <Button onClick={saveThresholds} disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                                <Save className="w-4 h-4 mr-2" /> Save Configuration
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>System Overrides &amp; Security Baselines</CardTitle>
                            <CardDescription>Configure security timeout parameters and authentication rules.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Session Idle Timeout (Minutes)</Label>
                                    <Input
                                        type="number"
                                        value={securityOverrides.session_timeout}
                                        onChange={(e) => setSecurityOverrides({ ...securityOverrides, session_timeout: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Failed Login Attempts</Label>
                                    <Input
                                        type="number"
                                        value={securityOverrides.max_login_attempts}
                                        onChange={(e) => setSecurityOverrides({ ...securityOverrides, max_login_attempts: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Password Expiry Period (Days)</Label>
                                    <Input
                                        type="number"
                                        value={securityOverrides.password_expiry}
                                        onChange={(e) => setSecurityOverrides({ ...securityOverrides, password_expiry: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div>
                                        <Label className="font-semibold block">Enforce Staff MFA</Label>
                                        <span className="text-[9px] text-slate-400">Require multi-factor token login.</span>
                                    </div>
                                    <Switch
                                        checked={securityOverrides.mfa_enforced}
                                        onCheckedChange={(val) => setSecurityOverrides({ ...securityOverrides, mfa_enforced: val })}
                                    />
                                </div>
                            </div>
                            <Button onClick={saveSecurityOverrides} disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                                <Save className="w-4 h-4 mr-2" /> Save Overrides
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- TAB 2: LEGAL CMS --- */}
                <TabsContent value="legal">
                    <Card>
                        <CardHeader><CardTitle>Data Privacy Policy (CMS)</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Policy Version Label</Label>
                                <Input
                                    value={privacyPolicy.version}
                                    onChange={(e) => setPrivacyPolicy({ ...privacyPolicy, version: e.target.value })}
                                    placeholder="e.g. v1.2"
                                    className="w-32"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Content</Label>
                                <Textarea value={privacyPolicy.content} onChange={(e) => setPrivacyPolicy({ ...privacyPolicy, content: e.target.value })} className="h-64" />
                            </div>
                            <Button onClick={savePrivacyPolicy} disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                                <Save className="w-4 h-4 mr-2" /> Publish Privacy Policy
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- TAB 3: MAINTENANCE --- */}
                <TabsContent value="maintenance">
                    <div className="grid gap-6">
                        <Card className="border-l-4 border-l-blue-500">
                            <CardHeader>
                                <CardTitle>Disaster Recovery</CardTitle>
                                <CardDescription>Export a full JSON snapshot of the database.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="outline" onClick={downloadBackup}>
                                    <Download className="w-4 h-4 mr-2" /> Download Full System Backup
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-amber-500">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-amber-600" /> Maintenance Mode
                                        </CardTitle>
                                        <CardDescription>Only Admins can log in when enabled.</CardDescription>
                                    </div>
                                    <Switch checked={maintenanceMode} onCheckedChange={toggleMaintenance} />
                                </div>
                            </CardHeader>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- TAB 4: BROADCASTS (Fixed Layout) --- */}
                <TabsContent value="broadcast">
                    <div className="grid gap-6">
                        {/* POSTING CARD */}
                        <Card className="border-l-4 border-l-blue-600 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Megaphone className="w-5 h-5 text-blue-600" />
                                    Post New Announcement
                                </CardTitle>
                                <CardDescription>
                                    Send a system-wide alert to the dashboard and mobile apps.
                                </CardDescription>
                            </CardHeader>

                            {/* Added 'pb-8' to ensure button isn't cut off */}
                            <CardContent className="space-y-6 pb-8">
                                <div className="space-y-2">
                                    <Label className="font-semibold">Announcement Title</Label>
                                    <Input
                                        placeholder="e.g. System Maintenance Scheduled"
                                        value={newAnnouncement.title}
                                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="font-semibold">Message Body</Label>
                                    <Textarea
                                        placeholder="We will be performing upgrades on..."
                                        value={newAnnouncement.message}
                                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                                        className="min-h-[120px]"
                                    />
                                </div>

                                {/* WRAPPER DIV ensures visibility */}
                                <div className="pt-2">
                                    <Button
                                        onClick={postAnnouncement}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-md transition-all active:scale-95"
                                    >
                                        <Megaphone className="w-4 h-4 mr-2" />
                                        Broadcast Now
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* LIST CARD */}
                        <Card>
                            <CardHeader><CardTitle>Active Broadcasts</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {announcements.length === 0 ? (
                                        <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed">
                                            <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-muted-foreground text-sm italic">No active announcements.</p>
                                        </div>
                                    ) : (
                                        announcements.map((a) => (
                                            <div key={a.id} className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                                                <div>
                                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{a.title}</h4>
                                                    <p className="text-sm text-muted-foreground mt-1">{a.message}</p>
                                                    <span className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                                        <Activity className="w-3 h-3" />
                                                        Posted on {new Date(a.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => deleteAnnouncement(a.id)} className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}