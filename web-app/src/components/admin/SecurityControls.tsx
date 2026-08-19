import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { API_URL } from "@/lib/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldAlert, Ban, Trash2, Save, Globe, Lock } from "lucide-react";

export default function SecurityControls() {
    const [blacklist, setBlacklist] = useState<any[]>([]);
    const [rateLimit, setRateLimit] = useState({ windowMs: 900000, max: 100 });

    // Form State
    const [newIp, setNewIp] = useState("");
    const [banReason, setBanReason] = useState("");

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/security`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setBlacklist(data.data.blacklist);
                setRateLimit(data.data.rateLimit);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleBanIp = async () => {
        if (!newIp) return toast.error("Enter an IP Address");
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/security/ip-ban`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ip: newIp, reason: banReason || "Manual Ban" })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("IP Banned");
                setNewIp(""); setBanReason("");
                fetchData();
            } else {
                toast.error(data.message);
            }
        } catch (err) { toast.error("Failed to ban IP"); }
    };

const handleUnban = async (id: number) => {
    if (!confirm("Unban this IP?")) return;
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/api/admin/security/ip-ban/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.success("IP Unbanned");
        fetchData();
    } catch (err) { toast.error("Failed"); }
};

    const saveRateLimit = async () => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/security/rate-limit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(rateLimit)
            });
            toast.success("Rate Limits Saved");
        } catch (err) { toast.error("Failed to save"); }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Security Controls</h2>
                <p className="text-muted-foreground">Manage network traffic, block malicious IPs, and set API limits.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* --- LEFT: RATE LIMIT CONFIG --- */}
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="w-5 h-5 text-blue-600" /> Global Rate Limiting
                        </CardTitle>
                        <CardDescription>Defend against DDoS and brute-force attacks.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Time Window (ms)</label>
                            <Input
                                type="number"
                                value={rateLimit.windowMs}
                                onChange={(e) => setRateLimit({ ...rateLimit, windowMs: parseInt(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">Default: 900000 (15 mins)</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Max Requests per IP</label>
                            <Input
                                type="number"
                                value={rateLimit.max}
                                onChange={(e) => setRateLimit({ ...rateLimit, max: parseInt(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">Standard: 100 requests</p>
                        </div>
                        <Button onClick={saveRateLimit} className="w-full bg-slate-800 hover:bg-slate-700">
                            <Save className="w-4 h-4 mr-2" /> Update Configuration
                        </Button>
                    </CardContent>
                </Card>

                {/* --- RIGHT: IP BAN FORM --- */}
                <Card className="h-fit border-l-4 border-l-red-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Ban className="w-5 h-5 text-red-600" /> IP Firewall
                        </CardTitle>
                        <CardDescription>Permanently block suspicious IP addresses.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">IP Address</label>
                            <Input
                                placeholder="192.168.1.1"
                                value={newIp}
                                onChange={(e) => setNewIp(e.target.value)}
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Reason</label>
                            <Input
                                placeholder="Suspicious login attempts..."
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleBanIp} variant="destructive" className="w-full">
                            <ShieldAlert className="w-4 h-4 mr-2" /> Ban IP Address
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* --- BOTTOM: BAN LIST --- */}
            <Card>
                <CardHeader><CardTitle>Blacklisted IPs</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>IP Address</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Banned Date</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {blacklist.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                        No active bans. Network is clean.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                blacklist.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono">{item.ip_address}</TableCell>
                                        <TableCell>{item.reason}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {new Date(item.banned_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleUnban(item.id)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}