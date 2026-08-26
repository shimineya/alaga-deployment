import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { 
    Activity, 
    ShieldAlert, 
    Wifi, 
    Database, 
    Server, 
    Clock, 
    AlertTriangle, 
    Trash2,
    ShieldCheck,
    RefreshCw,
    Search,
    X
} from "lucide-react";
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface SecurityEvent {
    timestamp: string;
    action: string;
    severity: string;
    resource_affected: string;
    username: string;
    ip_address: string;
}

interface BannedIp {
    id: number;
    ip_address: string;
    reason: string;
    banned_at: string;
}

interface StatsData {
    total_patients: number;
    critical_alerts: number;
    online_devices: number;
    pending_users: number;
    total_facilities: number;
    active_overrides: number;
    pending_erasure: number;
    db_size: string;
    db_connections: number;
    total_devices: number;
    offline_devices: number;
    system_status: string;
    uptime: number;
}

export default function CommandCenterDashboard() {
    const { token } = useAuth();
    
    // States
    const [stats, setStats] = useState<StatsData | null>(null);
    const [siemFeed, setSiemFeed] = useState<SecurityEvent[]>([]);
    const [blacklist, setBlacklist] = useState<BannedIp[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // IP Ban Modal State
    const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
    const [banIp, setBanIp] = useState('');
    const [banReason, setBanReason] = useState('');
    const [isBanning, setIsBanning] = useState(false);
 
    // Search & Suggestions States
    const [blacklistSearchQuery, setBlacklistSearchQuery] = useState('');
    const [showBlacklistSuggestions, setShowBlacklistSuggestions] = useState(false);
    const blacklistSearchRef = React.useRef<HTMLDivElement>(null);
 
    const [siemSearchQuery, setSiemSearchQuery] = useState('');
    const [showSiemSuggestions, setShowSiemSuggestions] = useState(false);
    const siemSearchRef = React.useRef<HTMLDivElement>(null);
 
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (blacklistSearchRef.current && !blacklistSearchRef.current.contains(event.target as Node)) {
                setShowBlacklistSuggestions(false);
            }
            if (siemSearchRef.current && !siemSearchRef.current.contains(event.target as Node)) {
                setShowSiemSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
 
    const filteredBlacklist = useMemo(() => {
        return blacklist.filter(item => 
            item.ip_address.toLowerCase().includes(blacklistSearchQuery.toLowerCase()) ||
            (item.reason || '').toLowerCase().includes(blacklistSearchQuery.toLowerCase())
        );
    }, [blacklist, blacklistSearchQuery]);
 
    const filteredSiemFeed = useMemo(() => {
        return siemFeed.filter(event => 
            (event.action || '').toLowerCase().includes(siemSearchQuery.toLowerCase()) ||
            (event.ip_address || '').toLowerCase().includes(siemSearchQuery.toLowerCase()) ||
            (event.username || '').toLowerCase().includes(siemSearchQuery.toLowerCase()) ||
            (event.resource_affected || '').toLowerCase().includes(siemSearchQuery.toLowerCase())
        );
    }, [siemFeed, siemSearchQuery]);

    const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
    const getHeaders = () => ({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    });

    // Fetch dashboard telemetry
    const fetchDashboardData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        else setIsRefreshing(true);

        try {
            // 1. Fetch system stats
            const statsRes = await fetch(`${API_BASE}/stats`, { headers: getHeaders() });
            const statsData = await statsRes.json();
            if (statsData.success) {
                setStats(statsData.data);
            }

            // 2. Fetch recent security logs
            const securityRes = await fetch(`${API_BASE}/security-events`, { headers: getHeaders() });
            const securityData = await securityRes.json();
            if (securityData.success) {
                setSiemFeed(securityData.data || []);
            }

            // 3. Fetch blacklisted IPs
            const blacklistRes = await fetch(`${API_BASE}/security/ip-whitelist`, { headers: getHeaders() });
            const blacklistData = await blacklistRes.json();
            if (blacklistData.success) {
                setBlacklist(blacklistData.data || []);
            }

        } catch (err) {
            toast.error("Failed to synchronize Command Center dashboard stats.");
            console.error("Dashboard Sync Error:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchDashboardData();
        }
    }, [token]);

    // Handle Unbanning an IP
    const handleUnban = async (banId: number, ip: string) => {
        if (!window.confirm(`Are you sure you want to remove the access block for IP address ${ip}?`)) {
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/security/ip-ban/${banId}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`IP Address ${ip} unblocked successfully.`);
                setBlacklist(prev => prev.filter(item => item.id !== banId));
            } else {
                toast.error(data.message || "Failed to unblock IP.");
            }
        } catch {
            toast.error("Network error: Failed to unblock IP.");
        }
    };

    // Handle Banning an IP
    const handleBan = async () => {
        if (!banIp.trim()) {
            toast.error("Please enter a valid IP address.");
            return;
        }

        setIsBanning(true);
        try {
            const res = await fetch(`${API_BASE}/security/ip-ban`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    ip: banIp.trim(),
                    reason: banReason.trim() || 'Manual ban by System Admin'
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`IP Address ${banIp.trim()} blocked successfully.`);
                setBanIp('');
                setBanReason('');
                setIsBanDialogOpen(false);
                fetchDashboardData(true);
            } else {
                toast.error(data.message || "Failed to block IP.");
            }
        } catch {
            toast.error("Network error: Failed to block IP.");
        } finally {
            setIsBanning(false);
        }
    };

    const getSeverityBadge = (severity: string) => {
        const s = severity?.toLowerCase();
        switch (s) {
            case 'critical':
            case 'high': 
                return <Badge variant="destructive">High</Badge>;
            case 'warning':
            case 'medium': 
                return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">Medium</Badge>;
            case 'info': 
                return <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">Info</Badge>;
            default: 
                return <Badge variant="outline">Info</Badge>;
        }
    };

    const getStatusText = (status: string) => {
        const s = status?.toLowerCase();
        if (s === 'blocked' || s === 'failure' || s === 'error') {
            return <span className="text-red-600 font-medium capitalize">{status}</span>;
        } else if (s === 'warning' || s === 'alert') {
            return <span className="text-amber-600 font-medium capitalize">{status}</span>;
        } else {
            return <span className="text-emerald-600 font-medium capitalize">{status || 'Success'}</span>;
        }
    };

    const formatUptime = (seconds: number) => {
        if (!seconds) return "0s";
        const d = Math.floor(seconds / (3600*24));
        const h = Math.floor((seconds % (3600*24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] gap-2">
                <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
                <p className="text-xs text-slate-500">Synchronizing global command center telemetry...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight">Command Center Dashboard</h2>
                    <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Aggregated Global Telemetry. PHI access is restricted in this zone.
                    </p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={isRefreshing}
                    onClick={() => fetchDashboardData(true)}
                    className="h-8 text-xs font-semibold"
                >
                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Sync Dashboard
                </Button>
            </div>

            {/* Section 1: Critical Operational KPIs (Top Row) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* System Uptime */}
                <Card className="bg-white border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0">
                        <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">System Uptime</CardTitle>
                        <Server className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="text-xl font-bold text-slate-800">
                            {stats ? formatUptime(stats.uptime) : '99.98%'}
                        </div>
                    </CardContent>
                </Card>

                {/* Active Emergency Access */}
                <Card className="bg-white border border-red-200 border-l-4 border-l-red-500 shadow-sm bg-red-50/50">
                    <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0">
                        <CardTitle className="text-[11px] font-medium text-red-800 uppercase tracking-wider">Active Break-Glass Overrides</CardTitle>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="cursor-help"><ShieldAlert className="h-4 w-4 text-red-600" /></div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>HIPAA Guardrail: Indicates an IT administrator currently has used an emergency override to view restricted patient health records.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="text-xl font-bold text-red-600">
                            {stats ? stats.active_overrides : 0} Active
                        </div>
                    </CardContent>
                </Card>

                {/* Global API Latency */}
                <Card className="bg-white border border-slate-200 border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0">
                        <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Estimated API Latency</CardTitle>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="cursor-help"><Activity className="h-4 w-4 text-blue-500" /></div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>Average time for the system to process sensor data and trigger the SVM anomaly algorithm.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="text-xl font-bold text-slate-800">12ms</div>
                    </CardContent>
                </Card>

                {/* Pending Data Erasure */}
                <Card className="bg-white border border-slate-200 border-l-4 border-l-amber-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0">
                        <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Archived Items (Pending Erasure)</CardTitle>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="cursor-help"><Trash2 className="h-4 w-4 text-amber-500" /></div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>DPA/GDPR Compliance: Patient, user, and device records stored in the central archive hub waiting for hard deletion.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="text-xl font-bold text-slate-800">
                            {stats ? stats.pending_erasure : 0} Items
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Section 2: IoT Fleet & Infrastructure (Middle Row) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Hardware Fleet Status */}
                <Card className="shadow-sm bg-white border border-slate-200">
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="flex items-center gap-2 text-sm text-slate-700">
                            <Wifi className="w-4 h-4 text-slate-500" />
                            Hardware Fleet Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-500">Total Registered Devices</span>
                                <span className="font-semibold text-base">{stats ? stats.total_devices : 0}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="text-xs font-medium text-emerald-600 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active Whitelist</span>
                                <span className="font-semibold text-xs">{stats ? stats.online_devices : 0}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="text-xs font-medium text-slate-500 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactive Fleet</span>
                                <span className="font-semibold text-xs">{stats ? stats.offline_devices : 0}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="text-xs font-medium text-amber-600 flex items-center gap-2">
                                    <AlertTriangle className="w-3 h-3" />
                                    Warning Flags
                                </span>
                                <span className="font-semibold text-xs text-amber-600">0</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Database & Storage Health */}
                <Card className="shadow-sm bg-white border border-slate-200">
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="flex items-center gap-2 text-sm text-slate-700">
                            <Database className="w-4 h-4 text-slate-500" />
                            Database &amp; Storage Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-500">Total Database Size</span>
                                <span className="font-semibold text-base">{stats ? stats.db_size : '1.2 MB'}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="text-xs font-medium text-slate-600">Active Database Connections</span>
                                <span className="font-semibold text-xs">{stats ? stats.db_connections : 0}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="text-xs font-medium text-slate-600">Active Facilities</span>
                                <span className="font-semibold text-xs">{stats ? stats.total_facilities : 0} Hospital(s)</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Section 3: Firewall IP Blacklist Manager */}
            <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b bg-white">
                    <div>
                        <CardTitle className="text-slate-800 flex items-center gap-2 text-sm">
                            <ShieldAlert className="w-4 h-4 text-rose-500" />
                            Firewall Access Blocks (IP Blacklist)
                        </CardTitle>
                        <CardDescription className="text-[10px] text-slate-500">
                            Prevent specific IP addresses from making requests to the facility servers.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {/* Blacklist Search with suggestions */}
                        <div className="relative w-full sm:w-48" ref={blacklistSearchRef}>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search blocked IPs..."
                                    value={blacklistSearchQuery}
                                    onChange={(e) => {
                                        setBlacklistSearchQuery(e.target.value);
                                        setShowBlacklistSuggestions(true);
                                    }}
                                    onFocus={() => setShowBlacklistSuggestions(true)}
                                    className="w-full text-xs pl-7 pr-6 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 outline-none bg-white"
                                />
                                {blacklistSearchQuery && (
                                    <button 
                                        onClick={() => { setBlacklistSearchQuery(''); setShowBlacklistSuggestions(false); }}
                                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            
                            {showBlacklistSuggestions && blacklistSearchQuery && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-50">
                                    {blacklist.filter(b => b.ip_address.includes(blacklistSearchQuery) || (b.reason || '').toLowerCase().includes(blacklistSearchQuery.toLowerCase())).length === 0 ? (
                                        <div className="p-2 text-[10px] text-slate-400 italic">No matches</div>
                                    ) : (
                                        blacklist
                                            .filter(b => b.ip_address.includes(blacklistSearchQuery) || (b.reason || '').toLowerCase().includes(blacklistSearchQuery.toLowerCase()))
                                            .map(b => (
                                                <button
                                                    key={b.id}
                                                    onClick={() => {
                                                        setBlacklistSearchQuery(b.ip_address);
                                                        setShowBlacklistSuggestions(false);
                                                    }}
                                                    className="w-full text-left px-2 py-1.5 text-[10px] hover:bg-rose-50 text-slate-700 hover:text-rose-900 transition-colors font-medium flex justify-between"
                                                >
                                                    <span className="font-mono">{b.ip_address}</span>
                                                    <span className="truncate max-w-[80px] text-slate-400 font-normal">{b.reason}</span>
                                                </button>
                                            ))
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <Button 
                            size="sm" 
                            onClick={() => setIsBanDialogOpen(true)}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 whitespace-nowrap"
                        >
                            Block IP
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="text-xs">IP Address</TableHead>
                                <TableHead className="text-xs">Reason for Block</TableHead>
                                <TableHead className="text-xs">Blocked At</TableHead>
                                <TableHead className="w-[120px] text-right text-xs">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredBlacklist.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-6 text-xs text-slate-400 italic">
                                        No IP addresses matching search query.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredBlacklist.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-slate-50/50 text-xs">
                                        <TableCell className="font-mono text-xs font-semibold text-rose-700">{item.ip_address}</TableCell>
                                        <TableCell className="text-slate-600">{item.reason}</TableCell>
                                        <TableCell className="font-mono text-slate-500">
                                            {new Date(item.banned_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleUnban(item.id, item.ip_address)}
                                                className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 h-7 px-2"
                                            >
                                                Remove Block
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Section 4: SIEM Feed (Bottom Row) */}
            <Card className="border-slate-800 shadow-sm bg-white">
                <CardHeader className="bg-slate-900 border-b border-slate-800 rounded-t-lg pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-slate-100 flex items-center gap-2 text-sm font-semibold">
                            <ShieldAlert className="w-5 h-5 text-amber-500" />
                            Security Information &amp; Event Management (SIEM)
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            Live logs of critical access trails and authentication records.
                        </CardDescription>
                    </div>

                    {/* SIEM Search with suggestions */}
                    <div className="relative w-full sm:w-56" ref={siemSearchRef}>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                value={siemSearchQuery}
                                onChange={(e) => {
                                    setSiemSearchQuery(e.target.value);
                                    setShowSiemSuggestions(true);
                                }}
                                onFocus={() => setShowSiemSuggestions(true)}
                                className="w-full text-xs pl-7 pr-6 py-1.5 bg-slate-850 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none bg-slate-800"
                            />
                            {siemSearchQuery && (
                                <button 
                                    onClick={() => { setSiemSearchQuery(''); setShowSiemSuggestions(false); }}
                                    className="absolute right-2 top-2 text-slate-450 hover:text-slate-200"
                                >
                                    <X className="w-3 h-3 text-slate-400" />
                                </button>
                            )}
                        </div>

                        {showSiemSuggestions && siemSearchQuery && (
                            <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-800">
                                {siemFeed.filter(event => 
                                    (event.action || '').toLowerCase().includes(siemSearchQuery.toLowerCase()) || 
                                    (event.username || '').toLowerCase().includes(siemSearchQuery.toLowerCase()) ||
                                    (event.ip_address || '').toLowerCase().includes(siemSearchQuery.toLowerCase())
                                ).length === 0 ? (
                                    <div className="p-2 text-[10px] text-slate-500 italic">No matches</div>
                                ) : (
                                    siemFeed
                                        .filter(event => 
                                            (event.action || '').toLowerCase().includes(siemSearchQuery.toLowerCase()) || 
                                            (event.username || '').toLowerCase().includes(siemSearchQuery.toLowerCase()) ||
                                            (event.ip_address || '').toLowerCase().includes(siemSearchQuery.toLowerCase())
                                        )
                                        .map((event, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setSiemSearchQuery(event.action || '');
                                                    setShowSiemSuggestions(false);
                                                }}
                                                className="w-full text-left px-2 py-1.5 text-[10px] hover:bg-slate-805 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors font-medium flex justify-between bg-slate-900 border-none outline-none"
                                            >
                                                <span className="truncate max-w-[120px]">{event.action || 'System Log'}</span>
                                                <span className="font-mono text-slate-500 text-[9px]">{event.username || 'System'}</span>
                                            </button>
                                        ))
                                )}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="w-[180px] text-xs">Timestamp</TableHead>
                                <TableHead className="text-xs">Event Type</TableHead>
                                <TableHead className="text-xs">Severity</TableHead>
                                <TableHead className="text-xs">Resource Affected</TableHead>
                                <TableHead className="text-xs">User / Caller</TableHead>
                                <TableHead className="text-xs">IP Address</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSiemFeed.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-6 text-xs text-slate-400 italic">
                                        No security events matching search query.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSiemFeed.map((event, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/80 text-xs">
                                        <TableCell className="font-mono text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                {new Date(event.timestamp).toLocaleString()}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-700">{event.action}</TableCell>
                                        <TableCell>{getSeverityBadge(event.severity)}</TableCell>
                                        <TableCell className="text-slate-600">{event.resource_affected}</TableCell>
                                        <TableCell className="font-semibold text-slate-700">{event.username || 'System'}</TableCell>
                                        <TableCell className="font-mono text-slate-600">{event.ip_address || 'Localhost'}</TableCell>
                                        <TableCell>{getStatusText('Success')}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* BLOCK IP DIALOG */}
            <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
                <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800">Block Network IP Address</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Apply a global firewall block against a client IP address. All subsequent sessions from this IP will be rejected.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 text-xs">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">IP Address</label>
                            <input 
                                type="text"
                                placeholder="e.g. 192.168.1.105"
                                value={banIp}
                                onChange={(e) => setBanIp(e.target.value)}
                                className="w-full text-xs px-3 py-2 border rounded focus:ring-1 focus:ring-rose-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">Justification Reason</label>
                            <textarea 
                                placeholder="e.g. Multiple failed logins detected"
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                                className="w-full text-xs px-3 py-2 border rounded focus:ring-1 focus:ring-rose-500 outline-none min-h-[60px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsBanDialogOpen(false)}>Cancel</Button>
                        <Button 
                            size="sm" 
                            disabled={!banIp || isBanning}
                            onClick={handleBan}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {isBanning ? 'Blocking...' : 'Block IP'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
